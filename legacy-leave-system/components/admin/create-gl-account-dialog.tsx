"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AccountType, DebitCredit } from "@prisma/client"
import { createGLAccount } from "@/lib/actions/gl-account-actions"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface CreateGLAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateGLAccountDialog({ open, onOpenChange }: CreateGLAccountDialogProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    accountCode: "",
    accountName: "",
    accountType: "" as AccountType | "",
    normalBalance: "" as DebitCredit | "",
    description: "",
    isActive: true
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.accountCode || !formData.accountName || !formData.accountType || !formData.normalBalance) {
      toast.error("Please fill in all required fields")
      return
    }

    setIsLoading(true)
    try {
      const result = await createGLAccount({
        accountCode: formData.accountCode,
        accountName: formData.accountName,
        accountType: formData.accountType as AccountType,
        normalBalance: formData.normalBalance as DebitCredit,
        description: formData.description || undefined,
        isActive: formData.isActive
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.success)
        onOpenChange(false)
        setFormData({
          accountCode: "",
          accountName: "",
          accountType: "",
          normalBalance: "",
          description: "",
          isActive: true
        })
        router.refresh()
      }
    } catch (error) {
      toast.error("Failed to create GL account")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      accountCode: "",
      accountName: "",
      accountType: "",
      normalBalance: "",
      description: "",
      isActive: true
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create GL Account</DialogTitle>
          <DialogDescription>
            Add a new general ledger account to the chart of accounts.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="accountCode">Account Code <span className="text-red-500">*</span></Label>
              <Input
                id="accountCode"
                placeholder="e.g., 1001"
                value={formData.accountCode}
                onChange={(e) => setFormData(prev => ({ ...prev, accountCode: e.target.value }))}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="accountType">Account Type <span className="text-red-500">*</span></Label>
              <Select
                value={formData.accountType}
                onValueChange={(value: AccountType) => setFormData(prev => ({ ...prev, accountType: value }))}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASSET">Asset</SelectItem>
                  <SelectItem value="LIABILITY">Liability</SelectItem>
                  <SelectItem value="EQUITY">Equity</SelectItem>
                  <SelectItem value="REVENUE">Revenue</SelectItem>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountName">Account Name <span className="text-red-500">*</span></Label>
            <Input
              id="accountName"
              placeholder="e.g., Cash and Cash Equivalents"
              value={formData.accountName}
              onChange={(e) => setFormData(prev => ({ ...prev, accountName: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="normalBalance">Normal Balance <span className="text-red-500">*</span></Label>
            <Select
              value={formData.normalBalance}
              onValueChange={(value: DebitCredit) => setFormData(prev => ({ ...prev, normalBalance: value }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select normal balance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DEBIT">Debit</SelectItem>
                <SelectItem value="CREDIT">Credit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional description of the account"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
            />
            <Label htmlFor="isActive">Active</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}