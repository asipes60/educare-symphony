/**
 * Loads and validates WORKFLOW.md. The YAML front matter becomes the runtime
 * config. Any validation failure here blocks the entire tick.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { WorkflowConfigSchema, type WorkflowConfig, ValidationError } from './types.js';
import { logger } from '../logging/structured.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKFLOW_PATH = join(__dirname, '../../WORKFLOW.md');

const FRONT_MATTER_REGEX = /^---\n([\s\S]*?)\n---/;

/**
 * Parse WORKFLOW.md and return validated config. Throws ValidationError on
 * any structural problem.
 */
export function loadWorkflow(path: string = WORKFLOW_PATH): WorkflowConfig {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (err) {
    throw new ValidationError(`Cannot read WORKFLOW.md at ${path}: ${err}`);
  }

  const match = FRONT_MATTER_REGEX.exec(raw);
  if (!match) {
    throw new ValidationError('WORKFLOW.md missing YAML front matter');
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(match[1]);
  } catch (err) {
    throw new ValidationError(`Invalid YAML in WORKFLOW.md: ${err}`);
  }

  const result = WorkflowConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new ValidationError(`WORKFLOW.md schema invalid: ${issues}`);
  }

  validateCrossReferences(result.data);
  logger.info({ destinations: Object.keys(result.data.destinations).length }, 'Workflow loaded');
  return result.data;
}

/**
 * Cross-cutting validations beyond what Zod can express in a single schema.
 */
function validateCrossReferences(config: WorkflowConfig): void {
  const errors: string[] = [];

  for (const [skill, dest] of Object.entries(config.destinations)) {
    if (dest.write_mode === 'update' && !dest.target_record_lookup) {
      errors.push(`${skill}: update mode requires target_record_lookup`);
    }

    if (
      (dest.shape === 'airtable_plus_drive' || dest.shape === 'drive_only') &&
      !dest.drive_subfolder_id
    ) {
      errors.push(`${skill}: ${dest.shape} requires drive_subfolder_id`);
    }

    if (
      (dest.shape === 'airtable_only' || dest.shape === 'airtable_plus_drive') &&
      dest.write_mode === 'create'
    ) {
      if (!dest.initial_status_field || !dest.initial_status_value) {
        errors.push(`${skill}: create mode requires initial_status_field and initial_status_value`);
      }
      if (!dest.approval_status_value) {
        errors.push(`${skill}: create mode requires approval_status_value`);
      }
    }
  }

  for (const trackKey of ['NBCC', 'BACB', 'Ops', 'Code']) {
    if (!config.identities[trackKey]) {
      errors.push(`identities.${trackKey} missing from WORKFLOW.md`);
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(`Workflow validation failed: ${errors.join('; ')}`);
  }
}
