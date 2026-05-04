/**
 * Calls the Anthropic API. Returns parsed JSON output and token usage.
 */

import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { WorkflowConfig, AgentOutput, Skill } from '../config/types.js';
import { taskLogger } from '../logging/structured.js';
import { SymphonyError } from '../config/types.js';
import { repairAgentJson } from './json-repair.js';

let client: Anthropic | null = null;

export function configureClaude(apiKey: string): void {
  client = new Anthropic({ apiKey });
}

export interface ClaudeRunResult {
  output: AgentOutput;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

function persistRawResponse(workspacePath: string | undefined, raw: string, taskId: string): void {
  if (!workspacePath) return;
  try {
    writeFileSync(join(workspacePath, 'raw_response.txt'), raw, 'utf-8');
    taskLogger(taskId).info({ workspacePath }, 'Persisted raw agent response for parse failure');
  } catch (err) {
    taskLogger(taskId).warn({ err, workspacePath }, 'Failed to persist raw agent response');
  }
}

function parseAgentJson(text: string, taskId: string, workspacePath?: string): AgentOutput {
  const cleaned = stripFences(text);
  try {
    return JSON.parse(cleaned) as AgentOutput;
  } catch (firstErr) {
    const repaired = repairAgentJson(cleaned);
    if (repaired !== cleaned) {
      try {
        const parsed = JSON.parse(repaired) as AgentOutput;
        taskLogger(taskId).warn({ originalError: (firstErr as Error).message }, 'Agent output recovered via repair pass');
        return parsed;
      } catch {
        // Fall through to persistence and rethrow.
      }
    }
    persistRawResponse(workspacePath, cleaned, taskId);
    throw new SymphonyError(
      `Agent output is not valid JSON: ${(firstErr as Error).message}. First 200 chars: ${cleaned.substring(0, 200)}`,
      'invalid_agent_output',
      taskId,
    );
  }
}

function resolveMaxTokens(config: WorkflowConfig, skill: Skill | null): number {
  if (skill && config.claude.max_tokens_by_skill?.[skill] != null) {
    return config.claude.max_tokens_by_skill[skill];
  }
  return config.claude.max_tokens;
}

export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  config: WorkflowConfig,
  taskId: string,
  options: { workspacePath?: string; skill?: Skill | null } = {},
): Promise<ClaudeRunResult> {
  if (!client) {
    throw new Error('Claude not configured. Call configureClaude() first.');
  }

  const log = taskLogger(taskId);
  const maxTokens = resolveMaxTokens(config, options.skill ?? null);
  log.info({ model: config.claude.model, max_tokens: maxTokens, skill: options.skill ?? null }, 'Calling Claude API');

  const response = await client.messages.create({
    model: config.claude.model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new SymphonyError('Claude response contained no text block', 'no_text_response', taskId);
  }

  if (response.stop_reason === 'max_tokens') {
    log.warn({ outputTokens: response.usage.output_tokens, max_tokens: maxTokens }, 'Claude response hit max_tokens; output likely truncated');
  }

  const output = parseAgentJson(textBlock.text, taskId, options.workspacePath);

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;

  log.info({ inputTokens, outputTokens, stop_reason: response.stop_reason }, 'Claude call complete');

  return {
    output,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}
