'use client'

import { useState, useEffect } from 'react'
import { 
  Calculator, 
  TrendingUp, 
  DollarSign, 
  Home,
  Calendar,
  PieChart,
  BarChart3,
  Info,
  Download,
  RefreshCw
} from 'lucide-react'

export default function CalculatorPage() {
  // Investment inputs
  const [propertyPrice, setPropertyPrice] = useState(350000)
  const [downPayment, setDownPayment] = useState(70000) // 20%
  const [loanAmount, setLoanAmount] = useState(280000)
  const [interestRate, setInterestRate] = useState(4.5)
  const [loanTerm, setLoanTerm] = useState(25)
  const [monthlyRent, setMonthlyRent] = useState(2500)
  const [propertyAppreciation, setPropertyAppreciation] = useState(5)
  const [maintenanceCost, setMaintenanceCost] = useState(200)
  const [propertyTax, setPropertyTax] = useState(350)
  const [insurance, setInsurance] = useState(150)
  const [managementFee, setManagementFee] = useState(10) // percentage
  const [vacancyRate, setVacancyRate] = useState(5) // percentage
  const [closingCosts, setClosingCosts] = useState(7000)

  // Projection period
  const [projectionYears, setProjectionYears] = useState(10)

  // Calculated values
  const [monthlyPayment, setMonthlyPayment] = useState(0)
  const [totalInterest, setTotalInterest] = useState(0)
  const [netMonthlyIncome, setNetMonthlyIncome] = useState(0)
  const [cashOnCashReturn, setCashOnCashReturn] = useState(0)
  const [capRate, setCapRate] = useState(0)
  const [totalROI, setTotalROI] = useState(0)
  const [breakEvenMonth, setBreakEvenMonth] = useState(0)
  const [compoundProjection, setCompoundProjection] = useState<{
    year: number
    propertyValue: number
    cumulativeRent: number
    cumulativeMortgage: number
    equity: number
    totalReturn: number
    annualizedReturn: number
  }[]>([])

  // Calculate mortgage payment
  useEffect(() => {
    const monthlyRate = interestRate / 100 / 12
    const numPayments = loanTerm * 12
    const payment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                    (Math.pow(1 + monthlyRate, numPayments) - 1)
    setMonthlyPayment(payment)
    setTotalInterest(payment * numPayments - loanAmount)
  }, [loanAmount, interestRate, loanTerm])

  // Calculate investment metrics
  useEffect(() => {
    // Net monthly income
    const effectiveRent = monthlyRent * (1 - vacancyRate / 100)
    const managementCost = effectiveRent * (managementFee / 100)
    const totalExpenses = monthlyPayment + maintenanceCost + propertyTax + insurance + managementCost
    const netIncome = effectiveRent - totalExpenses
    setNetMonthlyIncome(netIncome)

    // Cash on cash return
    const annualNetIncome = netIncome * 12
    const totalCashInvested = downPayment + closingCosts
    const cashReturn = (annualNetIncome / totalCashInvested) * 100
    setCashOnCashReturn(cashReturn)

    // Cap rate
    const netOperatingIncome = (effectiveRent - maintenanceCost - propertyTax - insurance - managementCost) * 12
    const capRateValue = (netOperatingIncome / propertyPrice) * 100
    setCapRate(capRateValue)

    // Compound projection over N years
    const projection = []
    let cumulativeRent = 0
    let cumulativeMortgage = 0
    let currentPropertyValue = propertyPrice
    const annualMortgagePayment = monthlyPayment * 12

    for (let yr = 1; yr <= projectionYears; yr++) {
      // Compound appreciation on property value each year
      currentPropertyValue = currentPropertyValue * (1 + propertyAppreciation / 100)

      // Rental income grows with appreciation (rents increase over time)
      const yearlyRentGrowth = Math.pow(1 + (propertyAppreciation * 0.6) / 100, yr - 1) // rent grows at 60% of appreciation
      const yearEffectiveRent = (monthlyRent * yearlyRentGrowth) * 12 * (1 - vacancyRate / 100)
      const yearExpenses = (maintenanceCost + propertyTax + insurance) * 12 + yearEffectiveRent * (managementFee / 100)

      cumulativeRent += yearEffectiveRent - yearExpenses
      cumulativeMortgage += annualMortgagePayment

      // Remaining loan balance (amortization)
      const monthlyRate = interestRate / 100 / 12
      const totalPayments = loanTerm * 12
      const paymentsMade = yr * 12
      let remainingBalance = loanAmount
      if (monthlyRate > 0 && loanAmount > 0) {
        remainingBalance = loanAmount * (Math.pow(1 + monthlyRate, totalPayments) - Math.pow(1 + monthlyRate, paymentsMade)) / (Math.pow(1 + monthlyRate, totalPayments) - 1)
        if (remainingBalance < 0) remainingBalance = 0
      } else if (loanAmount > 0) {
        remainingBalance = Math.max(0, loanAmount - (loanAmount / totalPayments) * paymentsMade)
      }

      const equity = currentPropertyValue - remainingBalance
      const totalReturn = equity + cumulativeRent - cumulativeMortgage - totalCashInvested
      const annualizedReturn = totalCashInvested > 0
        ? (Math.pow((totalCashInvested + totalReturn) / totalCashInvested, 1 / yr) - 1) * 100
        : 0

      projection.push({
        year: yr,
        propertyValue: currentPropertyValue,
        cumulativeRent,
        cumulativeMortgage,
        equity,
        totalReturn,
        annualizedReturn,
      })
    }
    setCompoundProjection(projection)

    // Total ROI uses compound projection for the selected period
    const finalProjection = projection[projectionYears - 1]
    const roi = finalProjection ? finalProjection.annualizedReturn : 0
    setTotalROI(roi)

    // Break-even point
    if (netIncome > 0) {
      const months = totalCashInvested / netIncome
      setBreakEvenMonth(Math.ceil(months))
    } else {
      setBreakEvenMonth(0)
    }
  }, [propertyPrice, downPayment, monthlyRent, monthlyPayment, maintenanceCost,
      propertyTax, insurance, managementFee, vacancyRate, closingCosts, propertyAppreciation,
      loanAmount, interestRate, loanTerm, projectionYears])

  // Update loan amount when down payment changes
  useEffect(() => {
    setLoanAmount(propertyPrice - downPayment)
  }, [propertyPrice, downPayment])

  const resetCalculator = () => {
    setPropertyPrice(350000)
    setDownPayment(70000)
    setInterestRate(4.5)
    setLoanTerm(25)
    setMonthlyRent(2500)
    setPropertyAppreciation(5)
    setMaintenanceCost(200)
    setPropertyTax(350)
    setInsurance(150)
    setManagementFee(10)
    setVacancyRate(5)
    setClosingCosts(7000)
    setProjectionYears(10)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
                Investment Calculator
              </h1>
              <p className="text-slate-600">
                Calculate ROI, cash flow, and investment metrics for any property
              </p>
            </div>
            <div className="flex gap-2 mt-4 md:mt-0">
              <button 
                onClick={resetCalculator}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Property Details */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6 flex items-center gap-2">
                <Home className="w-5 h-5 text-[#1B3A5C]" />
                Property Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="Property Price"
                  value={propertyPrice}
                  onChange={setPropertyPrice}
                  type="currency"
                  min={0}
                  step={10000}
                />
                <InputField
                  label="Down Payment"
                  value={downPayment}
                  onChange={setDownPayment}
                  type="currency"
                  min={0}
                  max={propertyPrice}
                  step={5000}
                  percentage={((downPayment / propertyPrice) * 100).toFixed(1)}
                />
                <InputField
                  label="Closing Costs"
                  value={closingCosts}
                  onChange={setClosingCosts}
                  type="currency"
                  min={0}
                  step={500}
                />
                <InputField
                  label="Property Appreciation"
                  value={propertyAppreciation}
                  onChange={setPropertyAppreciation}
                  type="percentage"
                  min={0}
                  max={20}
                  step={0.5}
                />
              </div>
            </div>

            {/* Loan Details */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Loan Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="Loan Amount"
                  value={loanAmount}
                  onChange={() => {}}
                  type="currency"
                  disabled={true}
                />
                <InputField
                  label="Interest Rate"
                  value={interestRate}
                  onChange={setInterestRate}
                  type="percentage"
                  min={0}
                  max={15}
                  step={0.1}
                />
                <InputField
                  label="Loan Term (Years)"
                  value={loanTerm}
                  onChange={setLoanTerm}
                  type="number"
                  min={1}
                  max={30}
                />
                <div className="p-4 bg-[#E0EDF7] rounded-lg">
                  <p className="text-sm text-[#1B3A5C] mb-1">Monthly Payment</p>
                  <p className="text-2xl font-bold text-slate-900">
                    ${monthlyPayment.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Rental Income & Expenses */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#C49A2E]" />
                Income & Expenses
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="Monthly Rent"
                  value={monthlyRent}
                  onChange={setMonthlyRent}
                  type="currency"
                  min={0}
                  step={100}
                />
                <InputField
                  label="Vacancy Rate"
                  value={vacancyRate}
                  onChange={setVacancyRate}
                  type="percentage"
                  min={0}
                  max={50}
                  step={1}
                />
                <InputField
                  label="Maintenance"
                  value={maintenanceCost}
                  onChange={setMaintenanceCost}
                  type="currency"
                  min={0}
                  step={50}
                  monthly={true}
                />
                <InputField
                  label="Property Tax"
                  value={propertyTax}
                  onChange={setPropertyTax}
                  type="currency"
                  min={0}
                  step={50}
                  monthly={true}
                />
                <InputField
                  label="Insurance"
                  value={insurance}
                  onChange={setInsurance}
                  type="currency"
                  min={0}
                  step={25}
                  monthly={true}
                />
                <InputField
                  label="Management Fee"
                  value={managementFee}
                  onChange={setManagementFee}
                  type="percentage"
                  min={0}
                  max={20}
                  step={1}
                />
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="bg-[#1B3A5C] rounded-2xl shadow-lg p-6 text-white">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Investment Metrics
              </h2>
              <div className="space-y-4">
                <MetricDisplay
                  label="Net Monthly Income"
                  value={`$${netMonthlyIncome.toFixed(0)}`}
                  isPositive={netMonthlyIncome > 0}
                />
                <MetricDisplay
                  label="Cash on Cash Return"
                  value={`${cashOnCashReturn.toFixed(2)}%`}
                  isPositive={cashOnCashReturn > 8}
                />
                <MetricDisplay
                  label="Cap Rate"
                  value={`${capRate.toFixed(2)}%`}
                  isPositive={capRate > 6}
                />
                <MetricDisplay
                  label={`Annualized ROI (${projectionYears}yr compound)`}
                  value={`${totalROI.toFixed(2)}%`}
                  isPositive={totalROI > 10}
                />
                <MetricDisplay
                  label="Break-even Point"
                  value={breakEvenMonth > 0 ? `${breakEvenMonth} months` : 'N/A'}
                  isPositive={breakEvenMonth > 0 && breakEvenMonth < 60}
                />
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-[#C49A2E]" />
                Financial Summary
              </h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Projection Period
                </label>
                <select
                  value={projectionYears}
                  onChange={(e) => setProjectionYears(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] text-sm"
                >
                  {[3, 5, 7, 10, 15, 20].map(y => (
                    <option key={y} value={y}>{y} years</option>
                  ))}
                </select>
              </div>
              <div className="space-y-3">
                <SummaryRow label="Total Cash Invested" value={`$${(downPayment + closingCosts).toLocaleString()}`} />
                <SummaryRow label="Year 1 Net Income" value={`$${(netMonthlyIncome * 12).toFixed(0)}`} />
                <SummaryRow label="Total Interest Paid" value={`$${totalInterest.toFixed(0)}`} />
                {compoundProjection.length > 0 && (
                  <div className="pt-3 border-t space-y-3">
                    <SummaryRow
                      label={`${projectionYears}-Year Property Value`}
                      value={`$${compoundProjection[compoundProjection.length - 1].propertyValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                      highlight={true}
                    />
                    <SummaryRow
                      label={`${projectionYears}-Year Total Return`}
                      value={`$${compoundProjection[compoundProjection.length - 1].totalReturn.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                      highlight={true}
                    />
                    <SummaryRow
                      label="Annualized Return (CAGR)"
                      value={`${compoundProjection[compoundProjection.length - 1].annualizedReturn.toFixed(1)}%`}
                      highlight={true}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Compound Growth Projection */}
            {compoundProjection.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#1B3A5C]" />
                  Compound Growth
                </h3>
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-slate-500">
                        <th className="text-left py-2 px-2">Year</th>
                        <th className="text-right py-2 px-2">Value</th>
                        <th className="text-right py-2 px-2">Equity</th>
                        <th className="text-right py-2 px-2">Return</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compoundProjection
                        .filter((_, i) => {
                          if (projectionYears <= 5) return true
                          if (projectionYears <= 10) return i % 2 === 0 || i === compoundProjection.length - 1
                          return i % 3 === 0 || i === compoundProjection.length - 1
                        })
                        .map(p => (
                        <tr key={p.year} className="border-b border-slate-100">
                          <td className="py-1.5 px-2 text-slate-600">Yr {p.year}</td>
                          <td className="py-1.5 px-2 text-right font-medium">${(p.propertyValue / 1000).toFixed(0)}k</td>
                          <td className="py-1.5 px-2 text-right font-medium">${(p.equity / 1000).toFixed(0)}k</td>
                          <td className={`py-1.5 px-2 text-right font-bold ${p.annualizedReturn > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {p.annualizedReturn.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-400 mt-3">
                  Projections use compound appreciation. Rent growth estimated at 60% of property appreciation rate.
                </p>
              </div>
            )}

            {/* Investment Grade */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-green-600" />
                Investment Grade
              </h3>
              <div className="text-center">
                <div className={`text-5xl font-bold mb-2 ${
                  totalROI > 15 ? 'text-green-600' :
                  totalROI > 10 ? 'text-[#1B3A5C]' :
                  totalROI > 5 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {totalROI > 15 ? 'A+' :
                   totalROI > 12 ? 'A' :
                   totalROI > 10 ? 'B+' :
                   totalROI > 8 ? 'B' :
                   totalROI > 5 ? 'C' : 'D'}
                </div>
                <p className="text-slate-600">
                  {totalROI > 15 ? 'Excellent Investment' :
                   totalROI > 10 ? 'Good Investment' :
                   totalROI > 5 ? 'Fair Investment' : 'Poor Investment'}
                </p>
              </div>
              <div className="mt-4 p-3 bg-[#E0EDF7] rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-[#1B3A5C] mt-0.5" />
                  <p className="text-xs text-[#1B3A5C]">
                    This grade is based on total ROI including rental income and property appreciation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Input Field Component
function InputField({ 
  label, 
  value, 
  onChange, 
  type = 'number', 
  min, 
  max, 
  step = 1, 
  disabled = false,
  percentage = null,
  monthly = false
}: any) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label} {percentage && <span className="text-[#1B3A5C]">({percentage}%)</span>}
        {monthly && <span className="text-slate-500 text-xs ml-1">/month</span>}
      </label>
      <div className="relative">
        {type === 'currency' && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
        )}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className={`w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A5C] ${
            type === 'currency' ? 'pl-8' : ''
          } ${type === 'percentage' ? 'pr-8' : ''} ${
            disabled ? 'bg-slate-100 cursor-not-allowed' : ''
          }`}
        />
        {type === 'percentage' && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
        )}
      </div>
    </div>
  )
}

// Metric Display Component
function MetricDisplay({ label, value, isPositive }: any) {
  return (
    <div className="flex justify-between items-center p-3 bg-white/10 rounded-lg">
      <span className="text-sm text-white/70">{label}</span>
      <span className={`text-lg font-bold ${
        isPositive ? 'text-white' : 'text-yellow-300'
      }`}>
        {value}
      </span>
    </div>
  )
}

// Summary Row Component
function SummaryRow({ label, value, highlight = false }: any) {
  return (
    <div className={`flex justify-between items-center ${highlight ? 'font-semibold' : ''}`}>
      <span className="text-sm text-slate-600">{label}</span>
      <span className={`text-sm ${highlight ? 'text-[#1B3A5C] text-base' : 'text-slate-900'}`}>
        {value}
      </span>
    </div>
  )
}
