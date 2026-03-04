"use client";

import { useRef, useCallback } from "react";
import { X, Printer, Download, Receipt } from "lucide-react";
import styles from "./BillPreviewModal.module.css";
import { showError, showSuccess, showConfirm } from "@/components/ui/Popup";

export interface BillItem {
  item_name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface BillData {
  id?: string;
  billNumber: string;
  guestName?: string;
  tableName?: string;
  items: BillItem[];
  discountAmount?: number;
  discount_amount?: number;
  itemsTotal?: number;
  items_total?: number;
  finalTotal?: number;
  final_total?: number;
  paymentMethod?: string;
  payment_method?: string;
  createdAt?: string;
  created_at?: string;
  sessionDetails?: {
    guestName?: string;
    // tableName?: string;
    numGuests?: number;
    orderCount?: number;
    startedAt?: string;
  };
}

interface BillPreviewModalProps {
  bill: BillData;
  onClose: () => void;
  onPrintComplete?: () => void;
  userRole?: string;
}

export function BillPreviewModal({
  bill,
  onClose,
  onPrintComplete,
  userRole,
}: BillPreviewModalProps) {
  const showPrintActions = userRole !== 'OUTSIDER' && userRole !== 'RIDER';
  const receiptRef = useRef<HTMLDivElement>(null);

  const now = (bill.createdAt || bill.created_at) ? new Date(bill.createdAt || bill.created_at!) : new Date();
  const dateStr = now.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  // Normalize data for consistency
  const itemsTotal = Number(bill.itemsTotal || bill.items_total || 0);
  const discountAmount = Number(bill.discountAmount || bill.discount_amount || 0);
  const finalTotal = Number(bill.finalTotal || bill.final_total || (itemsTotal - discountAmount));
  const paymentMethod = bill.paymentMethod || bill.payment_method || "";

  // Calculate percentage for display
  const discountPercent = itemsTotal > 0 ? Math.round((discountAmount / itemsTotal) * 100) : 0;

  const guestName = bill.sessionDetails?.guestName || bill.guestName || "";
  // const tableName = bill.sessionDetails?.tableName || bill.tableName || "";
  const orderCount = bill.sessionDetails?.orderCount;
  const numGuests = bill.sessionDetails?.numGuests;

  // Build the receipt HTML for print/PDF
  const buildPrintHTML = useCallback(() => {
    const itemsHTML = bill.items
      .map(
        (item) => `
            <tr>
                <td style="text-align:left;padding:6px 0;"><b>${item.item_name}</b></td>
                <td style="text-align:center;padding:6px 0;"><b>${item.quantity}</b></td>
                <td style="text-align:right;padding:6px 0;"><b>₹${(item.subtotal || 0).toFixed(2)}</b></td>
            </tr>
        `,
      )
      .join("");

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Bill ${bill.billNumber} - Ai Cavalli</title>
    <style>
        @page {
            size: 80mm auto;
            margin: 2mm;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 14px;
            font-weight: 700;
            width: 80mm;
            max-width: 80mm;
            padding: 4mm;
            background: white;
            color: #000000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            -webkit-text-stroke: 0.6px #000000;
            text-shadow: 0 0 0 #000, 0.5px 0 0 #000, -0.5px 0 0 #000, 0 0.5px 0 #000, 0 -0.5px 0 #000;
        }
        b, strong { font-weight: 900; }
        .center { text-align: center; }
        .restaurant-name {
    font-family: "Times New Roman", Times, serif;
    font-size: 26px;
    font-weight: 700;
    letter-spacing: 2px;
}

        .subtitle {
            font-size: 14px;
            color: #000000;
            font-weight: 900;
            margin-top: 4px;
            letter-spacing: 2px;
        }
        hr {
            border: none;
            border-top: 3px solid #000000;
            margin: 10px 0;
        }
        .info {
            display: flex;
            justify-content: space-between;
            font-size: 15px;
            font-weight: 900;
            margin-bottom: 5px;
            color: #000000;
        }
        table { width: 100%; border-collapse: collapse; }
        .items-header th {
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #000000;
            padding-bottom: 6px;
            font-weight: 900;
            border-bottom: 2px solid #000000;
        }
        td {
            font-size: 15px;
            font-weight: 900;
            color: #000000;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            font-size: 16px;
            font-weight: 900;
            margin: 5px 0;
            color: #000000;
        }
        .grand-total {
            display: flex;
            justify-content: space-between;
            font-size: 22px;
            font-weight: 900;
            padding: 8px 0;
            color: #000000;
            border-top: 3px solid #000000;
            border-bottom: 3px solid #000000;
            -webkit-text-stroke: 1.5px #000000;
            text-shadow: 0 0 1px #000, 1px 0 0 #000, -1px 0 0 #000;
        }
        .footer {
            text-align: center;
            margin-top: 12px;
            font-size: 15px;
            color: #000000;
            font-weight: 900;
        }
        .thank-you {
            font-weight: 900;
            font-size: 17px;
            color: #000000;
            -webkit-text-stroke: 0.8px #000000;
        }
    </style>
</head>
<body>
    <div class="center">
    <div class="restaurant-name">Ai CAVALLI</div>
    <div style="margin-top:4px;">
        Embassy Projects Pvt Ltd<br/>
        Embassy Point, Infantry Road<br/>
        Bangalore - 560001<br/>
        Phone: 080-43418451/2<br/>
        Mobile: 7353779533<br/>
        GSTIN: 29AAACE8809Q1ZW
    </div>
</div>

    <hr>
    <div class="info"><b>Bill No:</b><b>${bill.billNumber}</b></div>
    <div class="info"><b>Date:</b><b>${dateStr}</b></div>
    <div class="info"><b>Time:</b><b>${timeStr}</b></div>
    ${guestName ? `<div class="info"><b>Guest:</b><b>${guestName}</b></div>` : ""}
    ${orderCount ? `<div class="info"><b>Orders:</b><b>${orderCount}</b></div>` : ""}
    <hr>
    <div class="info"><b>Attended By:</b><b>Anand</b></div>
    <hr>
    <table>
        <thead>
            <tr class="items-header">
                <th style="text-align:left;"><b>Item</b></th>
                <th style="text-align:center;"><b>Qty</b></th>
                <th style="text-align:right;"><b>Amt</b></th>
            </tr>
        </thead>
        <tbody>
            ${itemsHTML}
        </tbody>
    </table>
    <hr>
    <hr>
    <div class="total-row"><b>Subtotal:</b><b>₹${itemsTotal.toFixed(2)}</b></div>
    ${discountAmount > 0 ? `<div class="total-row"><b>Discount ${discountPercent > 0 ? `(${discountPercent}%)` : ""}:</b><b>-₹${discountAmount.toFixed(2)}</b></div>` : ""}
    <hr>
    <div class="grand-total"><b>TOTAL:</b><b>₹${finalTotal.toFixed(2)}</b></div>
    ${paymentMethod ? `<div class="total-row"><b>Payment:</b><b>${paymentMethod.toUpperCase()}</b></div>` : ""}
    <hr>
    <div class="footer">
        <div class="thank-you"><b>Thank You! Visit Again!</b></div>
        <div style="margin-top:4px;"><b>Powered by Ai Cavalli</b></div>
    </div>
</body>
</html>`;
  }, [bill, dateStr, timeStr, guestName, numGuests, orderCount, itemsTotal, discountAmount, finalTotal, paymentMethod, discountPercent]);

  // Open browser print dialog (works for both printing and saving as PDF via browser)
  const handlePrint = useCallback(() => {
    const printWindow = window.open("", "_blank", "width=350,height=700");
    if (!printWindow) {
      showError("Popup Blocked", "Please allow popups to print the bill.");
      return;
    }

    printWindow.document.write(buildPrintHTML());
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      printWindow.onafterprint = () => {
        printWindow.close();
        onPrintComplete?.();
      };
    };

    // Fallback for browsers without onafterprint
    setTimeout(() => {
      if (!printWindow.closed) {
        printWindow.focus();
        printWindow.print();
      }
    }, 600);
  }, [buildPrintHTML, onPrintComplete]);

  // Save as PDF: Opens print dialog with instructions to select "Save as PDF"
  const handleSavePDF = useCallback(() => {
    const printWindow = window.open("", "_blank", "width=350,height=700");
    if (!printWindow) {
      showError(
        "Popup Blocked",
        "Please allow popups to save the bill as PDF.",
      );
      return;
    }

    // Add a hint banner for Save as PDF
    const htmlContent = buildPrintHTML().replace(
      "</body>",
      `<div id="pdf-hint" style="
                position:fixed;top:0;left:0;right:0;
                background:#C0272D;color:white;
                text-align:center;padding:8px;
                font-family:sans-serif;font-size:12px;font-weight:600;
                z-index:9999;
            ">
                Select "Save as PDF" as the destination in the print dialog
            </div>
            <script>
                window.onafterprint = function() {
                    var hint = document.getElementById('pdf-hint');
                    if (hint) hint.remove();
                };
            </script>
            </body>`,
    );

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      printWindow.onafterprint = () => {
        printWindow.close();
      };
    };

    setTimeout(() => {
      if (!printWindow.closed) {
        printWindow.focus();
        printWindow.print();
      }
    }, 600);
  }, [buildPrintHTML]);

  // Send to thermal printer via local print server
  const handleThermalPrint = useCallback(async () => {
    try {
      // Try local printer server first (for ESSAE PR-85 or similar)
      const response = await fetch("http://localhost:4000/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billNumber: bill.billNumber,
          // tableName,
          guestName,
          items: bill.items,
          itemsTotal,
          discountAmount,
          finalTotal,
          paymentMethod: paymentMethod || "CASH",
          sessionDetails: bill.sessionDetails,
        }),
      });

      const data = await response.json();
      if (data.success) {
        showSuccess("Printed!", "Bill sent to thermal printer.");
        onPrintComplete?.();
      } else {
        throw new Error(data.error || "Printer error");
      }
    } catch (error: any) {
      // Fallback to browser print if printer server isn't running
      const useBrowserPrint = await showConfirm(
        "Printer Unavailable",
        `${error.message || "Could not connect to printer server."} Use browser print instead?`,
        "Browser Print",
        "Cancel",
      );
      if (useBrowserPrint) {
        handlePrint();
      }
    }
  }, [bill, guestName, handlePrint, onPrintComplete]);

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.header}>
          <h2>
            <Receipt size={20} />
            Bill Preview
          </h2>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Receipt Preview */}
        <div className={styles.billContent}>
          <div className={styles.receipt} ref={receiptRef}>
            {/* Restaurant Header */}
            <div className={styles.receiptHeader}>
              <h3>AI CAVALLI</h3>
              <p style={{ fontSize: '0.75rem', color: '#000', fontWeight: 700, marginTop: '4px', lineHeight: 1.4 }}>
                Embassy Projects Pvt Ltd<br />
                Embassy Point, Infantry Road<br />
                Bangalore - 560001<br />
                Phone: 080-43418451/2<br />
                Mobile: 7353779533<br />
                GSTIN: 29AAACE8809Q1ZW
              </p>
            </div>

            <hr className={styles.divider} />

            {/* Bill Info */}
            <div className={styles.infoRow}>
              <span>Bill No:</span>
              <span>{bill.billNumber}</span>
            </div>
            <div className={styles.infoRow}>
              <span>Date:</span>
              <span>{dateStr}</span>
            </div>
            <div className={styles.infoRow}>
              <span>Time:</span>
              <span>{timeStr}</span>
            </div>
            {/* {tableName && (
              <div className={styles.infoRow}>
                <span>Table:</span>
                <span>{tableName}</span>
              </div>
            )} */}
            {guestName && (
              <div className={styles.infoRow}>
                <span>Guest:</span>
                <span>{guestName}</span>
              </div>
            )}

            {orderCount && (
              <div className={styles.infoRow}>
                <span>Orders:</span>
                <span>{orderCount}</span>
              </div>
            )}

            <hr className={styles.divider} />
            <div className={styles.infoRow}>
              <span>Attended By:</span>
              <span>Anand</span>
            </div>

            <hr className={styles.divider} />

            {/* Items Header */}
            <div className={styles.itemsHeader}>
              <span>Item</span>
              <span>Qty</span>
              <span>Amt</span>
            </div>

            {/* Items */}
            {bill.items.map((item, index) => (
              <div key={index} className={styles.itemRow}>
                <span>{item.item_name}</span>
                <span>{item.quantity}</span>
                <span>₹{(item.subtotal || 0).toFixed(2)}</span>
              </div>
            ))}

            <hr className={styles.divider} />

            {/* Totals */}
            <div className={styles.totalSection}>
              <div className={styles.totalRow}>
                <span>Subtotal:</span>
                <span>₹{itemsTotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className={`${styles.totalRow} ${styles.discount}`}>
                  <span>Discount {discountPercent > 0 && `(${discountPercent}%)`}:</span>
                  <span>-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            <hr className={styles.divider} />

            <div className={styles.grandTotal}>
              <span>TOTAL:</span>
              <span>₹{finalTotal.toFixed(2)}</span>
            </div>

            {paymentMethod && (
              <div className={styles.infoRow}>
                <span>Payment:</span>
                <span>{paymentMethod.toUpperCase()}</span>
              </div>
            )}

            <hr className={styles.divider} />

            {/* Footer */}
            <div className={styles.receiptFooter}>
              <p className={styles.thankYou}>Thank You! Visit Again!</p>
              <p>Powered by AI Cavalli</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        {showPrintActions && (
          <div className={styles.actions}>
            <button className={styles.printBtn} onClick={handlePrint}>
              <Printer size={20} />
              Print Bill
            </button>
            <div className={styles.secondaryActions}>
              <button className={styles.savePdfBtn} onClick={handleSavePDF}>
                <Download size={18} />
                Save as PDF
              </button>
              <button
                className={styles.thermalPrintBtn}
                onClick={handleThermalPrint}
              >
                <Receipt size={18} />
                Thermal Print
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
