import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/supabase';
import { getGstRate } from '../../utils/settings';

export default function NewOrderForm({ onClose }) {
  const { state, dispatch, showToast } = useApp();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [newCustomerMode, setNewCustomerMode] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);

  // SKUs and pricing from state
  const skus = state.skus || [];
  const pricingStrategies = state.pricingStrategies || [];

  const [formData, setFormData] = useState({
    customerName: '',
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
    status: 'packing',
    shippingAddress: '',
    followUpDate: '',
    followUpNotes: '',
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

  // Load customers
  useEffect(() => {
    setCustomers(state.customers || []);
  }, [state.customers]);

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
  }, [formData.items, formData.gstRate, formData.discountPercent, formData.discountAmount, formData.shippingCharge]);

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
    if (!newCustomer.name || !newCustomer.phone) {
      showToast('Name and phone are required', 'error');
      return;
    }

    const { data, error } = await dbService.createCustomer({
      id: `temp-${Date.now()}`,
      ...newCustomer
    });

    if (error) {
      showToast('Error creating customer', 'error');
      return;
    }

    dispatch({
      type: 'ADD_CUSTOMER',
      payload: data
    });

    setFormData(prev => ({
      ...prev,
      customerName: newCustomer.name,
      shippingAddress: `${newCustomer.address}, ${newCustomer.city}, ${newCustomer.state} ${newCustomer.pincode}`
    }));

    setNewCustomer({ name: '', email: '', phone: '', address: '', city: '', state: '', pincode: '' });
    setShowCustomerForm(false);
    setNewCustomerMode(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.customerName) {
      showToast('Please select or add a customer', 'error');
      return;
    }

    // Items required only for confirmed orders, not follow-ups
    if (formData.status !== 'follow_up' && formData.items.length === 0) {
      showToast('Please add at least one item', 'error');
      return;
    }

    setLoading(true);

    const { data, error } = await dbService.createSalesOrder({
      ...formData,
      customerId: selectedCustomer?.id,
      followUpDate: formData.followUpDate || null,
      followUpNotes: formData.followUpNotes || null,
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
          {/* Customer Section */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-900">Customer *</label>
            {!newCustomerMode ? (
              <div className="space-y-2">
                <select
                  value={selectedCustomer?.id || ''}
                  onChange={(e) => {
                    const customer = customers.find(c => c.id === e.target.value);
                    setSelectedCustomer(customer);
                    if (customer) {
                      setFormData(prev => ({
                        ...prev,
                        customerName: customer.name,
                        shippingAddress: customer.address || ''
                      }));
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">-- Select Customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setNewCustomerMode(true)}
                  className="text-teal-600 hover:text-teal-700 text-sm font-medium"
                >
                  + Add New Customer
                </button>
              </div>
            ) : (
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <input
                  type="text"
                  placeholder="Customer Name *"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="tel"
                  placeholder="Phone *"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <textarea
                  placeholder="Address"
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, address: e.target.value }))}
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
                    className="flex-1 px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
                  >
                    Create Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCustomerMode(false)}
                    className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Order Type / Status */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Order Type</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, status: 'follow_up', paymentStatus: 'pending' }))}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border-2 transition ${
                  formData.status === 'follow_up'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Follow-up (Lead)
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, status: 'packing', paymentStatus: 'received' }))}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border-2 transition ${
                  formData.status === 'packing'
                    ? 'border-teal-500 bg-teal-50 text-teal-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Confirmed Order
              </button>
            </div>
          </div>

          {/* Follow-up Fields */}
          {formData.status === 'follow_up' && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1">Follow-up Date</label>
                <input
                  type="date"
                  value={formData.followUpDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, followUpDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-blue-900 mb-1">Notes</label>
                <textarea
                  placeholder="What did the customer enquire about? Any preferences?"
                  value={formData.followUpNotes}
                  onChange={(e) => setFormData(prev => ({ ...prev, followUpNotes: e.target.value }))}
                  rows="2"
                  className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

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
              disabled={loading}
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
