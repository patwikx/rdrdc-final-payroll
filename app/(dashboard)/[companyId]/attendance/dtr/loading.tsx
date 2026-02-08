import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function DailyTimeRecordLoading() {
  return (
    <main className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6">
      <Card className="rounded-xl border border-border/70 bg-card/80 shadow-sm">
        <CardHeader>
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-3 w-72" />
        </CardHeader>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={String(index)} className="rounded-xl border border-border/70 bg-card/80 shadow-sm">
            <CardContent className="space-y-2 px-4 py-3">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-3 w-36" />
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="rounded-xl border border-border/70 bg-card/80 shadow-sm">
        <CardContent className="space-y-2 px-4 py-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-[320px] w-full" />
        </CardContent>
      </Card>
    </main>
  )
}
