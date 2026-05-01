import { OrderSkeletonList } from '@/components/ui/OrderSkeleton'

export default function KitchenLoading() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="animate-pulse mb-6">
          <div className="h-8 bg-gray-200 rounded w-48 mb-2" />
          <div className="h-4 bg-gray-100 rounded w-32" />
        </div>
        <OrderSkeletonList count={5} />
      </div>
    </div>
  )
}
