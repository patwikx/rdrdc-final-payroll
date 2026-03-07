import assert from "node:assert/strict"
import test from "node:test"

import {
  DEFAULT_BULK_CATEGORY_CODE,
  DEFAULT_BULK_CATEGORY_NAME,
  resolveBulkCategoryAssignments,
} from "../modules/procurement/utils/procurement-item-category-inference.ts"

test("resolveBulkCategoryAssignments preserves explicit category values", () => {
  const rows = [
    {
      categoryCode: "OPS",
      categoryName: "Operations Supplies",
      itemCode: "ABC-001",
      itemName: "Custom Item",
      itemDescription: "",
      uom: "PCS",
      unitPrice: 100,
      isActive: true,
    },
  ]

  const resolved = resolveBulkCategoryAssignments(rows)
  assert.equal(resolved[0]?.categoryCode, "OPS")
  assert.equal(resolved[0]?.categoryName, "Operations Supplies")
})

test("resolveBulkCategoryAssignments groups food ingredient items together", () => {
  const rows = [
    {
      itemCode: "A1S",
      itemName: "A1 SAUCE ORIGINAL 283G",
      itemDescription: "",
      uom: "BOT",
      unitPrice: undefined,
      isActive: true,
    },
    {
      itemCode: "ADDI0013",
      itemName: "VANILLA MCCORMICK 20ML",
      itemDescription: "",
      uom: "BOT",
      unitPrice: undefined,
      isActive: true,
    },
  ]

  const resolved = resolveBulkCategoryAssignments(rows)
  assert.equal(resolved[0]?.categoryCode, "FOOD_INGREDIENTS")
  assert.equal(resolved[1]?.categoryCode, "FOOD_INGREDIENTS")
})

test("resolveBulkCategoryAssignments detects cleaning chemicals", () => {
  const rows = [
    {
      itemCode: "ACID0001",
      itemName: "MERSHA ACID MURIATIC COMMERCIAL 1GAL",
      itemDescription: "",
      uom: "GAL",
      unitPrice: undefined,
      isActive: true,
    },
  ]

  const resolved = resolveBulkCategoryAssignments(rows)
  assert.equal(resolved[0]?.categoryCode, "CLEANING_CHEMICALS")
  assert.equal(resolved[0]?.categoryName, "Cleaning Chemicals")
})

test("resolveBulkCategoryAssignments uses recurring candidates for unknown groups", () => {
  const rows = Array.from({ length: 8 }, (_, index) => ({
    itemCode: `FAB00${index + 1}`,
    itemName: `Fab Custom Variant ${index + 1}`,
    itemDescription: "",
    uom: "PCS",
    unitPrice: undefined,
    isActive: true,
  }))

  const resolved = resolveBulkCategoryAssignments(rows)
  assert.equal(resolved[0]?.categoryCode, "FAB")
  assert.equal(resolved[1]?.categoryCode, "FAB")
  assert.equal(resolved[2]?.categoryCode, "FAB")
})

test("resolveBulkCategoryAssignments falls back to misc for non-recurring unknown items", () => {
  const rows = [
    {
      itemCode: "ZXQ-001",
      itemName: "ZXQ Variant A",
      itemDescription: "",
      uom: "PCS",
      unitPrice: undefined,
      isActive: true,
    },
    {
      itemCode: "LMN-001",
      itemName: "LMN Variant B",
      itemDescription: "",
      uom: "PCS",
      unitPrice: undefined,
      isActive: true,
    },
  ]

  const resolved = resolveBulkCategoryAssignments(rows)
  assert.equal(resolved[0]?.categoryCode, DEFAULT_BULK_CATEGORY_CODE)
  assert.equal(resolved[0]?.categoryName, DEFAULT_BULK_CATEGORY_NAME)
  assert.equal(resolved[1]?.categoryCode, DEFAULT_BULK_CATEGORY_CODE)
  assert.equal(resolved[1]?.categoryName, DEFAULT_BULK_CATEGORY_NAME)
})
