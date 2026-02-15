export type MaterialRequestActionErrorResult = {
  ok: false
  error: string
}

export type MaterialRequestActionMessageResult = {
  ok: true
  message: string
  requestId?: string
}

export type MaterialRequestActionResult = MaterialRequestActionMessageResult | MaterialRequestActionErrorResult

export type MaterialRequestActionDataResult<T> =
  | {
      ok: true
      data: T
    }
  | MaterialRequestActionErrorResult
