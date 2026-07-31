import React, { useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Minus, Plus, Trash2, Loader2, AlertTriangle, Printer } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';
import { parseOrderPaste } from '../utils/orderPasteParser';
import { generateA4LabelSheet } from '../utils/a4LabelSheet';

const EMPTY_FIELDS = { name: '', phone: '', address: '', city: '', state: '', pincode: '' };

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

  // The SKU's own Selling Price (set in SKU Management) is the master price
  // for orders — Weekly and Monthly are separate fields there. Pricing
  // Strategy is a planning tool only, never used to price a live order.
  const getPricingForSku = useCallback((sku, packType) => {
    return (packType === 'monthly' ? sku.monthlySellingPrice : sku.sellingPrice) || 0;
  }, []);

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
    setFields(prev => ({ ...prev, ...parsed }));
    if (parsed.phone) runPhoneLookup(parsed.phone);
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
      paymentMethod: 'upi',
      paymentStatus: 'received',
      amountPaid: totalAmount,
      status: 'confirmed',
      shippingAddress: fields.address,
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

  const handlePrintJustSaved = () => {
    if (!justSaved) return;
    generateA4LabelSheet([justSaved]);
    showToast('Label downloaded — 1 label on an A4 sheet (5 slots left blank)', 'success');
  };

  const packOptions = ['weekly', 'monthly'];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Minimal header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
        <Link to="/" className="flex items-center gap-1.5 text-sm text-gray-500">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>
        <h1 className="text-base font-bold text-gray-900">Quick Order</h1>
        <div className="w-20" />
      </div>

      {justSaved && (
        <div className="bg-green-600 text-white px-4 py-2 text-sm font-medium flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4 flex-shrink-0" /> Order {justSaved.order_number} saved — ready for the next one
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={handlePrintJustSaved} className="flex items-center gap-1.5 px-3 py-1 bg-white text-green-700 rounded-md text-xs font-semibold hover:bg-green-50">
              <Printer className="w-3.5 h-3.5" /> Print Label
            </button>
            <button onClick={() => setJustSaved(null)} className="text-white/80 hover:text-white text-xs px-1.5">✕</button>
          </div>
        </div>
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
                {pincodeMissing && <p className="text-xs text-amber-600 mt-0.5">No pincode found — add it for the shipping label</p>}
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
                      {packOptions.map(pt => (
                        <button
                          key={pt}
                          onClick={() => addItem(sku, pt)}
                          className="px-3 py-1.5 bg-teal-600 text-white rounded-full text-xs font-medium hover:bg-teal-700 active:scale-95 transition"
                        >
                          + {pt === 'weekly' ? 'Weekly' : 'Monthly'}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Running item list */}
            {items.length > 0 && (
              <div className="space-y-1.5">
                {items.map(item => (
                  <div key={item.key} className={`flex items-center justify-between rounded-lg px-3 py-2 ${item.unitPrice <= 0 ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.skuName}</p>
                      <p className="text-xs text-gray-500 capitalize">{item.packType}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => adjustItem(item.key, -1)} className="p-1 rounded bg-white border hover:bg-gray-100"><Minus className="w-3.5 h-3.5" /></button>
                      <span className="w-5 text-center text-sm font-semibold">{item.quantity}</span>
                      <button onClick={() => adjustItem(item.key, 1)} className="p-1 rounded bg-white border hover:bg-gray-100"><Plus className="w-3.5 h-3.5" /></button>
                      <div className="relative">
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => setItemPrice(item.key, e.target.value)}
                          className={`w-16 pl-4 pr-1 py-1 text-sm text-right border rounded ${item.unitPrice <= 0 ? 'border-amber-400' : 'border-gray-300'}`}
                        />
                      </div>
                      <span className="w-14 text-right text-sm font-semibold">₹{item.total.toFixed(0)}</span>
                      <button onClick={() => removeItem(item.key)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm pt-1 px-1">
                  <span className="text-gray-500">Shipping</span>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
                    <input
                      type="number"
                      value={shippingCharge}
                      onChange={(e) => setShippingCharge(e.target.value)}
                      className="w-20 pl-5 pr-2 py-1 text-sm text-right border border-gray-300 rounded"
                    />
                  </div>
                </div>
                <div className="flex justify-between text-sm pt-1 px-1 border-t border-gray-200">
                  <span className="text-gray-500">Total (GST incl. in price) + Shipping</span>
                  <span className="font-bold text-teal-700">₹{totalAmount.toFixed(2)}</span>
                </div>
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
                    {fields.pincode.trim() || '⚠ pincode missing'}
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
