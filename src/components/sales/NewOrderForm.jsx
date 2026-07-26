import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, AlertTriangle, Phone, CheckCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/supabase';
import { getGstRate } from '../../utils/settings';

export default function NewOrderForm({ onClose }) {
  const { state, dispatch, showToast } = useApp();
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [newCustomerMode, setNewCustomerMode] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneLookupStatus, setPhoneLookupStatus] = useState('idle'); // idle | searching | found | not_found
  const [phoneMatch, setPhoneMatch] = useState(null);
  const [savingCustomer, setSavingCustomer] = useState(false);

  // SKUs and pricing from state
  const skus = state.skus || [];
  const pricingStrategies = state.pricingStrategies || [];

  const [formData, setFormData] = useState({
    customerName: '',
    orderDate: new Date().toISOString().split('T')[0],
    orderSource: 'whatsapp',
    items: [],
    subtotal: 0,
    gstRate: getGstRate(),
    gstAmount: 0,
    discountPercent: 0,
    discountAmount: 0,
    shippingCharge: 0,
    totalAmount: 0,
    paymentMethod: 'upi',
    paymentStatus: 'received',
    amountPaid: 0,
    transactionId: '',
    status: 'confirmed',
    shippingAddress: '',
  });

  const [newItem, setNewItem] = useState({
    skuId: '',
    skuName: '',
    packType: 'weekly',
    quantity: 1,
    unitPrice: 0,
    total: 0,
  });

  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
  });

  // Price lookup helper
  const getPricingForSku = (skuId, packType) => {
    return pricingStrategies.find(
      (p) => String(p.skuId) === String(skuId) && p.packType === packType
    );
  };

  // Calculate totals
  useEffect(() => {
    const subtotal = formData.items.reduce((sum, item) => sum + (item.total || 0), 0);
    const gstAmount = (subtotal * formData.gstRate) / 100;
    const discountAmount = formData.discountPercent > 0
      ? (subtotal * formData.discountPercent) / 100
      : formData.discountAmount;
    const totalAmount = subtotal + gstAmount - discountAmount + (formData.shippingCharge || 0);

    setFormData(prev => ({
      ...prev,
      subtotal,
      gstAmount,
      discountAmount,
      totalAmount,
      amountPaid: formData.paymentStatus === 'received' ? totalAmount : formData.amountPaid,
    }));
  }, [formData.items, formData.gstRate, formData.discountPercent, formData.discountAmount, formData.shippingCharge, formData.paymentStatus]);

  // Phone-first customer lookup — type the mobile number, we find (or offer to create) the customer
  const handlePhoneInputChange = async (val) => {
    setPhoneInput(val);
    setSelectedCustomer(null);
    setFormData(prev => ({ ...prev, customerName: '', customerId: undefined, shippingAddress: '' }));

    const digits = val.replace(/[^0-9]/g, '');
    if (digits.length < 10) {
      setPhoneLookupStatus('idle');
      return;
    }

    setPhoneLookupStatus('searching');
    const found = await dbService.findCustomerByPhone(digits);
    if (found) {
      setSelectedCustomer(found);
      setFormData(prev => ({
        ...prev,
        customerName: found.name,
        customerId: found.id,
        shippingAddress: found.address || '',
      }));
      setPhoneLookupStatus('found');
    } else {
      setPhoneLookupStatus('not_found');
    }
  };

  const handleChangeCustomer = () => {
    setPhoneInput('');
    setSelectedCustomer(null);
    setPhoneLookupStatus('idle');
    setFormData(prev => ({ ...prev, customerName: '', customerId: undefined, shippingAddress: '' }));
  };

  const handleOpenCreateCustomer = () => {
    setNewCustomer(prev => ({ ...prev, phone: phoneInput }));
    setNewCustomerMode(true);
  };

  const handleSkuChange = (skuId) => {
    const sku = skus.find(s => String(s.id) === String(skuId));
    if (sku) {
      const pricing = getPricingForSku(sku.id, newItem.packType);
      setNewItem(prev => ({
        ...prev,
        skuId: String(sku.id),
        skuName: sku.name,
        unitPrice: pricing?.sellingPrice || prev.unitPrice,
      }));
    } else {
      setNewItem(prev => ({ ...prev, skuId: '', skuName: '' }));
    }
  };

  const handlePackTypeChange = (packType) => {
    const pricing = getPricingForSku(newItem.skuId, packType);
    setNewItem(prev => ({
      ...prev,
      packType,
      unitPrice: pricing?.sellingPrice || prev.unitPrice,
    }));
  };

  const handleAddItem = () => {
    if (!newItem.skuId || !newItem.quantity) {
      showToast('Please select a product and quantity', 'error');
      return;
    }

    const itemTotal = newItem.quantity * newItem.unitPrice;
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          ...newItem,
          total: itemTotal,
        }
      ]
    }));

    setNewItem({
      skuId: '',
      skuName: '',
      packType: 'weekly',
      quantity: 1,
      unitPrice: 0,
      total: 0,
    });
  };

  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleCreateCustomer = async () => {
    if (savingCustomer) return; // block double-clicks — two rapid saves create duplicate customers
    if (!newCustomer.name || !newCustomer.phone) {
      showToast('Name and phone are required', 'error');
      return;
    }

    setSavingCustomer(true);
    const { data, error, isExisting } = await dbService.findOrCreateCustomer(newCustomer);
    setSavingCustomer(false);

    if (error) {
      showToast('Error creating customer', 'error');
      return;
    }

    if (isExisting) {
      showToast(`Found existing customer: ${data.name}`, 'info');
    } else {
      // Customer is already saved in DB by findOrCreateCustomer —
      // REPLACE_CUSTOMER only updates local state (no second DB insert)
      dispatch({ type: 'REPLACE_CUSTOMER', payload: { tempId: data.id, customer: data } });
    }

    setSelectedCustomer(data);
    setPhoneInput(data.phone || newCustomer.phone);
    setPhoneLookupStatus('found');
    setFormData(prev => ({
      ...prev,
      customerName: data.name,
      customerId: data.id,
      shippingAddress: data.address || [newCustomer.address, newCustomer.city, newCustomer.state, newCustomer.pincode].filter(Boolean).join(', ')
    }));

    setNewCustomer({ name: '', email: '', phone: '', address: '', city: '', state: '', pincode: '' });
    setNewCustomerMode(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.customerName) {
      showToast('Please find or create a customer first', 'error');
      return;
    }

    if (formData.items.length === 0) {
      showToast('Please add at least one item', 'error');
      return;
    }

    setLoading(true);

    const { data, error } = await dbService.createSalesOrder({
      ...formData,
      customerId: selectedCustomer?.id,
    });

    if (error) {
      showToast('Error creating order', 'error');
      console.error(error);
    } else {
      showToast('Order created successfully!', 'success');
      dispatch({
        type: 'ADD_SALES_ORDER',
        payload: data
      });
      onClose();
    }

    setLoading(false);
  };

  const noPricingWarning = newItem.skuId && !getPricingForSku(newItem.skuId, newItem.packType);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Create New Order</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Order Date - first */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Order Date</label>
            <input
              type="date"
              value={formData.orderDate}
              onChange={(e) => setFormData(prev => ({ ...prev, orderDate: e.target.value }))}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Mobile Number - second, drives customer lookup */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-900">Mobile Number *</label>
            {phoneLookupStatus === 'found' && selectedCustomer ? (
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-900">{selectedCustomer.name}</p>
                    <p className="text-xs text-green-700">{selectedCustomer.phone}{selectedCustomer.address ? ` — ${selectedCustomer.address}` : ''}</p>
                  </div>
                </div>
                <button type="button" onClick={handleChangeCustomer} className="text-xs text-green-700 hover:text-green-900 font-medium underline flex-shrink-0">
                  Not them? Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  placeholder="Enter customer's mobile number"
                  value={phoneInput}
                  onChange={(e) => handlePhoneInputChange(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                />
              </div>
            )}

            {phoneLookupStatus === 'searching' && (
              <p className="text-xs text-gray-500">Looking up customer...</p>
            )}

            {phoneLookupStatus === 'not_found' && !newCustomerMode && (
              <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <span className="text-sm text-amber-800">No customer found for this number.</span>
                <button
                  type="button"
                  onClick={handleOpenCreateCustomer}
                  className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 flex-shrink-0"
                >
                  + Create New Customer
                </button>
              </div>
            )}

            {/* New Customer Panel */}
            {newCustomerMode && (
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm font-semibold text-gray-900">New Customer</p>
                <input
                  type="text"
                  placeholder="Customer Name *"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  autoFocus
                />
                <input
                  type="tel"
                  placeholder="Phone *"
                  value={newCustomer.phone}
                  onChange={async (e) => {
                    const val = e.target.value;
                    setNewCustomer(prev => ({ ...prev, phone: val }));
                    setPhoneMatch(null);
                    const digits = val.replace(/[^0-9]/g, '');
                    if (digits.length >= 10) {
                      const found = await dbService.findCustomerByPhone(digits);
                      if (found) setPhoneMatch(found);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                {phoneMatch && (
                  <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <span className="text-sm text-amber-800">
                      Customer exists: <strong>{phoneMatch.name}</strong> ({phoneMatch.phone})
                    </span>
                    <button type="button" onClick={() => {
                      setSelectedCustomer(phoneMatch);
                      setPhoneInput(phoneMatch.phone);
                      setPhoneLookupStatus('found');
                      setFormData(prev => ({ ...prev, customerName: phoneMatch.name, customerId: phoneMatch.id, shippingAddress: phoneMatch.address || '' }));
                      setNewCustomerMode(false);
                      setPhoneMatch(null);
                    }} className="px-2 py-1 bg-amber-600 text-white rounded text-xs font-medium hover:bg-amber-700">
                      Use this
                    </button>
                  </div>
                )}
                <input
                  type="email"
                  placeholder="Email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <textarea
                  placeholder="Paste full address — city, state, pincode will auto-fill"
                  value={newCustomer.address}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewCustomer(prev => ({ ...prev, address: val }));

                    // Auto-extract pincode
                    const pinMatch = val.match(/\b(\d{6})\b/);
                    if (pinMatch) {
                      setNewCustomer(prev => ({ ...prev, address: val, pincode: pinMatch[1] }));
                    }

                    // Auto-extract state
                    const states = ['Tamil Nadu','Kerala','Karnataka','Andhra Pradesh','Telangana','Maharashtra','Gujarat','Rajasthan','Delhi','Uttar Pradesh','Madhya Pradesh','West Bengal','Bihar','Odisha','Punjab','Haryana','Jharkhand','Chhattisgarh','Assam','Goa','Himachal Pradesh','Uttarakhand','Jammu and Kashmir','Puducherry','Chandigarh','Meghalaya','Manipur','Mizoram','Tripura','Nagaland','Arunachal Pradesh','Sikkim'];
                    const foundState = states.find(s => val.toLowerCase().includes(s.toLowerCase()));
                    if (foundState) {
                      setNewCustomer(prev => ({ ...prev, address: val, state: foundState, ...(pinMatch ? { pincode: pinMatch[1] } : {}) }));
                    }

                    // Auto-extract city — common Indian cities
                    const cities = ['Chennai','Mumbai','Bangalore','Bengaluru','Hyderabad','Delhi','Kolkata','Pune','Ahmedabad','Jaipur','Coimbatore','Madurai','Tiruchirappalli','Salem','Erode','Tirunelveli','Vellore','Nellore','Vijayawada','Visakhapatnam','Kochi','Thiruvananthapuram','Thrissur','Kozhikode','Puducherry','Pondicherry','Cuddalore','Tiruvallur','Kancheepuram','Thanjavur','Dindigul','Theni','Tirupur','Ariyalur','Gudur','Chromepet','Ambattur','Perambur','Kodambakkam','Thiruvannamalai','Gummidipoondi','Thiruthuraipoondi'];
                    const foundCity = cities.find(c => val.toLowerCase().includes(c.toLowerCase()));
                    if (foundCity) {
                      setNewCustomer(prev => ({
                        ...prev, address: val, city: foundCity,
                        ...(foundState ? { state: foundState } : {}),
                        ...(pinMatch ? { pincode: pinMatch[1] } : {}),
                      }));
                    }
                  }}
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="City"
                    value={newCustomer.city}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, city: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="State"
                    value={newCustomer.state}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, state: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Pincode"
                    value={newCustomer.pincode}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, pincode: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCreateCustomer}
                    disabled={savingCustomer}
                    className="flex-1 px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50"
                  >
                    {savingCustomer ? 'Saving...' : 'Create Customer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNewCustomerMode(false); setPhoneMatch(null); }}
                    className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Rest of the order form only appears once a customer is set */}
          {selectedCustomer && (
            <>
              {/* Order Source & Payment */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Order Source</label>
                  <select
                    value={formData.orderSource}
                    onChange={(e) => setFormData(prev => ({ ...prev, orderSource: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="website">Website</option>
                    <option value="instagram">Instagram</option>
                    <option value="meta_ad">Meta Ad</option>
                    <option value="walkin">Walk-in</option>
                    <option value="zoho">Zoho Commerce</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Payment Method</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  >
                    <option value="upi">UPI</option>
                    <option value="cod">COD</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="gpay">Google Pay</option>
                    <option value="phonepe">PhonePe</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Payment Status</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, paymentStatus: 'received' }))}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium border-2 transition ${
                      formData.paymentStatus === 'received'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Payment Received
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, paymentStatus: 'pending' }))}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium border-2 transition ${
                      formData.paymentStatus === 'pending'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Payment Pending
                  </button>
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-900">Items *</label>

                {/* Add Item Form */}
                <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {/* SKU Dropdown (was free text) */}
                    <select
                      value={newItem.skuId}
                      onChange={(e) => handleSkuChange(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">-- Select Product --</option>
                      {skus.map(sku => (
                        <option key={sku.id} value={String(sku.id)}>{sku.name}</option>
                      ))}
                    </select>
                    {/* Pack Type */}
                    <select
                      value={newItem.packType}
                      onChange={(e) => handlePackTypeChange(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="weekly">Weekly Pack</option>
                      <option value="monthly">Monthly Pack</option>
                    </select>
                  </div>

                  {/* No pricing warning */}
                  {noPricingWarning && (
                    <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span className="text-xs text-amber-700">No pricing set for this product/pack. Set it in <strong>Pricing</strong> page. You can still enter price manually below.</span>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    <input
                      type="number"
                      placeholder="Qty"
                      min="1"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                      <input
                        type="number"
                        placeholder="Price"
                        min="0"
                        step="0.01"
                        value={newItem.unitPrice}
                        onChange={(e) => setNewItem(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                        className={`w-full px-3 pl-6 py-2 border rounded-lg text-sm ${
                          newItem.unitPrice > 0 ? 'border-green-400 bg-green-50' : 'border-gray-300'
                        }`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium flex items-center justify-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>
                </div>

                {/* Items List */}
                {formData.items.length > 0 && (
                  <div className="space-y-2">
                    {formData.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{item.skuName} ({item.packType})</p>
                          <p className="text-sm text-gray-600">{item.quantity} x ₹{item.unitPrice} = ₹{item.total}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary Section */}
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">₹{formData.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">GST ({formData.gstRate}%):</span>
                  <span className="font-medium">₹{formData.gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Discount %"
                    min="0"
                    max="100"
                    value={formData.discountPercent}
                    onChange={(e) => setFormData(prev => ({ ...prev, discountPercent: parseFloat(e.target.value) || 0, discountAmount: 0 }))}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <span className="text-gray-600">- ₹{formData.discountAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Shipping:</span>
                  <input
                    type="number"
                    min="0"
                    value={formData.shippingCharge}
                    onChange={(e) => setFormData(prev => ({ ...prev, shippingCharge: parseFloat(e.target.value) || 0 }))}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                  />
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between font-bold">
                  <span>Total:</span>
                  <span className="text-teal-600">₹{formData.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Transaction ID (for UPI) */}
              {formData.paymentMethod === 'upi' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Transaction ID</label>
                  <input
                    type="text"
                    placeholder="UPI Transaction ID"
                    value={formData.transactionId}
                    onChange={(e) => setFormData(prev => ({ ...prev, transactionId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              )}
            </>
          )}

          {/* Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedCustomer}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
