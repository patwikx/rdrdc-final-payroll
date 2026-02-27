"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { MaterialRequest } from "@/types/material-request-types"
import { updateItemDescriptions } from "@/lib/actions/mrs-actions/material-request-actions"

interface ItemDescription {
  itemId: string
  description: string
}

interface FormData {
  items: ItemDescription[]
}

interface MaterialRequestEditDescriptionsProps {
  materialRequest: MaterialRequest
  onSuccess: () => void
  onCancel: () => void
}

export function MaterialRequestEditDescriptions({
  materialRequest,
  onSuccess,
  onCancel,
}: MaterialRequestEditDescriptionsProps) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<FormData>({
    defaultValues: {
      items: materialRequest.items.map(item => ({
        itemId: item.id,
        description: item.description,
      })),
    },
  })

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      const result = await updateItemDescriptions({
        requestId: materialRequest.id,
        items: data.items,
      })

      if (result.success) {
        toast.success("Item descriptions updated successfully")
        onSuccess()
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      console.error("Error updating descriptions:", error)
      toast.error("Failed to update item descriptions")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Edit Item Descriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {materialRequest.items.map((item, index) => (
                <div key={item.id} className="space-y-4 p-4 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="font-semibold">Item #{index + 1}</div>
                      {item.itemCode && (
                        <div className="text-sm text-muted-foreground">
                          Code: {item.itemCode}
                        </div>
                      )}
                      <div className="text-sm text-muted-foreground">
                        UOM: {item.uom} | Quantity: {item.quantity}
                      </div>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name={`items.${index}.description`}
                    rules={{
                      required: "Description is required",
                      minLength: {
                        value: 1,
                        message: "Description cannot be empty"
                      }
                    }}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter item description"
                            className="resize-none min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))}

              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading} className="gap-2">
                  <Save className="h-4 w-4" />
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
