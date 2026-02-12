export type LeaveActionErrorResult = {
  ok: false
  error: string
}

export type LeaveActionMessageResult = {
  ok: true
  message: string
}

export type LeaveActionResult = LeaveActionMessageResult | LeaveActionErrorResult

export type LeaveActionDataResult<T> =
  | {
      ok: true
      data: T
    }
  | LeaveActionErrorResult
