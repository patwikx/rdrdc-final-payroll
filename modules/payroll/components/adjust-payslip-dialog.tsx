"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { IconCircleMinus, IconCirclePlus } from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  getPayslipAdjustmentsAction,
  removePayslipAdjustmentAction,
  upsertPayslipAdjustmentAction,
} from "@/modules/payroll/actions/payroll-adjustment-actions"

type AdjustmentType = "EARNING" | "DEDUCTION"

type AdjustmentRecord = {
  id: string
  type: AdjustmentType
  description: string
  amount: number
  isTaxable: boolean
  createdAt: string
}

type AdjustPayslipDialogProps = {
  companyId: string
  payslipId: string
  employeeName: string
  onApplied: () => void
}

const amount = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" })

export function AdjustPayslipDialog({ companyId, payslipId, employeeName, onApplied }: AdjustPayslipDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [adjustments, setAdjustments] = useState<AdjustmentRecord[]>([])

  const [type, setType] = useState<AdjustmentType>("EARNING")
  const [description, setDescription] = useState("")
  const [amountValue, setAmountValue] = useState("")
  const [isTaxable, setIsTaxable] = useState(true)

  const loadAdjustments = useCallback(() => {
    startTransition(async () => {
      const result = await getPayslipAdjustmentsAction({ companyId, payslipId })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setAdjustments(result.data)
    })
  }, [companyId, payslipId])

  useEffect(() => {
    if (!isOpen) return
    loadAdjustments()
  }, [isOpen, loadAdjustments])

  const handleApply = () => {
    const parsedAmount = Number(amountValue)
    if (!description.trim()) {
      toast.error("Description is required.")
      return
    }

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid amount.")
      return
    }

    startTransition(async () => {
      const result = await upsertPayslipAdjustmentAction({
        companyId,
        payslipId,
        type,
        description: description.trim(),
        amount: parsedAmount,
        isTaxable,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      setDescription("")
      setAmountValue("")
      setIsTaxable(true)
      loadAdjustments()
      onApplied()
    })
  }

  const handleRemove = (adjustmentId: string, adjustmentType: AdjustmentType) => {
    startTransition(async () => {
      const result = await removePayslipAdjustmentAction({
        companyId,
        payslipId,
        adjustmentId,
        type: adjustmentType,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success(result.message)
      loadAdjustments()
      onApplied()
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" className="bg-blue-600 text-white hover:bg-blue-700">
          Adjust
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Adjust Payslip</DialogTitle>
          <DialogDescription>{employeeName}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as AdjustmentType)}>
              <SelectTrigger className="w-full">
                <div className="flex items-center gap-2">
                  {type === "EARNING" ? <IconCirclePlus className="h-4 w-4 text-emerald-600" /> : <IconCircleMinus className="h-4 w-4 text-destructive" />}
                  <SelectValue placeholder="Select type" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EARNING">Earning</SelectItem>
                <SelectItem value="DEDUCTION">Deduction</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <Input type="number" value={amountValue} onChange={(event) => setAmountValue(event.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Description</Label>
            <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Manual adjustment reason" />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 sm:col-span-2">
            <div>
              <p className="text-sm font-medium">Taxable</p>
              <p className="text-xs text-muted-foreground">Used only for earning adjustments.</p>
            </div>
            <Switch checked={isTaxable} onCheckedChange={setIsTaxable} disabled={type === "DEDUCTION"} />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Existing manual adjustments</p>
          <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border border-border/60 p-2">
            {adjustments.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">No manual adjustments.</p>
            ) : (
              adjustments.map((adjustment) => (
                <div key={adjustment.id} className="flex items-center justify-between gap-2 rounded-md border border-border/50 px-2 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{adjustment.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {adjustment.type} • {amount.format(adjustment.amount)} • {adjustment.createdAt}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleRemove(adjustment.id, adjustment.type)}
                  >
                    Remove
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" disabled={isPending} onClick={handleApply}>Apply Adjustment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
