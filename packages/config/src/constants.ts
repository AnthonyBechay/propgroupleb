export const SUPPORTED_COUNTRIES = [
  { id: 'lebanon', name: 'Lebanon' }
] as const;

export const PROPERTY_STATUSES = [
  'OFF_PLAN',
  'NEW_BUILD', 
  'RESALE'
] as const;

export const INVESTMENT_GOALS = [
  'HIGH_ROI',
  'CAPITAL_GROWTH',
  'GOLDEN_VISA'
] as const;

export type Country = typeof SUPPORTED_COUNTRIES[number]['id'];
export type PropertyStatus = typeof PROPERTY_STATUSES[number];
export type InvestmentGoal = typeof INVESTMENT_GOALS[number];
