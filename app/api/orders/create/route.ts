import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/database/prisma";
import { validateSessionToken } from "@/lib/auth/utils";

export async function POST(request: NextRequest) {
  try {
    const {
      userId,
      phone,
      items,
      tableName,
      numGuests,
      locationType,
      notes,
      sessionId,
    } = await request.json();

    const hasRegularStaffMeal = notes === "REGULAR_STAFF_MEAL";

    if (!userId || (!hasRegularStaffMeal && (!items || items.length === 0))) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: userId and at least one item" },
        { status: 400 }
      );
    }

    // AUTH GUARD: Multiple auth strategies
    const authHeader = request.headers.get("Authorization");
    let isAuthorized = false;

    // Strategy 1: Custom session token
    if (!isAuthorized && authHeader && authHeader !== "Bearer null" && authHeader !== "Bearer undefined") {
      const token = authHeader.replace("Bearer ", "");
      if (userId && token) {
        try {
          const tokenValid = await validateSessionToken(userId, token);
          if (tokenValid) {
            isAuthorized = true;
          } else {
            // Sliding window: check if token matches but expired
            const userRec = await prisma.user.findUnique({
              where: { id: userId },
              select: { id: true, sessionToken: true, sessionExpiresAt: true },
            });
            if (userRec && userRec.sessionToken === token) {
              const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
              await prisma.user.update({
                where: { id: userId },
                data: { sessionExpiresAt: newExpiry },
              });
              isAuthorized = true;
              console.log(`Session auto-extended for user ${userId}`);
            }
          }
        } catch (e) {
          console.log("Custom token validation error:", e);
        }
      }
    }

    // Strategy 2: Guest session check
    if (!isAuthorized && sessionId && userId) {
      const session = await prisma.guestSession.findFirst({
        where: { id: sessionId, userId, status: "active" },
        select: { id: true },
      });
      if (session) isAuthorized = true;
    }

    // Strategy 3: Any active guest session
    if (!isAuthorized && userId) {
      const activeSession = await prisma.guestSession.findFirst({
        where: { userId, status: "active" },
        select: { id: true },
      });
      if (activeSession) isAuthorized = true;
    }

    // Strategy 4: User exists in DB
    if (!isAuthorized && userId) {
      const userRecord = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (userRecord) isAuthorized = true;
    }

    if (!isAuthorized) {
      console.warn(`Order creation blocked: Unauthorized attempt for userId ${userId}`);
      return NextResponse.json(
        { success: false, error: "Unauthorized: User mismatch or invalid session" },
        { status: 403 }
      );
    }

    // 1. Fetch user profile
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, role: true },
    });

    if (!userData) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const rawRole = (userData.role || "").toUpperCase();
    const normalizedRole = rawRole === "KITCHEN_MANAGER" ? "KITCHEN"
      : rawRole === "GUEST" ? "OUTSIDER" : rawRole;

    if (hasRegularStaffMeal && normalizedRole !== "STAFF") {
      return NextResponse.json(
        { success: false, error: "Regular Staff Meal is available to STAFF only" },
        { status: 403 }
      );
    }

    // 2. Fetch current prices for all items
    const itemIds = Array.isArray(items) ? items.map((item: any) => item.itemId) : [];
    let menuItems: any[] = [];

    if (itemIds.length > 0) {
      menuItems = await prisma.menuItem.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, name: true, price: true, available: true },
      });
    }

    // 3. Validate availability and calculate total
    let serverTotal = 0;
    const validatedOrderItems = [];

    for (const item of Array.isArray(items) ? items : []) {
      const menuItem = menuItems.find((m) => m.id === item.itemId);
      if (!menuItem) {
        return NextResponse.json(
          { success: false, error: `Item ${item.itemId} not found` },
          { status: 400 }
        );
      }
      if (!menuItem.available) {
        return NextResponse.json(
          { success: false, error: `Item ${item.itemId} is currently unavailable` },
          { status: 400 }
        );
      }

      const itemTotal = Number(menuItem.price) * item.quantity;
      serverTotal += itemTotal;

      validatedOrderItems.push({
        menuItemId: item.itemId,
        quantity: item.quantity,
        price: Number(menuItem.price),
      });
    }

    // 4. Create order with items in a transaction
    const order = await prisma.order.create({
      data: {
        userId,
        guestInfo: normalizedRole === "OUTSIDER"
          ? { name: userData.name, email: userData.email }
          : undefined,
        tableName: tableName || "N/A",
        locationType,
        numGuests,
        total: serverTotal,
        notes,
        sessionId: sessionId || undefined,
        status: "pending",
        orderItems: {
          create: validatedOrderItems.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
    });

    // 5. Send Email Summary (Asynchronous)
    if (userData?.email) {
      try {
        const { sendEmail } = require("@/lib/utils/email");
        const itemsListHtml = (items || [])
          .map((item: any) => {
            const menuItem = menuItems.find((m) => m.id === item.itemId);
            return `<li>${menuItem?.name || "Item"} x ${item.quantity} - ₹${(Number(menuItem?.price) || 0) * item.quantity}</li>`;
          })
          .join("");

        sendEmail({
          to: userData.email,
          subject: `Order Confirmed: ${tableName} - Ai Cavalli`,
          html: `
            <div style="font-family: sans-serif; padding: 20px;">
              <h2 style="color: #c0272d;">Grazie, ${userData.name}!</h2>
              <p>Your order for <strong>Table ${tableName}</strong> has been received and is being prepared.</p>
              <hr /><ul>${itemsListHtml}</ul>
              <p><strong>Total: ₹${serverTotal}</strong></p>
              <p style="font-size: 12px; color: #666;">This is an automated summary of your order at Ai Cavalli.</p>
            </div>`,
        }).catch((err: any) => console.error("Failed to send order email:", err));
      } catch {}
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      total: serverTotal,
      message: "Order created successfully",
    });
  } catch (error: any) {
    console.error("Secure order API error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
