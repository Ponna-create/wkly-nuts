import React, { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Minus, Plus, Trash2, Loader2, AlertTriangle, CheckCircle2, Circle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';
import { getGstRate } from '../utils/settings';
import { parseOrderPaste } from '../utils/orderPasteParser';

const EMPTY_FIELDS = { name: '', phone: '', address: '', city: '', state: '', pincode: '' };

export default function QuickOrder() {
  const { state, dispatch, showToast } = useApp();
  const skus = state.skus || [];
  const pricingStrategies = state.pricingStrategies || [];

  const [pasteText, setPasteText] = useState('');
  const [fields, setFields] = useState(EMPTY_FIELDS);
  const [phoneLookupStatus, setPhoneLookupStatus] = useState('idle'); // idle | searching | found | not_found
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [items, setItems] = useState([]); // { key, skuId, skuName, packType, quantity, unitPrice, total }
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(null); // order_number of the last saved order

  const getPricingForSku = useCallback((skuId, packType) =>
    pricingStrategies.find(p => String(p.skuId) === String(skuId) && p.packType === packType),
    [pricingStrategies]
  );

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
      setFields(prev => ({
        ...prev,
        name: found.name || prev.name,
        address: found.address || prev.address,
        city: found.city || prev.city,
        state: found.state || prev.state,
        pincode: found.pincode || prev.pincode,
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

  const handleFieldChange = (key, val) => {
    setFields(prev => ({ ...prev, [key]: val }));
    if (key === 'phone') runPhoneLookup(val);
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
      const pricing = getPricingForSku(sku.id, packType);
      const unitPrice = pricing?.sellingPrice || 0;
      return [...prev, { key, skuId: String(sku.id), skuName: sku.name, packType, quantity: 1, unitPrice, total: unitPrice }];
    });
  };

  const adjustItem = (key, delta) => {
    setItems(prev => prev
      .map(i => i.key === key ? { ...i, quantity: i.quantity + delta, total: (i.quantity + delta) * i.unitPrice } : i)
      .filter(i => i.quantity > 0));
  };

  const removeItem = (key) => setItems(prev => prev.filter(i => i.key !== key));

  const gstRate = getGstRate();
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const gstAmount = (subtotal * gstRate) / 100;
  const totalAmount = subtotal + gstAmount;

  const resetForm = () => {
    setPasteText('');
    setFields(EMPTY_FIELDS);
    setPhoneLookupStatus('idle');
    setSelectedCustomer(null);
    setItems([]);
  };

  // Honest field-by-field checklist instead of a made-up "accuracy score" —
  // we can only tell you whether something was FOUND, not whether it's correct.
  const checks = useMemo(() => {
    const phoneDigits = fields.phone.replace(/\D/g, '');
    return [
      { label: 'Name', ok: !!fields.name.trim(), detail: fields.name.trim() || 'Not found — check paste' },
      { label: 'Phone', ok: phoneDigits.length === 10, detail: phoneDigits.length === 10 ? fields.phone : 'Not a valid 10-digit number' },
      { label: 'Address', ok: !!fields.address.trim(), detail: fields.address.trim() ? 'Captured' : 'Not found' },
      { label: 'Pincode', ok: !!fields.pincode.trim(), detail: fields.pincode.trim() || 'Not found — may need a manual add' },
      { label: 'State', ok: !!fields.state.trim(), detail: fields.state.trim() || 'Not found' },
    ];
  }, [fields]);

  const zeroPriceItems = items.filter(i => i.unitPrice <= 0);
  const readyCount = checks.filter(c => c.ok).length;
  const allChecksOk = readyCount === checks.length;

  const canSave = fields.name.trim() && fields.phone.replace(/\D/g, '').length >= 10 && items.length > 0 && !saving;

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
      orderDate: new Date().toISOString().split('T')[0],
      orderSource: 'whatsapp',
      items,
      subtotal,
      gstRate,
      gstAmount,
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
    setJustSaved(order.order_number);
    showToast(`Order ${order.order_number} created for ${fields.name}`, 'success');
    resetForm();
    setTimeout(() => setJustSaved(null), 4000);
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
        <div className="bg-green-600 text-white px-4 py-2 text-sm font-medium flex items-center gap-2">
          <Check className="w-4 h-4" /> Order {justSaved} saved — ready for the next one
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
          {/* Left: paste + fields + items */}
          <div className="space-y-4">
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
              <input
                value={fields.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                placeholder="Name"
                className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <div className="col-span-2 relative">
                <input
                  value={fields.phone}
                  onChange={(e) => handleFieldChange('phone', e.target.value)}
                  placeholder="Mobile number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                {phoneLookupStatus === 'found' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-green-600">Existing customer</span>
                )}
                {phoneLookupStatus === 'not_found' && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-amber-600">New customer</span>
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
              <input
                value={fields.pincode}
                onChange={(e) => handleFieldChange('pincode', e.target.value)}
                placeholder="Pincode"
                className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
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
                      <p className="text-xs text-gray-500 capitalize">
                        {item.packType} · {item.unitPrice > 0 ? `₹${item.unitPrice}` : (
                          <span className="text-amber-600 font-medium">no price set</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => adjustItem(item.key, -1)} className="p-1 rounded bg-white border hover:bg-gray-100"><Minus className="w-3.5 h-3.5" /></button>
                      <span className="w-5 text-center text-sm font-semibold">{item.quantity}</span>
                      <button onClick={() => adjustItem(item.key, 1)} className="p-1 rounded bg-white border hover:bg-gray-100"><Plus className="w-3.5 h-3.5" /></button>
                      <span className="w-16 text-right text-sm font-semibold">₹{item.total.toFixed(0)}</span>
                      <button onClick={() => removeItem(item.key)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between text-sm pt-1 px-1">
                  <span className="text-gray-500">Subtotal + GST ({gstRate}%)</span>
                  <span className="font-bold text-teal-700">₹{totalAmount.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Right: review panel — sticky on desktop, stacks below on mobile */}
          <div className="lg:sticky lg:top-16 bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-500 uppercase">Review before saving</h2>
              <span className={`text-xs font-semibold ${allChecksOk ? 'text-green-600' : 'text-amber-600'}`}>
                {readyCount}/{checks.length} confirmed
              </span>
            </div>

            <div className="space-y-1.5">
              {checks.map(c => (
                <div key={c.label} className="flex items-start gap-2">
                  {c.ok
                    ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    : <Circle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-700">{c.label}</p>
                    <p className={`text-xs truncate ${c.ok ? 'text-gray-600' : 'text-amber-700'}`}>{c.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 pt-3">
              <p className="text-xs font-semibold text-gray-700 mb-1">Customer</p>
              <p className="text-xs text-gray-600">
                {phoneLookupStatus === 'found' && 'Matches an existing customer — order will attach to them.'}
                {phoneLookupStatus === 'not_found' && 'No match — a new customer record will be created.'}
                {(phoneLookupStatus === 'idle' || phoneLookupStatus === 'searching') && 'Waiting for a valid phone number...'}
              </p>
            </div>

            {items.length > 0 && (
              <div className="border-t border-gray-200 pt-3">
                <p className="text-xs font-semibold text-gray-700 mb-1">Items ({items.length})</p>
                {items.map(i => (
                  <p key={i.key} className="text-xs text-gray-600">{i.quantity}× {i.skuName} ({i.packType})</p>
                ))}
                {zeroPriceItems.length > 0 && (
                  <div className="flex items-start gap-1.5 mt-2 text-amber-700">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <p className="text-xs">{zeroPriceItems.length} item(s) have no price set — this order will save at less than it should. Check the Pricing page, or edit the amount after saving.</p>
                  </div>
                )}
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
