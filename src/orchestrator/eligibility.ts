/**
 * Filters fetched candidate tasks down to dispatchable ones. Eligibility rules:
 *
 *   1. Status = Ready (already enforced at fetch time)
 *   2. Dispatch mode = Symphony (already enforced at fetch time)
 *   3. Track is set
 *   4. Skill is set and registered in destinations
 *   5. Track is not Code (Code track is reserved, rejected with unmapped_skill)
 *   6. Concurrency limits not exceeded (per-track and global)
 */

import type { Task, WorkflowConfig } from '../config/types.js';
import { logger } from '../logging/structured.js';

export interface EligibilityResult {
  eligible: Task[];
  rejected: Array<{ task: Task; reason: string }>;
}

export function filterEligible(tasks: Task[], config: WorkflowConfig): EligibilityResult {
  const eligible: Task[] = [];
  const rejected: Array<{ task: Task; reason: string }> = [];

  const trackCounts: Record<string, number> = { NBCC: 0, BACB: 0, Ops: 0, Code: 0 };

  // Sort by priority then creation order (P1 first, then P2, then P3)
  const sorted = [...tasks].sort((a, b) => {
    const order = { P1: 0, P2: 1, P3: 2 };
    const ap = a.priority ? order[a.priority] : 1;
    const bp = b.priority ? order[b.priority] : 1;
    return ap - bp;
  });

  for (const task of sorted) {
    if (!task.track) {
      rejected.push({ task, reason: 'missing_track' });
      continue;
    }

    if (!task.skill) {
      rejected.push({ task, reason: 'missing_skill' });
      continue;
    }

    if (task.track === 'Code') {
      rejected.push({ task, reason: 'code_track_reserved' });
      continue;
    }

    if (!config.destinations[task.skill]) {
      rejected.push({ task, reason: 'unmapped_skill' });
      continue;
    }

    const trackLimit = config.agent.max_concurrent_agents_by_track[task.track] ?? 0;
    if (trackCounts[task.track]! >= trackLimit) {
      rejected.push({ task, reason: 'track_concurrency_limit' });
      continue;
    }

    if (eligible.length >= config.agent.max_concurrent_agents) {
      rejected.push({ task, reason: 'global_concurrency_limit' });
      continue;
    }

    eligible.push(task);
    trackCounts[task.track] = (trackCounts[task.track] ?? 0) + 1;
  }

  logger.info(
    { eligible: eligible.length, rejected: rejected.length },
    'Eligibility filter applied',
  );

  return { eligible, rejected };
}
