import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function EmployeeOnboardingLoading() {
  return (
    <main className="min-h-screen w-full bg-background">
      <div className="border-b border-border/60">
        <div className="flex flex-col justify-between gap-6 px-4 pb-6 pt-6 sm:px-6 lg:flex-row lg:items-end lg:px-8">
          <div className="space-y-2">
            <Skeleton className="h-3 w-80 max-w-full" />
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 sm:px-6 lg:px-8">
        <div className="inline-flex flex-wrap items-center gap-1 border border-border/70 bg-muted/30 p-1">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-8 w-60" />
        </div>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden border-border/70 py-0">
          <CardHeader className="border-b border-border/60 px-5 py-3">
            <Skeleton className="h-4 w-20" />
          </CardHeader>
          <CardContent className="grid gap-4 px-5 pb-5 pt-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
            <div className="space-y-2">
              <Skeleton className="h-56 w-full" />
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 12 }).map((_, index) => (
                <div key={String(index)} className="space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/70 py-0">
          <CardHeader className="border-b border-border/60 px-5 py-3">
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent className="grid gap-3 px-5 pb-5 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 11 }).map((_, index) => (
              <div key={String(index)} className="space-y-1.5">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/70 py-0">
          <CardHeader className="border-b border-border/60 px-5 py-3">
            <Skeleton className="h-4 w-36" />
          </CardHeader>
          <CardContent className="space-y-3 px-5 pb-5 pt-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-3 w-64 max-w-full" />
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={String(index)}
                className="grid gap-2 border border-border/60 bg-background p-2 sm:grid-cols-[1fr_180px_120px_auto] sm:items-center"
              >
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-8 w-8" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between border-t border-border/60 px-4 py-4 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-20" />
      </div>
    </main>
  )
}
