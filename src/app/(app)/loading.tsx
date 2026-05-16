import { Skeleton } from "@/components/ui/skeleton"

export default function AppLoading() {
  return (
    <div className="max-w-6xl space-y-6">
      <Skeleton delay={0} className="h-10 w-56" />
      <Skeleton delay={80} className="h-5 w-80" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} delay={120 + i * 100} className="h-36 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Skeleton delay={420} className="h-64 rounded-2xl lg:col-span-2" />
        <Skeleton delay={520} className="h-64 rounded-2xl" />
      </div>
    </div>
  )
}
