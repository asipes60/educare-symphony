/**
 * Entry point. Loads .env (if present), runs one tick, exits.
 */

import 'dotenv/config';
import { tick } from './orchestrator/tick.js';
import { logger } from './logging/structured.js';

async function main(): Promise<void> {
  try {
    const result = await tick();
    logger.info(result, 'Tick ended');
    process.exit(0);
  } catch (err) {
    logger.fatal({ err }, 'Tick failed with unhandled error');
    process.exit(1);
  }
}

main();
