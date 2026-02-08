import { db } from "@/lib/db"

export type SetupState = {
  hasRecord: boolean
  isInitialized: boolean
}

export async function getSetupState(): Promise<SetupState> {
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
}
