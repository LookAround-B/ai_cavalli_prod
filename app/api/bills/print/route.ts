import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/database/prisma";
import { requireRoles } from "@/lib/auth/api-middleware";
import type { UserRole } from "@/lib/types/auth";

const BILL_ROLES: UserRole[] = ["STAFF", "KITCHEN", "ADMIN"];

export async function POST(request: NextRequest) {
  try {
    const { billId, userId } = await request.json();

    if (!billId) {
      return NextResponse.json(
        { success: false, error: "Bill ID is required" },
        { status: 400 },
      );
    }

    // AUTH GUARD
    const { authorized } = await requireRoles(request, BILL_ROLES);
    if (!authorized) {
      if (!userId) {
        return NextResponse.json(
          { success: false, error: "Unauthorized: No valid session or userId" },
          { status: 401 },
        );
      }
      const userRecord = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      });
      const normalizedRole = (userRecord?.role || "").toUpperCase() as UserRole;
      if (!userRecord || !BILL_ROLES.includes(normalizedRole)) {
        return NextResponse.json(
          { success: false, error: "Forbidden: Insufficient permissions" },
          { status: 403 },
        );
      }
    }

    // Fetch bill with items and order details
    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: {
        billItems: true,
        order: {
          select: {
            tableName: true,
            guestInfo: true,
            notes: true,
            createdAt: true,
            user: { select: { name: true, phone: true, role: true } },
          },
        },
      },
    });

    if (!bill) {
      return NextResponse.json(
        { success: false, error: "Bill not found" },
        { status: 404 },
      );
    }

    // Format bill data for thermal printer
    const billData = formatBillForPrinting(bill);

    // Update printed_at timestamp
    await prisma.bill.update({
      where: { id: billId },
      data: { printedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: "Bill formatted for printing",
      printData: billData,
      printedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Print error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to print bill" },
      { status: 500 },
    );
  }
}

function formatPaymentLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: "Cash",
    credit: "Credit",
    upi: "UPI",
    card: "Card",
    staff_payment: "Staff",
    rider_payment: "Rider Payment",
    silva: "Silva",
    chandar: "Chandar",
  };
  return (
    labels[method?.toLowerCase()] ||
    method?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ||
    ""
  );
}

function getGuestNameFromOrder(order: any): string {
  // Parse kitchen-created order notes for customer name
  if (
    order?.notes &&
    typeof order.notes === "string" &&
    order.notes.startsWith("KITCHEN_ORDER")
  ) {
    const parts = order.notes.split("|").map((s: string) => s.trim());
    if (parts.length >= 2 && parts[1]) return parts[1];
  }
  const guestInfo = order?.guestInfo as any;
  return guestInfo?.name || order?.user?.name || "";
}

function formatBillForPrinting(bill: any) {
  const order = bill.order;
  const items = bill.billItems || [];

  const billDate = new Date(bill.createdAt);
  const dateStr = billDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeStr = billDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const itemsTotal = Number(bill.itemsTotal);
  const discountAmount = Number(bill.discountAmount || 0);
  const afterDiscount = itemsTotal - discountAmount;
  const gstAmount = Number((bill as any).gstAmount || 0) || Math.round((afterDiscount * 0.05) * 100) / 100;
  // Always compute total as afterDiscount + GST
  const finalTotal = Math.round((afterDiscount + gstAmount) * 100) / 100;

  const itemsHTML = items
    .map((item: any) => {
      const name = item.itemName || "Item";
      const qty = item.quantity;
      const amount = `₹${Number(item.subtotal).toFixed(2)}`;
      return `<tr>
            <td style="text-align:left;padding:6px 0;"><b>${name}</b></td>
            <td style="text-align:center;padding:6px 0;"><b>${qty}</b></td>
            <td style="text-align:right;padding:6px 0;"><b>${amount}</b></td>
        </tr>`;
    })
    .join("");

  const htmlReceipt = `<!DOCTYPE html><html><head><style>
        @page { size: 80mm auto; margin: 2mm; }
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Arial Black','Arial Bold',Arial,Helvetica,sans-serif; font-size:16px; font-weight:900;
               width:80mm; max-width:80mm; padding:4mm; background:#fff; color:#000000;
               -webkit-print-color-adjust:exact; print-color-adjust:exact;
               -webkit-text-stroke:0.6px #000000;
               text-shadow:0 0 0 #000,0.5px 0 0 #000,-0.5px 0 0 #000,0 0.5px 0 #000,0 -0.5px 0 #000; }
        b, strong { font-weight:900; }
        .c { text-align:center; }
        .name { font-size:28px; font-weight:900; letter-spacing:3px;
                -webkit-text-stroke:1.5px #000000;
                text-shadow:0 0 1px #000,1px 0 0 #000,-1px 0 0 #000,0 1px 0 #000,0 -1px 0 #000; }
        .sub { font-size:14px; font-weight:900; letter-spacing:2px; margin-top:4px; }
        hr { border:none; border-top:3px solid #000000; margin:10px 0; }
        .r { display:flex; justify-content:space-between; font-size:15px; font-weight:900; margin-bottom:5px; color:#000000; }
        table { width:100%; border-collapse:collapse; }
        .th { font-size:14px; font-weight:900; text-transform:uppercase; padding-bottom:6px;
              letter-spacing:1px; border-bottom:2px solid #000000; }
        td { font-size:15px; font-weight:900; color:#000000; padding:6px 0; }
        .tr { font-size:16px; font-weight:900; margin:5px 0; display:flex; justify-content:space-between; color:#000000; }
        .gt { display:flex; justify-content:space-between; font-size:22px; font-weight:900;
              padding:8px 0; border-top:3px solid #000000; border-bottom:3px solid #000000;
              -webkit-text-stroke:1.5px #000000;
              text-shadow:0 0 1px #000,1px 0 0 #000,-1px 0 0 #000; }
        .ft { text-align:center; margin-top:12px; font-size:17px; font-weight:900;
              -webkit-text-stroke:0.8px #000000; }
    </style></head><body>
        <div class="c"><div class="name"><b>AI CAVALLI</b></div>
<div class="sub"><b>Embassy International Riding School<br/>
Tharahunise Village<br/>
Bangalore - 562157<br/>
Phone: 080-43418451/2<br/>
Mobile: 7353779533 | 9845054013<br/>
GSTIN: 29AAACE8809Q1ZW</b></div></div>
        <hr>
        <div class="r"><b>Bill No:</b><b>${bill.billNumber}</b></div>
        <div class="r"><b>Date:</b><b>${dateStr} ${timeStr}</b></div>
        <div class="r"><b>Table:</b><b>${order?.tableName || "N/A"}</b></div>
        ${getGuestNameFromOrder(order) ? `<div class="r"><b>Guest:</b><b>${getGuestNameFromOrder(order)}</b></div>` : ""}
        <hr>
        <table><thead><tr>
            <th class="th" style="text-align:left;"><b>Item</b></th>
            <th class="th" style="text-align:center;"><b>Qty</b></th>
            <th class="th" style="text-align:right;"><b>Amt</b></th>
        </tr></thead><tbody>${itemsHTML}</tbody></table>
        <hr>
        <div class="tr"><b>Subtotal:</b><b>₹${itemsTotal.toFixed(2)}</b></div>
        ${discountAmount > 0 ? `<div class="tr"><b>Discount:</b><b>-₹${discountAmount.toFixed(2)}</b></div>` : ""}
        <div class="tr"><b>GST (5%):</b><b>₹${gstAmount.toFixed(2)}</b></div>
        <hr>
        <div class="gt"><b>TOTAL:</b><b>₹${finalTotal.toFixed(2)}</b></div>
        ${bill.paymentMethod ? `<div class="tr"><b>Payment:</b><b>${formatPaymentLabel(bill.paymentMethod)}</b></div>` : ""}
        <hr>
        <div class="ft"><b>Thank You! Visit Again!</b></div>
        <div class="c" style="margin-top:4px;font-size:13px;font-weight:900;"><b>Powered by AI Cavalli</b></div>
    </body></html>`;

  // Plain text for raw printer fallback
  const lines = [
    "================================",
    "       AI CAVALLI RESTAURANT    ",
    "  Embassy Intl Riding School    ",
    "      Tharahunise Village       ",
    "      Bangalore - 562157        ",
    "      PH: 080-43418451/2        ",
    "  7353779533 | 9845054013       ",
    "   GSTIN: 29AAACE8809Q1ZW       ",
    "================================",
    `Bill No: ${bill.billNumber}`,
    `Date: ${dateStr} ${timeStr}`,
    `Table: ${order?.tableName || "N/A"}`,
    "--------------------------------",
    "ITEM              QTY    AMOUNT",
    "--------------------------------",
  ];

  items.forEach((item: any) => {
    const name = (item.itemName || "Item").substring(0, 18).padEnd(18);
    const qty = item.quantity.toString().padStart(3);
    const amount = `Rs.${Number(item.subtotal).toFixed(2)}`.padStart(9);
    lines.push(`${name}${qty}${amount}`);
  });

  lines.push("--------------------------------");
  lines.push(`Subtotal:         Rs.${itemsTotal.toFixed(2)}`);

  if (discountAmount > 0) {
    const discountPercent = ((discountAmount / itemsTotal) * 100).toFixed(0);
    lines.push(
      `Discount (${discountPercent}%):   -Rs.${discountAmount.toFixed(2)}`,
    );
  }

  lines.push(`GST (5%):         Rs.${gstAmount.toFixed(2)}`);
  lines.push("================================");
  lines.push(`TOTAL:            Rs.${finalTotal.toFixed(2)}`);
  lines.push("================================");

  if (bill.paymentMethod) {
    lines.push(`Payment: ${formatPaymentLabel(bill.paymentMethod)}`);
  }

  lines.push("");
  lines.push("      Thank you! Visit again!");
  lines.push("================================");
  lines.push("");
  lines.push("");

  return {
    billNumber: bill.billNumber,
    text: lines.join("\n"),
    html: htmlReceipt,
    lines,
    metadata: {
      billId: bill.id,
      orderId: bill.orderId,
      total: finalTotal,
      itemCount: items.length,
    },
  };
}
