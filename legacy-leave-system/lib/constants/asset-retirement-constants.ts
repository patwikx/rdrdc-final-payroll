export const RETIREMENT_REASONS = [
  { value: 'END_OF_USEFUL_LIFE', label: 'End of Useful Life' },
  { value: 'FULLY_DEPRECIATED', label: 'Fully Depreciated' },
  { value: 'OBSOLETE', label: 'Obsolete' },
  { value: 'DAMAGED_BEYOND_REPAIR', label: 'Damaged Beyond Repair' },
  { value: 'POLICY_CHANGE', label: 'Policy Change' },
  { value: 'UPGRADE_REPLACEMENT', label: 'Upgrade/Replacement' }
] as const

export const RETIREMENT_METHODS = [
  { value: 'NORMAL_RETIREMENT', label: 'Normal Retirement' },
  { value: 'EARLY_RETIREMENT', label: 'Early Retirement' },
  { value: 'EMERGENCY_RETIREMENT', label: 'Emergency Retirement' },
  { value: 'PLANNED_REPLACEMENT', label: 'Planned Replacement' },
  { value: 'POLICY_DRIVEN', label: 'Policy Driven' }
] as const

export const ASSET_CONDITIONS = [
  { value: 'EXCELLENT', label: 'Excellent' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
  { value: 'POOR', label: 'Poor' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'NON_FUNCTIONAL', label: 'Non-Functional' }
] as const