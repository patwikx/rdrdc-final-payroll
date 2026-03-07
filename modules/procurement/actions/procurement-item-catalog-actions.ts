"use server"

import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"

import { db } from "@/lib/db"
import { createAuditLog } from "@/modules/audit/utils/audit-log"
import { getActiveCompanyContext } from "@/modules/auth/utils/active-company-context"
import type { CompanyRole } from "@/modules/auth/utils/authorization-policy"
import {
  getProcurementItemCatalogInputSchema,
  upsertProcurementItemCategoryInputSchema,
  upsertProcurementItemInputSchema,
  type GetProcurementItemCatalogInput,
  type UpsertProcurementItemCategoryInput,
  type UpsertProcurementItemInput,
} from "@/modules/procurement/schemas/procurement-item-catalog-actions-schema"
import {
  bulkImportProcurementItemsInputSchema,
  type BulkImportProcurementItemsInput,
} from "@/modules/procurement/schemas/procurement-bulk-import-schema"
import type {
  ProcurementActionDataResult,
  ProcurementActionResult,
} from "@/modules/procurement/types/procurement-action-result"
import type { ProcurementItemCatalogViewModel } from "@/modules/procurement/types/procurement-item-catalog-types"
import { resolveBulkCategoryAssignments } from "@/modules/procurement/utils/procurement-item-category-inference"
import {
  canManagePurchaseRequestItemCatalog,
  getPurchaseRequestItemManagerFlag,
} from "@/modules/procurement/utils/purchase-request-workflow"

const toCatalogViewModel = (payload: {
  categories: Array<{
    id: string
    code: string
    name: string
    description: string | null
    isActive: boolean
  }>
  items: Array<{
    id: string
    categoryId: string
    code: string
    name: string
    description: string | null
    uom: string
    unitPrice: Prisma.Decimal | null
    isActive: boolean
    category: {
      code: string
      name: string
    }
  }>
}): ProcurementItemCatalogViewModel => {
  return {
    categories: payload.categories,
    items: payload.items.map((item) => ({
      id: item.id,
      categoryId: item.categoryId,
      categoryCode: item.category.code,
      categoryName: item.category.name,
      code: item.code,
      name: item.name,
      description: item.description,
      uom: item.uom,
      unitPrice: item.unitPrice === null ? null : Number(item.unitPrice),
      isActive: item.isActive,
    })),
  }
}

const getCatalogRevalidationPaths = (companyId: string): string[] => {
  return [
    `/${companyId}/settings/material-requests/item-catalog`,
    `/${companyId}/employee-portal/procurement-item-catalog`,
    `/${companyId}/employee-portal/purchase-requests/new`,
    `/${companyId}/employee-portal/purchase-requests`,
  ]
}

const revalidateCatalogPaths = (companyId: string): void => {
  for (const path of getCatalogRevalidationPaths(companyId)) {
    revalidatePath(path)
  }
}

const ensureCatalogManagementAccess = async (companyId: string): Promise<
  | {
      ok: true
      context: Awaited<ReturnType<typeof getActiveCompanyContext>>
    }
  | {
      ok: false
      error: string
    }
> => {
  const context = await getActiveCompanyContext({ companyId })
  const companyRole = context.companyRole as CompanyRole
  const isPurchaseRequestItemManager = await getPurchaseRequestItemManagerFlag({
    userId: context.userId,
    companyId: context.companyId,
  })

  if (!canManagePurchaseRequestItemCatalog({ role: companyRole, isPurchaseRequestItemManager })) {
    return { ok: false, error: "You are not allowed to manage the global procurement item catalog." }
  }

  return {
    ok: true,
    context,
  }
}

export async function getProcurementItemCatalogAction(
  input: GetProcurementItemCatalogInput
): Promise<ProcurementActionDataResult<ProcurementItemCatalogViewModel>> {
  const parsed = getProcurementItemCatalogInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid catalog payload." }
  }

  const access = await ensureCatalogManagementAccess(parsed.data.companyId)
  if (!access.ok) {
    return access
  }

  const payload = parsed.data
  const search = payload.search?.trim() ?? ""
  const includeInactive = payload.includeInactive ?? false

  const [categories, items] = await Promise.all([
    db.procurementItemCategory.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        ...(search
          ? {
              OR: [
                { code: { contains: search, mode: "insensitive" } },
                { name: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isActive: true,
      },
    }),
    db.procurementItem.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        ...(payload.categoryId ? { categoryId: payload.categoryId } : {}),
        ...(search
          ? {
              OR: [
                { code: { contains: search, mode: "insensitive" } },
                { name: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
      select: {
        id: true,
        categoryId: true,
        code: true,
        name: true,
        description: true,
        uom: true,
        unitPrice: true,
        isActive: true,
        category: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    }),
  ])

  return {
    ok: true,
    data: toCatalogViewModel({ categories, items }),
  }
}

export async function getProcurementItemPickerOptionsAction(
  input: GetProcurementItemCatalogInput
): Promise<ProcurementActionDataResult<ProcurementItemCatalogViewModel>> {
  const parsed = getProcurementItemCatalogInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid item picker payload." }
  }

  const payload = parsed.data
  await getActiveCompanyContext({ companyId: payload.companyId })

  const search = payload.search?.trim() ?? ""

  const [categories, items] = await Promise.all([
    db.procurementItemCategory.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isActive: true,
      },
    }),
    db.procurementItem.findMany({
      where: {
        isActive: true,
        category: {
          isActive: true,
        },
        ...(payload.categoryId ? { categoryId: payload.categoryId } : {}),
        ...(search
          ? {
              OR: [
                { code: { contains: search, mode: "insensitive" } },
                { name: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ code: "asc" }],
      take: 300,
      select: {
        id: true,
        categoryId: true,
        code: true,
        name: true,
        description: true,
        uom: true,
        unitPrice: true,
        isActive: true,
        category: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    }),
  ])

  return {
    ok: true,
    data: toCatalogViewModel({ categories, items }),
  }
}

export async function upsertProcurementItemCategoryAction(
  input: UpsertProcurementItemCategoryInput
): Promise<ProcurementActionResult> {
  const parsed = upsertProcurementItemCategoryInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid category payload." }
  }

  const payload = parsed.data
  const access = await ensureCatalogManagementAccess(payload.companyId)
  if (!access.ok) {
    return access
  }

  const code = payload.code.trim().toUpperCase()
  const name = payload.name.trim()

  try {
    if (payload.categoryId) {
      const categoryId = payload.categoryId
      await db.$transaction(async (tx) => {
        await tx.procurementItemCategory.update({
          where: {
            id: categoryId,
          },
          data: {
            code,
            name,
            description: payload.description,
            isActive: payload.isActive ?? true,
            updatedById: access.context.userId,
          },
        })

        await createAuditLog(
          {
            tableName: "ProcurementItemCategory",
            recordId: categoryId,
            action: "UPDATE",
            userId: access.context.userId,
            reason: "UPDATE_PROCUREMENT_ITEM_CATEGORY",
          },
          tx
        )
      })

      revalidateCatalogPaths(access.context.companyId)
      return { ok: true, message: "Category updated." }
    }

    await db.$transaction(async (tx) => {
      const created = await tx.procurementItemCategory.create({
        data: {
          code,
          name,
          description: payload.description,
          isActive: payload.isActive ?? true,
          createdById: access.context.userId,
          updatedById: access.context.userId,
        },
        select: {
          id: true,
        },
      })

      await createAuditLog(
        {
          tableName: "ProcurementItemCategory",
          recordId: created.id,
          action: "CREATE",
          userId: access.context.userId,
          reason: "CREATE_PROCUREMENT_ITEM_CATEGORY",
        },
        tx
      )
    })

    revalidateCatalogPaths(access.context.companyId)
    return { ok: true, message: "Category created." }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "A category with the same code or name already exists." }
    }

    const message = error instanceof Error ? error.message : "Failed to save category."
    return { ok: false, error: message }
  }
}

export async function upsertProcurementItemAction(
  input: UpsertProcurementItemInput
): Promise<ProcurementActionResult> {
  const parsed = upsertProcurementItemInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid item payload." }
  }

  const payload = parsed.data
  const access = await ensureCatalogManagementAccess(payload.companyId)
  if (!access.ok) {
    return access
  }

  const category = await db.procurementItemCategory.findFirst({
    where: {
      id: payload.categoryId,
    },
    select: {
      id: true,
    },
  })

  if (!category) {
    return { ok: false, error: "Selected category was not found." }
  }

  const code = payload.code.trim().toUpperCase()
  const name = payload.name.trim()
  const uom = payload.uom.trim().toUpperCase()
  const unitPrice = payload.unitPrice === undefined ? null : payload.unitPrice

  try {
    if (payload.itemId) {
      const itemId = payload.itemId
      await db.$transaction(async (tx) => {
        await tx.procurementItem.update({
          where: {
            id: itemId,
          },
          data: {
            categoryId: payload.categoryId,
            code,
            name,
            description: payload.description,
            uom,
            unitPrice,
            isActive: payload.isActive ?? true,
            updatedById: access.context.userId,
          },
        })

        await createAuditLog(
          {
            tableName: "ProcurementItem",
            recordId: itemId,
            action: "UPDATE",
            userId: access.context.userId,
            reason: "UPDATE_PROCUREMENT_ITEM",
          },
          tx
        )
      })

      revalidateCatalogPaths(access.context.companyId)
      return { ok: true, message: "Item updated." }
    }

    await db.$transaction(async (tx) => {
      const created = await tx.procurementItem.create({
        data: {
          categoryId: payload.categoryId,
          code,
          name,
          description: payload.description,
          uom,
          unitPrice,
          isActive: payload.isActive ?? true,
          createdById: access.context.userId,
          updatedById: access.context.userId,
        },
        select: {
          id: true,
        },
      })

      await createAuditLog(
        {
          tableName: "ProcurementItem",
          recordId: created.id,
          action: "CREATE",
          userId: access.context.userId,
          reason: "CREATE_PROCUREMENT_ITEM",
        },
        tx
      )
    })

    revalidateCatalogPaths(access.context.companyId)
    return { ok: true, message: "Item created." }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "An item with the same code already exists." }
    }

    const message = error instanceof Error ? error.message : "Failed to save item."
    return { ok: false, error: message }
  }
}

export type BulkImportResultRow = {
  rowIndex: number
  itemCode: string
  status: "created" | "updated" | "error"
  message: string
}

export type BulkImportResult = {
  ok: true
  created: number
  updated: number
  errors: number
  rows: BulkImportResultRow[]
}

type NormalizedBulkImportRow = {
  categoryCode: string
  categoryName: string
  itemCode: string
  itemName: string
  itemDescription: string | null
  uom: string
  unitPrice: number | null
  isActive: boolean
}

export async function bulkImportProcurementItemsAction(
  input: BulkImportProcurementItemsInput
): Promise<BulkImportResult | { ok: false; error: string }> {
  const parsed = bulkImportProcurementItemsInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid bulk import payload." }
  }

  const payload = parsed.data
  const access = await ensureCatalogManagementAccess(payload.companyId)
  if (!access.ok) {
    return access
  }

  const resolvedCategories = resolveBulkCategoryAssignments(payload.rows)
  const normalizedRows: NormalizedBulkImportRow[] = payload.rows.map((row, rowIndex) => {
    const derivedCategory = resolvedCategories[rowIndex]
    return {
      categoryCode: derivedCategory.categoryCode,
      categoryName: derivedCategory.categoryName,
      itemCode: row.itemCode.trim().toUpperCase(),
      itemName: row.itemName.trim(),
      itemDescription: row.itemDescription?.trim() || null,
      uom: row.uom.trim().toUpperCase(),
      unitPrice: row.unitPrice === undefined ? null : row.unitPrice,
      isActive: row.isActive ?? true,
    }
  })

  const uniqueCategoryCodes = new Map<string, string>()
  for (const row of normalizedRows) {
    const codeKey = row.categoryCode
    if (!uniqueCategoryCodes.has(codeKey)) {
      uniqueCategoryCodes.set(codeKey, row.categoryName)
    }
  }

  const existingCategories = await db.procurementItemCategory.findMany({
    where: {
      code: { in: Array.from(uniqueCategoryCodes.keys()) },
    },
    select: { id: true, code: true },
  })

  const categoryCodeToId = new Map<string, string>()
  for (const cat of existingCategories) {
    categoryCodeToId.set(cat.code.toUpperCase(), cat.id)
  }

  for (const [code, name] of uniqueCategoryCodes.entries()) {
    if (!categoryCodeToId.has(code)) {
      try {
        await db.$transaction(async (tx) => {
          const created = await tx.procurementItemCategory.create({
            data: {
              code,
              name,
              isActive: true,
              createdById: access.context.userId,
              updatedById: access.context.userId,
            },
            select: { id: true },
          })
          categoryCodeToId.set(code, created.id)

          await createAuditLog(
            {
              tableName: "ProcurementItemCategory",
              recordId: created.id,
              action: "CREATE",
              userId: access.context.userId,
              reason: "BULK_IMPORT_CREATE_CATEGORY",
            },
            tx
          )
        })
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const refetched = await db.procurementItemCategory.findFirst({
            where: { code },
            select: { id: true },
          })
          if (refetched) {
            categoryCodeToId.set(code, refetched.id)
          }
          continue
        }

        const message = error instanceof Error ? error.message : "Unknown error."
        return { ok: false, error: `Failed to prepare categories for bulk import: ${message}` }
      }
    }
  }

  const uniqueItemCodes = [...new Set(normalizedRows.map((row) => row.itemCode))]
  const existingItems = await db.procurementItem.findMany({
    where: {
      code: {
        in: uniqueItemCodes,
      },
    },
    select: {
      id: true,
      code: true,
    },
  })
  const itemCodeToId = new Map(existingItems.map((item) => [item.code.toUpperCase(), item.id]))

  const resultRows: BulkImportResultRow[] = []
  let created = 0
  let updated = 0
  let errors = 0

  for (let index = 0; index < normalizedRows.length; index++) {
    const row = normalizedRows[index]
    const code = row.itemCode
    const categoryCode = row.categoryCode
    const categoryId = categoryCodeToId.get(categoryCode)

    if (!categoryId) {
      resultRows.push({
        rowIndex: index,
        itemCode: code,
        status: "error",
        message: `Category "${categoryCode}" could not be resolved.`,
      })
      errors++
      continue
    }

    try {
      const existingItemId = itemCodeToId.get(code)
      if (existingItemId) {
        await db.$transaction(async (tx) => {
          await tx.procurementItem.update({
            where: { id: existingItemId },
            data: {
              categoryId,
              name: row.itemName,
              description: row.itemDescription,
              uom: row.uom,
              unitPrice: row.unitPrice,
              isActive: row.isActive,
              updatedById: access.context.userId,
            },
          })

          await createAuditLog(
            {
              tableName: "ProcurementItem",
              recordId: existingItemId,
              action: "UPDATE",
              userId: access.context.userId,
              reason: "BULK_IMPORT_UPDATE_ITEM",
            },
            tx
          )
        })

        resultRows.push({ rowIndex: index, itemCode: code, status: "updated", message: "Item updated." })
        updated++
      } else {
        try {
          const createdItemId = await db.$transaction(async (tx) => {
            const newItem = await tx.procurementItem.create({
              data: {
                categoryId,
                code,
                name: row.itemName,
                description: row.itemDescription,
                uom: row.uom,
                unitPrice: row.unitPrice,
                isActive: row.isActive,
                createdById: access.context.userId,
                updatedById: access.context.userId,
              },
              select: { id: true },
            })

            await createAuditLog(
              {
                tableName: "ProcurementItem",
                recordId: newItem.id,
                action: "CREATE",
                userId: access.context.userId,
                reason: "BULK_IMPORT_CREATE_ITEM",
              },
              tx
            )

            return newItem.id
          })

          itemCodeToId.set(code, createdItemId)
          resultRows.push({ rowIndex: index, itemCode: code, status: "created", message: "Item created." })
          created++
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            const refetchedItem = await db.procurementItem.findFirst({
              where: { code },
              select: { id: true },
            })

            if (refetchedItem) {
              itemCodeToId.set(code, refetchedItem.id)

              await db.$transaction(async (tx) => {
                await tx.procurementItem.update({
                  where: { id: refetchedItem.id },
                  data: {
                    categoryId,
                    name: row.itemName,
                    description: row.itemDescription,
                    uom: row.uom,
                    unitPrice: row.unitPrice,
                    isActive: row.isActive,
                    updatedById: access.context.userId,
                  },
                })

                await createAuditLog(
                  {
                    tableName: "ProcurementItem",
                    recordId: refetchedItem.id,
                    action: "UPDATE",
                    userId: access.context.userId,
                    reason: "BULK_IMPORT_UPDATE_ITEM",
                  },
                  tx
                )
              })

              resultRows.push({
                rowIndex: index,
                itemCode: code,
                status: "updated",
                message: "Item updated after resolving concurrent create.",
              })
              updated++
              continue
            }
          }

          throw error
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error."
      resultRows.push({ rowIndex: index, itemCode: code, status: "error", message })
      errors++
    }
  }

  revalidateCatalogPaths(access.context.companyId)

  return { ok: true, created, updated, errors, rows: resultRows }
}
