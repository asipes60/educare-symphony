/**
 * The poll tick. Called once per GitHub Actions run (every 15 minutes).
 *
 *   1. Load workflow config (validates WORKFLOW.md).
 *   2. Configure Airtable, Claude, Drive clients.
 *   3. Fetch eligible tasks (Status=Ready, Dispatch mode=Symphony).
 *   4. Filter to dispatchable subset.
 *   5. Run each eligible task to completion (sequentially in Block 6;
 *      Block 8 will add concurrency via Promise.all + per-track guards).
 *   6. Exit cleanly. The cron handles the next tick.
 */

import { loadWorkflow } from '../config/workflow-loader.js';
import { getSecret } from '../config/secrets.js';
import { configureAirtable } from '../airtable/client.js';
import { configureClaude } from '../runner/claude.js';
import { configureDrive } from '../deliverable/drive.js';
import { fetchEligibleTasks } from '../airtable/tasks.js';
import { filterEligible } from './eligibility.js';
import { runTask } from './lifecycle.js';
import { runApprovalWatcher } from './approval-watcher.js';
import { logger } from '../logging/structured.js';

export async function tick(): Promise<{ ranTasks: number; rejectedTasks: number }> {
  const tickStart = Date.now();
  logger.info('Tick started');

  const config = loadWorkflow();

  const airtableKey = await getSecret('AIRTABLE_API_KEY');
  configureAirtable(airtableKey);

  const anthropicKey = await getSecret('ANTHROPIC_API_KEY');
  configureClaude(anthropicKey);

  try {
    const driveJson = await getSecret('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON');
    if (driveJson && driveJson !== 'placeholder') {
      configureDrive(driveJson);
    } else {
      logger.warn('Drive service account is placeholder. Drive uploads will fail until configured.');
    }
  } catch (err) {
    logger.warn({ err }, 'Drive secret not available. Drive uploads will fail until configured.');
  }

  const candidates = await fetchEligibleTasks();

  let ranTasks = 0;
  let rejectedTasks = 0;

  if (candidates.length > 0) {
    const { eligible, rejected } = filterEligible(candidates, config);

    for (const r of rejected) {
      logger.warn({ taskId: r.task.id, reason: r.reason, taskName: r.task.taskName }, 'Task rejected at eligibility');
    }

    // Sequential execution in Block 6. Block 8 will parallelize with concurrency guards.
    for (const task of eligible) {
      try {
        await runTask(task, config);
      } catch (err) {
        logger.error({ err, taskId: task.id }, 'Unhandled error during task run');
      }
    }

    ranTasks = eligible.length;
    rejectedTasks = rejected.length;
  }

  // Approval watcher runs after dispatch. Read-mostly: only writes to Tasks
  // and Run Log. Failures inside the watcher are logged but do not fail the tick.
  let watcherStats = { approved: 0, rejected: 0, pending: 0, unknown: 0, errors: 0 };
  try {
    watcherStats = await runApprovalWatcher(config);
  } catch (err) {
    logger.error({ err }, 'Approval watcher failed (tick continues)');
  }

  logger.info(
    {
      ranTasks,
      rejectedTasks,
      approvalsProcessed: watcherStats.approved,
      rejectionsProcessed: watcherStats.rejected,
      stillPending: watcherStats.pending,
      misconfiguredDestinations: watcherStats.unknown,
      tickMs: Date.now() - tickStart,
    },
    'Tick complete',
  );

  return { ranTasks, rejectedTasks };
}
