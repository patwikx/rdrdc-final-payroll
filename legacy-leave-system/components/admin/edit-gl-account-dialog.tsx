"use client"

import { useState, useEffect } from "react"
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
import { GLAccount, updateGLAccount } from "@/lib/actions/gl-account-actions"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface EditGLAccountDialogProps {
  account: GLAccount
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditGLAccountDialog({ account, open, onOpenChange }: EditGLAccountDialogProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    accountName: "",
    accountType: "" as AccountType,
    normalBalance: "" as DebitCredit,
    description: "",
    isActive: true
  })

  useEffect(() => {
    if (account) {
      setFormData({
        accountName: account.accountName,
        accountType: account.accountType,
        normalBalance: account.normalBalance,
        description: account.description || "",
        isActive: account.isActive
      })
    }
  }, [account])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.accountName || !formData.accountType || !formData.normalBalance) {
      toast.error("Please fill in all required fields")
      return
    }

    setIsLoading(true)
    try {
      const result = await updateGLAccount(account.id, {
        accountName: formData.accountName,
        accountType: formData.accountType,
        normalBalance: formData.normalBalance,
        description: formData.description || undefined,
        isActive: formData.isActive
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.success)
        onOpenChange(false)
        router.refresh()
      }
    } catch (error) {
      toast.error("Failed to update GL account")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit GL Account</DialogTitle>
          <DialogDescription>
            Update the general ledger account details. Account code cannot be changed.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="accountCode">Account Code</Label>
              <Input
                id="accountCode"
                value={account.accountCode}
                disabled
                className="bg-muted"
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Updating..." : "Update Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}