/**
 * Optional AI integration for content briefs and competitor analysis.
 * Uses Anthropic or OpenAI API if a key is provided.
 * Falls back to rule-based suggestions without AI.
 */

import { getConfig } from '../lib/config.js';

interface AiResponse {
  text: string;
  model: string;
  ai_used: boolean;
}

async function callAnthropic(prompt: string, systemPrompt: string): Promise<string> {
  const config = getConfig();
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.anthropicApiKey!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errorBody}`);
  }

  const body = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };

  return body.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');
}

async function callOpenAI(prompt: string, systemPrompt: string): Promise<string> {
  const config = getConfig();
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 2000,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorBody}`);
  }

  const body = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  return body.choices[0]?.message?.content ?? '';
}

export async function generateAiContent(
  prompt: string,
  systemPrompt: string,
): Promise<AiResponse> {
  const config = getConfig();

  // Try Anthropic first
  if (config.anthropicApiKey) {
    try {
      const text = await callAnthropic(prompt, systemPrompt);
      return { text, model: 'claude-sonnet-4-20250514', ai_used: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Fall through to OpenAI
      if (!config.openaiApiKey) {
        return { text: `AI generation failed: ${msg}`, model: 'none', ai_used: false };
      }
    }
  }

  // Try OpenAI
  if (config.openaiApiKey) {
    try {
      const text = await callOpenAI(prompt, systemPrompt);
      return { text, model: 'gpt-4o-mini', ai_used: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { text: `AI generation failed: ${msg}`, model: 'none', ai_used: false };
    }
  }

  return { text: '', model: 'none', ai_used: false };
}

export function hasAiCapability(): boolean {
  const config = getConfig();
  return !!(config.anthropicApiKey || config.openaiApiKey);
}
