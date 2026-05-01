import { OrderSkeletonList } from '@/components/ui/OrderSkeleton'

export default function OrdersLoading() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto">
      <div className="animate-pulse mb-6">
        <div className="h-6 bg-gray-200 rounded w-32 mb-1" />
        <div className="h-3 bg-gray-100 rounded w-48" />
      </div>
      <OrderSkeletonList count={3} />
    </div>
  )
}
