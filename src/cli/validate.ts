/**
 * Validates WORKFLOW.md without running anything. Useful as a pre-commit check
 * and as a CI step.
 */

import 'dotenv/config';
import { loadWorkflow } from '../config/workflow-loader.js';
import { logger } from '../logging/structured.js';

async function main(): Promise<void> {
  try {
    const config = loadWorkflow();
    logger.info(
      {
        destinations: Object.keys(config.destinations).length,
        identities: Object.keys(config.identities).length,
        bacb_status: config.guardrails.bacb_ace_status,
        nbcc_status: config.guardrails.nbcc_acep_status,
      },
      'WORKFLOW.md is valid',
    );
    process.exit(0);
  } catch (err) {
    logger.fatal({ err }, 'WORKFLOW.md validation failed');
    process.exit(1);
  }
}

main();
