/**
 * Symphony domain types. All runtime data flowing between modules conforms to these.
 */

import { z } from 'zod';

// ============================================================================
// Track and Skill enums
// ============================================================================

export const TrackSchema = z.enum(['NBCC', 'BACB', 'Ops', 'Code']);
export type Track = z.infer<typeof TrackSchema>;

export const SkillSchema = z.enum([
  'educare-linkedin-poster',
  'educare-blog-writer',
  'nbcc-course-creator',
  'bcba-course-creator',
  'educare-nbcc-course-auditor',
  'educare-course-page-copy',
  'educare-toolkit-builder',
  'educare-marketing',
]);
export type Skill = z.infer<typeof SkillSchema>;

export const AgentIdentitySchema = z.enum(['Adam', 'Marissa', 'System']);
export type AgentIdentity = z.infer<typeof AgentIdentitySchema>;

export const TaskStatusSchema = z.enum([
  'Backlog',
  'Ready',
  'In progress',
  'Awaiting Review',
  'Done',
  'Blocked',
  'Failed',
  'Archived',
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const RunStatusSchema = z.enum([
  'Unclaimed',
  'Claimed',
  'Running',
  'Succeeded',
  'Failed',
  'Released',
]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const DispatchModeSchema = z.enum(['Symphony', 'Manual']);
export type DispatchMode = z.infer<typeof DispatchModeSchema>;

// ============================================================================
// Task (normalized from Airtable)
// ============================================================================

export interface Task {
  id: string;
  taskName: string;
  status: TaskStatus;
  dispatchMode: DispatchMode | null;
  track: Track | null;
  skill: Skill | null;
  priority: 'P1' | 'P2' | 'P3' | null;
  contentPillar: string | null;
  inputContext: string | null;
  destinationBaseId: string | null;
  destinationTableId: string | null;
  destinationRecordId: string | null;
  runStatus: RunStatus | null;
  workspacePath: string | null;
  attemptCount: number;
  lastError: string | null;
  lastRunStarted: string | null;
  lastRunEnded: string | null;
  agentIdentity: AgentIdentity | null;
  approvedByHuman: boolean;
}

// ============================================================================
// Workflow config (parsed from WORKFLOW.md front matter)
// ============================================================================

export const DeliverableShapeSchema = z.enum([
  'airtable_only',
  'drive_only',
  'airtable_plus_drive',
]);
export type DeliverableShape = z.infer<typeof DeliverableShapeSchema>;

export const WriteModeSchema = z.enum(['create', 'update']);
export type WriteMode = z.infer<typeof WriteModeSchema>;

export const DestinationConfigSchema = z.object({
  shape: DeliverableShapeSchema,
  base_id: z.string(),
  table_id: z.string(),
  write_mode: WriteModeSchema,
  target_record_lookup: z.string().optional(),
  drive_subfolder_id: z.string().optional(),
  initial_status_field: z.string().nullable().optional(),
  initial_status_value: z.string().nullable().optional(),
  approval_status_value: z.string().nullable().optional(),
  field_map: z.record(z.string()),
});
export type DestinationConfig = z.infer<typeof DestinationConfigSchema>;

export const IdentityConfigSchema = z.object({
  name: z.string(),
  credentials: z.string(),
  voice: z.string(),
});
export type IdentityConfig = z.infer<typeof IdentityConfigSchema>;

export const WorkflowConfigSchema = z.object({
  tracker: z.object({
    kind: z.literal('airtable'),
    base_id: z.string(),
    tasks_table_id: z.string(),
    run_log_table_id: z.string(),
    api_key: z.string(),
    active_states: z.array(z.string()),
    terminal_states: z.array(z.string()),
    required_dispatch_mode: z.string().default('Symphony'),
  }),
  polling: z.object({
    interval_ms: z.number(),
  }),
  agent: z.object({
    max_concurrent_agents: z.number(),
    max_concurrent_agents_by_track: z.record(z.number()),
    max_attempts: z.number(),
    request_timeout_ms: z.number(),
  }),
  claude: z.object({
    api_endpoint: z.string(),
    model: z.string(),
    api_key: z.string(),
    max_tokens: z.number(),
    max_tokens_by_skill: z.record(z.number()).optional(),
  }),
  workspace: z.object({
    root: z.string(),
    cleanup_on_success: z.boolean(),
    cleanup_on_failure: z.boolean(),
  }),
  deliverables: z.object({
    drive_root_folder_id: z.string(),
    drive_service_account_env: z.string(),
  }),
  identities: z.record(IdentityConfigSchema),
  guardrails: z.object({
    nbcc_acep_status: z.enum(['pending', 'approved']),
    nbcc_acep_submitted_date: z.string().optional(),
    bacb_ace_provider_id: z.string(),
    bacb_ace_status: z.enum(['pending', 'approved']),
  }),
  destinations: z.record(DestinationConfigSchema),
});
export type WorkflowConfig = z.infer<typeof WorkflowConfigSchema>;

// ============================================================================
// Deliverable (produced by agent runner, consumed by deliverable handler)
// ============================================================================

export interface AgentOutput {
  [key: string]: unknown;
}

export interface Deliverable {
  taskId: string;
  shape: DeliverableShape;
  destinationBaseId: string;
  destinationTableId: string;
  destinationRecordId: string | null;
  driveUrl: string | null;
  agentOutput: AgentOutput;
  fieldValues: Record<string, unknown>;
  createdAt: string;
}

// ============================================================================
// Run Log entry
// ============================================================================

export type RunOutcome =
  | 'Succeeded'
  | 'Failed'
  | 'Timeout'
  | 'Stalled'
  | 'Cancelled'
  | 'Approved'
  | 'Rejected';

export interface RunLogEntry {
  taskId: string;
  attempt: number;
  startedAt: string;
  endedAt: string;
  outcome: RunOutcome;
  skillInvoked: string;
  agentIdentity: AgentIdentity;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  error: string;
  deliverableDestination: string;
  destinationBaseId: string;
  destinationRecordId: string;
  driveUrl: string;
  workspacePath: string;
}

// ============================================================================
// Tasks table field IDs (Command Center)
// ============================================================================

export const TasksFieldIds = {
  taskName: 'fldBDWhjRFoUXjstO',
  status: 'fldPGozB8j3nBfL8L',
  priority: 'fldvAP1ySw0TyK2Hq',
  dueDate: 'fldQXdToqyaFHMrot',
  notes: 'fldQvrdYdA526hAeL',
  track: 'fld3IIcwFhgsu9RPr',
  skill: 'fldH76cB3WLO3NOrh',
  contentPillar: 'fld6SmbDQ5oovYO3l',
  inputContext: 'fldTVfY9IpxgS8X6N',
  dispatchMode: 'flddOEmt3xtFsVuGs',
  destinationBaseId: 'fldSGCa5l6ncCwamY',
  destinationTableId: 'fldrn6f9h6DpJ2wei',
  destinationRecordId: 'fldXv95bPSvNFvOia',
  runStatus: 'fld1Ukswy7h6NwcZr',
  workspacePath: 'fldYi8QAH8lLvBnDr',
  attemptCount: 'fldS56GHs1GnjVmyo',
  lastError: 'flduYwzAcdTYnzEni',
  lastRunStarted: 'fld6lckghuaHDKvxY',
  lastRunEnded: 'fldTkuRUkajcSD7sb',
  agentIdentity: 'fldvpiyGLJyWGYPwQ',
  approvedByHuman: 'fldfoO7NmP0D7FRH7',
} as const;

// ============================================================================
// Run Log table field IDs (Command Center)
// ============================================================================

export const RunLogFieldIds = {
  task: 'fldCufawwwzpqy2kU',
  attempt: 'fldArk1Ylacf1Syjz',
  startedAt: 'fldHYaEXBPQfFroMd',
  endedAt: 'fldLjpknbFwd3Bpiq',
  outcome: 'fldT5arioGfQqQEQN',
  skillInvoked: 'fldZeMtRHdrTbq2I6',
  agentIdentity: 'fldg2KNC08N7NEy5h',
  inputTokens: 'fldT1CXxGHjENHGVU',
  outputTokens: 'flds8BCAwbUmaCC4m',
  totalTokens: 'fldNGZfbvFt6fFq17',
  error: 'fldKUV96Y7cq1y9Tx',
  deliverableDestination: 'fldJi0Qh9f0UCrUIC',
  destinationBaseId: 'fldBdzvwHSXdrahZq',
  destinationRecordId: 'fldaDFD4iMuseI8lj',
  driveUrl: 'fldJncfL9n38pjvkS',
  workspacePath: 'fldaOKBHNI9AZ9KHO',
} as const;

// ============================================================================
// Track to Agent Identity mapping
// ============================================================================

export const TRACK_TO_IDENTITY: Record<Track, AgentIdentity> = {
  NBCC: 'Adam',
  BACB: 'Marissa',
  Ops: 'System',
  Code: 'System',
};

// ============================================================================
// Errors
// ============================================================================

export class SymphonyError extends Error {
  constructor(
    message: string,
    public code: string,
    public taskId?: string,
  ) {
    super(message);
    this.name = 'SymphonyError';
  }
}

export class ValidationError extends SymphonyError {
  constructor(message: string, taskId?: string) {
    super(message, 'validation_error', taskId);
  }
}

export class UnmappedSkillError extends SymphonyError {
  constructor(skill: string, taskId?: string) {
    super(`No destination mapping for skill: ${skill}`, 'unmapped_skill', taskId);
  }
}

export class GuardrailError extends SymphonyError {
  constructor(message: string, taskId?: string) {
    super(message, 'guardrail_violation', taskId);
  }
}
