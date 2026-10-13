import { prisma } from '@propgroup/db';

/**
 * The hard stop on AI spend — every model, every feature.
 *
 * Each call to Claude or Gemini writes an AiUsage row with what it cost. Before
 * the next call is made, the total is checked here, and the call is refused
 * once either ceiling is reached. It is deliberately not per-feature: a runaway
 * in one feature must not be able to hide behind another's allowance.
 *
 * Env (dollars; both always apply):
 *   AI_DAILY_BUDGET_USD   — rolling 24 hours, default 3
 *   AI_MONTHLY_BUDGET_USD — calendar month, default 30
 */

const envUsd = (name: string, fallback: number): number => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export interface AiBudget {
  dailyUsd: number;
  dailyLimitUsd: number;
  monthlyUsd: number;
  monthlyLimitUsd: number;
  exhausted: boolean;
}

export async function aiBudget(): Promise<AiBudget> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [day, month] = await Promise.all([
    prisma.aiUsage.aggregate({ where: { createdAt: { gte: dayAgo } }, _sum: { costUsd: true } }),
    prisma.aiUsage.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { costUsd: true } }),
  ]);
  const dailyUsd = day._sum.costUsd ?? 0;
  const monthlyUsd = month._sum.costUsd ?? 0;
  const dailyLimitUsd = envUsd('AI_DAILY_BUDGET_USD', 3);
  const monthlyLimitUsd = envUsd('AI_MONTHLY_BUDGET_USD', 30);
  return {
    dailyUsd,
    dailyLimitUsd,
    monthlyUsd,
    monthlyLimitUsd,
    exhausted: dailyUsd >= dailyLimitUsd || monthlyUsd >= monthlyLimitUsd,
  };
}

export class AiBudgetExceededError extends Error {
  constructor(budget: AiBudget) {
    super(
      budget.monthlyUsd >= budget.monthlyLimitUsd
        ? `The monthly AI budget of $${budget.monthlyLimitUsd} has been used. AI is paused until next month or until the budget is raised.`
        : `The daily AI budget of $${budget.dailyLimitUsd} has been used. AI is paused for now.`
    );
    this.name = 'AiBudgetExceededError';
  }
}

/** Throws once the budget is spent. Call before every model request. */
export async function assertAiBudget(): Promise<void> {
  const budget = await aiBudget();
  if (budget.exhausted) throw new AiBudgetExceededError(budget);
}
