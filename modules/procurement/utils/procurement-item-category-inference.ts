import type { BulkImportProcurementItemsInput } from "@/modules/procurement/schemas/procurement-bulk-import-schema"

type BulkImportRow = BulkImportProcurementItemsInput["rows"][number]

type InferredCategoryRule = {
  code: string
  name: string
  keywords: readonly string[]
}

export type ResolvedBulkCategory = {
  categoryCode: string
  categoryName: string
}

export const DEFAULT_BULK_CATEGORY_CODE = "MISC"
export const DEFAULT_BULK_CATEGORY_NAME = "Miscellaneous Items"

const MIN_RECURRING_CANDIDATE_COUNT = 8

const INFERRED_CATEGORY_RULES: readonly InferredCategoryRule[] = [
  {
    code: "CLEANING_CHEMICALS",
    name: "Cleaning Chemicals",
    keywords: [
      "MURIATIC",
      "BLEACH",
      "DETERGENT",
      "DEGREASER",
      "DISINFECT",
      "DISINFECTANT",
      "SANITIZER",
      "CHLORINE",
      "SOAP",
      "ACID",
      "CLEANER",
      "SOLVENT",
      "ALCOHOL",
    ],
  },
  {
    code: "OFFICE_SUPPLIES",
    name: "Office Supplies",
    keywords: [
      "BOND PAPER",
      "PAPER",
      "BALLPEN",
      "PEN",
      "NOTEBOOK",
      "FOLDER",
      "ENVELOPE",
      "STAPLE",
      "MARKER",
      "INK",
      "TONER",
      "CLIP",
      "TAPE",
    ],
  },
  {
    code: "PACKAGING_SUPPLIES",
    name: "Packaging Supplies",
    keywords: [
      "PACKAGING",
      "PLASTIC",
      "TRASH BAG",
      "SANDO BAG",
      "WRAP",
      "FOIL",
      "CONTAINER",
      "CUP",
      "LID",
      "STRAW",
      "BOX",
      "PAPER BAG",
    ],
  },
  {
    code: "BEVERAGES",
    name: "Beverages",
    keywords: [
      "COFFEE",
      "TEA",
      "JUICE",
      "SODA",
      "SOFTDRINK",
      "BOTTLED WATER",
      "MINERAL WATER",
      "DRINK",
      "BEVERAGE",
    ],
  },
  {
    code: "FOOD_INGREDIENTS",
    name: "Food Ingredients",
    keywords: [
      "SAUCE",
      "KETCHUP",
      "VINEGAR",
      "MUSTARD",
      "OIL",
      "SUGAR",
      "SALT",
      "FLOUR",
      "SEASONING",
      "SPICE",
      "POWDER",
      "PASTA",
      "NOODLE",
      "RICE",
      "CORN",
      "MCCORMICK",
      "NUTMEG",
      "CINNAMON",
      "VANILLA",
      "TOCINO",
      "OLIVES",
      "MILK",
      "CREAM",
      "CHEESE",
      "MEAT",
      "CHICKEN",
      "BEEF",
      "PORK",
      "FISH",
      "TUNA",
      "EGG",
      "GARLIC",
      "ONION",
      "BASIL",
    ],
  },
  {
    code: "MAINTENANCE_HARDWARE",
    name: "Maintenance & Hardware",
    keywords: [
      "HAMMER",
      "NAIL",
      "SCREW",
      "BOLT",
      "WRENCH",
      "PLIERS",
      "DRILL",
      "PAINT",
      "BRUSH",
      "ADHESIVE",
      "SEALANT",
      "CEMENT",
    ],
  },
  {
    code: "ELECTRICAL_SUPPLIES",
    name: "Electrical Supplies",
    keywords: [
      "WIRE",
      "CABLE",
      "SWITCH",
      "OUTLET",
      "BREAKER",
      "BULB",
      "LIGHT",
      "LED",
      "ELECTRICAL",
      "CONDUIT",
    ],
  },
  {
    code: "PLUMBING_SUPPLIES",
    name: "Plumbing Supplies",
    keywords: ["PIPE", "PVC", "FAUCET", "VALVE", "PLUMBING", "HOSE", "COUPLING"],
  },
  {
    code: "SAFETY_PPE",
    name: "Safety & PPE",
    keywords: ["GLOVES", "MASK", "HELMET", "SAFETY", "GOGGLES", "VEST", "PPE", "RESPIRATOR"],
  },
  {
    code: "MEDICAL_SUPPLIES",
    name: "Medical Supplies",
    keywords: [
      "BANDAGE",
      "GAUZE",
      "SYRINGE",
      "MEDICAL",
      "FIRST AID",
      "THERMOMETER",
      "COTTON",
      "ANTISEPTIC",
    ],
  },
  {
    code: "IT_SUPPLIES",
    name: "IT Supplies",
    keywords: [
      "LAPTOP",
      "MOUSE",
      "KEYBOARD",
      "MONITOR",
      "PRINTER",
      "ROUTER",
      "MODEM",
      "USB",
      "HARD DRIVE",
      "SSD",
      "MEMORY",
      "CARTRIDGE",
    ],
  },
]

const CANDIDATE_CODE_CANONICAL_MAP: Record<string, ResolvedBulkCategory> = {
  VEGE: { categoryCode: "FOOD_INGREDIENTS", categoryName: "Food Ingredients" },
  VEG: { categoryCode: "FOOD_INGREDIENTS", categoryName: "Food Ingredients" },
  FRUT: { categoryCode: "FOOD_INGREDIENTS", categoryName: "Food Ingredients" },
  FRUIT: { categoryCode: "FOOD_INGREDIENTS", categoryName: "Food Ingredients" },
  SPICES: { categoryCode: "FOOD_INGREDIENTS", categoryName: "Food Ingredients" },
  SPICE: { categoryCode: "FOOD_INGREDIENTS", categoryName: "Food Ingredients" },
  FUNG: { categoryCode: "FOOD_INGREDIENTS", categoryName: "Food Ingredients" },
  NDLE: { categoryCode: "FOOD_INGREDIENTS", categoryName: "Food Ingredients" },
  NOODLE: { categoryCode: "FOOD_INGREDIENTS", categoryName: "Food Ingredients" },
  ADDI: { categoryCode: "FOOD_INGREDIENTS", categoryName: "Food Ingredients" },
  FORM: { categoryCode: "FOOD_INGREDIENTS", categoryName: "Food Ingredients" },
  SAUCE: { categoryCode: "FOOD_INGREDIENTS", categoryName: "Food Ingredients" },
  BRED: { categoryCode: "FOOD_INGREDIENTS", categoryName: "Food Ingredients" },
  WINE: { categoryCode: "BEVERAGES", categoryName: "Beverages" },
  BEER: { categoryCode: "BEVERAGES", categoryName: "Beverages" },
  CRMR: { categoryCode: "BEVERAGES", categoryName: "Beverages" },
  CLPN: { categoryCode: "CLEANING_CHEMICALS", categoryName: "Cleaning Chemicals" },
  DSHW: { categoryCode: "CLEANING_CHEMICALS", categoryName: "Cleaning Chemicals" },
  GLMN: { categoryCode: "CLEANING_CHEMICALS", categoryName: "Cleaning Chemicals" },
  TSUE: { categoryCode: "PACKAGING_SUPPLIES", categoryName: "Packaging Supplies" },
}

const normalizeForMatch = (value: string): string => {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
}

const sanitizeCategoryCode = (value: string): string => {
  const sanitized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
  const fallback = sanitized.length > 0 ? sanitized : DEFAULT_BULK_CATEGORY_CODE
  return fallback.slice(0, 60)
}

const toTitleCaseWords = (value: string): string => {
  return value
    .split(/[_\s-]+/)
    .filter((part) => part.trim().length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

const buildExplicitCategoryFromRow = (row: BulkImportRow): ResolvedBulkCategory | null => {
  const explicitCode = row.categoryCode?.trim()
  const explicitName = row.categoryName?.trim()

  if (!explicitCode && !explicitName) {
    return null
  }

  const categoryCode = sanitizeCategoryCode(explicitCode ?? explicitName ?? DEFAULT_BULK_CATEGORY_CODE)
  const categoryName = (explicitName && explicitName.length > 0
    ? explicitName
    : categoryCode === DEFAULT_BULK_CATEGORY_CODE
      ? DEFAULT_BULK_CATEGORY_NAME
      : `${toTitleCaseWords(categoryCode)} Items`
  ).slice(0, 120)

  return { categoryCode, categoryName }
}

const inferCategoryByKeywords = (row: BulkImportRow): ResolvedBulkCategory | null => {
  const normalized = normalizeForMatch(`${row.itemName} ${row.itemDescription ?? ""}`)
  const haystack = ` ${normalized} `

  let bestRule: InferredCategoryRule | null = null
  let bestScore = 0

  for (const rule of INFERRED_CATEGORY_RULES) {
    let score = 0
    for (const keyword of rule.keywords) {
      const normalizedKeyword = normalizeForMatch(keyword)
      if (!normalizedKeyword) {
        continue
      }
      if (haystack.includes(` ${normalizedKeyword} `)) {
        score += 1
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestRule = rule
    }
  }

  if (!bestRule || bestScore === 0) {
    return null
  }

  return {
    categoryCode: bestRule.code,
    categoryName: bestRule.name,
  }
}

const deriveCandidateCategoryCodeFromItemCode = (itemCode: string): string | null => {
  const normalized = itemCode.trim().toUpperCase()
  if (!normalized) {
    return null
  }

  const firstToken = normalized.split(/[-_/.\s]+/).find((token) => token.length > 0)
  if (firstToken) {
    const firstTokenAlphaPrefix = firstToken.match(/^([A-Z]{2,6})\d/)
    if (firstTokenAlphaPrefix?.[1]) {
      return sanitizeCategoryCode(firstTokenAlphaPrefix[1])
    }

    if (/^[A-Z]{2,12}$/.test(firstToken)) {
      return sanitizeCategoryCode(firstToken)
    }
  }

  const alphaPrefix = normalized.match(/^([A-Z]{2,6})\d/)
  if (alphaPrefix?.[1]) {
    return sanitizeCategoryCode(alphaPrefix[1])
  }

  return null
}

const deriveCandidateCategoryCodeFromItemName = (itemName: string): string | null => {
  const ignored = new Set([
    "THE",
    "AND",
    "FOR",
    "WITH",
    "PCS",
    "PC",
    "SET",
    "PACK",
    "BOX",
    "OF",
    "KG",
    "G",
    "ML",
    "L",
    "BOTTLE",
  ])

  const tokens = normalizeForMatch(itemName)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && token.length <= 12)

  const candidate = tokens.find((token) => token.length >= 3 && !ignored.has(token))
  return candidate ? sanitizeCategoryCode(candidate) : null
}

const deriveCandidateCategoryCode = (row: BulkImportRow): string | null => {
  return deriveCandidateCategoryCodeFromItemCode(row.itemCode) ?? deriveCandidateCategoryCodeFromItemName(row.itemName)
}

const buildDerivedName = (code: string): string => {
  return (code === DEFAULT_BULK_CATEGORY_CODE ? DEFAULT_BULK_CATEGORY_NAME : `${toTitleCaseWords(code)} Items`).slice(
    0,
    120
  )
}

const mapCandidateToCanonicalCategory = (candidate: string): ResolvedBulkCategory | null => {
  return CANDIDATE_CODE_CANONICAL_MAP[candidate] ?? null
}

export const resolveBulkCategoryAssignments = (rows: readonly BulkImportRow[]): ResolvedBulkCategory[] => {
  const recurringCandidateCounts = new Map<string, number>()

  for (const row of rows) {
    if (buildExplicitCategoryFromRow(row)) {
      continue
    }
    if (inferCategoryByKeywords(row)) {
      continue
    }

    const candidate = deriveCandidateCategoryCode(row)
    if (!candidate) {
      continue
    }

    recurringCandidateCounts.set(candidate, (recurringCandidateCounts.get(candidate) ?? 0) + 1)
  }

  const recurringCandidates = new Set<string>()
  for (const [candidate, count] of recurringCandidateCounts.entries()) {
    if (count >= MIN_RECURRING_CANDIDATE_COUNT) {
      recurringCandidates.add(candidate)
    }
  }

  return rows.map((row) => {
    const explicit = buildExplicitCategoryFromRow(row)
    if (explicit) {
      return explicit
    }

    const keywordCategory = inferCategoryByKeywords(row)
    if (keywordCategory) {
      return keywordCategory
    }

    const candidate = deriveCandidateCategoryCode(row)
    if (candidate && recurringCandidates.has(candidate)) {
      const canonicalCategory = mapCandidateToCanonicalCategory(candidate)
      if (canonicalCategory) {
        return canonicalCategory
      }

      return {
        categoryCode: candidate,
        categoryName: buildDerivedName(candidate),
      }
    }

    return {
      categoryCode: DEFAULT_BULK_CATEGORY_CODE,
      categoryName: DEFAULT_BULK_CATEGORY_NAME,
    }
  })
}
