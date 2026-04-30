/**
 * Builds the rendered prompt for a task. Combines:
 * 1. The skill's SKILL.md content as the system prompt body
 * 2. Identity stamping from the assigned Track
 * 3. Guardrail context (NBCC pending, BACB approved, two-track terminology)
 * 4. The task's Input context as the user message
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Task, WorkflowConfig, IdentityConfig } from '../config/types.js';
import { TRACK_TO_IDENTITY, ValidationError } from '../config/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(__dirname, '../../skills');

function loadSkillFile(skillName: string): string {
  const path = join(SKILLS_DIR, skillName, 'SKILL.md');
  if (!existsSync(path)) {
    throw new ValidationError(`Skill file not found: ${path}`);
  }
  return readFileSync(path, 'utf-8');
}

function buildIdentityBlock(track: string, identity: IdentityConfig): string {
  const credLine = identity.credentials ? `, ${identity.credentials}` : '';
  return `## Author Identity

You are writing as ${identity.name}${credLine}. All first-person voice in deliverables must reflect this attribution. Track: ${track}.`;
}

function buildGuardrailBlock(config: WorkflowConfig, track: string): string {
  const lines: string[] = ['## Active Guardrails', ''];

  if (track === 'NBCC') {
    if (config.guardrails.nbcc_acep_status === 'pending') {
      lines.push(
        `**NBCC ACEP status: PENDING.** The application was submitted ${config.guardrails.nbcc_acep_submitted_date} and has not been approved. Do NOT claim NBCC ACEP approval, accreditation, or "approved provider" status anywhere in the deliverable. Frame accreditation as pending or omit accreditation language entirely.`,
      );
    } else {
      lines.push('**NBCC ACEP status: APPROVED.** Standard accreditation language permitted.');
    }
    lines.push('**Credit terminology:** Use "clock hours" only. Never use "CEU" in NBCC content.');
  }

  if (track === 'BACB') {
    if (config.guardrails.bacb_ace_status === 'approved') {
      lines.push(
        `**BACB ACE status: APPROVED.** Provider ID ${config.guardrails.bacb_ace_provider_id}. You may state approved provider status confidently.`,
      );
    }
    lines.push('**Credit terminology:** Use "CEUs" only. Never use "clock hours" in BACB content.');
  }

  lines.push('**Brand voice:** No em dashes. No filler openers ("Certainly!", "Great question!"). Direct, professional prose. Practitioner-to-practitioner tone.');
  return lines.join('\n');
}

function buildOutputContractBlock(): string {
  return `## Output Contract

Return your response as a single JSON object. Do NOT wrap it in markdown code fences. Do NOT include preamble or commentary outside the JSON.

The JSON keys depend on the skill. Read the skill instructions above carefully to determine the required output schema. The orchestrator will validate the response against the destination's field map and reject incomplete output.`;
}

export interface BuiltPrompt {
  systemPrompt: string;
  userMessage: string;
}

export function buildPrompt(task: Task, config: WorkflowConfig): BuiltPrompt {
  if (!task.track) {
    throw new ValidationError('Task missing track', task.id);
  }
  if (!task.skill) {
    throw new ValidationError('Task missing skill', task.id);
  }

  const identity = config.identities[task.track];
  if (!identity) {
    throw new ValidationError(`No identity config for track ${task.track}`, task.id);
  }

  const skillBody = loadSkillFile(task.skill);
  const identityBlock = buildIdentityBlock(task.track, identity);
  const guardrailBlock = buildGuardrailBlock(config, task.track);
  const outputContract = buildOutputContractBlock();

  const systemPrompt = [skillBody, '', identityBlock, '', guardrailBlock, '', outputContract].join('\n');

  const userMessage = task.inputContext
    ? `Task: ${task.taskName}\n\nInput context:\n${task.inputContext}`
    : `Task: ${task.taskName}`;

  return { systemPrompt, userMessage };
}

// Verify track-to-identity is consistent (defensive runtime check)
export function verifyAgentIdentity(track: string): string {
  const identity = TRACK_TO_IDENTITY[track as keyof typeof TRACK_TO_IDENTITY];
  if (!identity) {
    throw new ValidationError(`Unknown track: ${track}`);
  }
  return identity;
}
