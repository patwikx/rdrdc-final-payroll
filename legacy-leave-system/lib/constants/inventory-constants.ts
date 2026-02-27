export const DAMAGE_TYPES = [
  { value: 'WATER_DAMAGE', label: 'Water Damage' },
  { value: 'FIRE_DAMAGE', label: 'Fire Damage' },
  { value: 'PHYSICAL_DAMAGE', label: 'Physical Damage' },
  { value: 'NATURAL_DISASTER', label: 'Natural Disaster' },
  { value: 'ACCIDENT', label: 'Accident' },
  { value: 'WEAR_AND_TEAR', label: 'Wear and Tear' },
  { value: 'OTHER', label: 'Other' },
] as const

export const DAMAGE_SEVERITIES = [
  { value: 'MINOR', label: 'Minor' },
  { value: 'MODERATE', label: 'Moderate' },
  { value: 'SEVERE', label: 'Severe' },
  { value: 'TOTAL_LOSS', label: 'Total Loss' },
] as const

export const RECOVERY_STATUSES = [
  { value: 'PENDING_ASSESSMENT', label: 'Pending Assessment' },
  { value: 'ASSESSED', label: 'Assessed' },
  { value: 'LISTED_FOR_SALE', label: 'Listed for Sale' },
  { value: 'PARTIALLY_SOLD', label: 'Partially Sold' },
  { value: 'FULLY_SOLD', label: 'Fully Sold' },
  { value: 'SCRAPPED', label: 'Scrapped' },
  { value: 'DISPOSED', label: 'Disposed' },
] as const

export const RECOVERY_METHODS = [
  { value: 'SOLD_AS_IS', label: 'Sold As-Is' },
  { value: 'REPAIRED_THEN_SOLD', label: 'Repaired Then Sold' },
  { value: 'SOLD_FOR_PARTS', label: 'Sold for Parts' },
  { value: 'SCRAPPED', label: 'Scrapped' },
  { value: 'DISPOSED', label: 'Disposed' },
  { value: 'DONATED', label: 'Donated' },
] as const
