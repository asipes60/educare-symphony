/**
 * Runs a single task through its complete lifecycle:
 *   PreparingWorkspace -> LoadingSkill -> BuildingPrompt -> CallingClaude
 *   -> ParsingOutput -> RunningGuardrails -> ResolvingDeliverable
 *   -> WritingDeliverable -> LinkingTask -> Succeeded/Failed
 *
 * In Block 6 dispatch-only scope: any failure terminates the run. Retries and
 * approval watching are deferred to Block 8.
 */

import type { Task, WorkflowConfig, RunLogEntry } from '../config/types.js';
import { TRACK_TO_IDENTITY, UnmappedSkillError } from '../config/types.js';
import { prepareWorkspace, cleanupWorkspace } from '../runner/workspace.js';
import { buildPrompt } from '../runner/prompt.js';
import { callClaude } from '../runner/claude.js';
import { handleDeliverable, buildDeliverableSummary } from '../deliverable/handler.js';
import { claimTask, completeTask, failTask } from '../airtable/tasks.js';
import { appendRunLog } from '../logging/run-log.js';
import { taskLogger } from '../logging/structured.js';

export async function runTask(task: Task, config: WorkflowConfig): Promise<void> {
  const log = taskLogger(task.id);
  const startedAt = new Date().toISOString();
  const attempt = task.attemptCount + 1;

  if (!task.skill) {
    await failTask(task.id, 'Task has no skill assigned');
    return;
  }
  if (!task.track) {
    await failTask(task.id, 'Task has no track assigned');
    return;
  }

  const destination = config.destinations[task.skill];
  if (!destination) {
    const err = new UnmappedSkillError(task.skill, task.id);
    await failTask(task.id, err.message);
    await writeRunLogEntry({
      taskId: task.id,
      attempt,
      startedAt,
      endedAt: new Date().toISOString(),
      outcome: 'Failed',
      skillInvoked: task.skill,
      agentIdentity: TRACK_TO_IDENTITY[task.track],
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      error: err.message,
      deliverableDestination: '',
      destinationBaseId: '',
      destinationRecordId: '',
      driveUrl: '',
      workspacePath: '',
    });
    return;
  }

  const workspace = prepareWorkspace(config.workspace.root, task.id, task.taskName);
  const agentIdentity = TRACK_TO_IDENTITY[task.track];

  let success = false;
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let errorMsg = '';
  let deliverableDestination = '';
  let destinationBaseId = '';
  let destinationRecordId = '';
  let driveUrl = '';

  try {
    await claimTask(task.id, attempt, workspace.rootPath);

    const { systemPrompt, userMessage } = buildPrompt(task, config);
    const claudeResult = await callClaude(systemPrompt, userMessage, config, task.id);
    inputTokens = claudeResult.inputTokens;
    outputTokens = claudeResult.outputTokens;
    totalTokens = claudeResult.totalTokens;

    const handlerResult = await handleDeliverable(
      task,
      destination,
      claudeResult.output,
      workspace,
      config.deliverables.drive_root_folder_id,
    );

    destinationBaseId = handlerResult.destinationBaseId;
    destinationRecordId = handlerResult.destinationRecordId;
    driveUrl = handlerResult.driveUrl ?? '';
    deliverableDestination = buildDeliverableSummary(task, destination, destinationRecordId);

    await completeTask(
      task.id,
      handlerResult.destinationBaseId,
      handlerResult.destinationTableId,
      handlerResult.destinationRecordId,
    );

    success = true;
    log.info({ recordId: destinationRecordId, driveUrl }, 'Task run succeeded');
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
    log.error({ err: errorMsg }, 'Task run failed');
    await failTask(task.id, errorMsg);
  } finally {
    cleanupWorkspace(
      workspace,
      success,
      config.workspace.cleanup_on_success,
      config.workspace.cleanup_on_failure,
    );

    await writeRunLogEntry({
      taskId: task.id,
      attempt,
      startedAt,
      endedAt: new Date().toISOString(),
      outcome: success ? 'Succeeded' : 'Failed',
      skillInvoked: task.skill,
      agentIdentity,
      inputTokens,
      outputTokens,
      totalTokens,
      error: errorMsg,
      deliverableDestination,
      destinationBaseId,
      destinationRecordId,
      driveUrl,
      workspacePath: workspace.rootPath,
    });
  }
}

async function writeRunLogEntry(entry: RunLogEntry): Promise<void> {
  await appendRunLog(entry);
}
