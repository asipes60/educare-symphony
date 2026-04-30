/**
 * Calls the Anthropic API. Returns parsed JSON output and token usage.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { WorkflowConfig, AgentOutput } from '../config/types.js';
import { taskLogger } from '../logging/structured.js';
import { SymphonyError } from '../config/types.js';

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

function parseAgentJson(text: string, taskId: string): AgentOutput {
  const cleaned = stripFences(text);
  try {
    return JSON.parse(cleaned) as AgentOutput;
  } catch (err) {
    throw new SymphonyError(
      `Agent output is not valid JSON: ${(err as Error).message}. First 200 chars: ${cleaned.substring(0, 200)}`,
      'invalid_agent_output',
      taskId,
    );
  }
}

export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  config: WorkflowConfig,
  taskId: string,
): Promise<ClaudeRunResult> {
  if (!client) {
    throw new Error('Claude not configured. Call configureClaude() first.');
  }

  const log = taskLogger(taskId);
  log.info({ model: config.claude.model, max_tokens: config.claude.max_tokens }, 'Calling Claude API');

  const response = await client.messages.create({
    model: config.claude.model,
    max_tokens: config.claude.max_tokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new SymphonyError('Claude response contained no text block', 'no_text_response', taskId);
  }

  const output = parseAgentJson(textBlock.text, taskId);

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
