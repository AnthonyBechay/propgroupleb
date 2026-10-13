/**
 * The chat AI — Google Gemini, for WhatsApp and Instagram replies only.
 *
 * Gemini rather than Claude here for one reason: it accepts audio directly, so
 * a voice note is understood in the same call that writes the reply. SEO
 * generation stays on Claude (config/ai.ts); nothing else may call either.
 *
 * The same rules as config/ai.ts, for the same reason — this is triggered by
 * anyone who messages the number:
 *   1. Off unless a key is present AND the caller's own switch is on.
 *   2. The model list is hardcoded. An env var cannot select an expensive one.
 *   3. Every call is capped, logged and written to AiUsage.
 *
 * Called over plain HTTPS on purpose: no SDK dependency, no lockfile change.
 */
import { prisma } from '@propgroup/db';
import { assertAiBudget } from '../utils/ai-budget.js';
import { logger } from '../utils/logger.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Tried in order. The first is the stronger model; the second is the cheaper
 * one, used when the first is overloaded (Google answers 503 under load).
 * USD per million tokens — the first row is Google's rate until 2026-12-31,
 * after which it doubles; update it then or the usage panel under-reports.
 *
 * gemini-3.8-flash is deliberately not here: over two days of testing it
 * answered 503 or hung on every call, and a model that costs each client a
 * 12-second wait before the fallback is worse than not listing it. It is the
 * same price as 3.6 — put it first again once it is dependable.
 */
const MODELS = [
  { id: 'gemini-3.6-flash', inputPerM: 0.75, outputPerM: 3.75 },
  { id: 'gemini-3.5-flash-lite', inputPerM: 0.3, outputPerM: 2.5 },
] as const;

const MAX_OUTPUT_TOKENS = 800;
const TIMEOUT_MS = 30_000;
const FIRST_TRY_TIMEOUT_MS = 12_000;

export function chatAiEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export type ChatPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { functionCall: { name: string; args: Record<string, any>; id?: string }; thoughtSignature?: string }
  | { functionResponse: { name: string; response: Record<string, any>; id?: string } };

export interface ChatContent {
  role: 'user' | 'model';
  parts: ChatPart[];
}

export interface ChatTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface ChatTurnResult {
  /** The model's turn exactly as returned — replay it unchanged, signatures included. */
  content: ChatContent;
  text: string;
  calls: Array<{ name: string; args: Record<string, any>; id?: string }>;
}

/** One conversation with the model, pinned to whichever model answered first. */
export class ChatSession {
  private modelIndex = 0;
  private started = false;

  constructor(
    private readonly system: string,
    private readonly tools: ChatTool[],
    private readonly usage: { feature: string; conversationId?: string | null }
  ) {}

  async send(contents: ChatContent[]): Promise<ChatTurnResult> {
    if (!chatAiEnabled()) throw new Error('Chat AI is disabled (GEMINI_API_KEY is not set).');
    // The hard stop, shared with every other AI feature.
    await assertAiBudget();

    for (;;) {
      const model = MODELS[this.modelIndex];
      const canFallBack = !this.started && this.modelIndex < MODELS.length - 1;
      let res: Response;
      try {
        res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Key in a header, never the URL — URLs end up in logs.
            'x-goog-api-key': process.env.GEMINI_API_KEY as string,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: this.system }] },
            contents,
            tools: [{ functionDeclarations: this.tools }],
            generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
          }),
          // An overloaded model sometimes hangs instead of refusing; give the
          // first attempt less rope so the fallback still answers in time.
          signal: AbortSignal.timeout(canFallBack ? FIRST_TRY_TIMEOUT_MS : TIMEOUT_MS),
          }
        );
      } catch (err) {
        if (!canFallBack) throw err;
        logger.warn(`Chat AI: ${model.id} did not answer (${(err as Error).name}), falling back`);
        this.modelIndex += 1;
        continue;
      }
      const json: any = await res.json().catch(() => ({}));

      // Overloaded or rate-limited on the first call: drop to the next model.
      // Not mid-conversation — a turn carries signatures only its own model accepts.
      if ((res.status === 503 || res.status === 429) && canFallBack) {
        logger.warn(`Chat AI: ${model.id} unavailable (${res.status}), falling back`);
        this.modelIndex += 1;
        continue;
      }
      if (!res.ok) {
        throw new Error(`Gemini ${res.status}: ${json?.error?.message ?? 'request failed'}`);
      }
      this.started = true;

      const u = json.usageMetadata ?? {};
      const inputTokens = u.promptTokenCount ?? 0;
      // Thinking is billed as output.
      const outputTokens = (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
      const costUsd = (inputTokens * model.inputPerM + outputTokens * model.outputPerM) / 1e6;
      logger.info(`Chat AI call: model=${model.id} in=${inputTokens} out=${outputTokens} ≈$${costUsd.toFixed(5)}`);
      void prisma.aiUsage
        .create({
          data: {
            feature: this.usage.feature,
            model: model.id,
            inputTokens,
            outputTokens,
            costUsd,
            conversationId: this.usage.conversationId ?? null,
          },
        })
        .catch((err) => logger.warn('AI usage not recorded', { error: (err as Error).message }));

      const content: ChatContent = json.candidates?.[0]?.content ?? { role: 'model', parts: [] };
      const parts: any[] = content.parts ?? [];
      return {
        content: { role: 'model', parts },
        text: parts.map((p) => p.text ?? '').join('').trim(),
        calls: parts.filter((p) => p.functionCall).map((p) => p.functionCall),
      };
    }
  }
}

