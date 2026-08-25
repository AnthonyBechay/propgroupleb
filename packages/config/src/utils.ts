/**
 * Investment calculation utilities
 */

export interface InvestmentCalculationInputs {
  propertyPrice: number
  downPaymentPercent: number
  interestRate: number
  loanTermYears: number
  monthlyRent: number
}

export interface InvestmentCalculationResults {
  downPayment: number
  loanAmount: number
  monthlyPayment: number
  annualRent: number
  annualMortgage: number
  netAnnualCashflow: number
  netMonthlyCashflow: number
  cashOnCashReturn: number
  grossRentalYield: number
  netRentalYield: number
}

/**
 * Calculate cash-on-cash return for a real estate investment
 */
export function calculateCashOnCash(inputs: InvestmentCalculationInputs): InvestmentCalculationResults {
  const {
    propertyPrice,
    downPaymentPercent,
    interestRate,
    loanTermYears,
    monthlyRent
  } = inputs

  // Basic calculations
  const downPayment = (propertyPrice * downPaymentPercent) / 100
  const loanAmount = propertyPrice - downPayment
  const annualRent = monthlyRent * 12

  // Monthly mortgage payment calculation
  const monthlyRate = interestRate / 100 / 12
  const totalPayments = loanTermYears * 12
  
  let monthlyPayment = 0
  if (loanAmount > 0 && totalPayments > 0) {
    monthlyPayment = monthlyRate > 0
      ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) /
        (Math.pow(1 + monthlyRate, totalPayments) - 1)
      // A 0% loan is not "no loan" — it is the principal spread evenly, and
      // `loanAmount / totalPayments` is the limit of the formula above as the
      // rate approaches zero. The formula itself divides by
      // ((1+i)^n - 1), which is exactly 0 when i is 0, so it needs its own
      // branch. The old guard sidestepped the division by leaving the payment
      // at 0, which told a buyer that an interest-free plan costs nothing per
      // month and inflated the cash-on-cash return to match.
      //
      // This is not a hypothetical input: interest-free developer instalment
      // plans are ordinary in off-plan sales in both markets.
      : loanAmount / totalPayments
  }

  // Annual calculations
  const annualMortgage = monthlyPayment * 12
  const netAnnualCashflow = annualRent - annualMortgage
  const netMonthlyCashflow = netAnnualCashflow / 12

  // ROI calculations
  const cashOnCashReturn = downPayment > 0 ? (netAnnualCashflow / downPayment) * 100 : 0
  const grossRentalYield = (annualRent / propertyPrice) * 100
  const netRentalYield = (netAnnualCashflow / propertyPrice) * 100

  return {
    downPayment,
    loanAmount,
    monthlyPayment,
    annualRent,
    annualMortgage,
    netAnnualCashflow,
    netMonthlyCashflow,
    cashOnCashReturn,
    grossRentalYield,
    netRentalYield
  }
}

/**
 * Calculate simple ROI without leverage
 */
export function calculateSimpleROI(propertyPrice: number, annualRent: number): number {
  return (annualRent / propertyPrice) * 100
}

/**
 * Calculate break-even occupancy rate — the share of the year the place has to
 * be let for the rent to cover the mortgage.
 */
export function calculateBreakEvenOccupancy(
  monthlyPayment: number,
  monthlyRent: number
): number {
  // Nothing to cover, so it breaks even standing empty.
  if (monthlyPayment <= 0) return 0

  // There is a payment and no rent to meet it, so no level of occupancy ever
  // covers it. Infinity is both the honest answer and the one
  // `calculateSimpleROI` already gives for the same division by zero.
  //
  // The previous `: 0` returned the most optimistic figure the metric can take
  // — "breaks even with no tenant at all" — for its worst possible input, and
  // it is the reading a buyer is least able to sanity-check.
  if (monthlyRent <= 0) return Infinity

  return (monthlyPayment / monthlyRent) * 100
}

/**
 * Calculate property appreciation value over time
 */
export function calculateAppreciation(
  propertyPrice: number,
  annualAppreciationRate: number,
  years: number
): number {
  return propertyPrice * Math.pow(1 + annualAppreciationRate / 100, years)
}

/**
 * Calculate total return including appreciation
 */
export function calculateTotalReturn(
  propertyPrice: number,
  annualRent: number,
  annualAppreciationRate: number,
  years: number
): {
  totalAppreciation: number
  totalRentalIncome: number
  totalReturn: number
  annualizedReturn: number
} {
  const totalAppreciation = calculateAppreciation(propertyPrice, annualAppreciationRate, years) - propertyPrice
  const totalRentalIncome = annualRent * years
  const totalReturn = totalAppreciation + totalRentalIncome

  // Compound annual growth rate on the whole gain, treated as a lump sum
  // realised at the end. It deliberately ignores the timing of the rent — real
  // money arrives monthly and could be reinvested — so it reads *lower* than an
  // IRR on the same deal (8% gross yield with no appreciation annualises to
  // 6.05% here). That understatement is the direction to err in on a page
  // aimed at prospective buyers, so it stays.
  const annualizedReturn = (Math.pow(totalReturn / propertyPrice + 1, 1 / years) - 1) * 100

  return {
    totalAppreciation,
    totalRentalIncome,
    totalReturn,
    annualizedReturn
  }
}
