/**
 * Append-only Run Log writer. One row per run attempt.
 */

import { createRecord } from '../airtable/client.js';
import { RunLogFieldIds, type RunLogEntry } from '../config/types.js';
import { logger } from './structured.js';

const COMMAND_CENTER_BASE = 'appnw60PZmruBD81U';
const RUN_LOG_TABLE = 'tblVZevifbtLu3dbU';

export async function appendRunLog(entry: RunLogEntry): Promise<void> {
  try {
    const fields: Record<string, unknown> = {
      [RunLogFieldIds.task]: [entry.taskId],
      [RunLogFieldIds.attempt]: entry.attempt,
      [RunLogFieldIds.startedAt]: entry.startedAt,
      [RunLogFieldIds.endedAt]: entry.endedAt,
      [RunLogFieldIds.outcome]: entry.outcome,
      [RunLogFieldIds.skillInvoked]: entry.skillInvoked,
      [RunLogFieldIds.agentIdentity]: entry.agentIdentity,
      [RunLogFieldIds.inputTokens]: entry.inputTokens,
      [RunLogFieldIds.outputTokens]: entry.outputTokens,
      [RunLogFieldIds.totalTokens]: entry.totalTokens,
      [RunLogFieldIds.error]: entry.error,
      [RunLogFieldIds.deliverableDestination]: entry.deliverableDestination,
      [RunLogFieldIds.destinationBaseId]: entry.destinationBaseId,
      [RunLogFieldIds.destinationRecordId]: entry.destinationRecordId,
      [RunLogFieldIds.driveUrl]: entry.driveUrl,
      [RunLogFieldIds.workspacePath]: entry.workspacePath,
    };
    await createRecord(COMMAND_CENTER_BASE, RUN_LOG_TABLE, fields);
    logger.debug({ taskId: entry.taskId, outcome: entry.outcome }, 'Run log written');
  } catch (err) {
    logger.error({ err, taskId: entry.taskId }, 'Failed to write run log');
  }
}
