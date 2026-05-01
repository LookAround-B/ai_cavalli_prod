import { prisma } from '@/lib/database/prisma'

// Fetch a single order with all relations and serialize it to the same
// shape the GET /api/orders endpoint returns.
export async function fetchAndSerializeOrder(orderId: string) {
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { role: true, name: true, phone: true } },
      bill: { select: { paymentMethod: true } },
      orderItems: {
        include: {
          menuItem: {
            include: { category: { select: { name: true } } },
          },
        },
      },
    },
  })

  if (!o) return null

  return {
    id:                  o.id,
    user_id:             o.userId,
    table_name:          o.tableName,
    guest_info:          o.guestInfo,
    status:              o.status,
    total:               Number(o.total),
    discount_amount:     Number(o.discountAmount),
    ready_in_minutes:    o.readyInMinutes,
    num_guests:          o.numGuests,
    notes:               o.notes,
    location_type:       o.locationType,
    billed:              o.billed,
    bill_payment_method: o.bill?.paymentMethod ?? null,
    created_at:          o.createdAt.toISOString(),
    updated_at:          o.updatedAt.toISOString(),
    user: o.user
      ? { role: o.user.role, name: o.user.name, phone: o.user.phone }
      : null,
    items: o.orderItems.map((i) => ({
      id:           i.id,
      menu_item_id: i.menuItemId,
      quantity:     i.quantity,
      price:        Number(i.price),
      menu_item:    i.menuItem
        ? {
            id:       i.menuItem.id,
            name:     i.menuItem.name,
            category: i.menuItem.category ? { name: i.menuItem.category.name } : null,
          }
        : null,
    })),
  }
}
