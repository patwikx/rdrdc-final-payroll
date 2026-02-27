export const DISPOSAL_METHODS = [
  { value: 'SALE', label: 'Sale' },
  { value: 'SCRAP', label: 'Scrap' },
  { value: 'DONATION', label: 'Donation' },
  { value: 'TRADE_IN', label: 'Trade-in' },
  { value: 'DESTRUCTION', label: 'Destruction' },
  { value: 'OTHER', label: 'Other' }
] as const

export const DISPOSAL_REASONS = [
  { value: 'SOLD', label: 'Sold' },
  { value: 'DONATED', label: 'Donated' },
  { value: 'SCRAPPED', label: 'Scrapped' },
  { value: 'LOST', label: 'Lost' },
  { value: 'STOLEN', label: 'Stolen' },
  { value: 'TRANSFERRED', label: 'Transferred' },
  { value: 'END_OF_LIFE', label: 'End of Life' },
  { value: 'DAMAGED_BEYOND_REPAIR', label: 'Damaged Beyond Repair' },
  { value: 'OBSOLETE', label: 'Obsolete' },
  { value: 'REGULATORY_COMPLIANCE', label: 'Regulatory Compliance' }
] as const