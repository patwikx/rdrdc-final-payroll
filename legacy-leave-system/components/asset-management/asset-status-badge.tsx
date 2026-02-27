"use client"

import { Badge } from "@/components/ui/badge"
import { AssetStatus } from "@prisma/client"

interface AssetStatusBadgeProps {
  status: AssetStatus
}

export function AssetStatusBadge({ status }: AssetStatusBadgeProps) {
  const getStatusConfig = (status: AssetStatus) => {
    switch (status) {
      case 'AVAILABLE':
        return { variant: 'default' as const, label: 'Available' }
      case 'DEPLOYED':
        return { variant: 'secondary' as const, label: 'Deployed' }
      case 'IN_MAINTENANCE':
        return { variant: 'outline' as const, label: 'In Maintenance' }
      case 'RETIRED':
        return { variant: 'secondary' as const, label: 'Retired' }
      case 'LOST':
        return { variant: 'destructive' as const, label: 'Lost' }
      case 'DAMAGED':
        return { variant: 'destructive' as const, label: 'Damaged' }
      case 'FULLY_DEPRECIATED':
        return { variant: 'outline' as const, label: 'Fully Depreciated' }
      case 'DISPOSED':
        return { variant: 'secondary' as const, label: 'Disposed' }
      default:
        return { variant: 'outline' as const, label: status }
    }
  }

  const config = getStatusConfig(status)
  
  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  )
}