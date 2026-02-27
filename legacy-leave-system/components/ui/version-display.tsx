import { Badge } from "@/components/ui/badge"

export function VersionDisplay() {
  return (
    <Badge variant="outline" className="text-xs font-mono bg-muted/50 text-muted-foreground border-muted-foreground/20">
      v2.1.1
    </Badge>
  )
}