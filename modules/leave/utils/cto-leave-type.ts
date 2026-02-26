type CtoLeaveTypeLike = {
  isCTO?: boolean | null
  code?: string | null
  name?: string | null
}

const normalize = (value: string | null | undefined): string =>
  (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "")

export const isCtoLeaveType = (value: CtoLeaveTypeLike): boolean => {
  if (value.isCTO) {
    return true
  }

  const code = normalize(value.code)
  const name = normalize(value.name)

  if (code === "cto" || code.includes("cto")) {
    return true
  }

  if (name.includes("cto")) {
    return true
  }

  return name.includes("compens") && name.includes("time") && name.includes("off")
}

