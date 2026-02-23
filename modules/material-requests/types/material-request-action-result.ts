export type MaterialRequestActionErrorResult = {
  ok: false
  error: string
}

export type MaterialRequestActionMessageResult = {
  ok: true
  message: string
  requestId?: string
  receivingReportId?: string
}

export type MaterialRequestActionResult = MaterialRequestActionMessageResult | MaterialRequestActionErrorResult

export type MaterialRequestActionDataResult<T> =
  | {
      ok: true
      data: T
    }
  | MaterialRequestActionErrorResult
