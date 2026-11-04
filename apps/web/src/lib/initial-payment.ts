/**
 * `UnitOption.initialPayment` holds two kinds of value. The back office enters a
 * percentage (30 = 30%, capped at 100), while options imported from the old
 * Georgian catalogue hold a money amount (23489 = $23,489). Anything above 100
 * can only be an amount, the same rule ProposalDocument uses to label it.
 *
 * Accepts the raw value too: Prisma Decimals reach the browser as strings.
 *
 * @returns the amount to pay, or null when there is no value or, for a
 * percentage, no total to take it of.
 */
export function initialPaymentAmount(stored: unknown, total: number): number | null {
  if (stored == null || stored === '') return null
  const value = Number(stored)
  if (!Number.isFinite(value)) return null
  if (value > 100) return value
  return total > 0 ? Math.round((total * value) / 100) : null
}

/**
 * How to show it: a percentage stays a percentage, with its amount beside it
 * ("30% · $23,910"), and a stored amount stays money ("$23,489").
 *
 * @returns null when there is nothing to show, zero included.
 */
export function initialPaymentLabel(
  stored: unknown,
  total: number,
  formatMoney: (amount: number) => string,
): string | null {
  const value = Number(stored)
  if (!(value > 0)) return null
  if (value > 100) return formatMoney(value)
  const amount = initialPaymentAmount(value, total)
  return amount != null ? `${value}% · ${formatMoney(amount)}` : `${value}%`
}
