const DISALLOWED_RECURRING_EARNING_PATTERNS: RegExp[] = [
  /\bOVERTIME\b/i,
  /\bOT\b/i,
  /NIGHT[\s_-]*DIFF/i,
  /\bHOLIDAY\b/i,
  /\bADJUSTMENT\b/i,
]

export const isDisallowedRecurringEarningType = (earningTypeCode: string, earningTypeName: string): boolean => {
  const haystack = `${earningTypeCode} ${earningTypeName}`.toUpperCase()
  return DISALLOWED_RECURRING_EARNING_PATTERNS.some((pattern) => pattern.test(haystack))
}
