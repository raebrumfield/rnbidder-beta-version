/* ═══════════════════════════════════════════
   RnB Bidding Tool — Branded PDF Export
   ═══════════════════════════════════════════
   Generates a professional customer-facing PDF estimate.
   Uses jsPDF (loaded via CDN).
   Logo loaded from logo.png in the same directory.
*/

// ─── Logo Cache ───
let _logoDataUrl = null;

async function _loadLogo() {
  if (_logoDataUrl) return _logoDataUrl;
  try {
    const res = await fetch("logo.png");
    if (!res.ok) throw new Error("Logo not found");
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => { _logoDataUrl = reader.result; resolve(_logoDataUrl); };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("Could not load logo.png — PDF will generate without logo.", e);
    return null;
  }
}

/**
 * Generate and download a branded PDF estimate from a bid object.
 * @param {Object} bid — bid data from collectBidData() or BidStore.get()
 */
async function exportBidToPDF(bid) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const pw = doc.internal.pageSize.getWidth();   // ~215.9
  const ph = doc.internal.pageSize.getHeight();   // ~279.4
  const ml = 20;           // left margin
  const mr = pw - 20;      // right margin x
  const navy = [15, 52, 96];
  const red  = [233, 69, 96];
  let y = 18;

  // ──────────────────────────────
  //  LOGO
  // ──────────────────────────────
  const logoUrl = await _loadLogo();
  if (logoUrl) {
    try {
      // Load image to get natural dimensions for aspect ratio
      const img = await _loadImage(logoUrl);
      const maxW = 50;
      const maxH = 50;
      const ratio = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      const x = (pw - w) / 2;
      doc.addImage(logoUrl, "PNG", x, y, w, h);
      y += h + 4;
    } catch (e) {
      console.warn("Logo render failed:", e);
    }
  }

  // ──────────────────────────────
  //  COMPANY INFO
  // ──────────────────────────────
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont(undefined, "normal");
  _centerText(doc, "Colorado Springs, CO", pw, y); y += 4.5;
  _centerText(doc, "719-424-8032", pw, y); y += 4.5;
  _centerText(doc, "rnbhomes.co@gmail.com", pw, y); y += 8;

  // ──────────────────────────────
  //  DIVIDER
  // ──────────────────────────────
  doc.setDrawColor(...navy);
  doc.setLineWidth(0.6);
  doc.line(ml, y, mr, y);
  y += 10;

  // ──────────────────────────────
  //  ESTIMATE TITLE
  // ──────────────────────────────
  doc.setFontSize(20);
  doc.setTextColor(...navy);
  doc.setFont(undefined, "bold");
  _centerText(doc, "ESTIMATE", pw, y);
  y += 12;

  // ──────────────────────────────
  //  CUSTOMER / BID DETAILS
  // ──────────────────────────────
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  const details = [
    ["Customer:", bid.customerName || "\u2014"],
    ["Address:",  bid.jobAddress || "\u2014"],
    ["Date:",     _formatDate(bid.bidDate)],
    ["Bid:",      bid.name || "\u2014"],
  ];
  details.forEach(([label, value]) => {
    doc.setFont(undefined, "bold");
    doc.text(label, ml, y);
    doc.setFont(undefined, "normal");
    doc.text(String(value), ml + 28, y);
    y += 6.5;
  });
  y += 4;

  // ──────────────────────────────
  //  DIVIDER
  // ──────────────────────────────
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(ml, y, mr, y);
  y += 10;

  // ──────────────────────────────
  //  PRICING SUMMARY
  //  Materials = materialsSubtotal + markupAmount (markup NOT disclosed)
  //  Labor = laborSubtotal
  //  Total = Materials + Labor
  // ──────────────────────────────
  const materialsWithMarkup = (bid.materialsSubtotal || 0) + (bid.markupAmount || 0);
  const labor = bid.laborSubtotal || 0;
  const total = materialsWithMarkup + labor + (bid.taxAmount || 0);

  doc.setFontSize(11);
  doc.setTextColor(50, 50, 50);

  // Materials row
  doc.setFont(undefined, "normal");
  doc.text("Materials", ml, y);
  doc.text("$" + _fmt(materialsWithMarkup), mr, y, { align: "right" });
  y += 9;

  // Labor row
  doc.text("Labor", ml, y);
  doc.text("$" + _fmt(labor), mr, y, { align: "right" });
  y += 6;

  // Subtotal line
  doc.setDrawColor(15, 52, 96);
  doc.setLineWidth(0.4);
  doc.line(mr - 55, y, mr, y);
  y += 8;

  // Total
  doc.setFontSize(14);
  doc.setFont(undefined, "bold");
  doc.setTextColor(...navy);
  doc.text("Total", ml, y);
  doc.text("$" + _fmt(total), mr, y, { align: "right" });
  y += 16;

  // ──────────────────────────────
  //  NOTES / SCOPE OF WORK
  // ──────────────────────────────
  if (bid.notes && bid.notes.trim()) {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(ml, y, mr, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(...navy);
    doc.setFont(undefined, "bold");
    doc.text("Notes / Scope of Work", ml, y);
    y += 7;

    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.setFont(undefined, "normal");
    const noteLines = doc.splitTextToSize(bid.notes, mr - ml);
    doc.text(noteLines, ml, y);
    y += noteLines.length * 4.5 + 5;
  }

  // ──────────────────────────────
  //  FOOTER DISCLAIMER
  // ──────────────────────────────
  const footerY = ph - 28;

  // Divider above footer
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(ml, footerY - 4, mr, footerY - 4);

  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.setFont(undefined, "italic");

  const disc1 = "* Estimates are good for 30 days from date of invoice. Prices subject to change due to market price on materials.";
  const disc2 = "Workmanship is warranted for one year from the service date. Warranty does not apply in cases of misuse, tampering, or work performed by others. Additional exclusions may apply.";

  const d1 = doc.splitTextToSize(disc1, mr - ml);
  doc.text(d1, ml, footerY);

  const d2 = doc.splitTextToSize(disc2, mr - ml);
  doc.text(d2, ml, footerY + d1.length * 3.2 + 2);

  // ──────────────────────────────
  //  SAVE PDF
  // ──────────────────────────────
  const safeName = (bid.name || "Estimate").replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "Estimate";
  doc.save(safeName + ".pdf");
}

// ─── Helpers ───

function _centerText(doc, text, pageWidth, y) {
  doc.text(text, pageWidth / 2, y, { align: "center" });
}

function _fmt(n) {
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _formatDate(dateStr) {
  if (!dateStr) return "\u2014";
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  } catch (e) {
    return dateStr;
  }
}

function _loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
