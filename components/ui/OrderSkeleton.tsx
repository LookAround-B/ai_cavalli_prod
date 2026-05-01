export function OrderSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-100 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-4 bg-gray-200 rounded w-1/4" />
        <div className="h-5 bg-gray-200 rounded-full w-16" />
      </div>
      <div className="h-3 bg-gray-200 rounded w-1/3" />
      <div className="space-y-2 pt-1">
        <div className="h-3 bg-gray-100 rounded w-2/3" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
      </div>
      <div className="flex justify-between pt-1">
        <div className="h-3 bg-gray-200 rounded w-1/4" />
        <div className="h-3 bg-gray-200 rounded w-1/5" />
      </div>
    </div>
  )
}

export function OrderSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <OrderSkeleton key={i} />
      ))}
    </div>
  )
}
