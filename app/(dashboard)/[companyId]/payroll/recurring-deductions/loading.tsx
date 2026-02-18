import { Skeleton } from "@/components/ui/skeleton"

export default function PayrollRecurringDeductionsLoading() {
  return (
    <main className="min-h-screen w-full bg-background">
      <header className="border-b border-border/60 bg-muted/20 px-4 py-6 sm:px-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-4 w-[520px] max-w-full" />
        </div>
      </header>

      <section className="grid gap-4 px-4 py-4 sm:px-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className="overflow-hidden border border-border/60 bg-background">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div className="space-y-1">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>

          <div className="grid grid-cols-3 gap-px border-b border-border/60 bg-border/60">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={String(index)} className="space-y-2 bg-background px-3 py-2.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-10" />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
            <Skeleton className="h-9 w-full sm:w-96" />
            <Skeleton className="h-9 w-32" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px]">
              <thead className="bg-muted/20">
                <tr className="border-b border-border/60">
                  {Array.from({ length: 7 }).map((_, index) => (
                    <th key={String(index)} className="px-3 py-2 text-left">
                      <Skeleton className="h-3 w-20" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 7 }).map((_, index) => (
                  <tr key={String(index)} className="border-b border-border/50">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Skeleton className="h-8 w-8" />
                        <div className="space-y-1">
                          <Skeleton className="h-3 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Skeleton className="h-3 w-24" />
                    </td>
                    <td className="px-3 py-2.5">
                      <Skeleton className="h-3 w-24" />
                    </td>
                    <td className="px-3 py-2.5">
                      <Skeleton className="h-3 w-20" />
                    </td>
                    <td className="px-3 py-2.5">
                      <Skeleton className="h-3 w-28" />
                    </td>
                    <td className="px-3 py-2.5">
                      <Skeleton className="h-6 w-20" />
                    </td>
                    <td className="px-3 py-2.5">
                      <Skeleton className="h-8 w-8" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-border/60 px-3 py-2">
            <Skeleton className="h-3 w-40" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-14" />
              <Skeleton className="h-7 w-14" />
            </div>
          </div>
        </section>

        <aside className="overflow-hidden border border-border/60 bg-background">
          <div className="space-y-1 border-b border-border/60 px-4 py-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <div className="grid max-h-[calc(100vh-300px)] gap-3 overflow-y-auto px-4 py-3">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={String(index)} className="space-y-1.5">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
            <div className="flex items-center gap-2 border-t border-border/60 pt-3">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-14" />
            </div>
          </div>
        </aside>
      </section>
    </main>
  )
}
