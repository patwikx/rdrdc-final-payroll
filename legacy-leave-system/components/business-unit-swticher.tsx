"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { 
  Store, 
  Plus, 
  Check, 
  Monitor, 
  Smartphone, 
  Code, 
  Settings, 
  ChevronsUpDown 
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

import { useBusinessUnitModal } from "@/hooks/use-bu-modal"
import type { BusinessUnitItem } from "@/types/business-unit-types"

interface BusinessUnitSwitcherProps {
  items: BusinessUnitItem[]
  className?: string
  userRole?: string
  isPurchaser?: boolean
}

// Define icon types for better type safety
type IconComponent = React.ComponentType<{ className?: string }>

// Icon mapping based on business unit name
const getBusinessUnitIcon = (name: string): IconComponent => {
  const lowerName = name.toLowerCase()
  
  if (lowerName.includes('mobile') || lowerName.includes('app')) {
    return Smartphone
  }
  if (lowerName.includes('admin') || lowerName.includes('settings')) {
    return Settings
  }
  if (lowerName.includes('store') || lowerName.includes('shop') || lowerName.includes('retail')) {
    return Store
  }
  if (lowerName.includes('dev') || lowerName.includes('code') || lowerName.includes('development')) {
    return Code
  }
  if (lowerName.includes('hotel') || lowerName.includes('resort') || lowerName.includes('hospitality')) {
    return Store // Using Store as a generic business icon
  }
  
  return Monitor // Default fallback
}

const getBusinessUnitTypeLabel = (name: string): string => {
  const lowerName = name.toLowerCase()
  
  if (lowerName.includes('mobile') || lowerName.includes('app')) {
    return 'Mobile application'
  }
  if (lowerName.includes('admin')) {
    return 'Administrative unit'
  }
  if (lowerName.includes('dev') || lowerName.includes('development')) {
    return 'Business Unit'
  }
  if (lowerName.includes('hotel') || lowerName.includes('resort')) {
    return 'Hotel property'
  }
  if (lowerName.includes('store') || lowerName.includes('shop') || lowerName.includes('retail')) {
    return 'Retail location'
  }
  
  return 'Business unit' // Default fallback
}

export default function BusinessUnitSwitcher({ 
  className, 
  items = [],
  userRole,
  isPurchaser = false
}: BusinessUnitSwitcherProps) {
  const businessUnitModal = useBusinessUnitModal()
  const params = useParams()
  const router = useRouter()
  const { isMobile } = useSidebar()
  const [open, setOpen] = React.useState<boolean>(false)
  const [logoUrls, setLogoUrls] = React.useState<Record<string, string>>({})

  // Type-safe params access
  const businessUnitId = typeof params.businessUnitId === 'string' ? params.businessUnitId : undefined

  // ADMIN, HR, and users with purchaser access can switch business units
  const canSwitchBusinessUnits = userRole === 'ADMIN' || userRole === 'HR' || isPurchaser
  const isSwitcherActive = items.length > 1 && canSwitchBusinessUnits
  const currentBusinessUnit = items.find((item) => item.id === businessUnitId)

  // Load business unit logos
  React.useEffect(() => {
    const loadLogos = async () => {
      const logoPromises = items
        .filter(item => item.image)
        .map(async (item) => {
          try {
            const response = await fetch(`/api/business-unit-logo/${encodeURIComponent(item.image!)}`);
            const result = await response.json();
            
            if (result.success && result.fileUrl) {
              return { id: item.id, url: result.fileUrl };
            }
          } catch (error) {
            console.error(`Error loading logo for ${item.name}:`, error);
          }
          return null;
        });

      const logoResults = await Promise.all(logoPromises);
      const logoMap: Record<string, string> = {};
      
      logoResults.forEach(result => {
        if (result) {
          logoMap[result.id] = result.url;
        }
      });
      
      setLogoUrls(logoMap);
    };

    if (items.length > 0) {
      loadLogos();
    }
  }, [items]);

  const onBusinessUnitSelect = React.useCallback((selectedBusinessUnitId: string) => {
    setOpen(false)
    router.push(`/${selectedBusinessUnitId}`)
    router.refresh()
  }, [router])

  const handleAddBusinessUnit = React.useCallback(() => {
    setOpen(false)
    businessUnitModal.onOpen()
  }, [businessUnitModal])

  // Get current business unit info
  const CurrentIcon = getBusinessUnitIcon(currentBusinessUnit?.name ?? '')
  const currentUnitName = currentBusinessUnit?.name ?? "No Unit Assigned"
  const currentUnitType = getBusinessUnitTypeLabel(currentBusinessUnit?.name ?? '')

  // Component to render business unit logo or fallback icon
  const BusinessUnitLogo = ({ businessUnit, size = "size-8", containerSize = "size-8" }: { businessUnit: BusinessUnitItem, size?: string, containerSize?: string }) => {
    const logoUrl = logoUrls[businessUnit.id]
    const FallbackIcon = getBusinessUnitIcon(businessUnit.name)
    
    if (logoUrl) {
      return (
        <img 
          src={logoUrl} 
          alt={businessUnit.name}
          className={cn("object-contain rounded-lg", containerSize)}
        />
      )
    }
    
    return (
      <div className={cn("flex items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground", containerSize)}>
        <FallbackIcon className={size} />
      </div>
    )
  }

  // Static display for single unit users
  if (!isSwitcherActive) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className={cn(
              "data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground",
              className
            )}
          >
            {currentBusinessUnit ? (
              <BusinessUnitLogo businessUnit={currentBusinessUnit} size="size-4" containerSize="size-8" />
            ) : (
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <CurrentIcon className="size-4" />
              </div>
            )}
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">
                {currentUnitName}
              </span>
              <span className="truncate text-xs">
                {currentUnitType}
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  // Interactive dropdown for multi-unit users
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {currentBusinessUnit ? (
                <BusinessUnitLogo businessUnit={currentBusinessUnit} size="size-4" containerSize="size-8" />
              ) : (
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <CurrentIcon className="size-4" />
                </div>
              )}
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {currentUnitName}
                </span>
                <span className="truncate text-xs">
                  {currentUnitType}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            {/* Active Units Section */}
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Business Units
            </DropdownMenuLabel>

            {/* Current/Selected item */}
            {currentBusinessUnit && (
              <DropdownMenuItem
                onClick={() => onBusinessUnitSelect(currentBusinessUnit.id)}
                className="gap-2 p-2"
              >
                <BusinessUnitLogo businessUnit={currentBusinessUnit} size="size-3" containerSize="size-6" />
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  <div className="font-medium truncate">
                    {currentBusinessUnit.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {getBusinessUnitTypeLabel(currentBusinessUnit.name)}
                  </div>
                </div>
                <Check className="ml-auto size-4" />
              </DropdownMenuItem>
            )}

            {/* Other business units */}
            {items
              .filter((item): item is BusinessUnitItem => item.id !== currentBusinessUnit?.id)
              .slice(0, 5) // Show up to 5 additional units
              .map((item) => {
                return (
                  <DropdownMenuItem
                    key={item.id}
                    onClick={() => onBusinessUnitSelect(item.id)}
                    className="gap-2 p-2"
                  >
                    <BusinessUnitLogo businessUnit={item} size="size-3" containerSize="size-6" />
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      <div className="font-medium truncate">
                        {item.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {getBusinessUnitTypeLabel(item.name)}
                      </div>
                    </div>
                  </DropdownMenuItem>
                )
              })}

            {/* Show overflow indicator if there are more units */}
            {items.length > 6 && (
              <DropdownMenuItem disabled className="gap-2 p-2 opacity-50">
                <div className="flex size-6 items-center justify-center rounded-sm border">
                  <Monitor className="size-4 shrink-0" />
                </div>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  <div className="text-sm truncate">
                    +{items.length - 6} more units...
                  </div>
                </div>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            {/* Add Business Unit Option */}
            <DropdownMenuItem
              onClick={handleAddBusinessUnit}
              className="gap-2 p-2"
            >
              <div className="flex size-6 items-center justify-center rounded-md border border-dashed">
                <Plus className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                <div className="font-medium">Add Business Unit</div>
                <div className="text-xs text-muted-foreground">
                  Create new unit
                </div>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}