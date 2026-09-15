/**
 * AI spend controls.
 *
 * Context: an unauthenticated `/api/ai-search` called Claude on every request,
 * behind nothing but a 1000-req/15-min general limiter. Combined with an API
 * key that had leaked into a committed log file, this cost ~$100 in 24 hours —
 * spent on a model this codebase never asks for.
 *
 * Three independent controls, so no single mistake can repeat that:
 *
 *   1. AI is OFF unless explicitly enabled. Default-deny, not default-allow.
 *   2. Only cheap models may be requested. The allowlist is hardcoded — not
 *      env-driven — so a mis-set environment variable cannot select an
 *      expensive model.
 *   3. Every call goes through `createMessage()`, which pins the model and caps
 *      max_tokens. Callers cannot pass a model at all.
 *
 * Never call the Anthropic SDK directly elsewhere in this codebase.
 */
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger.js';

/**
 * The only models this platform may use. Cheap tiers only.
 *
 * Deliberately hardcoded. Adding an expensive model here should require a code
 * review, not an environment change.
 */
const ALLOWED_MODELS = ['claude-haiku-4-5-20251001'] as const;

export type AllowedModel = (typeof ALLOWED_MODELS)[number];

/** The model every AI feature uses. */
export const AI_MODEL: AllowedModel = 'claude-haiku-4-5-20251001';

/** Hard ceiling per response, regardless of what a caller asks for. */
const MAX_OUTPUT_TOKENS = 600;

/**
 * Master switch. AI stays off unless `AI_ENABLED=true` is set explicitly.
 *
 * This is the "turn it all off right now" lever: unset it and redeploy, and no
 * code path can reach the Anthropic API — no need to find and edit call sites
 * under pressure.
 */
export function isAiEnabled(): boolean {
  return process.env.AI_ENABLED === 'true' && Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;

/** Throws unless the model is on the allowlist. */
function assertAllowedModel(model: string): asserts model is AllowedModel {
  if (!(ALLOWED_MODELS as readonly string[]).includes(model)) {
    throw new Error(
      `Model "${model}" is not permitted. Allowed: ${ALLOWED_MODELS.join(', ')}. ` +
        'Expensive models are blocked by policy — see config/ai.ts.',
    );
  }
}

export type GuardedMessageParams = {
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Clamped to MAX_OUTPUT_TOKENS. */
  maxTokens?: number;
};

/**
 * The only way to call Claude in this codebase.
 *
 * Note there is no `model` parameter — it cannot be overridden by a caller,
 * a request body, or an environment variable.
 */
export async function createMessage(params: GuardedMessageParams) {
  if (!isAiEnabled()) {
    throw new Error('AI is disabled (set AI_ENABLED=true and ANTHROPIC_API_KEY to enable).');
  }

  assertAllowedModel(AI_MODEL);

  if (!client) client = new Anthropic();

  const maxTokens = Math.min(params.maxTokens ?? MAX_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS);

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: maxTokens,
    ...(params.system ? { system: params.system } : {}),
    messages: params.messages,
  });

  // Cost visibility: without this, a runaway loop is invisible until the bill.
  const u = response.usage;
  logger.info(
    `AI call: model=${AI_MODEL} in=${u.input_tokens} out=${u.output_tokens} ` +
      `≈$${(((u.input_tokens ?? 0) * 1 + (u.output_tokens ?? 0) * 5) / 1e6).toFixed(5)}`,
  );

  return response;
}

/** Plain text from a guarded call. */
export async function createText(params: GuardedMessageParams): Promise<string> {
  const response = await createMessage(params);
  return response.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('');
}
