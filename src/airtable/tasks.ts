/**
 * Tasks table operations. Reads candidate tasks, normalizes Airtable's wire
 * format into the Task domain object, and writes orchestrator-owned fields back.
 */

import { getBase, updateRecord } from './client.js';
import {
  TasksFieldIds,
  type Task,
  type TaskStatus,
  type RunStatus,
  type Track,
  type Skill,
  type AgentIdentity,
  type DispatchMode,
} from '../config/types.js';
import { logger } from '../logging/structured.js';

const COMMAND_CENTER_BASE = 'appnw60PZmruBD81U';
const TASKS_TABLE = 'tblShDc3vpr23icRe';

/**
 * Convert Airtable's selectField objects to plain string values.
 * Airtable returns singleSelect as either a string (when written as string)
 * or an object {id, name, color}. Normalize both to string.
 */
function unwrapSelect(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'name' in value) {
    return (value as { name: string }).name;
  }
  return null;
}

function normalizeTask(record: { id: string; fields: Record<string, unknown> }): Task {
  const f = record.fields;
  return {
    id: record.id,
    taskName: (f[TasksFieldIds.taskName] as string) ?? '',
    status: (unwrapSelect(f[TasksFieldIds.status]) as TaskStatus) ?? 'Backlog',
    dispatchMode: unwrapSelect(f[TasksFieldIds.dispatchMode]) as DispatchMode | null,
    track: unwrapSelect(f[TasksFieldIds.track]) as Track | null,
    skill: unwrapSelect(f[TasksFieldIds.skill]) as Skill | null,
    priority: unwrapSelect(f[TasksFieldIds.priority]) as 'P1' | 'P2' | 'P3' | null,
    contentPillar: (f[TasksFieldIds.contentPillar] as string) ?? null,
    inputContext: (f[TasksFieldIds.inputContext] as string) ?? null,
    destinationBaseId: (f[TasksFieldIds.destinationBaseId] as string) ?? null,
    destinationTableId: (f[TasksFieldIds.destinationTableId] as string) ?? null,
    destinationRecordId: (f[TasksFieldIds.destinationRecordId] as string) ?? null,
    runStatus: unwrapSelect(f[TasksFieldIds.runStatus]) as RunStatus | null,
    workspacePath: (f[TasksFieldIds.workspacePath] as string) ?? null,
    attemptCount: (f[TasksFieldIds.attemptCount] as number) ?? 0,
    lastError: (f[TasksFieldIds.lastError] as string) ?? null,
    lastRunStarted: (f[TasksFieldIds.lastRunStarted] as string) ?? null,
    lastRunEnded: (f[TasksFieldIds.lastRunEnded] as string) ?? null,
    agentIdentity: unwrapSelect(f[TasksFieldIds.agentIdentity]) as AgentIdentity | null,
    approvedByHuman: Boolean(f[TasksFieldIds.approvedByHuman]),
  };
}

/**
 * Fetch all tasks currently in Ready status with Dispatch mode = Symphony.
 * The orchestrator filters further at the eligibility step (e.g., concurrency
 * limits, skill registration), but this is the initial candidate set.
 */
export async function fetchEligibleTasks(): Promise<Task[]> {
  const base = getBase(COMMAND_CENTER_BASE);
  const records: { id: string; fields: Record<string, unknown> }[] = [];

  await base(TASKS_TABLE)
    .select({
      filterByFormula: `AND({Status} = 'Ready', {Dispatch mode} = 'Symphony')`,
      pageSize: 100,
    })
    .eachPage((pageRecords, next) => {
      for (const r of pageRecords) {
        records.push({ id: r.id, fields: r.fields });
      }
      next();
    });

  logger.info({ count: records.length }, 'Fetched eligible tasks');
  return records.map(normalizeTask);
}

/**
 * Fetch a single task by ID.
 */
export async function fetchTask(taskId: string): Promise<Task | null> {
  try {
    const base = getBase(COMMAND_CENTER_BASE);
    const record = await base(TASKS_TABLE).find(taskId);
    return normalizeTask({ id: record.id, fields: record.fields });
  } catch (err) {
    logger.error({ err, taskId }, 'Failed to fetch task');
    return null;
  }
}

/**
 * Update orchestrator-owned fields on a Task.
 */
export async function updateTaskFields(
  taskId: string,
  fields: Partial<Record<keyof typeof TasksFieldIds, unknown>>,
): Promise<void> {
  const fieldMap: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    const fieldId = TasksFieldIds[key as keyof typeof TasksFieldIds];
    if (fieldId) {
      fieldMap[fieldId] = value;
    }
  }
  await updateRecord(COMMAND_CENTER_BASE, TASKS_TABLE, taskId, fieldMap);
}

/**
 * Mark a task as claimed for dispatch. Sets status, run status, attempt count,
 * and run start timestamp atomically (single Airtable write).
 */
export async function claimTask(taskId: string, attemptNumber: number, workspacePath: string): Promise<void> {
  await updateTaskFields(taskId, {
    status: 'In progress',
    runStatus: 'Running',
    attemptCount: attemptNumber,
    workspacePath,
    lastRunStarted: new Date().toISOString(),
    lastError: '',
  });
  logger.info({ taskId, attempt: attemptNumber }, 'Task claimed');
}

/**
 * Mark a task as succeeded and ready for human review. Writes destination
 * IDs back to the task and flips Status to Awaiting Review.
 */
export async function completeTask(
  taskId: string,
  destinationBaseId: string,
  destinationTableId: string,
  destinationRecordId: string,
): Promise<void> {
  await updateTaskFields(taskId, {
    status: 'Awaiting Review',
    runStatus: 'Succeeded',
    destinationBaseId,
    destinationTableId,
    destinationRecordId,
    lastRunEnded: new Date().toISOString(),
  });
  logger.info({ taskId, destinationRecordId }, 'Task completed and awaiting review');
}

/**
 * Mark a task as failed. In Block 6 dispatch-only scope, all failures terminate.
 * Block 8 will add retry logic that may set status back to Ready instead.
 */
export async function failTask(taskId: string, error: string): Promise<void> {
  await updateTaskFields(taskId, {
    status: 'Failed',
    runStatus: 'Failed',
    lastError: error,
    lastRunEnded: new Date().toISOString(),
  });
  logger.error({ taskId, error }, 'Task failed');
}
