import { Skeleton } from "@/components/ui/skeleton"

export default function ApprovalQueueLoading() {
  return (
    <main className="min-h-screen w-full bg-background">
      <section className="border-b border-border/60 bg-muted/20 px-4 py-6 sm:px-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-4 w-[620px] max-w-full" />
        </div>
      </section>

      <div className="space-y-4 px-4 py-4 sm:px-6">
        <section className="overflow-hidden border border-border/60 bg-background">
          <div className="grid grid-cols-2 gap-px bg-border/60 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={String(index)} className="space-y-2 bg-background px-3 py-2.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-12" />
              </div>
            ))}
          </div>
        </section>

        <section className="border border-border/60 bg-background px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-[320px] max-w-full" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        </section>

        <section className="overflow-hidden border border-border/60 bg-background">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="bg-muted/20">
                <tr>
                  {Array.from({ length: 7 }).map((_, index) => (
                    <th key={String(index)} className="px-3 py-2 text-left">
                      <Skeleton className="h-3 w-20" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 7 }).map((_, index) => (
                  <tr key={String(index)} className="border-t border-border/50">
                    <td className="px-3 py-2">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="mt-1 h-3 w-20" />
                    </td>
                    <td className="px-3 py-2">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="mt-1 h-3 w-20" />
                    </td>
                    <td className="px-3 py-2">
                      <Skeleton className="h-3 w-32" />
                    </td>
                    <td className="px-3 py-2">
                      <Skeleton className="h-3 w-24" />
                    </td>
                    <td className="px-3 py-2">
                      <Skeleton className="h-3 w-24" />
                    </td>
                    <td className="px-3 py-2">
                      <Skeleton className="h-6 w-16" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end">
                        <Skeleton className="h-8 w-8" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-3 py-2">
            <Skeleton className="h-3 w-40" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-14" />
              <Skeleton className="h-7 w-14" />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
