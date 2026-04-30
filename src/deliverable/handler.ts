/**
 * Deliverable handler. Routes by shape to the right write sequence:
 *
 *   airtable_only / create  -> create destination record with initial status
 *   airtable_only / update  -> update destination record (status untouched)
 *   airtable_plus_drive / create -> Drive upload first, then Airtable create
 *   airtable_plus_drive / update -> Drive upload, then Airtable update
 *   drive_only              -> Drive upload only, URL written back to task
 *
 * On success, returns the destination record ID and Drive URL (if any).
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Task, Deliverable, DestinationConfig, AgentOutput } from '../config/types.js';
import type { Workspace } from '../runner/workspace.js';
import { resolveFieldMap, resolveTargetRecordId } from './field-map.js';
import { uploadWorkspaceOutputs } from './drive.js';
import { createRecord, updateRecord } from '../airtable/client.js';
import { taskLogger } from '../logging/structured.js';
import { ValidationError } from '../config/types.js';

/**
 * Persist agent JSON output to the workspace as output.json. This gives us a
 * file artifact for Drive uploads even when the agent didn't produce file output
 * directly, and provides a debugging trail when cleanup_on_failure is false.
 */
function writeOutputArtifact(workspace: Workspace, output: AgentOutput): void {
  const path = join(workspace.outputsPath, 'output.json');
  writeFileSync(path, JSON.stringify(output, null, 2));
}

export interface HandlerResult {
  destinationBaseId: string;
  destinationTableId: string;
  destinationRecordId: string;
  driveUrl: string | null;
}

export async function handleDeliverable(
  task: Task,
  destination: DestinationConfig,
  output: AgentOutput,
  workspace: Workspace,
  driveRootFolderId: string,
): Promise<HandlerResult> {
  const log = taskLogger(task.id);
  log.info({ shape: destination.shape, write_mode: destination.write_mode }, 'Handling deliverable');

  writeOutputArtifact(workspace, output);

  let driveUrl: string | null = null;

  if (destination.shape === 'airtable_plus_drive' || destination.shape === 'drive_only') {
    const subfolderId = destination.drive_subfolder_id ?? driveRootFolderId;
    const result = await uploadWorkspaceOutputs(
      workspace.outputsPath,
      subfolderId,
      task.id,
      task.taskName,
    );
    driveUrl = result.folderUrl;
  }

  if (destination.shape === 'drive_only') {
    if (!driveUrl) {
      throw new ValidationError('drive_only shape produced no driveUrl', task.id);
    }
    return {
      destinationBaseId: '',
      destinationTableId: '',
      destinationRecordId: '',
      driveUrl,
    };
  }

  const fields = resolveFieldMap(
    destination.field_map,
    task,
    output,
    { driveUrl: driveUrl ?? undefined },
  );

  if (destination.write_mode === 'create') {
    if (destination.initial_status_field && destination.initial_status_value) {
      fields[destination.initial_status_field] = destination.initial_status_value;
    }
    const recordId = await createRecord(destination.base_id, destination.table_id, fields);
    log.info({ recordId, base_id: destination.base_id }, 'Destination record created');
    return {
      destinationBaseId: destination.base_id,
      destinationTableId: destination.table_id,
      destinationRecordId: recordId,
      driveUrl,
    };
  }

  if (destination.write_mode === 'update') {
    if (!destination.target_record_lookup) {
      throw new ValidationError('update mode requires target_record_lookup', task.id);
    }
    const targetId = resolveTargetRecordId(destination.target_record_lookup, task);
    const tableId = destination.table_id.startsWith('$')
      ? (resolveFieldMap({ table: destination.table_id }, task, output, { driveUrl: driveUrl ?? undefined }).table as string)
      : destination.table_id;

    await updateRecord(destination.base_id, tableId, targetId, fields);
    log.info({ recordId: targetId, base_id: destination.base_id }, 'Destination record updated');
    return {
      destinationBaseId: destination.base_id,
      destinationTableId: tableId,
      destinationRecordId: targetId,
      driveUrl,
    };
  }

  throw new ValidationError(`Unhandled write mode: ${destination.write_mode}`, task.id);
}

export function buildDeliverableSummary(
  task: Task,
  destination: DestinationConfig,
  recordId: string,
): string {
  return `${task.skill} / ${destination.base_id}:${destination.table_id}:${recordId}`;
}

export function toDeliverable(
  task: Task,
  destination: DestinationConfig,
  output: AgentOutput,
  result: HandlerResult,
  fieldValues: Record<string, unknown>,
): Deliverable {
  return {
    taskId: task.id,
    shape: destination.shape,
    destinationBaseId: result.destinationBaseId,
    destinationTableId: result.destinationTableId,
    destinationRecordId: result.destinationRecordId,
    driveUrl: result.driveUrl,
    agentOutput: output,
    fieldValues,
    createdAt: new Date().toISOString(),
  };
}
