import React, { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Minus, Plus, Trash2, Loader2 } from 'lucide-react';
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

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-32">
        {/* Paste box */}
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

        {/* Parsed / editable fields */}
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
              <div key={item.key} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.skuName}</p>
                  <p className="text-xs text-gray-500 capitalize">{item.packType} · ₹{item.unitPrice}</p>
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
