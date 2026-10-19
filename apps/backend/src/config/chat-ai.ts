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

/**
 * The order models are tried in. "quality" leads with the stronger model —
 * about a cent per reply with a voice note. "economy" leads with the cheapest,
 * about a fifth of that, with plainer replies. Measured on the same voice-note
 * reply, 2026-10-14.
 */
export function chatModelOrder(tier: 'quality' | 'economy'): number[] {
  return tier === 'economy' ? [2, 1, 0] : [0, 1, 2];
}

/**
 * The ceiling covers the model's THINKING as well as its answer. These models
 * think for 400–1,000 tokens before a tool call or a two-line reply, so a
 * ceiling sized for the reply alone (it was 800) is spent on thinking and the
 * answer comes back empty — no text, no error. Sized for both.
 */
const MAX_OUTPUT_TOKENS = 4096;
/**
 * An overloaded model sometimes hangs instead of refusing — but a merely slow
 * one takes 15 seconds or more to answer, and cutting that off as "down" is
 * how a working model gets skipped. Long enough for slow, short enough that a
 * hung one does not hold a client for a minute.
 */
const TIMEOUT_MS = 25_000;
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

/**
 * A model that has just failed is left alone for a few minutes. Without this,
 * every reply during an outage would first spend half a minute finding out,
 * again, that the same model is still down.
 */
const REST_MS = 5 * 60 * 1000;
const restingUntil = new Map<number, number>();

/** True while this model is being skipped after failing. */
export function chatModelResting(modelIndex: number): boolean {
  return (restingUntil.get(modelIndex) ?? 0) > Date.now();
}

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
  /** What this session has cost so far, for the one log line each reply gets. */
  readonly spent = { calls: 0, inputTokens: 0, outputTokens: 0, usd: 0, ms: 0 };

  constructor(
    private readonly system: string,
    private readonly tools: ChatTool[],
    private readonly usage: { feature: string; conversationId?: string | null },
    private readonly modelIndex = 0
  ) {}

  get modelId(): string {
    return MODELS[this.modelIndex].id;
  }

  /** `textOnly` forbids tool calls for this turn, so the model has to write. */
  async send(contents: ChatContent[], textOnly = false): Promise<ChatTurnResult> {
    if (!chatAiEnabled()) throw new Error('Chat AI is disabled (GEMINI_API_KEY is not set).');
    // The hard stop, shared with every other AI feature.
    await assertAiBudget();

    const model = MODELS[this.modelIndex];
    for (let attempt = 0; ; attempt++) {
      let failure: string;
      const started = Date.now();
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
              ...(this.tools.length ? { tools: [{ functionDeclarations: this.tools }] } : {}),
              ...(textOnly ? { toolConfig: { functionCallingConfig: { mode: 'NONE' } } } : {}),
              generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
            }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
          }
        );
        const json: any = await res.json().catch(() => ({}));
        if (res.ok) return this.finish(model, json, Date.now() - started);

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

      if (attempt >= RETRY_DELAYS_MS.length) {
        restingUntil.set(this.modelIndex, Date.now() + REST_MS);
        throw new ChatModelUnavailableError(model.id, failure);
      }
      logger.warn('Chat AI: model busy, retrying', { model: model.id, failure, attempt: attempt + 1 });
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }

  private finish(model: (typeof MODELS)[number], json: any, ms: number): ChatTurnResult {
      const u = json.usageMetadata ?? {};
      const inputTokens = u.promptTokenCount ?? 0;
      // Thinking is billed as output.
      const outputTokens = (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
      const costUsd = (inputTokens * model.inputPerM + outputTokens * model.outputPerM) / 1e6;
      this.spent.calls += 1;
      this.spent.inputTokens += inputTokens;
      this.spent.outputTokens += outputTokens;
      this.spent.usd += costUsd;
      this.spent.ms += ms;
      logger.debug('Chat AI call', { model: model.id, in: inputTokens, out: outputTokens, usd: costUsd.toFixed(5), ms });
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

      const candidate = json.candidates?.[0];
      const content: ChatContent = candidate?.content ?? { role: 'model', parts: [] };
      const parts: any[] = content.parts ?? [];
      // A turn with nothing in it is never normal. Say why the model stopped —
      // MAX_TOKENS, SAFETY, a blocked prompt — or it is undiagnosable later.
      if (!parts.some((p) => p.text || p.functionCall)) {
        logger.warn('Chat AI: the model returned an empty turn', {
          model: model.id,
          finishReason: candidate?.finishReason ?? 'none',
          blockReason: json.promptFeedback?.blockReason,
          thinkingTokens: u.thoughtsTokenCount ?? 0,
          outputTokens: u.candidatesTokenCount ?? 0,
        });
      }
      return {
        content: { role: 'model', parts },
        text: parts.map((p) => p.text ?? '').join('').trim(),
        calls: parts.filter((p) => p.functionCall).map((p) => p.functionCall),
      };
  }
}

