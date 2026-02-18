import { AsyncLocalStorage } from "node:async_hooks"

export type RequestAuthContext = {
  userId: string
  companyId: string
  companyCode: string
  companyName: string
  companyRole: string
  userRole: string | null
  isDefaultCompany: boolean
}

const requestAuthContextStorage = new AsyncLocalStorage<RequestAuthContext>()

export const runWithRequestAuthContext = async <T>(
  context: RequestAuthContext,
  callback: () => Promise<T>
): Promise<T> => {
  return requestAuthContextStorage.run(context, callback)
}

export const getRequestAuthContext = (): RequestAuthContext | undefined => {
  return requestAuthContextStorage.getStore()
}
