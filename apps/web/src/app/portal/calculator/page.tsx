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

  // Calculated values
  const [monthlyPayment, setMonthlyPayment] = useState(0)
  const [totalInterest, setTotalInterest] = useState(0)
  const [netMonthlyIncome, setNetMonthlyIncome] = useState(0)
  const [cashOnCashReturn, setCashOnCashReturn] = useState(0)
  const [capRate, setCapRate] = useState(0)
  const [totalROI, setTotalROI] = useState(0)
  const [breakEvenMonth, setBreakEvenMonth] = useState(0)

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

    // Total ROI (including appreciation)
    const annualAppreciation = propertyPrice * (propertyAppreciation / 100)
    const totalAnnualReturn = annualNetIncome + annualAppreciation
    const roi = (totalAnnualReturn / totalCashInvested) * 100
    setTotalROI(roi)

    // Break-even point
    if (netIncome > 0) {
      const months = totalCashInvested / netIncome
      setBreakEvenMonth(Math.ceil(months))
    } else {
      setBreakEvenMonth(0)
    }
  }, [propertyPrice, downPayment, monthlyRent, monthlyPayment, maintenanceCost, 
      propertyTax, insurance, managementFee, vacancyRate, closingCosts, propertyAppreciation])

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
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-stone-900 mb-2">
                Investment Calculator
              </h1>
              <p className="text-stone-600">
                Calculate ROI, cash flow, and investment metrics for any property
              </p>
            </div>
            <div className="flex gap-2 mt-4 md:mt-0">
              <button 
                onClick={resetCalculator}
                className="px-4 py-2 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors flex items-center gap-2"
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
              <h2 className="text-xl font-semibold text-stone-900 mb-6 flex items-center gap-2">
                <Home className="w-5 h-5 text-[#1B4965]" />
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
              <h2 className="text-xl font-semibold text-stone-900 mb-6 flex items-center gap-2">
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
                <div className="p-4 bg-[#E8F1F5] rounded-lg">
                  <p className="text-sm text-[#1B4965] mb-1">Monthly Payment</p>
                  <p className="text-2xl font-bold text-stone-900">
                    ${monthlyPayment.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Rental Income & Expenses */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-xl font-semibold text-stone-900 mb-6 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#C97B4B]" />
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
            <div className="bg-[#1B4965] rounded-2xl shadow-lg p-6 text-white">
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
                  label="Total ROI (w/ appreciation)"
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
              <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-[#C97B4B]" />
                Financial Summary
              </h3>
              <div className="space-y-3">
                <SummaryRow label="Total Investment" value={`$${(downPayment + closingCosts).toLocaleString()}`} />
                <SummaryRow label="Annual Rental Income" value={`$${(monthlyRent * 12 * (1 - vacancyRate/100)).toFixed(0)}`} />
                <SummaryRow label="Annual Net Income" value={`$${(netMonthlyIncome * 12).toFixed(0)}`} />
                <SummaryRow label="Total Interest Paid" value={`$${totalInterest.toFixed(0)}`} />
                <div className="pt-3 border-t">
                  <SummaryRow 
                    label="10-Year Property Value" 
                    value={`$${(propertyPrice * Math.pow(1 + propertyAppreciation/100, 10)).toFixed(0)}`}
                    highlight={true}
                  />
                </div>
              </div>
            </div>

            {/* Investment Grade */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-green-600" />
                Investment Grade
              </h3>
              <div className="text-center">
                <div className={`text-5xl font-bold mb-2 ${
                  totalROI > 15 ? 'text-green-600' :
                  totalROI > 10 ? 'text-[#1B4965]' :
                  totalROI > 5 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {totalROI > 15 ? 'A+' :
                   totalROI > 12 ? 'A' :
                   totalROI > 10 ? 'B+' :
                   totalROI > 8 ? 'B' :
                   totalROI > 5 ? 'C' : 'D'}
                </div>
                <p className="text-stone-600">
                  {totalROI > 15 ? 'Excellent Investment' :
                   totalROI > 10 ? 'Good Investment' :
                   totalROI > 5 ? 'Fair Investment' : 'Poor Investment'}
                </p>
              </div>
              <div className="mt-4 p-3 bg-[#E8F1F5] rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-[#1B4965] mt-0.5" />
                  <p className="text-xs text-[#1B4965]">
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
      <label className="block text-sm font-medium text-stone-700 mb-2">
        {label} {percentage && <span className="text-[#1B4965]">({percentage}%)</span>}
        {monthly && <span className="text-stone-500 text-xs ml-1">/month</span>}
      </label>
      <div className="relative">
        {type === 'currency' && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">$</span>
        )}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className={`w-full px-3 py-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B4965] ${
            type === 'currency' ? 'pl-8' : ''
          } ${type === 'percentage' ? 'pr-8' : ''} ${
            disabled ? 'bg-stone-100 cursor-not-allowed' : ''
          }`}
        />
        {type === 'percentage' && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500">%</span>
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
      <span className="text-sm text-stone-600">{label}</span>
      <span className={`text-sm ${highlight ? 'text-[#1B4965] text-base' : 'text-stone-900'}`}>
        {value}
      </span>
    </div>
  )
}
