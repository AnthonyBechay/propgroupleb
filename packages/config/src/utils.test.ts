import { describe, it, expect } from 'vitest'
import { 
  calculateCashOnCash, 
  calculateSimpleROI, 
  calculateBreakEvenOccupancy,
  calculateAppreciation,
  calculateTotalReturn 
} from './utils'

/**
 * Several expectations in here were wrong rather than aspirational, and the
 * suite had been failing on them for a while.
 *
 * The anchor for the mortgage maths is the standard amortisation formula:
 * $200,000 at 4.5% over 30 years is the widely published $1,013.37/month, which
 * this implementation reproduces exactly. The 1.2x loan in the first test is
 * therefore $1,216.04, not the $1,215.98 that was asserted, and the four
 * figures derived from it were off by the same drift.
 *
 * The appreciation figures were asserted at $402,440.13 for 3% over 10 years;
 * that implies a rate of 2.9812%, not 3%. Annual compounding of the stated rate
 * gives $403,174.91.
 *
 * The two `annualizedReturn` expectations (13.33% and 7.18%) are not derivable
 * from their inputs under any convention — 7.18% is precisely the rate that
 * doubles money over ten years, but the scenario returns 1.8x. They look like
 * placeholders that were never computed.
 *
 * Where the implementation was genuinely wrong (0% interest, zero rent) the
 * code changed and these tests now pin the corrected behaviour.
 */
describe('Investment Calculation Utils', () => {
  describe('calculateCashOnCash', () => {
    it('should calculate cash-on-cash return for leveraged investment', () => {
      const inputs = {
        propertyPrice: 300000,
        downPaymentPercent: 20,
        interestRate: 4.5,
        loanTermYears: 30,
        monthlyRent: 2000
      }

      const result = calculateCashOnCash(inputs)

      expect(result.downPayment).toBe(60000)
      expect(result.loanAmount).toBe(240000)
      expect(result.monthlyPayment).toBeCloseTo(1216.04, 2)
      expect(result.annualRent).toBe(24000)
      expect(result.annualMortgage).toBeCloseTo(14592.54, 2)
      expect(result.netAnnualCashflow).toBeCloseTo(9407.46, 2)
      expect(result.netMonthlyCashflow).toBeCloseTo(783.96, 2)
      expect(result.cashOnCashReturn).toBeCloseTo(15.68, 2)
      expect(result.grossRentalYield).toBe(8)
      expect(result.netRentalYield).toBeCloseTo(3.14, 2)
    })

    it('should match the published amortisation figure', () => {
      // $200,000 at 4.5% over 30 years is $1,013.37 in every mortgage table
      // there is. This is the check that says the formula itself is right,
      // independent of the scenario numbers above.
      const result = calculateCashOnCash({
        propertyPrice: 200000,
        downPaymentPercent: 0,
        interestRate: 4.5,
        loanTermYears: 30,
        monthlyRent: 0
      })

      expect(result.monthlyPayment).toBeCloseTo(1013.37, 2)
    })

    it('should handle all-cash purchase (no loan)', () => {
      const inputs = {
        propertyPrice: 300000,
        downPaymentPercent: 100,
        interestRate: 4.5,
        loanTermYears: 30,
        monthlyRent: 2000
      }

      const result = calculateCashOnCash(inputs)

      expect(result.downPayment).toBe(300000)
      expect(result.loanAmount).toBe(0)
      expect(result.monthlyPayment).toBe(0)
      expect(result.annualRent).toBe(24000)
      expect(result.annualMortgage).toBe(0)
      expect(result.netAnnualCashflow).toBe(24000)
      expect(result.netMonthlyCashflow).toBe(2000)
      expect(result.cashOnCashReturn).toBe(8)
      expect(result.grossRentalYield).toBe(8)
      expect(result.netRentalYield).toBe(8)
    })

    it('should handle zero interest rate', () => {
      const inputs = {
        propertyPrice: 300000,
        downPaymentPercent: 20,
        interestRate: 0,
        loanTermYears: 30,
        monthlyRent: 2000
      }

      const result = calculateCashOnCash(inputs)

      expect(result.downPayment).toBe(60000)
      expect(result.loanAmount).toBe(240000)
      // 240000 / (30 * 12). An interest-free plan still has to be repaid;
      // this used to come back as 0.
      expect(result.monthlyPayment).toBeCloseTo(666.67, 2)
      expect(result.annualMortgage).toBeCloseTo(8000, 2)
      expect(result.netAnnualCashflow).toBeCloseTo(16000, 2)
      // 16000 / 60000. The 20% previously asserted here matched neither the
      // old behaviour nor the correct one.
      expect(result.cashOnCashReturn).toBeCloseTo(26.67, 2)
    })

    it('should not report a free loan when the term is missing', () => {
      const result = calculateCashOnCash({
        propertyPrice: 300000,
        downPaymentPercent: 20,
        interestRate: 0,
        loanTermYears: 0,
        monthlyRent: 2000
      })

      // Nothing sensible to divide by, but it must not be Infinity or NaN.
      expect(Number.isFinite(result.monthlyPayment)).toBe(true)
      expect(result.monthlyPayment).toBe(0)
    })

    it('should handle negative cashflow', () => {
      const inputs = {
        propertyPrice: 300000,
        downPaymentPercent: 20,
        interestRate: 6,
        loanTermYears: 30,
        monthlyRent: 1000 // Low rent
      }

      const result = calculateCashOnCash(inputs)

      expect(result.netAnnualCashflow).toBeLessThan(0)
      expect(result.cashOnCashReturn).toBeLessThan(0)
    })
  })

  describe('calculateSimpleROI', () => {
    it('should calculate simple ROI correctly', () => {
      const roi = calculateSimpleROI(300000, 24000)
      expect(roi).toBe(8)
    })

    it('should handle zero rent', () => {
      const roi = calculateSimpleROI(300000, 0)
      expect(roi).toBe(0)
    })

    it('should handle zero property price', () => {
      const roi = calculateSimpleROI(0, 24000)
      expect(roi).toBe(Infinity)
    })
  })

  describe('calculateBreakEvenOccupancy', () => {
    it('should calculate break-even occupancy correctly', () => {
      const occupancy = calculateBreakEvenOccupancy(1500, 2000)
      expect(occupancy).toBe(75)
    })

    it('should handle zero rent', () => {
      // No rent can never cover a payment. Returning 0 here would read as
      // "breaks even with no tenant", which is the opposite of the truth.
      const occupancy = calculateBreakEvenOccupancy(1500, 0)
      expect(occupancy).toBe(Infinity)
    })

    it('should handle zero payment', () => {
      const occupancy = calculateBreakEvenOccupancy(0, 2000)
      expect(occupancy).toBe(0)
    })

    it('should handle no payment and no rent', () => {
      // Nothing to cover wins over nothing to cover it with.
      expect(calculateBreakEvenOccupancy(0, 0)).toBe(0)
    })
  })

  describe('calculateAppreciation', () => {
    it('should calculate appreciation correctly', () => {
      // 300000 * 1.03^10, compounded annually.
      const appreciation = calculateAppreciation(300000, 3, 10)
      expect(appreciation).toBeCloseTo(403174.91, 2)
    })

    it('should handle zero appreciation', () => {
      const appreciation = calculateAppreciation(300000, 0, 10)
      expect(appreciation).toBe(300000)
    })

    it('should handle zero years', () => {
      const appreciation = calculateAppreciation(300000, 3, 0)
      expect(appreciation).toBe(300000)
    })
  })

  describe('calculateTotalReturn', () => {
    it('should calculate total return correctly', () => {
      const result = calculateTotalReturn(300000, 24000, 3, 10)
      
      expect(result.totalAppreciation).toBeCloseTo(103174.91, 2)
      expect(result.totalRentalIncome).toBe(240000)
      expect(result.totalReturn).toBeCloseTo(343174.91, 2)
      // CAGR on a 2.144x gain over 10 years. See the note on
      // `annualizedReturn` in utils.ts for why this sits below the IRR.
      expect(result.annualizedReturn).toBeCloseTo(7.92, 2)
    })

    it('should handle zero appreciation', () => {
      const result = calculateTotalReturn(300000, 24000, 0, 10)
      
      expect(result.totalAppreciation).toBe(0)
      expect(result.totalRentalIncome).toBe(240000)
      expect(result.totalReturn).toBe(240000)
      // CAGR on a 1.8x gain over 10 years.
      expect(result.annualizedReturn).toBeCloseTo(6.05, 2)
    })
  })
})
