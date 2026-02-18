import { Skeleton } from "@/components/ui/skeleton"

export default function SyncBiometricsLoading() {
  return (
    <main className="min-h-screen w-full bg-background">
      <div className="border-b border-border/60 bg-muted/20 px-6 py-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-52" />
              <Skeleton className="h-6 w-36" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="border border-border/60 bg-background">
          <div className="p-6">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
              <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/60 bg-muted/5 py-24 lg:col-span-5">
                <Skeleton className="h-16 w-16" />
                <Skeleton className="mt-6 h-5 w-52" />
                <Skeleton className="mt-2 h-4 w-72 max-w-full" />
                <Skeleton className="mt-10 h-10 w-28" />
              </div>

              <div className="space-y-4 lg:col-span-7">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-6 w-24" />
                </div>
                <div className="h-[400px] border border-border/60 bg-muted/20 p-4">
                  <div className="space-y-2">
                    {Array.from({ length: 14 }).map((_, index) => (
                      <Skeleton key={String(index)} className="h-3 w-full" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t border-border/60 bg-muted/30 p-6">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-4 w-[680px] max-w-full" />
          </div>
        </div>
      </div>
    </main>
  )
}
