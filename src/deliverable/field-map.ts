/**
 * Resolves field map expressions defined in WORKFLOW.md.
 *
 * Supported expressions:
 *   $output.<key>      -- value from agent JSON output
 *   $task.<key>        -- value from the originating Task record
 *   $deliverable.<key> -- value computed during deliverable handling (e.g. drive_url)
 *   $now               -- current ISO timestamp
 *   <literal string>   -- used as-is
 *
 * Nested keys (e.g. $task.input_context.target_record_id) are supported via
 * dot-path traversal. For input_context specifically, the value may be a JSON
 * string containing structured data, in which case it is parsed and traversed.
 */

import type { Task, AgentOutput } from '../config/types.js';
import { ValidationError } from '../config/types.js';

export interface DeliverableContext {
  driveUrl?: string;
}

const TASK_LOOKUP_KEYS: Record<string, (t: Task) => unknown> = {
  task_name: (t) => t.taskName,
  track: (t) => t.track,
  skill: (t) => t.skill,
  content_pillar: (t) => t.contentPillar,
  priority: (t) => t.priority,
  agent_identity: (t) => t.agentIdentity,
  track_for_toolkit: (t) => t.track,
};

function getNestedValue(obj: unknown, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function resolveTaskExpression(task: Task, path: string[]): unknown {
  const head = path[0];
  if (!head) return undefined;

  if (head in TASK_LOOKUP_KEYS) {
    const fn = TASK_LOOKUP_KEYS[head]!;
    return fn(task);
  }

  if (head === 'input_context' && path.length > 1) {
    if (!task.inputContext) return undefined;
    const parsed = tryParseJson(task.inputContext);
    if (parsed && typeof parsed === 'object') {
      return getNestedValue(parsed, path.slice(1));
    }
    return parseInputContextLine(task.inputContext, path[1]!);
  }

  return undefined;
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * If input_context is plain text, allow simple key:value extraction.
 * Example line: "target_record_id: rec123ABC"
 */
function parseInputContextLine(text: string, key: string): string | undefined {
  const regex = new RegExp(`${key}\\s*:\\s*([^\\s,;\\n]+)`, 'i');
  const match = regex.exec(text);
  return match?.[1];
}

export function resolveFieldMap(
  fieldMap: Record<string, string>,
  task: Task,
  output: AgentOutput,
  context: DeliverableContext,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const [destField, expr] of Object.entries(fieldMap)) {
    resolved[destField] = resolveExpression(expr, task, output, context);
  }

  return resolved;
}

export function resolveExpression(
  expr: string,
  task: Task,
  output: AgentOutput,
  context: DeliverableContext,
): unknown {
  if (typeof expr !== 'string') return expr;

  if (expr === '$now') {
    // Return date-only string (YYYY-MM-DD) for compatibility with Airtable date fields.
    // dateTime fields also accept this format, so this works for both.
    return new Date().toISOString().split('T')[0];
  }

  if (expr.startsWith('$output.')) {
    const path = expr.substring('$output.'.length).split('.');
    return getNestedValue(output, path);
  }

  if (expr.startsWith('$task.')) {
    const path = expr.substring('$task.'.length).split('.');
    return resolveTaskExpression(task, path);
  }

  if (expr.startsWith('$deliverable.')) {
    const path = expr.substring('$deliverable.'.length).split('.');
    return getNestedValue(context, path);
  }

  return expr;
}

/**
 * Resolve the target_record_lookup expression for update-mode destinations.
 * The expression is a path like "task.input_context.target_record_id" (note:
 * no leading $ for this one, by spec convention).
 */
export function resolveTargetRecordId(lookupExpr: string, task: Task): string {
  const path = lookupExpr.split('.');
  if (path[0] !== 'task') {
    throw new ValidationError(`Unsupported target_record_lookup root: ${path[0]}`);
  }
  const value = resolveTaskExpression(task, path.slice(1));
  if (typeof value !== 'string' || !value.startsWith('rec')) {
    throw new ValidationError(
      `target_record_lookup did not resolve to a record ID. Got: ${String(value)}`,
      task.id,
    );
  }
  return value;
}
