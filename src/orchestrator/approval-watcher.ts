/**
 * The Approval Watcher. Runs once per tick after the dispatch loop. Reads each
 * Task in 'Awaiting Review', fetches the destination record, and decides whether
 * to mark the Task approved (Done) or rejected (back to Ready).
 *
 * Read-mostly: writes only to the Tasks table and the Run Log. Never writes to
 * destination records — humans own destination state.
 *
 * Idempotent: if a tick crashes mid-watcher, the next tick re-reads the live
 * destination state and converges. There is no per-watcher persistence.
 */

import type { Task, WorkflowConfig, DestinationConfig, RunOutcome, AgentIdentity } from '../config/types.js';
import { TRACK_TO_IDENTITY } from '../config/types.js';
import { fetchRecord } from '../airtable/client.js';
import { fetchAwaitingReviewTasks, markTaskApproved, markTaskRejected } from '../airtable/tasks.js';
import { appendRunLog } from '../logging/run-log.js';
import { taskLogger, logger } from '../logging/structured.js';

export type ApprovalDecision = 'approved' | 'rejected' | 'pending' | 'unknown';

/**
 * Pure function: given a destination's current status string and the destination
 * config, return whether the Task should be approved, rejected, or left pending.
 *
 * - 'approved'  → destination status equals destination.approval_status_value
 * - 'rejected'  → destination status equals destination.rejection_status_value (if set)
 * - 'unknown'   → destination is misconfigured (no approval_status_value)
 * - 'pending'   → anything else (still in review or back to draft)
 */
export function decideApprovalOutcome(
  destStatus: string | null,
  destination: DestinationConfig,
): ApprovalDecision {
  if (!destination.approval_status_value) return 'unknown';
  if (destStatus == null) return 'pending';
  if (destStatus === destination.approval_status_value) return 'approved';
  if (destination.rejection_status_value && destStatus === destination.rejection_status_value) {
    return 'rejected';
  }
  return 'pending';
}

/**
 * Read the Status field from a destination record. The destination config's
 * `initial_status_field` is a field NAME (not an ID), and the airtable.js
 * find() call returns fields keyed by name — they line up.
 */
function readDestStatus(
  destFields: Record<string, unknown>,
  destination: DestinationConfig,
): string | null {
  if (!destination.initial_status_field) return null;
  const raw = destFields[destination.initial_status_field];
  if (raw == null) return null;
  if (typeof raw === 'string') return raw;
  // Airtable singleSelect can come back as either a string or {id, name, color}
  if (typeof raw === 'object' && 'name' in raw) {
    return (raw as { name: string }).name;
  }
  return null;
}

/**
 * Process a single Awaiting Review task. Pure I/O — all decisions go through
 * decideApprovalOutcome above. Writes Tasks-table transition + Run Log row.
 */
async function processOneTask(task: Task, config: WorkflowConfig): Promise<ApprovalDecision> {
  const log = taskLogger(task.id);

  if (!task.skill) {
    log.warn('Awaiting Review task has no skill — skipping');
    return 'pending';
  }
  if (!task.destinationBaseId || !task.destinationTableId || !task.destinationRecordId) {
    log.warn('Awaiting Review task missing destination IDs — skipping');
    return 'pending';
  }

  const destination = config.destinations[task.skill];
  if (!destination) {
    log.warn({ skill: task.skill }, 'No destination config for skill — skipping');
    return 'pending';
  }

  const destFields = await fetchRecord(
    task.destinationBaseId,
    task.destinationTableId,
    task.destinationRecordId,
  );
  if (destFields == null) {
    log.warn({ destRecordId: task.destinationRecordId }, 'Destination record not found — skipping');
    return 'pending';
  }

  const destStatus = readDestStatus(destFields, destination);
  const decision = decideApprovalOutcome(destStatus, destination);

  log.info({ destStatus, decision }, 'Approval decision');

  if (decision === 'pending' || decision === 'unknown') return decision;

  const agentIdentity: AgentIdentity = task.track ? TRACK_TO_IDENTITY[task.track] : 'System';
  const now = new Date().toISOString();
  const outcome: RunOutcome = decision === 'approved' ? 'Approved' : 'Rejected';

  if (decision === 'approved') {
    await markTaskApproved(task.id);
  } else {
    await markTaskRejected(task.id, task.attemptCount);
  }

  await appendRunLog({
    taskId: task.id,
    attempt: task.attemptCount,
    startedAt: now,
    endedAt: now,
    outcome,
    skillInvoked: task.skill,
    agentIdentity,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    error: '',
    deliverableDestination: '',
    destinationBaseId: task.destinationBaseId,
    destinationRecordId: task.destinationRecordId,
    driveUrl: '',
    workspacePath: '',
  });

  return decision;
}

/**
 * Orchestration entry point. Fetches all Awaiting Review tasks, processes each
 * sequentially. Errors on a single task are logged but do not stop the batch —
 * the next tick retries naturally because the Task stays in Awaiting Review.
 */
export async function runApprovalWatcher(config: WorkflowConfig): Promise<{
  approved: number;
  rejected: number;
  pending: number;
  errors: number;
}> {
  const tasks = await fetchAwaitingReviewTasks();
  if (tasks.length === 0) {
    logger.info('Approval watcher: no awaiting-review tasks');
    return { approved: 0, rejected: 0, pending: 0, errors: 0 };
  }

  let approved = 0;
  let rejected = 0;
  let pending = 0;
  let errors = 0;

  for (const task of tasks) {
    try {
      const decision = await processOneTask(task, config);
      if (decision === 'approved') approved++;
      else if (decision === 'rejected') rejected++;
      else pending++;
    } catch (err) {
      errors++;
      logger.error({ err, taskId: task.id }, 'Approval watcher: error processing task');
    }
  }

  logger.info({ approved, rejected, pending, errors, total: tasks.length }, 'Approval watcher complete');
  return { approved, rejected, pending, errors };
}
