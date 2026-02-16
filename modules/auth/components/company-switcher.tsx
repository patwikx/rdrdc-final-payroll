"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState, useTransition } from "react"
import { IconBuilding } from "@tabler/icons-react"

import { setActiveCompanyAction } from "@/modules/auth/actions/set-active-company-action"
import type { UserCompanyOption } from "@/modules/auth/utils/active-company-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"

type CompanySwitcherProps = {
  options: UserCompanyOption[]
  activeCompanyId: string
}

export function CompanySwitcher({ options, activeCompanyId }: CompanySwitcherProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedCompanyId, setSelectedCompanyId] = useState(activeCompanyId)

  useEffect(() => {
    setSelectedCompanyId(activeCompanyId)
  }, [activeCompanyId])

  const activeOption = useMemo(() => {
    return options.find((option) => option.companyId === selectedCompanyId) ?? options[0]
  }, [options, selectedCompanyId])

  const handleCompanyChange = (companyId: string) => {
    setErrorMessage(null)
    const previousCompanyId = selectedCompanyId
    setSelectedCompanyId(companyId)

    startTransition(async () => {
      const result = await setActiveCompanyAction({ companyId })

      if (!result.ok) {
        setSelectedCompanyId(previousCompanyId)
        setErrorMessage(result.error)
        return
      }

      router.refresh()
    })
  }

  return (
    <div className="space-y-1">
      <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
        <SelectTrigger className="w-full min-w-56" aria-label="Select active company" disabled={isPending}>
          {activeOption ? (
            <div className="flex min-w-0 items-center gap-2">
              <Avatar className="size-5 rounded-md border border-border/60 [&_*]:rounded-md">
                <AvatarImage src={activeOption.logoUrl ?? undefined} alt={activeOption.companyName} className="object-cover" />
                <AvatarFallback className="bg-muted text-foreground">
                  <IconBuilding className="size-3" />
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-sm">
                {activeOption.companyCode} - {activeOption.companyName}
              </span>
            </div>
          ) : (
            <SelectValue placeholder="Select company" />
          )}
          {isPending ? <Spinner className="size-3.5" /> : null}
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.companyId} value={option.companyId}>
              <div className="flex min-w-0 items-center gap-2">
                <Avatar className="size-5 rounded-md border border-border/60 [&_*]:rounded-md">
                  <AvatarImage src={option.logoUrl ?? undefined} alt={option.companyName} className="object-cover" />
                  <AvatarFallback className="bg-muted text-foreground">
                    <IconBuilding className="size-3" />
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">
                  {option.companyCode} - {option.companyName}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {errorMessage ? <p className="text-destructive text-[11px]">{errorMessage}</p> : null}
    </div>
  )
}
