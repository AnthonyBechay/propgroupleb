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
 * Tried in order, strongest first. Google's Flash models answer 503 ("high
 * demand") or simply hang often enough that one model is not a service: a
 * call is retried, and if the model stays unavailable the whole reply is
 * redone on the next one down. USD per million tokens — the first row is
 * Google's rate until 2026-12-31, after which it doubles; update it then or
 * the usage panel under-reports.
 *
 * gemini-3.8-flash is deliberately not here: over two days of testing it
 * failed or hung on every call. Same price as 3.6 — put it first once it is
 * dependable.
 */
const MODELS = [
  { id: 'gemini-3.6-flash', inputPerM: 0.75, outputPerM: 3.75 },
  { id: 'gemini-3.5-flash-lite', inputPerM: 0.3, outputPerM: 2.5 },
  { id: 'gemini-3.1-flash-lite', inputPerM: 0.25, outputPerM: 1.5 },
] as const;

/** How many models there are to fall back through. */
export const CHAT_MODEL_COUNT = MODELS.length;

const MAX_OUTPUT_TOKENS = 800;
/** An overloaded model sometimes hangs instead of refusing. */
const TIMEOUT_MS = 15_000;
/** Wait before the one retry on the same model; after that, the next model. */
const RETRY_DELAYS_MS = [1000];

/** The model could not be reached after retries — try the next one. */
export class ChatModelUnavailableError extends Error {
  constructor(model: string, cause: string) {
    super(`${model} is unavailable (${cause})`);
    this.name = 'ChatModelUnavailableError';
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

/**
 * One conversation with one model. A turn carries signatures only its own
 * model accepts, so a session never switches model mid-way — when its model
 * gives out it throws ChatModelUnavailableError and the caller starts the
 * reply again on the next (`modelIndex + 1`).
 */
export class ChatSession {
  constructor(
    private readonly system: string,
    private readonly tools: ChatTool[],
    private readonly usage: { feature: string; conversationId?: string | null },
    private readonly modelIndex = 0
  ) {}

  get modelId(): string {
    return MODELS[this.modelIndex].id;
  }

  async send(contents: ChatContent[]): Promise<ChatTurnResult> {
    if (!chatAiEnabled()) throw new Error('Chat AI is disabled (GEMINI_API_KEY is not set).');
    // The hard stop, shared with every other AI feature.
    await assertAiBudget();

    const model = MODELS[this.modelIndex];
    for (let attempt = 0; ; attempt++) {
      let failure: string;
      try {
        const res = await fetch(
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
            signal: AbortSignal.timeout(TIMEOUT_MS),
          }
        );
        const json: any = await res.json().catch(() => ({}));
        if (res.ok) return this.finish(model, json);

        // Overloaded, rate-limited or a server fault: worth another go. Anything
        // else (bad request, bad key) will not get better by asking again.
        if (![429, 500, 502, 503, 504].includes(res.status)) {
          throw new Error(`Gemini ${res.status}: ${json?.error?.message ?? 'request failed'}`);
        }
        failure = `HTTP ${res.status}`;
      } catch (err) {
        const name = (err as Error).name;
        if (name !== 'TimeoutError' && name !== 'AbortError' && !(err instanceof TypeError)) throw err;
        failure = name === 'TypeError' ? 'network error' : 'no answer in time';
      }

      if (attempt >= RETRY_DELAYS_MS.length) throw new ChatModelUnavailableError(model.id, failure);
      logger.warn('Chat AI: model busy, retrying', { model: model.id, failure, attempt: attempt + 1 });
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  private finish(model: (typeof MODELS)[number], json: any): ChatTurnResult {
      const u = json.usageMetadata ?? {};
      const inputTokens = u.promptTokenCount ?? 0;
      // Thinking is billed as output.
      const outputTokens = (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
      const costUsd = (inputTokens * model.inputPerM + outputTokens * model.outputPerM) / 1e6;
      logger.debug('Chat AI call', { model: model.id, in: inputTokens, out: outputTokens, usd: costUsd.toFixed(5) });
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

