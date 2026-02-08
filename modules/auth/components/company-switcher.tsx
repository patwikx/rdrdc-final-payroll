"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { setActiveCompanyAction } from "@/modules/auth/actions/set-active-company-action"
import type { UserCompanyOption } from "@/modules/auth/utils/active-company-context"
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

  const handleCompanyChange = (companyId: string) => {
    setErrorMessage(null)

    startTransition(async () => {
      const result = await setActiveCompanyAction({ companyId })

      if (!result.ok) {
        setErrorMessage(result.error)
        return
      }

      router.refresh()
    })
  }

  return (
    <div className="space-y-1">
      <Select defaultValue={activeCompanyId} onValueChange={handleCompanyChange}>
        <SelectTrigger className="w-full min-w-56" aria-label="Select active company" disabled={isPending}>
          <SelectValue placeholder="Select company" />
          {isPending ? <Spinner className="size-3.5" /> : null}
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.companyId} value={option.companyId}>
              {option.companyCode} - {option.companyName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {errorMessage ? <p className="text-destructive text-[11px]">{errorMessage}</p> : null}
    </div>
  )
}
