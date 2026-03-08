import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Printer, MessageCircle, Package, Truck, CheckCircle, FileText, Loader2, Save, Edit2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/supabase';
import LabelPrinter from './LabelPrinter';
import WhatsAppSender from './WhatsAppSender';

export default function OrderDetailView({ order, onClose, onUpdate }) {
  const { state, dispatch, showToast } = useApp();
  const [loading, setLoading] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [showLabelPrinter, setShowLabelPrinter] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(order);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [showInvoiceView, setShowInvoiceView] = useState(false);
  const [editingTracking, setEditingTracking] = useState(false);
  const [trackingInput, setTrackingInput] = useState(order.tracking_number || '');
  const [courierInput, setCourierInput] = useState(order.courier_name || 'ST Courier');
  const [savingTracking, setSavingTracking] = useState(false);

  // Sync with parent order prop when it changes (e.g., after BulkTrackingEntry updates)
  useEffect(() => {
    setCurrentOrder(order);
    setTrackingInput(order.tracking_number || '');
    setCourierInput(order.courier_name || 'ST Courier');
  }, [order, order.tracking_number, order.courier_name, order.status, order.invoice_id]);

  // Find linked invoice - check by ID with both formats
  const linkedInvoice = currentOrder.invoice_id
    ? (state.invoices || []).find(inv =>
        inv.id === currentOrder.invoice_id ||
        String(inv.id) === String(currentOrder.invoice_id)
      )
    : null;

  const getStatusBadge = (status) => {
    const badges = {
      follow_up: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Follow-up' },
      awaiting_payment: { bg: 'bg-red-100', text: 'text-red-800', label: 'Awaiting Payment' },
      packing: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Packing' },
      packed: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Packed' },
      dispatched: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Dispatched' },
      in_transit: { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'In Transit' },
      delivered: { bg: 'bg-green-100', text: 'text-green-800', label: 'Delivered' },
      completed: { bg: 'bg-teal-100', text: 'text-teal-800', label: 'Completed' },
      cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Cancelled' },
    };
    return badges[status] || badges.packing;
  };

  const handleCopyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleStatusChange = async (newStatus) => {
    setLoading(true);
    const updateData = {
      ...currentOrder,
      status: newStatus,
    };

    if (newStatus === 'dispatched' && !currentOrder.dispatch_date) {
      updateData.dispatch_date = new Date().toISOString().split('T')[0];
    }
    if (newStatus === 'delivered' && !currentOrder.actual_delivery_date) {
      updateData.actual_delivery_date = new Date().toISOString().split('T')[0];
    }

    const { error } = await dbService.updateSalesOrder(updateData);

    if (error) {
      showToast('Error updating status', 'error');
    } else {
      // Deduct finished goods from inventory on dispatch
      if (newStatus === 'dispatched') {
        const invResult = await dbService.deductInventoryForOrder(currentOrder);
        if (invResult.deducted > 0) {
          showToast(`${invResult.deducted} item(s) deducted from inventory`, 'success');
        }
        if (invResult.warnings.length > 0) {
          showToast(`Stock warning: ${invResult.warnings[0]}`, 'error');
        }
      }
      showToast(`Status updated to ${getStatusBadge(newStatus).label}`, 'success');
      setCurrentOrder(prev => ({ ...prev, status: newStatus }));
      onUpdate();
    }
    setLoading(false);
  };

  const handlePrintAndPack = async () => {
    setShowLabelPrinter(true);
    if (currentOrder.status === 'packing') {
      await handleStatusChange('packed');
    }
  };

  const handleSaveTracking = async () => {
    if (!trackingInput.trim()) {
      showToast('Please enter a tracking number', 'error');
      return;
    }
    setSavingTracking(true);
    const updatedOrder = {
      ...currentOrder,
      tracking_number: trackingInput.trim(),
      courier_name: courierInput.trim() || 'ST Courier',
    };
    const { error } = await dbService.updateSalesOrder(updatedOrder);
    if (error) {
      showToast('Error saving tracking number', 'error');
    } else {
      setCurrentOrder(updatedOrder);
      dispatch({ type: 'UPDATE_SALES_ORDER', payload: updatedOrder });
      showToast('Tracking number saved!', 'success');
      setEditingTracking(false);
      onUpdate();
    }
    setSavingTracking(false);
  };

  // Generate Invoice from Order
  const handleGenerateInvoice = async () => {
    // If invoice already linked, try to show it
    if (currentOrder.invoice_id) {
      if (linkedInvoice) {
        setShowInvoiceView(true);
        return;
      }
      // Invoice ID exists but not found in state - try fetching from DB
      try {
        const { data: freshInvoices } = await dbService.getInvoices();
        if (freshInvoices) {
          dispatch({ type: 'LOAD_INVOICES', payload: freshInvoices });
          const found = freshInvoices.find(inv => String(inv.id) === String(currentOrder.invoice_id));
          if (found) {
            setShowInvoiceView(true);
            return;
          }
        }
      } catch (e) {
        console.warn('Could not fetch invoices:', e);
      }
    }

    setGeneratingInvoice(true);
    try {
      const invoiceData = {
        id: `inv-${Date.now()}`,
        customerId: currentOrder.customer_id,
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: null,
        items: (currentOrder.items || []).map(item => ({
          skuId: item.sku_id || item.skuId,
          skuName: item.sku_name || item.skuName,
          packType: item.pack_type || item.packType,
          quantity: item.quantity,
          unitPrice: item.unit_price || item.unitPrice,
          total: item.total,
        })),
        gstRate: currentOrder.gst_rate || 5,
        subtotal: currentOrder.subtotal || 0,
        gstAmount: currentOrder.gst_amount || 0,
        discountPercent: currentOrder.discount_percent || 0,
        discountAmount: currentOrder.discount_amount || 0,
        shippingCharge: currentOrder.shipping_charge || 0,
        totalAmount: currentOrder.total_amount || 0,
        balanceDue: (currentOrder.total_amount || 0) - (currentOrder.amount_paid || 0),
        advancePaid: currentOrder.amount_paid || 0,
        status: currentOrder.payment_status === 'received' ? 'paid' : 'sent',
        paymentMethod: currentOrder.payment_method,
        notes: `Auto-generated from order ${currentOrder.order_number}`,
        terms: 'Payment due within 15 days',
      };

      // Create invoice
      const { data: createdInvoice, error: invoiceError } = await dbService.createInvoice(invoiceData);
      if (invoiceError) throw invoiceError;

      // Link invoice to order
      const updatedOrder = { ...currentOrder, invoice_id: createdInvoice?.id || invoiceData.id };
      await dbService.updateSalesOrder(updatedOrder);

      // Update local state
      if (createdInvoice) {
        dispatch({ type: 'ADD_INVOICE', payload: createdInvoice });
      }
      setCurrentOrder(updatedOrder);
      dispatch({ type: 'UPDATE_SALES_ORDER', payload: updatedOrder });

      showToast('Invoice generated and linked!', 'success');
      setShowInvoiceView(true);
      onUpdate();
    } catch (error) {
      console.error('Invoice generation error:', error);
      showToast('Error generating invoice', 'error');
    }
    setGeneratingInvoice(false);
  };

  const badge = getStatusBadge(currentOrder.status);

  const statusSteps = [
    { key: 'follow_up', label: 'Follow-up', icon: MessageCircle },
    { key: 'packing', label: 'Packing', icon: Package },
    { key: 'packed', label: 'Packed', icon: Package },
    { key: 'dispatched', label: 'Dispatched', icon: Truck },
    { key: 'in_transit', label: 'In Transit', icon: Truck },
    { key: 'delivered', label: 'Delivered', icon: CheckCircle },
  ];

  const currentStepIndex = statusSteps.findIndex(s => s.key === currentOrder.status);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{currentOrder.order_number}</h2>
            <p className="text-sm text-gray-600 mt-1">{currentOrder.order_date}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status Timeline */}
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {statusSteps.map((step, idx) => {
              const isActive = idx <= currentStepIndex;
              const isCurrent = step.key === currentOrder.status;
              const Icon = step.icon;
              return (
                <React.Fragment key={step.key}>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                    isCurrent ? 'bg-teal-600 text-white' :
                    isActive ? 'bg-teal-100 text-teal-800' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    <Icon className="w-3 h-3" />
                    {step.label}
                  </div>
                  {idx < statusSteps.length - 1 && (
                    <div className={`w-4 h-0.5 flex-shrink-0 ${isActive ? 'bg-teal-400' : 'bg-gray-200'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Status + Change */}
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}>
              {badge.label}
            </span>
            <select
              value={currentOrder.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={loading}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50"
            >
              <option value="follow_up">Follow-up</option>
              <option value="awaiting_payment">Awaiting Payment</option>
              <option value="packing">Packing</option>
              <option value="packed">Packed</option>
              <option value="dispatched">Dispatched</option>
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Customer */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Customer</p>
              <p className="text-lg font-bold text-gray-900">{currentOrder.customer_name}</p>
              {currentOrder.phone && <p className="text-sm text-gray-600">{currentOrder.phone}</p>}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Source</p>
              <p className="text-lg font-bold text-gray-900 capitalize">{currentOrder.order_source}</p>
            </div>
          </div>

          {currentOrder.shipping_address && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Shipping Address</p>
              <p className="text-sm text-gray-700 mt-1">{currentOrder.shipping_address}</p>
            </div>
          )}

          {/* Items */}
          <div className="space-y-3">
            <h3 className="font-bold text-gray-900">Items</h3>
            {currentOrder.items && currentOrder.items.length > 0 ? (
              <div className="space-y-2">
                {currentOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{item.sku_name || item.skuName}</p>
                      <p className="text-sm text-gray-600 capitalize">{item.pack_type || item.packType} Pack</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">x{item.quantity}</p>
                      <p className="text-sm text-gray-600">₹{item.total || (item.quantity * (item.unit_price || item.unitPrice || 0))}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No items</p>
            )}
          </div>

          {/* Financials */}
          <div className="p-4 bg-gray-50 rounded-lg space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">₹{currentOrder.subtotal?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">GST ({currentOrder.gst_rate || 5}%):</span>
              <span className="font-medium">₹{currentOrder.gst_amount?.toFixed(2) || '0.00'}</span>
            </div>
            {currentOrder.discount_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Discount:</span>
                <span className="font-medium text-red-600">-₹{currentOrder.discount_amount?.toFixed(2)}</span>
              </div>
            )}
            {currentOrder.shipping_charge > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Shipping:</span>
                <span className="font-medium">₹{currentOrder.shipping_charge?.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-base">
              <span>Total:</span>
              <span className="text-teal-600">₹{currentOrder.total_amount?.toFixed(2) || '0.00'}</span>
            </div>
          </div>

          {/* Invoice Link */}
          {linkedInvoice && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">
                  Invoice: {linkedInvoice.invoiceNumber || linkedInvoice.invoice_number || 'Linked'}
                </p>
                <p className="text-xs text-blue-600">
                  Status: {linkedInvoice.status || 'N/A'} | ₹{linkedInvoice.totalAmount?.toFixed(2) || linkedInvoice.total_amount?.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>
          )}

          {/* Payment */}
          <div className="space-y-3">
            <h3 className="font-bold text-gray-900">Payment</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Method</p>
                <p className="text-gray-900 capitalize">{currentOrder.payment_method || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Status</p>
                <p className={`capitalize font-medium ${
                  currentOrder.payment_status === 'received' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {currentOrder.payment_status || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Paid</p>
                <p className="text-gray-900">₹{currentOrder.amount_paid?.toFixed(2) || '0.00'}</p>
              </div>
            </div>
            {currentOrder.transaction_id && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Transaction ID</p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">{currentOrder.transaction_id}</code>
                  <button
                    onClick={() => handleCopyToClipboard(currentOrder.transaction_id, 'txn')}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    {copiedField === 'txn' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Shipping & Tracking - Always shown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Shipping & Tracking</h3>
              {!editingTracking && (
                <button
                  onClick={() => setEditingTracking(true)}
                  className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium"
                >
                  <Edit2 className="w-3 h-3" />
                  {currentOrder.tracking_number ? 'Edit' : 'Add Tracking'}
                </button>
              )}
            </div>

            {currentOrder.dispatch_date && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Dispatch Date</p>
                <p className="text-gray-900">{currentOrder.dispatch_date}</p>
              </div>
            )}

            {editingTracking ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Courier Name</label>
                  <input
                    type="text"
                    value={courierInput}
                    onChange={(e) => setCourierInput(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="ST Courier"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Tracking Number</label>
                  <input
                    type="text"
                    value={trackingInput}
                    onChange={(e) => setTrackingInput(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                    placeholder="Enter tracking number"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveTracking}
                    disabled={savingTracking}
                    className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50"
                  >
                    {savingTracking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingTracking(false);
                      setTrackingInput(currentOrder.tracking_number || '');
                      setCourierInput(currentOrder.courier_name || 'ST Courier');
                    }}
                    className="px-3 py-1.5 text-gray-600 hover:bg-gray-200 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Courier</p>
                  <p className="text-gray-900">{currentOrder.courier_name || <span className="text-gray-400 italic">Not set</span>}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">Tracking Number</p>
                  {currentOrder.tracking_number ? (
                    <div className="flex items-center gap-2">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">{currentOrder.tracking_number}</code>
                      <button
                        onClick={() => handleCopyToClipboard(currentOrder.tracking_number, 'tracking')}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        {copiedField === 'tracking' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-600" />}
                      </button>
                    </div>
                  ) : (
                    <p className="text-gray-400 italic text-sm">No tracking yet</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Follow-up Notes */}
          {currentOrder.follow_up_notes && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Follow-up Notes</p>
              <p className="text-gray-700 mt-1 text-sm">{currentOrder.follow_up_notes}</p>
            </div>
          )}

          {/* Notes */}
          {currentOrder.notes && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Notes</p>
              <p className="text-gray-700 mt-1 text-sm">{currentOrder.notes}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-6">
            <button
              onClick={() => setShowWhatsApp(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </button>
            <button
              onClick={handlePrintAndPack}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium text-sm"
            >
              <Printer className="w-4 h-4" />
              Print Label
            </button>
            {/* Invoice Button */}
            <button
              onClick={handleGenerateInvoice}
              disabled={generatingInvoice}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm disabled:opacity-50"
            >
              {generatingInvoice ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              {linkedInvoice ? 'View Invoice' : 'Generate Invoice'}
            </button>
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Modals */}
      {showLabelPrinter && (
        <LabelPrinter
          order={currentOrder}
          onClose={() => setShowLabelPrinter(false)}
        />
      )}

      {showWhatsApp && (
        <WhatsAppSender
          order={currentOrder}
          onClose={() => setShowWhatsApp(false)}
        />
      )}

      {/* Invoice Viewer Modal */}
      {showInvoiceView && linkedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Invoice {linkedInvoice.invoiceNumber || linkedInvoice.invoice_number || ''}
              </h3>
              <button onClick={() => setShowInvoiceView(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500">Date</p>
                  <p className="font-medium">{linkedInvoice.invoiceDate || linkedInvoice.invoice_date}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <p className={`font-medium capitalize ${linkedInvoice.status === 'paid' ? 'text-green-600' : 'text-amber-600'}`}>
                    {linkedInvoice.status}
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-3">
                <p className="text-xs text-gray-500 mb-2">Items</p>
                {(linkedInvoice.items || []).map((item, idx) => (
                  <div key={idx} className="flex justify-between py-1">
                    <span>{item.skuName || item.sku_name} ({item.packType || item.pack_type})</span>
                    <span className="font-medium">x{item.quantity} = ₹{item.total}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 pt-3 space-y-1">
                <div className="flex justify-between"><span>Subtotal</span><span>₹{(linkedInvoice.subtotal || 0).toFixed(2)}</span></div>
                <div className="flex justify-between"><span>GST</span><span>₹{(linkedInvoice.gstAmount || linkedInvoice.gst_amount || 0).toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-base border-t pt-2">
                  <span>Total</span>
                  <span className="text-teal-600">₹{(linkedInvoice.totalAmount || linkedInvoice.total_amount || 0).toFixed(2)}</span>
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-3">
                View full invoice details and PDF on the <strong>Invoices</strong> page.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
