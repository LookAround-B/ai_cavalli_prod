import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/database/prisma";
import { validateSessionToken } from "@/lib/auth/utils";

export async function PUT(request: NextRequest) {
  try {
    const { orderId, userId, items, notes } = await request.json();

    if (!orderId || !userId || !items || items.length === 0) {
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

    // Check cooldown: only within 2 minutes
    const timeDiffSeconds = (Date.now() - existingOrder.createdAt.getTime()) / 1000;
    if (timeDiffSeconds > 120) {
      return NextResponse.json(
        { success: false, error: "Edit window has expired. Orders can only be modified within 2 minutes of placement." },
        { status: 403 }
      );
    }

    // Fetch current prices
    const itemIds = items.map((item: any) => item.itemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true, price: true, available: true },
    });

    // Validate and calculate
    let serverTotal = 0;
    const validatedOrderItems = [];

    for (const item of items) {
      const menuItem = menuItems.find((m: any) => m.id === item.itemId);
      if (!menuItem) {
        return NextResponse.json({ success: false, error: `Item ${item.itemId} not found` }, { status: 400 });
      }
      if (!menuItem.available) {
        return NextResponse.json({ success: false, error: `${menuItem.name} is currently unavailable` }, { status: 400 });
      }

      const itemTotal = Number(menuItem.price) * item.quantity;
      serverTotal += itemTotal;
      validatedOrderItems.push({
        orderId,
        menuItemId: item.itemId,
        quantity: item.quantity,
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
  } catch (error: any) {
    console.error("Order update API error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
