export type ProcurementActionErrorResult = {
  ok: false
  error: string
}

export type ProcurementActionMessageResult = {
  ok: true
  message: string
  requestId?: string
  purchaseOrderId?: string
  goodsReceiptId?: string
}

export type ProcurementActionResult = ProcurementActionMessageResult | ProcurementActionErrorResult

export type ProcurementActionDataResult<T> =
  | {
      ok: true
      data: T
    }
  | ProcurementActionErrorResult
