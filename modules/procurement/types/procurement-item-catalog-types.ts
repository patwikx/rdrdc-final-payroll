export type ProcurementItemCategoryRow = {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
}

export type ProcurementItemRow = {
  id: string
  categoryId: string
  categoryCode: string
  categoryName: string
  code: string
  name: string
  description: string | null
  uom: string
  unitPrice: number | null
  isActive: boolean
}

export type ProcurementItemCatalogViewModel = {
  categories: ProcurementItemCategoryRow[]
  items: ProcurementItemRow[]
}
