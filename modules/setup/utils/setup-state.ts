import { db } from "@/lib/db"
import { cache } from "react"

export type SetupState = {
  hasRecord: boolean
  isInitialized: boolean
}

const readSetupState = cache(async (): Promise<SetupState> => {
  const setup = await db.systemSetup.findFirst({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      isInitialized: true,
    },
  })

  return {
    hasRecord: Boolean(setup?.id),
    isInitialized: setup?.isInitialized ?? false,
  }
})

export async function getSetupState(): Promise<SetupState> {
  return readSetupState()
}
