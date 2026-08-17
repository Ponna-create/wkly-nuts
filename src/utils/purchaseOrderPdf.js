import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logo from '../assets/wkly-nuts-logo.png';

// Generates and downloads a Purchase Order PDF for a vendor.
// If no item has a unit price set yet, the Rate/Total columns are hidden and the
// PDF shows quantities only — for sending to a vendor to quote back on (Smart PO flow).
export async function generatePurchaseOrderPDF(po, vendor) {
  const items = Array.isArray(po.items) ? po.items : [];
  const hasPricing = items.some(i => parseFloat(i.unit_price || i.rate || 0) > 0);

  const doc = new jsPDF({ compress: true, unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  // Logo (fallback to text if it fails to load)
  const loadLogo = () => new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try { doc.addImage(img, 'PNG', margin, y, 26, 26, undefined, 'FAST'); resolve(true); }
      catch { resolve(false); }
    };
    img.onerror = () => resolve(false);
    img.src = logo;
    setTimeout(() => resolve(false), 1000);
  });
  const logoLoaded = await loadLogo();
  if (!logoLoaded) {
    doc.setFont(undefined, 'bold');
    doc.setFontSize(16);
    doc.setTextColor(13, 148, 136);
    doc.text('WKLY Nuts', margin, y + 10);
  }

  // Title (right-aligned)
  doc.setFont(undefined, 'bold');
  doc.setFontSize(20);
  doc.setTextColor(20, 20, 20);
  doc.text('PURCHASE ORDER', pageWidth - margin, y + 8, { align: 'right' });
  doc.setFont(undefined, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(`PO #: ${po.po_number || po.poNumber || '—'}`, pageWidth - margin, y + 15, { align: 'right' });
  doc.text(`Order Date: ${formatDate(po.order_date || po.orderDate)}`, pageWidth - margin, y + 20, { align: 'right' });
  if (po.expected_delivery_date || po.expectedDeliveryDate) {
    doc.text(`Expected Delivery: ${formatDate(po.expected_delivery_date || po.expectedDeliveryDate)}`, pageWidth - margin, y + 25, { align: 'right' });
  }

  y += 34;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Vendor block
  doc.setFont(undefined, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('VENDOR', margin, y);
  y += 5;
  doc.setFont(undefined, 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text(po.vendor_name || po.vendorName || 'TBD', margin, y);
  y += 6;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(80, 80, 80);
  if (vendor?.phone) { doc.text(`Phone: ${vendor.phone}`, margin, y); y += 5; }
  if (vendor?.location) { doc.text(vendor.location, margin, y); y += 5; }
  if (vendor?.email) { doc.text(vendor.email, margin, y); y += 5; }

  y += 4;

  // Items table
  const body = items.map(i => {
    const qty = i.quantity_kg ?? i.quantity ?? '';
    const rate = parseFloat(i.unit_price || i.rate || 0);
    const total = parseFloat(i.total || (qty && rate ? qty * rate : 0)) || 0;
    const row = [i.ingredient_name || i.name || '', `${qty} kg`];
    if (hasPricing) {
      row.push(rate > 0 ? `Rs ${rate.toLocaleString('en-IN')}` : '-');
      row.push(total > 0 ? `Rs ${total.toLocaleString('en-IN')}` : '-');
    }
    return row;
  });

  const head = hasPricing
    ? [['Ingredient', 'Quantity', 'Rate/kg', 'Total']]
    : [['Ingredient', 'Quantity']];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head,
    body,
    theme: 'grid',
    headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: 'bold', fontSize: 9.5 },
    bodyStyles: { fontSize: 9.5, textColor: [40, 40, 40] },
    columnStyles: hasPricing
      ? { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } }
      : { 1: { halign: 'right' } },
  });

  y = doc.lastAutoTable.finalY + 8;

  if (!hasPricing) {
    doc.setFont(undefined, 'italic');
    doc.setFontSize(9);
    doc.setTextColor(180, 120, 20);
    doc.text('Quantities only — please quote pricing for the above.', margin, y);
    y += 8;
  } else {
    const subtotal = parseFloat(po.subtotal) || items.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
    const gst = parseFloat(po.gst_amount ?? po.gstAmount) || 0;
    const shipping = parseFloat(po.shipping_charge ?? po.shippingCharge) || 0;
    const total = parseFloat(po.total_amount ?? po.totalAmount) || (subtotal + gst + shipping);

    const boxWidth = 70;
    const boxX = pageWidth - margin - boxWidth;
    const rows = [
      ['Subtotal', subtotal],
      ...(gst > 0 ? [['GST', gst]] : []),
      ...(shipping > 0 ? [['Shipping', shipping]] : []),
    ];
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(80, 80, 80);
    rows.forEach(([label, val]) => {
      doc.text(label, boxX, y);
      doc.text(`Rs ${val.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, pageWidth - margin, y, { align: 'right' });
      y += 5.5;
    });
    doc.setDrawColor(200, 200, 200);
    doc.line(boxX, y, pageWidth - margin, y);
    y += 5.5;
    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);
    doc.setTextColor(13, 148, 136);
    doc.text('Total', boxX, y);
    doc.text(`Rs ${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`, pageWidth - margin, y, { align: 'right' });
    y += 10;
  }

  if (po.notes) {
    doc.setFont(undefined, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('NOTES', margin, y);
    y += 5;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(60, 60, 60);
    const noteLines = doc.splitTextToSize(po.notes, pageWidth - margin * 2);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 5 + 4;
  }

  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.text('Generated by WKLY Nuts Business OS', margin, doc.internal.pageSize.getHeight() - 10);

  doc.save(`PO-${po.po_number || po.poNumber || 'draft'}.pdf`);
}

function formatDate(d) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}-${dt.getFullYear()}`;
  } catch { return d; }
}
