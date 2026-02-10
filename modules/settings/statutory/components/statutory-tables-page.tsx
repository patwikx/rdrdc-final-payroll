"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import {
  IconBuilding,
  IconCalendarEvent,
  IconCheck,
  IconHeartRateMonitor,
  IconPlus,
  IconReceiptTax,
  IconRefresh,
  IconScale,
  IconShieldCheck,
  IconTrash,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { upsertStatutoryTablesAction } from "@/modules/settings/statutory/actions/upsert-statutory-tables-action"
import type { StatutoryTablesInput } from "@/modules/settings/statutory/schemas/statutory-tables-schema"

type StatutoryTablesPageProps = {
  companyName: string
  initialData: StatutoryTablesInput
}

type TabKey = "sss" | "philhealth" | "pagibig" | "wtax"

const semiMonthlyWtaxDefaults: StatutoryTablesInput["taxRows"] = [
  { bracketOver: 0, bracketNotOver: 10417, baseTax: 0, taxRatePercent: 0, excessOver: 0 },
  { bracketOver: 10417, bracketNotOver: 16667, baseTax: 0, taxRatePercent: 0.15, excessOver: 10417 },
  { bracketOver: 16667, bracketNotOver: 33333, baseTax: 937.5, taxRatePercent: 0.2, excessOver: 16667 },
  { bracketOver: 33333, bracketNotOver: 83333, baseTax: 4270.7, taxRatePercent: 0.25, excessOver: 33333 },
  { bracketOver: 83333, bracketNotOver: 333333, baseTax: 16770.7, taxRatePercent: 0.3, excessOver: 83333 },
  { bracketOver: 333333, bracketNotOver: 999999999, baseTax: 91770.7, taxRatePercent: 0.35, excessOver: 333333 },
]

const getPhilHealthFlexPresetRows = (effectiveYear: number): StatutoryTablesInput["philHealthRows"] => {
  let monthlyCeiling = 100000
  let premiumRate = 0.05

  if (effectiveYear < 2024) {
    monthlyCeiling = 100000 - (2024 - effectiveYear) * 10000
    premiumRate = (5 - (2024 - effectiveYear) * 0.5) / 100
  }

  if (effectiveYear === 2023) {
    monthlyCeiling = 80000
    premiumRate = 0.04
  }

  return [
    {
      premiumRate,
      monthlyFloor: 10000,
      monthlyCeiling,
      employeeSharePercent: 0.5,
      employerSharePercent: 0.5,
      membershipCategory: undefined,
    },
  ]
}

const pagIbigFlexPresetRows: StatutoryTablesInput["pagIbigRows"] = [
  {
    salaryBracketMin: 0,
    salaryBracketMax: 999999999,
    employeeRatePercent: 0.02,
    employerRatePercent: 0.02,
    maxMonthlyCompensation: 10000,
  },
]

const roundUp2 = (value: number): number => {
  return Math.ceil((value + Number.EPSILON) * 100) / 100
}

const toPhDateInputValue = (date?: Date): string => {
  if (!date) return ""
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(date)
}

const parsePhDateInputValue = (value: string): Date | undefined => {
  if (!value) return undefined
  return new Date(`${value}T00:00:00+08:00`)
}

const formatDisplayDate = (value: string): string => {
  const parsed = parsePhDateInputValue(value)
  if (!parsed) return "Select date"

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(parsed)
}

const getEffectiveYearFromDateInput = (value: string): number => {
  const parsed = parsePhDateInputValue(value)
  if (!parsed) {
    return Number(
      new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        timeZone: "Asia/Manila",
      }).format(new Date())
    )
  }

  return Number(
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      timeZone: "Asia/Manila",
    }).format(parsed)
  )
}

const buildSssPresetRow = (
  salaryBracketMin: number,
  salaryBracketMax: number,
  monthlySalaryCredit: number
): StatutoryTablesInput["sssRows"][number] => {
  const employeeShare = roundUp2(monthlySalaryCredit * 0.05)
  const employerShare = roundUp2(monthlySalaryCredit * 0.1)
  const ecContribution = employerShare >= 1500 ? 30 : 10

  return {
    salaryBracketMin,
    salaryBracketMax,
    monthlySalaryCredit,
    employeeShare,
    employerShare,
    ecContribution,
    totalContribution: roundUp2(employeeShare + employerShare + ecContribution),
    wispEmployee: undefined,
    wispEmployer: undefined,
  }
}

const sssFlexPresetRows: StatutoryTablesInput["sssRows"] = (() => {
  const rows: StatutoryTablesInput["sssRows"] = [buildSssPresetRow(0, 5249.99, 5000)]

  for (let msc = 5500; msc < 35000; msc += 500) {
    rows.push(buildSssPresetRow(msc - 250, msc + 249.99, msc))
  }

  rows.push(buildSssPresetRow(34750, 999999999, 35000))

  return rows
})()

export function StatutoryTablesPage({ companyName, initialData }: StatutoryTablesPageProps) {
  const [tab, setTab] = useState<TabKey>("sss")
  const [form, setForm] = useState<StatutoryTablesInput>(initialData)
  const [isSssPresetLocked, setIsSssPresetLocked] = useState(true)
  const [isPhilHealthPresetLocked, setIsPhilHealthPresetLocked] = useState(true)
  const [isPagIbigPresetLocked, setIsPagIbigPresetLocked] = useState(true)
  const [isWtaxPresetLocked, setIsWtaxPresetLocked] = useState(true)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setForm(initialData)
  }, [initialData])

  const isUsingSemiMonthlyPreset = useMemo(() => {
    if (form.taxRows.length !== semiMonthlyWtaxDefaults.length) {
      return false
    }

    return form.taxRows.every((row, index) => {
      const preset = semiMonthlyWtaxDefaults[index]
      return (
        row.bracketOver === preset.bracketOver &&
        row.bracketNotOver === preset.bracketNotOver &&
        row.baseTax === preset.baseTax &&
        row.taxRatePercent === preset.taxRatePercent &&
        row.excessOver === preset.excessOver
      )
    })
  }, [form.taxRows])

  const handleReset = () => {
    setForm(initialData)
    setIsSssPresetLocked(true)
    setIsPhilHealthPresetLocked(true)
    setIsPagIbigPresetLocked(true)
    setIsWtaxPresetLocked(true)
    toast.info("Statutory tables form reset.")
  }

  const handleLoadSssPreset = () => {
    const unchanged = JSON.stringify(form.sssRows) === JSON.stringify(sssFlexPresetRows)

    setForm((prev) => ({ ...prev, sssRows: sssFlexPresetRows }))
    setIsSssPresetLocked(true)

    if (unchanged) {
      toast.info("SSS flex rules are already applied.")
      return
    }

    toast.success("SSS flex rules loaded.")
  }

  const handleSave = () => {
    startTransition(async () => {
      const result = await upsertStatutoryTablesAction(form)

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
    })
  }

  const handleLoadPhilHealthPreset = () => {
    const effectiveYear = getEffectiveYearFromDateInput(form.effectiveFrom)
    const preset = getPhilHealthFlexPresetRows(effectiveYear)
    const unchanged = JSON.stringify(form.philHealthRows) === JSON.stringify(preset)

    setForm((prev) => ({
      ...prev,
      philHealthRows: preset,
    }))
    setIsPhilHealthPresetLocked(true)

    if (unchanged) {
      toast.info(`PhilHealth flex rules are already applied for ${effectiveYear}.`)
      return
    }

    toast.success(`PhilHealth flex rules loaded for ${effectiveYear}.`)
  }

  const handleLoadPagIbigPreset = () => {
    const unchanged = JSON.stringify(form.pagIbigRows) === JSON.stringify(pagIbigFlexPresetRows)

    setForm((prev) => ({
      ...prev,
      pagIbigRows: pagIbigFlexPresetRows,
    }))
    setIsPagIbigPresetLocked(true)

    if (unchanged) {
      toast.info("Pag-IBIG flex rules are already applied.")
      return
    }

    toast.success("Pag-IBIG flex rules loaded.")
  }

  return (
    <main className="min-h-screen w-full animate-in fade-in duration-500 bg-background">
      <header className="border-b border-border/60 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground"><IconScale className="size-5" /> {companyName} Statutory Tables</h1>
            <p className="text-sm text-muted-foreground">Simple bracket setup for SSS, PhilHealth, Pag-IBIG, and semi-monthly withholding tax.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={handleReset} disabled={isPending}>
              <IconRefresh className="size-4" />
              Reset
            </Button>
            <Button type="button" onClick={handleSave} disabled={isPending}>
              <IconCheck className="size-4" />
              {isPending ? "Saving..." : "Save Tables"}
            </Button>
          </div>
        </div>
      </header>

      <div className="space-y-4 py-6">
        <section className="border-y border-border/60 px-4 py-3 sm:px-6">
          <div className="inline-flex w-fit rounded-md border border-border/60 bg-background p-1">
            <Button size="sm" type="button" variant={tab === "sss" ? "default" : "ghost"} onClick={() => setTab("sss")}><IconShieldCheck className="size-3.5" /> SSS</Button>
            <Button size="sm" type="button" variant={tab === "philhealth" ? "default" : "ghost"} onClick={() => setTab("philhealth")}><IconHeartRateMonitor className="size-3.5" /> PhilHealth</Button>
            <Button size="sm" type="button" variant={tab === "pagibig" ? "default" : "ghost"} onClick={() => setTab("pagibig")}><IconBuilding className="size-3.5" /> Pag-IBIG</Button>
            <Button size="sm" type="button" variant={tab === "wtax" ? "default" : "ghost"} onClick={() => setTab("wtax")}><IconReceiptTax className="size-3.5" /> WTAX (Semi-Monthly)</Button>
          </div>
        </section>

        <div className="px-4 sm:px-6">

      {tab === "sss" ? (
        <SssSection
          form={form}
          setForm={setForm}
          isPresetLocked={isSssPresetLocked}
          setIsPresetLocked={setIsSssPresetLocked}
          onLoadDefaults={handleLoadSssPreset}
          effectiveFrom={form.effectiveFrom}
          onEffectiveFromChange={(value) => setForm((prev) => ({ ...prev, effectiveFrom: value }))}
        />
      ) : null}
      {tab === "philhealth" ? (
        <PhilHealthSection
          form={form}
          setForm={setForm}
          isPresetLocked={isPhilHealthPresetLocked}
          setIsPresetLocked={setIsPhilHealthPresetLocked}
          onLoadDefaults={handleLoadPhilHealthPreset}
          effectiveFrom={form.effectiveFrom}
          onEffectiveFromChange={(value) => setForm((prev) => ({ ...prev, effectiveFrom: value }))}
        />
      ) : null}
      {tab === "pagibig" ? (
        <PagIbigSection
          form={form}
          setForm={setForm}
          isPresetLocked={isPagIbigPresetLocked}
          setIsPresetLocked={setIsPagIbigPresetLocked}
          onLoadDefaults={handleLoadPagIbigPreset}
          effectiveFrom={form.effectiveFrom}
          onEffectiveFromChange={(value) => setForm((prev) => ({ ...prev, effectiveFrom: value }))}
        />
      ) : null}
      {tab === "wtax" ? (
        <WtaxSection
          form={form}
          setForm={setForm}
          isPresetLocked={isWtaxPresetLocked}
          setIsPresetLocked={setIsWtaxPresetLocked}
          isUsingSemiMonthlyPreset={isUsingSemiMonthlyPreset}
          onLoadDefaults={() => {
            setForm((prev) => ({ ...prev, taxRows: semiMonthlyWtaxDefaults }))
            setIsWtaxPresetLocked(true)
          }}
          effectiveFrom={form.effectiveFrom}
          onEffectiveFromChange={(value) => setForm((prev) => ({ ...prev, effectiveFrom: value }))}
        />
      ) : null}
        </div>
      </div>
    </main>
  )
}

function SssSection({
  form,
  setForm,
  isPresetLocked,
  setIsPresetLocked,
  onLoadDefaults,
  effectiveFrom,
  onEffectiveFromChange,
}: {
  form: StatutoryTablesInput
  setForm: React.Dispatch<React.SetStateAction<StatutoryTablesInput>>
  isPresetLocked: boolean
  setIsPresetLocked: React.Dispatch<React.SetStateAction<boolean>>
  onLoadDefaults: () => void
  effectiveFrom: string
  onEffectiveFromChange: (value: string) => void
}) {
  return (
    <BracketCard
      title="SSS Contribution Brackets"
      description="Input salary ranges and contribution shares."
      icon={<IconShieldCheck className="size-4" />}
      addDisabled={isPresetLocked}
      extraAction={
        <div className="flex flex-wrap items-center gap-2">
          <EffectiveFromPicker value={effectiveFrom} onChange={onEffectiveFromChange} />
          <Button type="button" variant="outline" onClick={onLoadDefaults}>Load SSS Flex Rules</Button>
          <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3">
            <span className="text-[11px] text-muted-foreground">Lock flex rules</span>
            <Switch checked={isPresetLocked} onCheckedChange={setIsPresetLocked} />
          </div>
        </div>
      }
      onAdd={() =>
        setForm((prev) => ({
          ...prev,
          sssRows: [...prev.sssRows, { salaryBracketMin: 0, salaryBracketMax: 0, monthlySalaryCredit: 0, employeeShare: 0, employerShare: 0, ecContribution: 0, totalContribution: 0 }],
        }))
      }
    >
      <div className="overflow-x-auto border border-border/60">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <Th>Min</Th><Th>Max</Th><Th>MSC</Th><Th>Emp</Th><Th>Empr</Th><Th>EC</Th><Th>Total</Th><Th>Remove</Th>
            </tr>
          </thead>
          <tbody>
            {form.sssRows.map((row, index) => (
              <tr key={`sss-${index}`} className="border-t border-border/50">
                <Td><NumberInput value={row.salaryBracketMin} disabled={isPresetLocked} onChange={(value) => setForm((prev) => updateRow(prev, "sssRows", index, "salaryBracketMin", value))} /></Td>
                <Td><NumberInput value={row.salaryBracketMax} disabled={isPresetLocked} onChange={(value) => setForm((prev) => updateRow(prev, "sssRows", index, "salaryBracketMax", value))} /></Td>
                <Td><NumberInput value={row.monthlySalaryCredit} disabled={isPresetLocked} onChange={(value) => setForm((prev) => updateRow(prev, "sssRows", index, "monthlySalaryCredit", value))} /></Td>
                <Td><NumberInput value={row.employeeShare} disabled={isPresetLocked} onChange={(value) => setForm((prev) => updateRow(prev, "sssRows", index, "employeeShare", value))} /></Td>
                <Td><NumberInput value={row.employerShare} disabled={isPresetLocked} onChange={(value) => setForm((prev) => updateRow(prev, "sssRows", index, "employerShare", value))} /></Td>
                <Td><NumberInput value={row.ecContribution} disabled={isPresetLocked} onChange={(value) => setForm((prev) => updateRow(prev, "sssRows", index, "ecContribution", value))} /></Td>
                <Td><NumberInput value={row.totalContribution} disabled={isPresetLocked} onChange={(value) => setForm((prev) => updateRow(prev, "sssRows", index, "totalContribution", value))} /></Td>
                <Td><RemoveRowButton onClick={() => setForm((prev) => ({ ...prev, sssRows: prev.sssRows.filter((_, i) => i !== index) }))} disabled={isPresetLocked || form.sssRows.length <= 1} /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BracketCard>
  )
}

function PhilHealthSection({
  form,
  setForm,
  isPresetLocked,
  setIsPresetLocked,
  onLoadDefaults,
  effectiveFrom,
  onEffectiveFromChange,
}: {
  form: StatutoryTablesInput
  setForm: React.Dispatch<React.SetStateAction<StatutoryTablesInput>>
  isPresetLocked: boolean
  setIsPresetLocked: React.Dispatch<React.SetStateAction<boolean>>
  onLoadDefaults: () => void
  effectiveFrom: string
  onEffectiveFromChange: (value: string) => void
}) {
  return (
    <BracketCard
      title="PhilHealth Premium Rules"
      description="Keep one simple row unless you need category-specific rates."
      icon={<IconHeartRateMonitor className="size-4" />}
      addDisabled={isPresetLocked}
      extraAction={
        <div className="flex flex-wrap items-center gap-2">
          <EffectiveFromPicker value={effectiveFrom} onChange={onEffectiveFromChange} />
          <Button type="button" variant="outline" onClick={onLoadDefaults}>Load PhilHealth Flex Rules</Button>
          <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3">
            <span className="text-[11px] text-muted-foreground">Lock flex rules</span>
            <Switch checked={isPresetLocked} onCheckedChange={setIsPresetLocked} />
          </div>
        </div>
      }
      onAdd={() =>
        setForm((prev) => ({
          ...prev,
          philHealthRows: [...prev.philHealthRows, { premiumRate: 0.05, monthlyFloor: 0, monthlyCeiling: 0, employeeSharePercent: 0.5, employerSharePercent: 0.5, membershipCategory: undefined }],
        }))
      }
    >
      <div className="overflow-x-auto border border-border/60">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <Th>Rate</Th><Th>Floor</Th><Th>Ceiling</Th><Th>Emp %</Th><Th>Empr %</Th><Th>Category</Th><Th>Remove</Th>
            </tr>
          </thead>
          <tbody>
            {form.philHealthRows.map((row, index) => (
              <tr key={`ph-${index}`} className="border-t border-border/50">
                <Td><NumberInput value={row.premiumRate} disabled={isPresetLocked} step="0.0001" onChange={(value) => setForm((prev) => updateRow(prev, "philHealthRows", index, "premiumRate", value))} /></Td>
                <Td><NumberInput value={row.monthlyFloor} disabled={isPresetLocked} onChange={(value) => setForm((prev) => updateRow(prev, "philHealthRows", index, "monthlyFloor", value))} /></Td>
                <Td><NumberInput value={row.monthlyCeiling} disabled={isPresetLocked} onChange={(value) => setForm((prev) => updateRow(prev, "philHealthRows", index, "monthlyCeiling", value))} /></Td>
                <Td><NumberInput value={row.employeeSharePercent} disabled={isPresetLocked} step="0.0001" onChange={(value) => setForm((prev) => updateRow(prev, "philHealthRows", index, "employeeSharePercent", value))} /></Td>
                <Td><NumberInput value={row.employerSharePercent} disabled={isPresetLocked} step="0.0001" onChange={(value) => setForm((prev) => updateRow(prev, "philHealthRows", index, "employerSharePercent", value))} /></Td>
                <Td><Input disabled={isPresetLocked} value={row.membershipCategory ?? ""} onChange={(event) => setForm((prev) => updateRow(prev, "philHealthRows", index, "membershipCategory", event.target.value || undefined))} /></Td>
                <Td><RemoveRowButton onClick={() => setForm((prev) => ({ ...prev, philHealthRows: prev.philHealthRows.filter((_, i) => i !== index) }))} disabled={isPresetLocked || form.philHealthRows.length <= 1} /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Flex-rule basis: floor at 10,000, year-based premium rate/ceiling, then split 50/50 (employee/employer) with 2-decimal round-up at payroll computation.
      </p>
    </BracketCard>
  )
}

function PagIbigSection({
  form,
  setForm,
  isPresetLocked,
  setIsPresetLocked,
  onLoadDefaults,
  effectiveFrom,
  onEffectiveFromChange,
}: {
  form: StatutoryTablesInput
  setForm: React.Dispatch<React.SetStateAction<StatutoryTablesInput>>
  isPresetLocked: boolean
  setIsPresetLocked: React.Dispatch<React.SetStateAction<boolean>>
  onLoadDefaults: () => void
  effectiveFrom: string
  onEffectiveFromChange: (value: string) => void
}) {
  return (
    <BracketCard
      title="Pag-IBIG Contribution Brackets"
      description="Set rate percent and compensation cap brackets."
      icon={<IconBuilding className="size-4" />}
      addDisabled={isPresetLocked}
      extraAction={
        <div className="flex flex-wrap items-center gap-2">
          <EffectiveFromPicker value={effectiveFrom} onChange={onEffectiveFromChange} />
          <Button type="button" variant="outline" onClick={onLoadDefaults}>Load Pag-IBIG Flex Rules</Button>
          <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3">
            <span className="text-[11px] text-muted-foreground">Lock flex rules</span>
            <Switch checked={isPresetLocked} onCheckedChange={setIsPresetLocked} />
          </div>
        </div>
      }
      onAdd={() =>
        setForm((prev) => ({
          ...prev,
          pagIbigRows: [...prev.pagIbigRows, { salaryBracketMin: 0, salaryBracketMax: 0, employeeRatePercent: 0.01, employerRatePercent: 0.02, maxMonthlyCompensation: 10000 }],
        }))
      }
    >
      <div className="overflow-x-auto border border-border/60">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <Th>Min</Th><Th>Max</Th><Th>Emp %</Th><Th>Empr %</Th><Th>Max Comp</Th><Th>Remove</Th>
            </tr>
          </thead>
          <tbody>
            {form.pagIbigRows.map((row, index) => (
              <tr key={`pag-${index}`} className="border-t border-border/50">
                <Td><NumberInput value={row.salaryBracketMin} disabled={isPresetLocked} onChange={(value) => setForm((prev) => updateRow(prev, "pagIbigRows", index, "salaryBracketMin", value))} /></Td>
                <Td><NumberInput value={row.salaryBracketMax} disabled={isPresetLocked} onChange={(value) => setForm((prev) => updateRow(prev, "pagIbigRows", index, "salaryBracketMax", value))} /></Td>
                <Td><NumberInput value={row.employeeRatePercent} disabled={isPresetLocked} step="0.0001" onChange={(value) => setForm((prev) => updateRow(prev, "pagIbigRows", index, "employeeRatePercent", value))} /></Td>
                <Td><NumberInput value={row.employerRatePercent} disabled={isPresetLocked} step="0.0001" onChange={(value) => setForm((prev) => updateRow(prev, "pagIbigRows", index, "employerRatePercent", value))} /></Td>
                <Td><NumberInput value={row.maxMonthlyCompensation} disabled={isPresetLocked} onChange={(value) => setForm((prev) => updateRow(prev, "pagIbigRows", index, "maxMonthlyCompensation", value))} /></Td>
                <Td><RemoveRowButton onClick={() => setForm((prev) => ({ ...prev, pagIbigRows: prev.pagIbigRows.filter((_, i) => i !== index) }))} disabled={isPresetLocked || form.pagIbigRows.length <= 1} /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Flex-rule alignment: configured as 2% employee + 2% employer with 10,000 compensation cap (200 each). Payroll posting rule for odd-period application and employee override amount should be handled in computation/runtime logic.
      </p>
    </BracketCard>
  )
}

function WtaxSection({
  form,
  setForm,
  isPresetLocked,
  setIsPresetLocked,
  isUsingSemiMonthlyPreset,
  onLoadDefaults,
  effectiveFrom,
  onEffectiveFromChange,
}: {
  form: StatutoryTablesInput
  setForm: React.Dispatch<React.SetStateAction<StatutoryTablesInput>>
  isPresetLocked: boolean
  setIsPresetLocked: React.Dispatch<React.SetStateAction<boolean>>
  isUsingSemiMonthlyPreset: boolean
  onLoadDefaults: () => void
  effectiveFrom: string
  onEffectiveFromChange: (value: string) => void
}) {
  return (
    <BracketCard
      title="Withholding Tax Brackets (Semi-Monthly)"
      description="BIR 2023 semi-monthly flex rules style: base tax + excess * rate."
      icon={<IconReceiptTax className="size-4" />}
      onAdd={() =>
        setForm((prev) => ({
          ...prev,
          taxRows: [...prev.taxRows, { bracketOver: 0, bracketNotOver: 0, baseTax: 0, taxRatePercent: 0, excessOver: 0 }],
        }))
      }
      addDisabled={isPresetLocked}
      extraAction={
        <div className="flex flex-wrap items-center gap-2">
          <EffectiveFromPicker value={effectiveFrom} onChange={onEffectiveFromChange} />
          <Button type="button" variant="outline" onClick={onLoadDefaults}>Load BIR 2023 Flex Rules</Button>
          <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3">
            <span className="text-[11px] text-muted-foreground">Lock flex rules</span>
            <Switch checked={isPresetLocked} onCheckedChange={setIsPresetLocked} />
          </div>
        </div>
      }
    >
      {isUsingSemiMonthlyPreset ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">Using BIR 2023 semi-monthly flex rules brackets.</p>
      ) : null}
      <div className="overflow-x-auto border border-border/60">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <Th>Over</Th><Th>Not Over</Th><Th>Base Tax</Th><Th>Rate</Th><Th>Excess Over</Th><Th>Remove</Th>
            </tr>
          </thead>
          <tbody>
            {form.taxRows.map((row, index) => (
              <tr key={`tax-${index}`} className="border-t border-border/50">
                <Td><NumberInput value={row.bracketOver} disabled={isPresetLocked} onChange={(value) => setForm((prev) => updateRow(prev, "taxRows", index, "bracketOver", value))} /></Td>
                <Td><NumberInput value={row.bracketNotOver} disabled={isPresetLocked} onChange={(value) => setForm((prev) => updateRow(prev, "taxRows", index, "bracketNotOver", value))} /></Td>
                <Td><NumberInput value={row.baseTax} disabled={isPresetLocked} onChange={(value) => setForm((prev) => updateRow(prev, "taxRows", index, "baseTax", value))} /></Td>
                <Td><NumberInput value={row.taxRatePercent} disabled={isPresetLocked} step="0.0001" onChange={(value) => setForm((prev) => updateRow(prev, "taxRows", index, "taxRatePercent", value))} /></Td>
                <Td><NumberInput value={row.excessOver} disabled={isPresetLocked} onChange={(value) => setForm((prev) => updateRow(prev, "taxRows", index, "excessOver", value))} /></Td>
                <Td><RemoveRowButton onClick={() => setForm((prev) => ({ ...prev, taxRows: prev.taxRows.filter((_, i) => i !== index) }))} disabled={isPresetLocked || form.taxRows.length <= 1} /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Tax computation: `baseTax + (taxableIncome - excessOver) * rate`, then round up to 2 decimals.</p>
    </BracketCard>
  )
}

function EffectiveFromPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="justify-between">
          <span>{formatDisplayDate(value)}</span>
          <IconCalendarEvent className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <Calendar mode="single" selected={parsePhDateInputValue(value)} onSelect={(date) => onChange(toPhDateInputValue(date))} />
      </PopoverContent>
    </Popover>
  )
}

function BracketCard({
  title,
  description,
  icon,
  onAdd,
  children,
  extraAction,
  addDisabled,
}: {
  title: string
  description: string
  icon?: React.ReactNode
  onAdd: () => void
  children: React.ReactNode
  extraAction?: React.ReactNode
  addDisabled?: boolean
}) {
  return (
    <section className="space-y-3 border border-border/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <h3 className="inline-flex items-center gap-1.5 text-base font-semibold text-foreground">{icon}<span>{title}</span></h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {extraAction}
          <Button type="button" variant="outline" onClick={onAdd} disabled={addDisabled}><IconPlus className="size-3.5" /> Add Row</Button>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-medium text-muted-foreground">{children}</th>
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2">{children}</td>
}

function NumberInput({ value, onChange, step, disabled }: { value: number; onChange: (value: number) => void; step?: string; disabled?: boolean }) {
  return <Input type="number" step={step ?? "0.01"} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value) || 0)} />
}

function RemoveRowButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick} disabled={disabled}>
      <IconTrash className="size-3.5" />
      Remove
    </Button>
  )
}

function updateRow<
  K extends "sssRows" | "philHealthRows" | "pagIbigRows" | "taxRows",
  RK extends keyof StatutoryTablesInput[K][number]
>(
  form: StatutoryTablesInput,
  key: K,
  index: number,
  rowKey: RK,
  value: StatutoryTablesInput[K][number][RK]
): StatutoryTablesInput {
  return {
    ...form,
    [key]: form[key].map((row, rowIndex) =>
      rowIndex === index
        ? {
            ...row,
            [rowKey]: value,
          }
        : row
    ),
  }
}
