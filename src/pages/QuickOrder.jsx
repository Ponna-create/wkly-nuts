import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Minus, Plus, Trash2, Loader2, AlertTriangle, Printer, ScanLine } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';
import { parseOrderPaste } from '../utils/orderPasteParser';
import { generateA4LabelSheet } from '../utils/a4LabelSheet';
import LabelPrinter from '../components/sales/LabelPrinter';
import { buildInvoiceDataFromOrder, isPromotionalOrder } from '../utils/invoiceFromOrder';
import TrackingScanner from '../components/sales/TrackingScanner';

const EMPTY_FIELDS = { name: '', phone: '', courierNumber: '', address: '', city: '', state: '', pincode: '', oldStylePostalCode: '' };

export default function QuickOrder() {
  const { state, dispatch, showToast } = useApp();
  const skus = state.skus || [];

  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [orderSource, setOrderSource] = useState('whatsapp');
  const [customSourceMode, setCustomSourceMode] = useState(false);
  const [customSourceInput, setCustomSourceInput] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [fields, setFields] = useState(EMPTY_FIELDS);
  const [phoneLookupStatus, setPhoneLookupStatus] = useState('idle'); // idle | searching | found | not_found
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [items, setItems] = useState([]); // { key, skuId, skuName, packType, quantity, unitPrice, total }
  const [shippingCharge, setShippingCharge] = useState(0);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(null); // the last saved order, with phone attached for printing
  const [showLabelPrinter, setShowLabelPrinter] = useState(false);
  const [showTrackingScanner, setShowTrackingScanner] = useState(false);
  const [customItemMode, setCustomItemMode] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [customItemWeight, setCustomItemWeight] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi'); // upi (prepaid, default) | cod

  // The SKU's own Selling Price (set in SKU Management) is the master price
  // for orders — Weekly and Monthly are separate fields there. Pricing
  // Strategy is a planning tool only, never used to price a live order.
  const getPricingForSku = useCallback((sku, packType) => {
    return (packType === 'monthly' ? sku.monthlySellingPrice : sku.sellingPrice) || 0;
  }, []);

  // Repeat-customer context — pulled from orders already loaded app-wide,
  // no extra query needed. Counts this as their next order (previous + 1)
  // so it reads "3rd order" the moment she's placing their 3rd, not after.
  const repeatStats = useMemo(() => {
    if (!selectedCustomer) return null;
    const prev = (state.salesOrders || []).filter(o => String(o.customer_id) === String(selectedCustomer.id));
    if (prev.length === 0) return null;
    const totalSpent = prev.reduce((s, o) => s + (o.total_amount || 0), 0);
    return { orderNumber: prev.length + 1, totalSpent };
  }, [selectedCustomer, state.salesOrders]);

  const ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const runPhoneLookup = async (phone) => {
    const digits = (phone || '').replace(/\D/g, '');
    if (digits.length < 10) {
      setPhoneLookupStatus('idle');
      setSelectedCustomer(null);
      return;
    }
    setPhoneLookupStatus('searching');
    const found = await dbService.findCustomerByPhone(digits);
    if (found) {
      setSelectedCustomer(found);
      setPhoneLookupStatus('found');
      // Prefer whatever was just pasted/typed over the customer's stored
      // record — she may be pasting a fresh/updated address this time, and
      // the stored one could also just be stale from an earlier order.
      setFields(prev => ({
        ...prev,
        name: prev.name || found.name || '',
        address: prev.address || found.address || '',
        city: prev.city || found.city || '',
        state: prev.state || found.state || '',
        pincode: prev.pincode || found.pincode || '',
      }));
    } else {
      setSelectedCustomer(null);
      setPhoneLookupStatus('not_found');
    }
  };

  const handlePasteChange = (val) => {
    setPasteText(val);
    const parsed = parseOrderPaste(val);
    const existingPhone = fields.phone?.trim();
    const phoneDiffers = existingPhone && parsed.phone && parsed.phone !== existingPhone;

    setFields(prev => ({
      ...prev,
      ...parsed,
      // The Number box is the WhatsApp/identity number — if she's already
      // typed one, a pasted address never overwrites it. A different number
      // found in the pasted address goes into Courier Number instead (the
      // customer gave a different contact for delivery), not the main field.
      phone: prev.phone || parsed.phone,
      courierNumber: phoneDiffers ? parsed.phone : prev.courierNumber,
    }));

    const lookupPhone = existingPhone || parsed.phone;
    if (lookupPhone) runPhoneLookup(lookupPhone);
  };

  const phoneLookupTimer = useRef(null);
  const handleFieldChange = (key, val) => {
    setFields(prev => ({ ...prev, [key]: val }));
    if (key === 'phone') {
      // Wait for her to stop typing before hitting the DB — otherwise every
      // digit of a 10-digit number fires its own lookup call.
      clearTimeout(phoneLookupTimer.current);
      phoneLookupTimer.current = setTimeout(() => runPhoneLookup(val), 400);
    }
  };

  const addItem = (sku, packType) => {
    const key = `${sku.id}-${packType}`;
    setItems(prev => {
      const existing = prev.find(i => i.key === key);
      if (existing) {
        return prev.map(i => i.key === key
          ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unitPrice }
          : i);
      }
      const unitPrice = getPricingForSku(sku, packType);
      return [...prev, { key, skuId: String(sku.id), skuName: sku.name, packType, quantity: 1, unitPrice, total: unitPrice }];
    });
  };

  const adjustItem = (key, delta) => {
    setItems(prev => prev
      .map(i => i.key === key ? { ...i, quantity: i.quantity + delta, total: (i.quantity + delta) * i.unitPrice } : i)
      .filter(i => i.quantity > 0));
  };

  const setItemPrice = (key, price) => {
    const unitPrice = parseFloat(price) || 0;
    setItems(prev => prev.map(i => i.key === key ? { ...i, unitPrice, total: unitPrice * i.quantity } : i));
  };

  const removeItem = (key) => setItems(prev => prev.filter(i => i.key !== key));

  // Name and weight only ever apply to custom (not-in-catalog) items — a
  // real SKU's name should stay tied to the catalog, so those aren't
  // editable here.
  const setItemName = (key, name) => setItems(prev => prev.map(i => i.key === key ? { ...i, skuName: name } : i));
  const setItemWeight = (key, grams) => setItems(prev => prev.map(i => i.key === key ? { ...i, weightGrams: grams === '' ? null : parseFloat(grams) || null } : i));

  // For items that aren't in the SKU catalog at all — loose stock sold
  // occasionally (Almonds, Figs, etc.) that don't have a Recipe Pack or
  // their own SKU set up. No skuId, so it's excluded from inventory
  // deduction and Top Selling by-SKU stats, same as the existing free-text
  // items (Honey, Dates, Walnuts) already seen on real orders.
  const addCustomItem = () => {
    const name = customItemName.trim();
    const unitPrice = parseFloat(customItemPrice) || 0;
    const weightGrams = customItemWeight === '' ? null : parseFloat(customItemWeight) || null;
    if (!name) return;
    const key = `custom-${Date.now()}`;
    setItems(prev => [...prev, { key, skuId: null, skuName: name, packType: 'weekly', quantity: 1, unitPrice, total: unitPrice, weightGrams }]);
    setCustomItemName('');
    setCustomItemPrice('');
    setCustomItemWeight('');
    setCustomItemMode(false);
  };

  // Selling Price already includes GST — never add GST on top here. Each
  // item's price is split back into taxable value + GST (using that SKU's
  // own GST %, set in SKU Management) purely for the GST-filing breakup;
  // the customer-facing total is just what was typed in, plus shipping.
  const itemsTotal = items.reduce((s, i) => s + i.total, 0);
  const subtotal = items.reduce((s, i) => {
    const sku = skus.find(sk => String(sk.id) === String(i.skuId));
    const rate = sku?.gstRate ?? 5;
    return s + i.total / (1 + rate / 100);
  }, 0);
  const gstAmount = itemsTotal - subtotal;
  const gstRate = subtotal > 0 ? (gstAmount / subtotal) * 100 : 0;
  const totalAmount = itemsTotal + (parseFloat(shippingCharge) || 0);

  const resetForm = () => {
    setOrderDate(new Date().toISOString().split('T')[0]);
    setPasteText('');
    setFields(EMPTY_FIELDS);
    setPhoneLookupStatus('idle');
    setSelectedCustomer(null);
    setItems([]);
    setShippingCharge(0);
    setPaymentMethod('upi');
  };

  const phoneDigits = fields.phone.replace(/\D/g, '');
  const nameMissing = !fields.name.trim();
  const phoneInvalid = phoneDigits.length !== 10;
  const pincodeMissing = !fields.pincode.trim();
  const zeroPriceItems = items.filter(i => i.unitPrice <= 0);

  const canSave = fields.name.trim() && !phoneInvalid && items.length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) {
      if (!fields.name.trim()) showToast('Enter a name', 'error');
      else if (fields.phone.replace(/\D/g, '').length < 10) showToast('Enter a valid 10-digit phone number', 'error');
      else if (items.length === 0) showToast('Add at least one item', 'error');
      return;
    }
    setSaving(true);

    let customer = selectedCustomer;
    if (!customer) {
      const { data, error } = await dbService.findOrCreateCustomer({
        name: fields.name,
        phone: fields.phone,
        address: fields.address,
        city: fields.city,
        state: fields.state,
        pincode: fields.pincode,
      });
      if (error || !data) {
        showToast('Error saving customer', 'error');
        setSaving(false);
        return;
      }
      customer = data;
      dispatch({ type: 'REPLACE_CUSTOMER', payload: { tempId: data.id, customer: data } });
    }

    // COD: the cash isn't collected until delivery, so it starts unpaid —
    // unlike UPI/prepaid, which is treated as paid in full at order time.
    const isCod = paymentMethod === 'cod';
    const { data: order, error } = await dbService.createSalesOrder({
      customerId: customer.id,
      customerName: fields.name,
      orderDate,
      orderSource,
      items,
      subtotal,
      gstRate,
      gstAmount,
      shippingCharge: parseFloat(shippingCharge) || 0,
      totalAmount,
      paymentMethod,
      paymentStatus: isCod ? 'pending' : 'received',
      amountPaid: isCod ? 0 : totalAmount,
      balanceDue: isCod ? totalAmount : 0,
      status: 'confirmed',
      shippingAddress: fields.address,
      courierNumber: fields.courierNumber || null,
    });

    setSaving(false);

    if (error) {
      showToast('Error creating order', 'error');
      return;
    }

    dispatch({ type: 'ADD_SALES_ORDER', payload: order });
    // createSalesOrder's return doesn't carry phone (that's only joined in
    // getSalesOrders) — attach it here so the label preview has it.
    setJustSaved({ ...order, phone: fields.phone });
    showToast(`Order ${order.order_number} created for ${fields.name}`, 'success');
    resetForm();
  };

  // The invoice record has to exist for GST filing regardless of whether
  // she's actually printing it right now — create & link it quietly the
  // first time a label is printed for this order.
  const ensureInvoiceForJustSaved = async () => {
    if (!justSaved || justSaved.invoice_id) return;
    if (isPromotionalOrder(justSaved)) return; // promo/collab sends aren't a real sale — no invoice
    try {
      const invoiceData = buildInvoiceDataFromOrder(justSaved, 'Auto-generated on label print', skus);
      const { data: autoInvoice, error } = await dbService.createInvoice(invoiceData);
      if (error || !autoInvoice) return;
      await dbService.updateSalesOrder({ id: justSaved.id, invoice_id: autoInvoice.id });
      dispatch({ type: 'ADD_INVOICE', payload: autoInvoice });
      setJustSaved(prev => prev && prev.id === justSaved.id ? { ...prev, invoice_id: autoInvoice.id } : prev);
    } catch (invErr) {
      console.warn('Auto-invoice failed:', invErr);
    }
  };

  const handlePrintLabel = () => {
    setShowLabelPrinter(true);
    ensureInvoiceForJustSaved();
  };

  const handlePrintA4Sheet = () => {
    if (!justSaved) return;
    generateA4LabelSheet([justSaved]);
    ensureInvoiceForJustSaved();
    showToast('Label downloaded — 1 label on an A4 sheet (5 slots left blank)', 'success');
    dbService.updateSalesOrder({ id: justSaved.id, label_printed_at: new Date().toISOString() }).catch(() => {});
  };

  // Batch print — process a stack of orders back-to-back via paste + Save
  // (the form already clears itself after each save), then print everyone's
  // labels on one A4 sheet at the end instead of one at a time. Filters by
  // the Order Date field's current value (not the real calendar date) so
  // backdating an order (e.g. entering it a day late) still lets it be
  // batch-printed under that date instead of only "real today".
  const todaysOrders = useMemo(() => {
    return (state.salesOrders || []).filter(o => o.order_date === orderDate);
  }, [state.salesOrders, orderDate]);

  const handlePrintTodaysLabels = async () => {
    if (todaysOrders.length === 0) {
      showToast("No orders for the selected date yet", 'error');
      return;
    }
    generateA4LabelSheet(todaysOrders);
    showToast(`Printed ${todaysOrders.length} label(s) for ${orderDate}`, 'success');
    await Promise.all(todaysOrders.map(o => dbService.updateSalesOrder({ id: o.id, label_printed_at: new Date().toISOString() })));
    // Same as single-order printing — make sure every one of these has an
    // invoice record for GST filing, not just the ones already printed individually.
    for (const o of todaysOrders) {
      if (o.invoice_id || isPromotionalOrder(o)) continue; // promo/collab sends aren't a real sale — no invoice
      try {
        const invoiceData = buildInvoiceDataFromOrder(o, 'Auto-generated on label print', skus);
        const { data: autoInvoice, error } = await dbService.createInvoice(invoiceData);
        if (error || !autoInvoice) continue;
        await dbService.updateSalesOrder({ id: o.id, invoice_id: autoInvoice.id });
        dispatch({ type: 'ADD_INVOICE', payload: autoInvoice });
      } catch (invErr) {
        console.warn('Auto-invoice failed for', o.order_number, invErr);
      }
    }
  };

  // Only Recipe Pack SKUs (skuType 'weekly' — Day Pack, Nutrition Pack, Night
  // Soak) actually have separate Weekly/Monthly pricing. Single/repack/resale
  // SKUs (Dates, Seed Cycle, Mexican Bites, etc.) have just one price, so
  // showing a "+Monthly" button for them added a second, meaningless variant.
  const packOptionsFor = (sku) => sku.skuType === 'weekly' ? ['weekly', 'monthly'] : ['weekly'];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Minimal header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
        <Link to="/" className="flex items-center gap-1.5 text-sm text-gray-500">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>
        <h1 className="text-base font-bold text-gray-900">Quick Order</h1>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowTrackingScanner(true)}
            className="flex items-center gap-1 text-xs font-semibold text-fuchsia-700 bg-fuchsia-50 border border-fuchsia-200 rounded-md px-2 py-1.5 whitespace-nowrap"
            title="Scan or upload a courier slip's barcode to set its tracking number"
          >
            <ScanLine className="w-3.5 h-3.5" /> Add Tracking
          </button>
          <button
            onClick={handlePrintTodaysLabels}
            className="flex items-center gap-1 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-md px-2 py-1.5 whitespace-nowrap"
            title={`Print all orders dated ${orderDate} as A4 label sheets`}
          >
            <Printer className="w-3.5 h-3.5" /> {orderDate === new Date().toISOString().split('T')[0] ? 'Today' : orderDate} ({todaysOrders.length})
          </button>
        </div>
      </div>

      {showTrackingScanner && (
        <TrackingScanner
          orders={(state.salesOrders || []).filter(o => !o.tracking_number && !['dispatched', 'transit', 'delivered', 'cancelled', 'returned'].includes(o.status))}
          onClose={() => setShowTrackingScanner(false)}
          onUpdate={() => {}}
        />
      )}

      {justSaved && (
        <div className="bg-green-600 text-white px-4 py-2 text-sm font-medium flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4 flex-shrink-0" /> Order {justSaved.order_number} saved — ready for the next one
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={handlePrintLabel} className="flex items-center gap-1.5 px-3 py-1 bg-white text-green-700 rounded-md text-xs font-semibold hover:bg-green-50">
              <Printer className="w-3.5 h-3.5" /> Print Label
            </button>
            <button onClick={handlePrintA4Sheet} className="flex items-center gap-1.5 px-3 py-1 bg-white text-green-700 rounded-md text-xs font-semibold hover:bg-green-50">
              <Printer className="w-3.5 h-3.5" /> A4 Sheet
            </button>
            <button onClick={() => setJustSaved(null)} className="text-white/80 hover:text-white text-xs px-1.5">✕</button>
          </div>
        </div>
      )}

      {showLabelPrinter && justSaved && (
        <LabelPrinter order={justSaved} onClose={() => setShowLabelPrinter(false)} />
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
          {/* Left: paste + fields + items */}
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Order Date</label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Payment</label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('upi')}
                    className={`px-2.5 py-2 rounded-lg text-xs font-medium border ${
                      paymentMethod === 'upi' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-300 bg-white text-gray-600'
                    }`}
                  >
                    ✅ Prepaid
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cod')}
                    title="Cash collected at delivery — starts as unpaid"
                    className={`px-2.5 py-2 rounded-lg text-xs font-medium border ${
                      paymentMethod === 'cod' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-300 bg-white text-gray-600'
                    }`}
                  >
                    💵 COD
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Source</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { value: 'whatsapp', label: '💬 WhatsApp' },
                    { value: 'instagram', label: '📷 Instagram' },
                    { value: 'website', label: '🌐 Website' },
                    { value: 'walkin', label: '🚶 Walk-in' },
                    { value: 'meta_ad', label: '📢 Meta Ad' },
                    { value: 'zoho', label: '📦 Zoho' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setOrderSource(opt.value); setCustomSourceMode(false); }}
                      className={`px-2.5 py-2 rounded-lg text-xs font-medium border ${
                        orderSource === opt.value && !customSourceMode
                          ? 'border-teal-500 bg-teal-50 text-teal-700'
                          : 'border-gray-300 bg-white text-gray-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                  {customSourceMode ? (
                    <input
                      type="text"
                      autoFocus
                      value={customSourceInput}
                      onChange={(e) => { setCustomSourceInput(e.target.value); setOrderSource(e.target.value); }}
                      onBlur={() => { if (!customSourceInput.trim()) setCustomSourceMode(false); }}
                      placeholder="Type source"
                      className="px-2.5 py-2 rounded-lg text-xs font-medium border border-teal-500 bg-teal-50 text-teal-700 w-28"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCustomSourceMode(true)}
                      className={`px-2.5 py-2 rounded-lg text-xs font-medium border ${
                        customSourceMode
                          ? 'border-teal-500 bg-teal-50 text-teal-700'
                          : 'border-gray-300 bg-white text-gray-600'
                      }`}
                    >
                      + Other
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">
                Paste the customer's message
              </label>
              <textarea
                value={pasteText}
                onChange={(e) => handlePasteChange(e.target.value)}
                rows={5}
                placeholder="Paste name, address, phone — anything the customer sent"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <input
                  value={fields.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  placeholder="Name"
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${nameMissing ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                />
                {nameMissing && <p className="text-xs text-red-600 mt-0.5">Couldn't find a name — enter it manually</p>}
              </div>
              <div className="col-span-2 relative">
                <input
                  value={fields.phone}
                  onChange={(e) => handleFieldChange('phone', e.target.value)}
                  placeholder="Mobile number"
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${phoneInvalid ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                />
                {phoneLookupStatus === 'found' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-green-600">Existing customer</span>
                )}
                {phoneLookupStatus === 'not_found' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-amber-600">New customer</span>
                )}
                {phoneInvalid && <p className="text-xs text-red-600 mt-0.5">Not a valid 10-digit number</p>}
                {repeatStats && (
                  <p className="text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-md px-2 py-1 mt-1.5 inline-block">
                    🔁 Repeat customer — {ordinal(repeatStats.orderNumber)} order · ₹{repeatStats.totalSpent.toFixed(0)} lifetime
                  </p>
                )}
              </div>
              <div className="col-span-2">
                <input
                  value={fields.courierNumber}
                  onChange={(e) => handleFieldChange('courierNumber', e.target.value)}
                  placeholder="Courier number (only if different from above)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                {fields.courierNumber && (
                  <p className="text-xs text-amber-700 mt-0.5">📦 This number prints on the label instead of the mobile number above</p>
                )}
              </div>
              <textarea
                value={fields.address}
                onChange={(e) => handleFieldChange('address', e.target.value)}
                rows={2}
                placeholder="Address"
                className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <input
                value={fields.city}
                onChange={(e) => handleFieldChange('city', e.target.value)}
                placeholder="City"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <input
                value={fields.state}
                onChange={(e) => handleFieldChange('state', e.target.value)}
                placeholder="State"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <div className="col-span-2">
                <input
                  value={fields.pincode}
                  onChange={(e) => handleFieldChange('pincode', e.target.value)}
                  placeholder="Pincode"
                  className={`w-full px-3 py-2 border rounded-lg text-sm ${pincodeMissing ? 'border-amber-400 bg-amber-50' : 'border-gray-300'}`}
                />
                {pincodeMissing && (
                  <p className="text-xs text-amber-600 mt-0.5">
                    {fields.oldStylePostalCode
                      ? `"${fields.oldStylePostalCode}" is an old-style code, not a 6-digit PIN — ask the customer for their current pincode`
                      : 'No pincode found — add it for the shipping label'}
                  </p>
                )}
              </div>
            </div>

            {/* Quick-tap items */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Items — tap to add</label>
              {skus.length === 0 ? (
                <p className="text-sm text-gray-400">No SKUs set up yet.</p>
              ) : (
                <div className="space-y-2">
                  {skus.map(sku => (
                    <div key={sku.id} className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800 flex-1 truncate">{sku.name}</span>
                      {packOptionsFor(sku).map(pt => (
                        <button
                          key={pt}
                          onClick={() => addItem(sku, pt)}
                          className="px-3 py-1.5 bg-teal-600 text-white rounded-full text-xs font-medium hover:bg-teal-700 active:scale-95 transition"
                        >
                          {sku.skuType === 'weekly' ? `+ ${pt === 'weekly' ? 'Weekly' : 'Monthly'}` : '+ Add'}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Not-in-catalog items — loose stock (Almonds, Figs, etc.)
                  sold occasionally without a real SKU set up for it yet */}
              <div className="mt-2">
                {customItemMode ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={customItemName}
                      onChange={(e) => setCustomItemName(e.target.value)}
                      placeholder="Item name (e.g. Figs)"
                      className="flex-1 min-w-0 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm"
                    />
                    <div className="relative w-16 flex-shrink-0">
                      <input
                        type="number"
                        value={customItemWeight}
                        onChange={(e) => setCustomItemWeight(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addCustomItem()}
                        placeholder="Grams"
                        className="w-full pl-1.5 pr-4 py-1.5 border border-gray-300 rounded-lg text-sm"
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">g</span>
                    </div>
                    <div className="relative w-20 flex-shrink-0">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
                      <input
                        type="number"
                        value={customItemPrice}
                        onChange={(e) => setCustomItemPrice(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addCustomItem()}
                        placeholder="Price"
                        className="w-full pl-5 pr-1.5 py-1.5 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <button onClick={addCustomItem} className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 flex-shrink-0">Add</button>
                    <button onClick={() => { setCustomItemMode(false); setCustomItemName(''); setCustomItemPrice(''); setCustomItemWeight(''); }} className="px-2 py-1.5 text-gray-400 hover:text-gray-600 flex-shrink-0">✕</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setCustomItemMode(true)}
                    className="flex items-center gap-1 px-3 py-1.5 border border-dashed border-gray-300 text-gray-500 rounded-lg text-xs font-medium hover:border-teal-400 hover:text-teal-600"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Item — not in SKU list
                  </button>
                )}
              </div>
            </div>

            {/* Running item list */}
            {items.length > 0 && (
              <div className="space-y-1.5">
                {items.map(item => (
                  <div key={item.key} className={`rounded-lg px-3 py-2 ${item.unitPrice <= 0 ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {item.skuId ? (
                          <>
                            <p className="text-sm font-medium text-gray-900 truncate">{item.skuName}</p>
                            {skus.find(sk => String(sk.id) === String(item.skuId))?.skuType === 'weekly' && (
                              <p className="text-xs text-gray-500 capitalize">{item.packType}</p>
                            )}
                          </>
                        ) : (
                          <input
                            value={item.skuName}
                            onChange={(e) => setItemName(item.key, e.target.value)}
                            className="w-full px-1.5 py-0.5 -ml-1.5 text-sm font-medium text-gray-900 border border-transparent hover:border-gray-300 focus:border-teal-400 rounded bg-transparent focus:bg-white"
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => adjustItem(item.key, -1)} className="p-1 rounded bg-white border hover:bg-gray-100"><Minus className="w-3.5 h-3.5" /></button>
                        <span className="w-5 text-center text-sm font-semibold">{item.quantity}</span>
                        <button onClick={() => adjustItem(item.key, 1)} className="p-1 rounded bg-white border hover:bg-gray-100"><Plus className="w-3.5 h-3.5" /></button>
                        <div className="relative">
                          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
                          <input
                            type="number"
                            value={item.unitPrice || ''}
                            onChange={(e) => setItemPrice(item.key, e.target.value)}
                            className={`w-16 pl-4 pr-1 py-1 text-sm text-right border rounded ${item.unitPrice <= 0 ? 'border-amber-400' : 'border-gray-300'}`}
                          />
                        </div>
                        <span className="w-14 text-right text-sm font-semibold">₹{item.total.toFixed(0)}</span>
                        <button onClick={() => removeItem(item.key)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    {!item.skuId && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs text-gray-400">Weight:</span>
                        <div className="relative">
                          <input
                            type="number"
                            value={item.weightGrams || ''}
                            onChange={(e) => setItemWeight(item.key, e.target.value)}
                            placeholder="grams"
                            className="w-20 pl-1.5 pr-4 py-0.5 text-xs border border-gray-300 rounded"
                          />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">g</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm pt-1 px-1">
                  <span className="text-gray-500">Shipping</span>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
                    <input
                      type="number"
                      value={shippingCharge || ''}
                      onChange={(e) => setShippingCharge(e.target.value)}
                      className="w-20 pl-5 pr-2 py-1 text-sm text-right border border-gray-300 rounded"
                    />
                  </div>
                </div>
                <div className="flex justify-between text-sm pt-1 px-1 border-t border-gray-200">
                  <span className="text-gray-500">Total (GST incl. in price) + Shipping</span>
                  <span className="font-bold text-teal-700">₹{totalAmount.toFixed(2)}</span>
                </div>
                {paymentMethod === 'cod' && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 mt-1 text-center font-medium">
                    💵 Collect ₹{totalAmount.toFixed(2)} cash at delivery
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: label preview — sticky on desktop, stacks below on mobile.
              Shows exactly what will print on the shipping label, so problems
              show up as red text right where they'd show up on the label —
              nothing to actively "review" when everything's fine. */}
          <div className="lg:sticky lg:top-16 space-y-3">
            <div className="border-2 border-gray-900 rounded-lg overflow-hidden bg-white">
              <div className="bg-gray-900 text-white text-xs font-bold px-3 py-1.5 tracking-wide">SHIP TO</div>
              <div className="px-3 py-3 space-y-1">
                <p className={`text-sm font-bold ${nameMissing ? 'text-red-600' : 'text-gray-900'}`}>
                  {fields.name.trim() || '⚠ Name missing'}
                </p>
                {fields.address.trim()
                  ? fields.address.split('\n').map((line, i) => (
                      <p key={i} className="text-xs text-gray-700 leading-snug">{line}</p>
                    ))
                  : <p className="text-xs text-red-600">⚠ Address missing</p>}
                <p className="text-xs text-gray-700">
                  {[fields.city, fields.state].filter(Boolean).join(', ')}
                  {fields.city || fields.state ? ' - ' : ''}
                  <span className={pincodeMissing ? 'text-amber-600 font-medium' : ''}>
                    {fields.pincode.trim() || (fields.oldStylePostalCode ? `⚠ old-style code (${fields.oldStylePostalCode}), ask for real PIN` : '⚠ pincode missing')}
                  </span>
                </p>
                <p className={`text-xs pt-1 ${phoneInvalid ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                  Ph: {fields.phone.trim() || '⚠ missing'}
                </p>
              </div>
            </div>

            <p className="text-xs text-center text-gray-400">This is how the shipping label will look</p>

            {phoneLookupStatus !== 'idle' && (
              <p className={`text-xs text-center font-medium ${phoneLookupStatus === 'found' ? 'text-green-600' : phoneLookupStatus === 'not_found' ? 'text-amber-600' : 'text-gray-400'}`}>
                {phoneLookupStatus === 'searching' && 'Checking existing customers...'}
                {phoneLookupStatus === 'found' && 'Matches an existing customer'}
                {phoneLookupStatus === 'not_found' && 'New customer will be created'}
              </p>
            )}

            {zeroPriceItems.length > 0 && (
              <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-600" />
                <p className="text-xs text-amber-700">{zeroPriceItems.length} item(s) have no price set — check the Pricing page.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky bottom actions */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex gap-2">
        <button
          onClick={resetForm}
          className="px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Clear
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-teal-600 text-white rounded-lg font-semibold text-sm disabled:opacity-40"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Order'}
        </button>
      </div>
    </div>
  );
}
