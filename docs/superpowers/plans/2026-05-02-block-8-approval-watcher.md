# Block 8 — Approval Watcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Approval Watcher that runs each tick after dispatch, reads destination-record status for every Task in `Awaiting Review`, and transitions Tasks to `Done` (approved) or back to `Ready` (rejected) — writing only to the Tasks and Run Log tables, never to destination records.

**Architecture:** Pure decision function (`decideApprovalOutcome`) wrapped by an orchestration loop (`runApprovalWatcher`) that fetches Awaiting Review Tasks, fetches each destination record, decides the outcome, then writes the transition. Hooked into `tick.ts` after the dispatch loop. Idempotent — if a tick crashes, the next tick reconverges from the live destination state.

**Tech Stack:** TypeScript (strict), `airtable` SDK, existing Symphony modules (`fetchRecord`, `updateTaskFields`, `appendRunLog`, `taskLogger`).

**Test approach (constrained):** Symphony has zero unit tests and no test runner. We do not introduce one in this plan. We rely on:
1. TypeScript strict compilation (`npm run build`)
2. Workflow validation (`npm run validate`)
3. End-to-end smoke test against the two real Tasks currently in Awaiting Review (`recXXX` LinkedIn newsletter signup posts), manually flipping the destination record's Status to `Ready to Post` and confirming the watcher marks the Task `Done` and writes a Run Log row with outcome `Approved`.
4. Pure decision function is deliberately extracted with no Airtable dependency so future tests can target it cheaply.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/config/types.ts` | modify | Add optional `rejection_status_value` to `DestinationConfigSchema` |
| `src/airtable/tasks.ts` | modify | Add `fetchAwaitingReviewTasks`, `markTaskApproved`, `markTaskRejected` |
| `src/orchestrator/approval-watcher.ts` | create | Pure `decideApprovalOutcome` + orchestration `runApprovalWatcher` |
| `src/orchestrator/tick.ts` | modify | Call `runApprovalWatcher(config)` after dispatch loop, before logging tick complete |

`WORKFLOW.md` does **not** need editing for this block. The new `rejection_status_value` is optional; if absent for a destination, the watcher only handles approve + pending. Adam can add the field per-destination later when he wants explicit rejection detection.

---

## Task 1: Add `rejection_status_value` to destination config schema

**Files:**
- Modify: `src/config/types.ts:95-107`

- [ ] **Step 1: Add the optional field to the Zod schema**

In `src/config/types.ts`, locate `DestinationConfigSchema` (lines ~95-106) and add the new field beside `approval_status_value`:

```ts
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
  rejection_status_value: z.string().nullable().optional(),
  field_map: z.record(z.string()),
});
```

- [ ] **Step 2: Verify the type compiles**

Run: `npm run build`
Expected: Exit code 0, no TS errors. The inferred `DestinationConfig` type now includes `rejection_status_value?: string | null`.

- [ ] **Step 3: Verify workflow still validates**

Run: `npm run validate`
Expected: Exit code 0. WORKFLOW.md parses cleanly because the new field is optional.

- [ ] **Step 4: Commit**

```bash
git add src/config/types.ts
git commit -m "Block 8: add optional rejection_status_value to DestinationConfig"
```

---

## Task 2: Add Tasks-table helpers for Awaiting Review fetch and approval/rejection writes

**Files:**
- Modify: `src/airtable/tasks.ts` (add three new exported functions at end of file, after `failTask`)

- [ ] **Step 1: Add `fetchAwaitingReviewTasks`**

Append to `src/airtable/tasks.ts`:

```ts
/**
 * Fetch all tasks currently in Awaiting Review status, regardless of dispatch mode.
 * The Approval Watcher reads destination-record status and decides whether each
 * Task should transition to Done (approved) or back to Ready (rejected).
 */
export async function fetchAwaitingReviewTasks(): Promise<Task[]> {
  const base = getBase(COMMAND_CENTER_BASE);
  const records: { id: string; fields: Record<string, unknown> }[] = [];

  await base(TASKS_TABLE)
    .select({
      filterByFormula: `{Status} = 'Awaiting Review'`,
      pageSize: 100,
      returnFieldsByFieldId: true,
    } as never)
    .eachPage((pageRecords, next) => {
      for (const r of pageRecords) {
        records.push({ id: r.id, fields: r.fields });
      }
      next();
    });

  logger.info({ count: records.length }, 'Fetched awaiting-review tasks');
  return records.map(normalizeTask);
}
```

- [ ] **Step 2: Add `markTaskApproved`**

Append:

```ts
/**
 * Mark a Task as approved by the human reviewer. Sets Approved by human=true,
 * Status=Done, and stamps Last run ended. Idempotent: re-running on a Done
 * task is a no-op write but harmless.
 */
export async function markTaskApproved(taskId: string): Promise<void> {
  await updateTaskFields(taskId, {
    status: 'Done',
    approvedByHuman: true,
    lastRunEnded: new Date().toISOString(),
  });
  logger.info({ taskId }, 'Task approved by human');
}
```

- [ ] **Step 3: Add `markTaskRejected`**

Append:

```ts
/**
 * Mark a Task as rejected. Resets Status=Ready so the next tick re-dispatches,
 * clears Approved by human, and increments Attempt count. Run Log captures the
 * rejection event separately via appendRunLog.
 */
export async function markTaskRejected(taskId: string, currentAttempt: number): Promise<void> {
  await updateTaskFields(taskId, {
    status: 'Ready',
    approvedByHuman: false,
    attemptCount: currentAttempt + 1,
    lastRunStarted: '',
    lastRunEnded: '',
    lastError: '',
    runStatus: 'Released',
  });
  logger.info({ taskId, nextAttempt: currentAttempt + 1 }, 'Task rejected, returned to Ready');
}
```

- [ ] **Step 4: Verify compile**

Run: `npm run build`
Expected: Exit code 0. All three new functions type-check; `'Released'` is already a valid `RunStatus`, `'Done'` and `'Ready'` are valid `TaskStatus`.

- [ ] **Step 5: Commit**

```bash
git add src/airtable/tasks.ts
git commit -m "Block 8: add fetchAwaitingReviewTasks, markTaskApproved, markTaskRejected"
```

---

## Task 3: Create the Approval Watcher module with pure decision function

**Files:**
- Create: `src/orchestrator/approval-watcher.ts`

- [ ] **Step 1: Write the new file in full**

Create `src/orchestrator/approval-watcher.ts` with this exact content:

```ts
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
```

- [ ] **Step 2: Verify the module compiles**

Run: `npm run build`
Expected: Exit code 0. All imports resolve; `decideApprovalOutcome` and `runApprovalWatcher` are exported.

- [ ] **Step 3: Manual sanity-check the pure function**

Run: `npx tsx -e "import { decideApprovalOutcome } from './src/orchestrator/approval-watcher.js'; const d = { shape: 'airtable_only', base_id: 'x', table_id: 'y', write_mode: 'create', initial_status_field: 'Status', initial_status_value: 'Draft', approval_status_value: 'Ready to Post', rejection_status_value: 'Rejected', field_map: {} }; console.log('approved:', decideApprovalOutcome('Ready to Post', d)); console.log('rejected:', decideApprovalOutcome('Rejected', d)); console.log('pending:', decideApprovalOutcome('Draft', d)); console.log('null:', decideApprovalOutcome(null, d));"`

Expected output:
```
approved: approved
rejected: rejected
pending: pending
null: pending
```

If any of those four lines disagree, fix the function before proceeding.

- [ ] **Step 4: Commit**

```bash
git add src/orchestrator/approval-watcher.ts
git commit -m "Block 8: implement Approval Watcher with pure decision function"
```

---

## Task 4: Wire the watcher into `tick.ts`

**Files:**
- Modify: `src/orchestrator/tick.ts:35-72`

- [ ] **Step 1: Add the import**

At the top of `src/orchestrator/tick.ts`, add this import line beside the existing orchestrator imports:

```ts
import { runApprovalWatcher } from './approval-watcher.js';
```

So the import block looks like:

```ts
import { fetchEligibleTasks } from '../airtable/tasks.js';
import { filterEligible } from './eligibility.js';
import { runTask } from './lifecycle.js';
import { runApprovalWatcher } from './approval-watcher.js';
import { logger } from '../logging/structured.js';
```

- [ ] **Step 2: Call the watcher after the dispatch loop**

In `src/orchestrator/tick.ts`, replace the current end-of-tick block:

```ts
  // Sequential execution in Block 6. Block 8 will parallelize with concurrency guards.
  for (const task of eligible) {
    try {
      await runTask(task, config);
    } catch (err) {
      logger.error({ err, taskId: task.id }, 'Unhandled error during task run');
    }
  }

  logger.info(
    { ranTasks: eligible.length, rejectedTasks: rejected.length, tickMs: Date.now() - tickStart },
    'Tick complete',
  );

  return { ranTasks: eligible.length, rejectedTasks: rejected.length };
}
```

with:

```ts
  // Sequential execution in Block 6. Block 8 will parallelize with concurrency guards.
  for (const task of eligible) {
    try {
      await runTask(task, config);
    } catch (err) {
      logger.error({ err, taskId: task.id }, 'Unhandled error during task run');
    }
  }

  // Approval watcher runs after dispatch. Read-mostly: only writes to Tasks
  // and Run Log. Failures inside the watcher are logged but do not fail the tick.
  let watcherStats = { approved: 0, rejected: 0, pending: 0, errors: 0 };
  try {
    watcherStats = await runApprovalWatcher(config);
  } catch (err) {
    logger.error({ err }, 'Approval watcher failed (tick continues)');
  }

  logger.info(
    {
      ranTasks: eligible.length,
      rejectedTasks: rejected.length,
      approvalsProcessed: watcherStats.approved,
      rejectionsProcessed: watcherStats.rejected,
      stillPending: watcherStats.pending,
      tickMs: Date.now() - tickStart,
    },
    'Tick complete',
  );

  return { ranTasks: eligible.length, rejectedTasks: rejected.length };
}
```

Note: the function still returns `{ ranTasks, rejectedTasks }` — adding watcher stats to the return type is a separate refactor. The CLI consumer in `src/index.ts` doesn't need the watcher numbers.

- [ ] **Step 3: Verify the wiring compiles**

Run: `npm run build`
Expected: Exit code 0.

- [ ] **Step 4: Verify a no-op tick still works**

Run: `npm run tick`
Expected: Exit code 0. Logs include `"Approval watcher: no awaiting-review tasks"` if there are no Awaiting Review tasks at the moment, OR `"Approval watcher complete"` with stats otherwise. Crucially: tick still exits cleanly even if the watcher logs warnings.

If the watcher errors out hard (uncaught throw escapes the try/catch in tick.ts), the wiring is wrong — fix before commit.

- [ ] **Step 5: Commit**

```bash
git add src/orchestrator/tick.ts
git commit -m "Block 8: invoke approval watcher after dispatch loop in tick"
```

---

## Task 5: End-to-end smoke test against the two real Awaiting Review records

These are the two LinkedIn newsletter-signup posts created on 2026-04-30 that are sitting in Awaiting Review right now. Both reference real destination records in `apphMrUMSEexbApjo / tbl1uXcLNIXXhjI3Z` (LinkedIn Drafts). Their destination records currently have `Status = Draft`, so the first watcher run should leave them `pending`.

- [ ] **Step 1: Baseline — run the watcher with both destinations still in Draft**

Run: `npm run tick`
Expected log lines (search the output):
- `"Fetched awaiting-review tasks"` with `count: 2`
- For each task: `"Approval decision"` with `destStatus: "Draft", decision: "pending"`
- `"Approval watcher complete"` with `approved: 0, rejected: 0, pending: 2, errors: 0`

If `count` is not 2 or any task shows a decision other than `"pending"`, stop and investigate before flipping any records.

- [ ] **Step 2: Manually flip ONE destination record to "Ready to Post"**

In Airtable, open base `apphMrUMSEexbApjo` table `tbl1uXcLNIXXhjI3Z` (LinkedIn Drafts). Pick ONE of the two destination records (the one linked from Task `"LinkedIn post: newsletter signup — pain point hook"` is fine — its destination ID is recorded in the Task's `Destination record ID` field). Change its Status field from `Draft` to `Ready to Post`. Do not touch the second record yet.

- [ ] **Step 3: Run the watcher and verify the approval write**

Run: `npm run tick`
Expected:
- `"Approval decision"` line for the flipped task: `destStatus: "Ready to Post", decision: "approved"`
- `"Task approved by human"` log line for that task ID
- `"Run log written"` debug line with `outcome: "Approved"`
- Watcher summary: `approved: 1, rejected: 0, pending: 1, errors: 0`

Then verify in Airtable:
1. Command Center → Tasks: the flipped Task's Status is now `Done`, `Approved by human` is checked, `Last run ended` is the just-run timestamp.
2. Command Center → Run Log: a new row exists with that Task linked, Outcome = `Approved`.
3. The destination LinkedIn Drafts record is **unchanged** — Status is still `Ready to Post`. The watcher did not write to it.

If any of the three checks fail, do not proceed. Roll the Task back to Awaiting Review manually in Airtable, debug, and re-run.

- [ ] **Step 4: Run the watcher again to confirm idempotence**

Run: `npm run tick`
Expected:
- `"Fetched awaiting-review tasks"` with `count: 1` (the Done task is no longer Awaiting Review).
- Watcher summary: `approved: 0, rejected: 0, pending: 1, errors: 0`.
- The Done task is not touched a second time.

- [ ] **Step 5: Commit nothing — this task is verification only**

There are no code changes in Task 5. This task exists to prove the implementation works against real records before declaring Block 8 Approval Watcher done.

If desired, leave the second LinkedIn post in Awaiting Review for Adam to approve manually (which exercises the watcher again on the next scheduled tick), or flip it now to fully drain the queue.

---

## Task 6: Update README and close out the Command Center backlog item

**Files:**
- Modify: `README.md` — Block 6 / Block 8 sections

- [ ] **Step 1: Update README scope sections**

In `README.md`, change the "Block 8 Scope (Deferred)" list — strike through or remove the "Approval Watcher" line because it is now shipped:

Before:
```
## Block 8 Scope (Deferred)

- Retry logic with exponential backoff
- Approval Watcher (poll destination records, mark Done or re-Ready on rejection)
- Reconciliation for stalled tasks
- Concurrent task execution within concurrency limits
```

After:
```
## Block 8 Scope (Deferred)

- Retry logic with exponential backoff
- Reconciliation for stalled tasks
- Concurrent task execution within concurrency limits

## Block 8 Scope (Shipped)

- Approval Watcher — polls destination records each tick, transitions Tasks to Done on approval and Ready on rejection
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Block 8: document Approval Watcher as shipped in README"
```

- [ ] **Step 3: Mark the Command Center task Done**

Open Command Center → Tasks → "Block 8: Build Approval Watcher". Set Status = `Done`. Add a brief Notes entry referencing the commits. (The watcher itself does not auto-close this task because Status was Backlog/Manual, not Awaiting Review.)

- [ ] **Step 4: Decide on re-enabling the 4 LinkedIn signup-driver tasks**

The Command Center task "Re-enable LinkedIn signup-driver tasks after Block 7 verified" depends on Block 8 verification, not Block 8 completion. With the watcher live, Adam can now flip those four task records (recV8U6N63kjJ7OvE, recn1Kp5eYku29ZU3, recJhfXtLnd1bnBUh, rec1I0KbWbI3hBR3y) from Backlog to Ready when ready. The next tick will dispatch them and the watcher will handle their approvals downstream.

This step is not code work — it is Adam's decision and is left to him.

---

## Self-Review Checklist (post-write)

- [x] Spec coverage: every numbered item in the Command Center spec ("fetch Awaiting Review", "read destination", "if approval", "if rejection", "otherwise leave pending", "writes only to Tasks and Run Log") maps to a step in Tasks 2-3.
- [x] No placeholders: every code block contains complete, runnable code. No "TBD", no "similar to above".
- [x] Type consistency: function names match across tasks (`fetchAwaitingReviewTasks`, `markTaskApproved`, `markTaskRejected`, `decideApprovalOutcome`, `runApprovalWatcher`).
- [x] All referenced types (`Task`, `WorkflowConfig`, `DestinationConfig`, `RunOutcome`, `AgentIdentity`) are already exported from `src/config/types.ts`.
- [x] All referenced functions (`fetchRecord`, `updateTaskFields`, `appendRunLog`, `taskLogger`, `TRACK_TO_IDENTITY`) exist in the codebase as imported.
- [x] No new dependencies added (no test runner, no extra Zapier/MCP wiring).
- [x] Idempotence is structural: Task 5 Step 4 explicitly verifies running the watcher twice on a Done task is a no-op.

---

## Out of scope (deliberately deferred to later Block 8 work)

- Retry logic with exponential backoff for failed dispatches — separate task.
- Reconciliation for stalled `In progress` tasks (12+ min old) — separate Command Center task.
- Concurrent dispatch within track-level concurrency limits — separate.
- Adding `rejection_status_value` to live destinations in WORKFLOW.md — Adam's call when he wants the rejection branch active. Schema supports it from Task 1 onward.
- Unit tests / vitest setup — would be a separate "introduce test runner" PR; the pure `decideApprovalOutcome` function is already structured to be trivially testable when that lands.
