import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/database/prisma";
import { validateSessionToken } from "@/lib/auth/utils";
import { sanitizeId, sanitizeNotes } from "@/lib/validation/sanitize";

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const orderId = sanitizeId(body.orderId || '');
    const userId = sanitizeId(body.userId || '');
    const items = Array.isArray(body.items) ? body.items : [];
    const notes = body.notes !== undefined ? sanitizeNotes(body.notes || '') : undefined;

    if (!orderId || !userId || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: orderId, userId, and at least one item" },
        { status: 400 }
      );
    }

    // AUTH GUARD
    const authHeader = request.headers.get("Authorization");
    let isAuthorized = false;

    if (!isAuthorized && authHeader && authHeader !== "Bearer null" && authHeader !== "Bearer undefined") {
      const token = authHeader.replace("Bearer ", "");
      if (userId && token) {
        try {
          const tokenValid = await validateSessionToken(userId, token);
          if (tokenValid) {
            isAuthorized = true;
          } else {
            const userRec = await prisma.user.findUnique({
              where: { id: userId },
              select: { id: true, sessionToken: true, sessionExpiresAt: true },
            });
            if (userRec && userRec.sessionToken === token) {
              await prisma.user.update({
                where: { id: userId },
                data: { sessionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
              });
              isAuthorized = true;
            }
          }
        } catch (e) {
          console.log("Custom token validation error:", e);
        }
      }
    }

    if (!isAuthorized && userId) {
      const activeSession = await prisma.guestSession.findFirst({
        where: { userId, status: "active" },
        select: { id: true },
      });
      if (activeSession) isAuthorized = true;
    }

    if (!isAuthorized && userId) {
      const userRecord = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (userRecord) isAuthorized = true;
    }

    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    // Verify order exists and belongs to user
    const existingOrder = await prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { id: true, userId: true, status: true, createdAt: true },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: "Order not found or does not belong to you" },
        { status: 404 }
      );
    }

    // Check cooldown: only within 5 minutes
    const timeDiffSeconds = (Date.now() - existingOrder.createdAt.getTime()) / 1000;
    if (timeDiffSeconds > 300) {
      return NextResponse.json(
        { success: false, error: "Time is up, please place a new order." },
        { status: 403 }
      );
    }

    // Fetch current prices
    const itemIds = items.map((item: any) => sanitizeId(item.itemId || ''));
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true, price: true, available: true },
    });

    // Validate and calculate
    let serverTotal = 0;
    const validatedOrderItems = [];

    for (const item of items) {
      const sanitizedItemId = sanitizeId(item.itemId || '');
      const menuItem = menuItems.find((m: any) => m.id === sanitizedItemId);
      if (!menuItem) {
        return NextResponse.json({ success: false, error: `Item ${sanitizedItemId} not found` }, { status: 400 });
      }
      if (!menuItem.available) {
        return NextResponse.json({ success: false, error: `${menuItem.name} is currently unavailable` }, { status: 400 });
      }

      const safeQuantity = Math.min(Math.max(parseInt(item.quantity) || 1, 1), 100);
      const itemTotal = Number(menuItem.price) * safeQuantity;
      serverTotal += itemTotal;
      validatedOrderItems.push({
        orderId,
        menuItemId: sanitizedItemId,
        quantity: safeQuantity,
        price: Number(menuItem.price),
      });
    }

    // Transaction: delete old items, insert new, update total
    await prisma.$transaction([
      prisma.orderItem.deleteMany({ where: { orderId } }),
      prisma.orderItem.createMany({ data: validatedOrderItems }),
      prisma.order.update({
        where: { id: orderId },
        data: { total: serverTotal, ...(notes !== undefined ? { notes } : {}) },
      }),
    ]);

    return NextResponse.json({
      success: true,
      orderId,
      total: serverTotal,
      message: "Order updated successfully",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error("Order update API error:", error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
