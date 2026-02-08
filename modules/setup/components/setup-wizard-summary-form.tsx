"use client"

import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { initializeSystemAction } from "@/modules/setup/actions/initialize-system-action"
import { setupDraftSchema, type SetupDraftInput } from "@/modules/setup/schemas/initialize-system-schema"

const CONFIRM_TEXT = "INITIALIZE SYSTEM"
const SETUP_DRAFT_STORAGE_KEY = "setupDraftV1"

const REQUIRED = <span className="ml-1 text-destructive">*</span>

export function SetupWizardSummaryForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [draft] = useState<SetupDraftInput | null>(() => {
    if (typeof window === "undefined") {
      return null
    }

    const raw = window.sessionStorage.getItem(SETUP_DRAFT_STORAGE_KEY)

    if (!raw) {
      return null
    }

    try {
      const parsed = setupDraftSchema.safeParse(JSON.parse(raw))
      return parsed.success ? parsed.data : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (!draft) {
      router.replace("/setup")
    }
  }, [draft, router])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)

    if (!draft) {
      setErrorMessage("Setup draft not found. Please restart setup.")
      return
    }

    const formData = new FormData(event.currentTarget)
    const adminPassword = String(formData.get("adminPassword") ?? "")
    const confirmationText = String(formData.get("confirmationText") ?? "")

    if (confirmationText.trim().toUpperCase() !== CONFIRM_TEXT) {
      setErrorMessage(`Please type \"${CONFIRM_TEXT}\" to confirm.`)
      return
    }

    startTransition(async () => {
      const result = await initializeSystemAction({
        ...draft,
        admin: {
          ...draft.admin,
          password: adminPassword,
        },
      })

      if (!result.ok) {
        setErrorMessage(result.error)
        return
      }

      sessionStorage.removeItem(SETUP_DRAFT_STORAGE_KEY)
      router.push("/login")
      router.refresh()
    })
  }

  if (!draft) {
    return null
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-4xl">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Setup Summary</CardTitle>
            <CardDescription>
              Final review before initialization. This will create super admin, company, core payroll, attendance,
              leave, overtime, statutory, and baseline configuration data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <section className="space-y-1 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">Admin: {draft.admin.firstName} {draft.admin.lastName}</p>
              <p>Username: {draft.admin.username}</p>
              <p>Email: {draft.admin.email}</p>
            </section>

            <section className="space-y-1 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">Company: {draft.company.name} ({draft.company.code})</p>
              <p>Legal name: {draft.company.legalName || "-"}</p>
              <p>TIN: {draft.company.tin || "-"}</p>
              <p>RDO code: {draft.company.rdoCode || "-"}</p>
            </section>

            <section className="space-y-1 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">Operations Setup</p>
              <p>Leave types: {draft.leave.leaveTypes.length}</p>
              <p>Holiday entries: {draft.holidays.items.length}</p>
              <p>Loan types: {draft.loans.loanTypes.length}</p>
              <p>Earning types: {draft.compensation.earningTypes.length}</p>
              <p>Deduction types: {draft.compensation.deductionTypes.length}</p>
              <p>Saturday half-day: {draft.attendance.workSchedule.saturdayHalfDay.enabled ? "Enabled" : "Disabled"}</p>
            </section>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="adminPassword" className="text-[11px] uppercase tracking-[0.08em]">Super Admin Password{REQUIRED}</Label>
                <Input id="adminPassword" name="adminPassword" type="password" minLength={12} required />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmationText" className="text-[11px] uppercase tracking-[0.08em]">Type {CONFIRM_TEXT}{REQUIRED}</Label>
                <Input id="confirmationText" name="confirmationText" placeholder={CONFIRM_TEXT} required />
              </div>

              {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => router.push("/setup")}>Back</Button>
                <Button type="submit" disabled={isPending}>{isPending ? "Finalizing setup..." : "Confirm and Initialize"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  )
}
