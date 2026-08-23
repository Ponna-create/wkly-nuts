import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Copy, Check, Printer, MessageCircle, Package, Truck, CheckCircle, FileText, Loader2, Save, Edit2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/supabase';
import LabelPrinter from './LabelPrinter';
import WhatsAppSender from './WhatsAppSender';
import { buildInvoiceDataFromOrder, isPromotionalOrder } from '../../utils/invoiceFromOrder';
import { formatDate } from '../../utils/dateFormat';

export default function OrderDetailView({ order, onClose, onUpdate }) {
  const { state, dispatch, showToast } = useApp();
  const navigate = useNavigate();
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
  const [editingOrder, setEditingOrder] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [addItemMode, setAddItemMode] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [cnForm, setCnForm] = useState(null);
  const [savingCreditNote, setSavingCreditNote] = useState(false);
  const [creditNotes, setCreditNotes] = useState([]);

  // Sync with parent order prop when it changes (e.g., after BulkTrackingEntry updates)
  useEffect(() => {
    setCurrentOrder(order);
    setTrackingInput(order.tracking_number || '');
    setCourierInput(order.courier_name || 'ST Courier');
  }, [order, order.tracking_number, order.courier_name, order.status, order.invoice_id]);

  // Any credit note(s) already issued for this order — shown so it's obvious
  // at a glance whether a returned/refused order has already been reversed.
  useEffect(() => {
    dbService.getCreditNotesForOrder(currentOrder.id).then(({ data }) => setCreditNotes(data || []));
  }, [currentOrder.id]);

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
      confirmed: { bg: 'bg-cyan-100', text: 'text-cyan-800', label: 'Confirmed' },
      packing: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Packing' },
      fulfilled: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Fulfilled' },
      collected: { bg: 'bg-pink-100', text: 'text-pink-800', label: 'Collected by Courier' },
      dispatched: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Dispatched' },
      transit: { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'In Transit' },
      delivered: { bg: 'bg-green-100', text: 'text-green-800', label: 'Delivered' },
      completed: { bg: 'bg-teal-100', text: 'text-teal-800', label: 'Completed' },
      returned: { bg: 'bg-rose-100', text: 'text-rose-800', label: 'Returned (RTO)' },
      cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Cancelled' },
    };
    return badges[status] || badges.confirmed;
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
      // Order returned (RTO) → put the packs back into finished-goods stock
      if (newStatus === 'returned') {
        const restock = await dbService.restockInventoryForOrder(currentOrder);
        if (restock.restocked > 0) {
          showToast(`${restock.restocked} item(s) returned to stock`, 'success');
        }
        // Never edit or delete the original invoice — a Credit Note against
        // it is the GST-correct way to reverse the taxable value. Only
        // prompt when there's actually an invoice to reverse, and skip if
        // one's already been issued for this order.
        if (currentOrder.invoice_id && creditNotes.length === 0) {
          openCreditNoteModal();
        }
      }
      // Deduct finished goods from inventory once fulfilled (scanned/boxed for courier)
      if (newStatus === 'fulfilled') {
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

  const handlePaymentMethodChange = async (method) => {
    const updateData = { id: currentOrder.id, paymentMethod: method };
    // Switching to COD means the cash hasn't actually been collected yet —
    // don't leave it showing as "received" from whatever it was before.
    if (method === 'cod' && currentOrder.payment_status === 'received' && !currentOrder.amount_paid) {
      updateData.paymentStatus = 'pending';
    }
    const { error } = await dbService.updateSalesOrder(updateData);
    if (error) {
      showToast('Error updating payment method', 'error');
      return;
    }
    setCurrentOrder(prev => ({ ...prev, payment_method: method, ...(updateData.paymentStatus ? { payment_status: updateData.paymentStatus } : {}) }));
    onUpdate();
  };

  // Cash actually collected at the door — records it as paid in full now,
  // separate from order creation time when a COD order genuinely hasn't
  // been paid yet.
  const handleMarkCodCollected = async () => {
    setLoading(true);
    const total = currentOrder.total_amount || 0;
    const { error } = await dbService.updateSalesOrder({
      id: currentOrder.id,
      paymentStatus: 'received',
      amountPaid: total,
      balanceDue: 0,
    });
    setLoading(false);
    if (error) {
      showToast('Error updating payment', 'error');
      return;
    }
    setCurrentOrder(prev => ({ ...prev, payment_status: 'received', amount_paid: total, balance_due: 0 }));
    showToast('Marked as collected', 'success');
    onUpdate();
  };

  // Pre-fills a full reversal of the linked invoice — she can edit any
  // amount before confirming (e.g. a partial return). Default CGST/SGST
  // split assumes Tamil Nadu (the overwhelming majority of orders); flip to
  // IGST manually for an interstate customer.
  const openCreditNoteModal = () => {
    const taxableValue = linkedInvoice?.subtotal || currentOrder.subtotal || 0;
    const gstAmount = linkedInvoice?.gstAmount || currentOrder.gst_amount || 0;
    const totalAmount = linkedInvoice?.totalAmount || currentOrder.total_amount || 0;
    setCnForm({
      taxableValue: taxableValue.toFixed(2),
      cgstAmount: (gstAmount / 2).toFixed(2),
      sgstAmount: (gstAmount / 2).toFixed(2),
      igstAmount: '0.00',
      totalAmount: totalAmount.toFixed(2),
      reason: 'RTO / Customer Refused',
      notes: '',
      date: new Date().toISOString().split('T')[0],
    });
    setShowCreditNoteModal(true);
  };

  const handleSaveCreditNote = async () => {
    setSavingCreditNote(true);
    const { data, error } = await dbService.createCreditNote({
      invoiceId: currentOrder.invoice_id,
      invoiceNumber: linkedInvoice?.invoiceNumber || linkedInvoice?.invoice_number || '',
      orderId: currentOrder.id,
      orderNumber: currentOrder.order_number,
      customerName: currentOrder.customer_name,
      reason: cnForm.reason,
      taxableValue: parseFloat(cnForm.taxableValue) || 0,
      cgstAmount: parseFloat(cnForm.cgstAmount) || 0,
      sgstAmount: parseFloat(cnForm.sgstAmount) || 0,
      igstAmount: parseFloat(cnForm.igstAmount) || 0,
      totalAmount: parseFloat(cnForm.totalAmount) || 0,
      creditNoteDate: cnForm.date,
      notes: cnForm.notes,
    });
    setSavingCreditNote(false);
    if (error || !data) {
      showToast('Error creating credit note', 'error');
      return;
    }
    setCreditNotes(prev => [data, ...prev]);
    showToast(`Credit note ${data.credit_note_number} issued`, 'success');
    setShowCreditNoteModal(false);
  };

  // Creates the invoice for this order if it doesn't have one yet, links it, and
  // returns the invoice id — used so printing a label also produces the invoice.
  const ensureInvoiceForOrder = async (targetOrder) => {
    if (targetOrder.invoice_id) return targetOrder.invoice_id;
    if (isPromotionalOrder(targetOrder)) return null; // promo/collab sends aren't a real sale — no invoice
    try {
      const invoiceData = buildInvoiceDataFromOrder(targetOrder, 'Auto-generated on label print', state.skus);
      const { data: autoInvoice, error } = await dbService.createInvoice(invoiceData);
      if (error || !autoInvoice) {
        showToast('Could not auto-generate invoice for this order', 'error');
        return null;
      }
      await dbService.updateSalesOrder({ id: targetOrder.id, invoice_id: autoInvoice.id });
      dispatch({ type: 'ADD_INVOICE', payload: autoInvoice });
      setCurrentOrder(prev => ({ ...prev, invoice_id: autoInvoice.id }));
      return autoInvoice.id;
    } catch (invErr) {
      console.warn('Auto-invoice failed:', invErr);
      showToast('Could not auto-generate invoice for this order', 'error');
      return null;
    }
  };

  // Label only — the invoice record is still created & linked in the
  // background (it has to exist for GST filing regardless), it just isn't
  // opened/printed here. Separate from handlePrintAndPack below since the
  // two used to always happen together, which was confusing (invoice PDF
  // would open in a new tab the instant the label modal appeared).
  const handlePrintLabelOnly = async () => {
    setShowLabelPrinter(true);
    if (currentOrder.status === 'confirmed') {
      await handleStatusChange('packing');
    }
    await ensureInvoiceForOrder(currentOrder);
    onUpdate();
  };

  const handlePrintAndPack = async () => {
    setShowLabelPrinter(true);
    if (currentOrder.status === 'confirmed') {
      await handleStatusChange('packing');
    }
    const invoiceId = await ensureInvoiceForOrder(currentOrder);
    if (invoiceId) {
      onUpdate();
      navigate(`/invoices?autoprint=${invoiceId}`);
    }
  };

  const handleSaveTracking = async () => {
    if (!trackingInput.trim()) {
      showToast('Please enter a tracking number', 'error');
      return;
    }
    setSavingTracking(true);

    // Adding a tracking number means the courier has collected & we've shared
    // it with the customer — order moves to Dispatched (unless already beyond).
    const PIPELINE_ORDER = ['follow_up', 'awaiting_payment', 'confirmed', 'packing', 'fulfilled', 'collected', 'dispatched', 'transit', 'delivered'];
    let newStatus = currentOrder.status;
    if (trackingInput.trim()) {
      const idx = PIPELINE_ORDER.indexOf(currentOrder.status);
      const dispatchedIdx = PIPELINE_ORDER.indexOf('dispatched');
      if (idx === -1 || idx < dispatchedIdx) {
        newStatus = 'dispatched';
      }
    }

    const updatedOrder = {
      ...currentOrder,
      tracking_number: trackingInput.trim(),
      courier_name: courierInput.trim() || 'ST Courier',
      status: newStatus,
    };

    if (newStatus === 'dispatched' && !currentOrder.dispatch_date) {
      updatedOrder.dispatch_date = new Date().toISOString().split('T')[0];
    }

    const { error } = await dbService.updateSalesOrder(updatedOrder);
    if (error) {
      showToast('Error saving tracking number', 'error');
    } else {
      setCurrentOrder(updatedOrder);
      dispatch({ type: 'UPDATE_SALES_ORDER', payload: updatedOrder });
      const statusMsg = newStatus !== currentOrder.status
        ? ` | Status → ${getStatusBadge(newStatus).label}`
        : '';
      showToast(`Tracking saved!${statusMsg}`, 'success');
      setEditingTracking(false);
      onUpdate();
    }
    setSavingTracking(false);
  };

  // Order edit — fix a mistyped address/pincode or a wrong item/qty/price
  // after the order was already saved.
  const startEditOrder = () => {
    setEditForm({
      customer_name: currentOrder.customer_name || '',
      order_source: currentOrder.order_source || '',
      shipping_address: currentOrder.shipping_address || '',
      courier_number: currentOrder.courier_number || '',
      shipping_charge: currentOrder.shipping_charge || 0,
      items: (currentOrder.items || []).map(i => ({ ...i })),
    });
    setAddItemMode(false);
    setNewItemName('');
    setEditingOrder(true);
  };

  const updateEditItem = (idx, key, val) => {
    setEditForm(prev => {
      const items = prev.items.map((it, i) => {
        if (i !== idx) return it;
        if (key === 'sku_name') return { ...it, sku_name: val };
        if (key === 'weight_grams') return { ...it, weight_grams: val === '' ? null : parseFloat(val) || null };
        const quantity = key === 'quantity' ? parseFloat(val) || 0 : parseFloat(it.quantity) || 0;
        const unitPrice = key === 'unit_price' ? parseFloat(val) || 0 : parseFloat(it.unit_price ?? it.unitPrice) || 0;
        return { ...it, quantity, unit_price: unitPrice, total: quantity * unitPrice };
      });
      return { ...prev, items };
    });
  };

  const removeEditItem = (idx) => {
    setEditForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  // For items that aren't in the SKU catalog at all — loose stock sold
  // occasionally (Almonds, Figs, etc.) that a customer sometimes asks for
  // on top of their usual order, without a real SKU set up for it.
  const addEditItem = (name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    setEditForm(prev => ({
      ...prev,
      items: [...prev.items, { sku_id: null, sku_name: trimmed, pack_type: 'weekly', quantity: 1, unit_price: 0, total: 0 }],
    }));
  };

  const handleSaveOrderEdit = async () => {
    setSavingOrder(true);
    // Selling Price already includes GST — never add GST on top. Each item's
    // price is split back into taxable value + GST (using that SKU's own
    // GST %) purely for the GST-filing breakup; the total is unaffected.
    const itemsTotal = editForm.items.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
    const subtotal = editForm.items.reduce((s, i) => {
      const skuId = i.sku_id || i.skuId;
      const sku = (state.skus || []).find(sk => String(sk.id) === String(skuId));
      const rate = sku?.gstRate ?? 5;
      return s + (parseFloat(i.total) || 0) / (1 + rate / 100);
    }, 0);
    const gstAmount = itemsTotal - subtotal;
    const discount = currentOrder.discount_amount || 0;
    const shippingCharge = parseFloat(editForm.shipping_charge) || 0;
    const totalAmount = itemsTotal - discount + shippingCharge;

    const updatedOrder = {
      ...currentOrder,
      customer_name: editForm.customer_name,
      order_source: editForm.order_source,
      shipping_address: editForm.shipping_address,
      courier_number: editForm.courier_number || null,
      items: editForm.items,
      shipping_charge: shippingCharge,
      subtotal,
      gst_amount: gstAmount,
      total_amount: totalAmount,
    };

    const { error } = await dbService.updateSalesOrder(updatedOrder);
    if (error) {
      showToast('Error saving changes', 'error');
    } else {
      setCurrentOrder(updatedOrder);
      dispatch({ type: 'UPDATE_SALES_ORDER', payload: updatedOrder });
      showToast('Order updated', 'success');
      setEditingOrder(false);
      onUpdate();
    }
    setSavingOrder(false);
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

    if (isPromotionalOrder(currentOrder)) {
      showToast('This is a promotional/collab order — no GST invoice is generated for it', 'error');
      return;
    }

    setGeneratingInvoice(true);
    try {
      const invoiceData = {
        id: `inv-${Date.now()}`,
        dueDate: null,
        terms: 'Payment due within 15 days',
        ...buildInvoiceDataFromOrder(currentOrder, 'Auto-generated from order', state.skus),
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
    { key: 'confirmed', label: 'Confirmed', icon: CheckCircle },
    { key: 'packing', label: 'Packing', icon: Package },
    { key: 'fulfilled', label: 'Fulfilled', icon: Package },
    { key: 'collected', label: 'Collected', icon: Truck },
    { key: 'dispatched', label: 'Dispatched', icon: Truck },
    { key: 'transit', label: 'In Transit', icon: Truck },
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
            <p className="text-sm text-gray-600 mt-1">{formatDate(currentOrder.order_date)}</p>
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
              <option value="confirmed">Confirmed</option>
              <option value="packing">Packing</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="collected">Collected by Courier</option>
              <option value="dispatched">Dispatched</option>
              <option value="transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="completed">Completed</option>
              <option value="returned">Returned (RTO)</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          {currentOrder.status === 'returned' && (
            <p className="text-xs text-rose-600">
              Packs are back in stock. To resend, set the status to <strong>Fulfilled</strong> again — stock will deduct once more.
            </p>
          )}

          {/* Customer */}
          <div className="flex items-start justify-between">
            <div className="grid grid-cols-2 gap-4 flex-1">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Customer</p>
                {editingOrder ? (
                  <input
                    type="text"
                    value={editForm.customer_name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, customer_name: e.target.value }))}
                    className="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-sm font-medium"
                  />
                ) : (
                  <p className="text-lg font-bold text-gray-900">{currentOrder.customer_name}</p>
                )}
                {currentOrder.phone && <p className="text-sm text-gray-600">{currentOrder.phone}</p>}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Source</p>
                {editingOrder ? (
                  <select
                    value={editForm.order_source}
                    onChange={(e) => setEditForm(prev => ({ ...prev, order_source: e.target.value }))}
                    className="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-sm font-medium capitalize"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="instagram">Instagram</option>
                    <option value="website">Website</option>
                    <option value="walkin">Walk-in</option>
                    <option value="meta_ad">Meta Ad</option>
                    <option value="zoho">Zoho</option>
                    <option value="amazon">Amazon</option>
                    {editForm.order_source && !['whatsapp', 'instagram', 'website', 'walkin', 'meta_ad', 'zoho', 'amazon'].includes(editForm.order_source) && (
                      <option value={editForm.order_source}>{editForm.order_source}</option>
                    )}
                  </select>
                ) : (
                  <p className="text-lg font-bold text-gray-900 capitalize">{currentOrder.order_source}</p>
                )}
              </div>
            </div>
            {!editingOrder && (
              <button
                onClick={startEditOrder}
                className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium whitespace-nowrap ml-2"
              >
                <Edit2 className="w-3 h-3" />
                Edit Order
              </button>
            )}
          </div>

          {editingOrder ? (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Shipping Address</p>
              <textarea
                value={editForm.shipping_address}
                onChange={(e) => setEditForm(prev => ({ ...prev, shipping_address: e.target.value }))}
                rows={3}
                className="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
          ) : currentOrder.shipping_address && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Shipping Address</p>
              <p className="text-sm text-gray-700 mt-1">{currentOrder.shipping_address}</p>
            </div>
          )}

          {editingOrder ? (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Courier Number (only if different from the phone above)</p>
              <input
                type="text"
                value={editForm.courier_number}
                onChange={(e) => setEditForm(prev => ({ ...prev, courier_number: e.target.value }))}
                placeholder="Leave blank to print the phone number above"
                className="w-full mt-1 px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
          ) : currentOrder.courier_number && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase">Courier Number</p>
              <p className="text-sm text-gray-700 mt-1">📦 {currentOrder.courier_number} <span className="text-xs text-gray-400">(prints on label instead of {currentOrder.phone || 'the phone number'})</span></p>
            </div>
          )}

          {/* Items */}
          <div className="space-y-3">
            <h3 className="font-bold text-gray-900">Items</h3>
            {editingOrder ? (
              <div className="space-y-2">
                {editForm.items.map((item, idx) => {
                  const isCustom = !(item.sku_id || item.skuId);
                  return (
                  <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {isCustom ? (
                          <input
                            value={item.sku_name || item.skuName || ''}
                            onChange={(e) => updateEditItem(idx, 'sku_name', e.target.value)}
                            className="w-full px-1.5 py-0.5 -ml-1.5 font-medium text-gray-900 border border-transparent hover:border-gray-300 focus:border-teal-400 rounded bg-transparent focus:bg-white"
                          />
                        ) : (
                          <>
                            <p className="font-medium text-gray-900">{item.sku_name || item.skuName}</p>
                            <p className="text-sm text-gray-600 capitalize">{item.pack_type || item.packType} Pack</p>
                          </>
                        )}
                      </div>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity || ''}
                        onChange={(e) => updateEditItem(idx, 'quantity', e.target.value)}
                        className="w-14 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                      />
                      <div className="flex items-center">
                        <span className="text-sm text-gray-500 mr-1">₹</span>
                        <input
                          type="number"
                          min="0"
                          value={(item.unit_price ?? item.unitPrice) || ''}
                          onChange={(e) => updateEditItem(idx, 'unit_price', e.target.value)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                        />
                      </div>
                      <button
                        onClick={() => removeEditItem(idx)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {isCustom && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-xs text-gray-400">Weight:</span>
                        <div className="relative">
                          <input
                            type="number"
                            value={item.weight_grams || ''}
                            onChange={(e) => updateEditItem(idx, 'weight_grams', e.target.value)}
                            placeholder="grams"
                            className="w-20 pl-1.5 pr-4 py-0.5 text-xs border border-gray-300 rounded"
                          />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">g</span>
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
                {editForm.items.length === 0 && (
                  <p className="text-gray-500 text-sm">All items removed — order will save with no items.</p>
                )}

                {/* Not-in-catalog items — loose stock (Almonds, Figs, etc.)
                    a customer sometimes wants added, without a real SKU set
                    up for it. Added at ₹0 — set the price right in the row above. */}
                {addItemMode ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (addEditItem(newItemName), setNewItemName(''), setAddItemMode(false))}
                      placeholder="Item name (e.g. Figs)"
                      className="flex-1 min-w-0 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      onClick={() => { addEditItem(newItemName); setNewItemName(''); setAddItemMode(false); }}
                      className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 flex-shrink-0"
                    >
                      Add
                    </button>
                    <button onClick={() => { setAddItemMode(false); setNewItemName(''); }} className="px-2 py-1.5 text-gray-400 hover:text-gray-600 flex-shrink-0">✕</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddItemMode(true)}
                    className="flex items-center gap-1 px-3 py-1.5 border border-dashed border-gray-300 text-gray-500 rounded-lg text-xs font-medium hover:border-teal-400 hover:text-teal-600"
                  >
                    + Add Item — not in SKU list
                  </button>
                )}

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-600">Shipping charge</span>
                  <div className="flex items-center">
                    <span className="text-sm text-gray-500 mr-1">₹</span>
                    <input
                      type="number"
                      value={editForm.shipping_charge || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, shipping_charge: e.target.value }))}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleSaveOrderEdit}
                    disabled={savingOrder}
                    className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50"
                  >
                    {savingOrder ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Save Changes
                  </button>
                  <button
                    onClick={() => setEditingOrder(false)}
                    className="px-3 py-1.5 text-gray-600 hover:bg-gray-200 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : currentOrder.items && currentOrder.items.length > 0 ? (
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
              {creditNotes.length === 0 && (
                <button
                  onClick={openCreditNoteModal}
                  className="text-xs font-medium text-blue-700 hover:text-blue-900 border border-blue-300 rounded-lg px-2.5 py-1.5 whitespace-nowrap"
                  title="Order refused/returned but this invoice shouldn't be edited or deleted — issue a Credit Note against it instead"
                >
                  Issue Credit Note
                </button>
              )}
            </div>
          )}

          {/* Credit Notes already issued — the original invoice above is
              untouched; this is the GST-correct reversal record instead. */}
          {creditNotes.length > 0 && (
            <div className="space-y-1.5 p-3 bg-rose-50 border border-rose-200 rounded-lg">
              <p className="text-xs font-semibold text-rose-700 uppercase">Credit Note{creditNotes.length > 1 ? 's' : ''} Issued</p>
              {creditNotes.map(cn => (
                <div key={cn.id} className="flex items-center justify-between text-sm">
                  <span className="text-rose-900">{cn.credit_note_number} <span className="text-rose-500">· {formatDate(cn.credit_note_date)}</span></span>
                  <span className="font-medium text-rose-900">-₹{parseFloat(cn.total_amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Payment */}
          <div className="space-y-3">
            <h3 className="font-bold text-gray-900">Payment</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">Method</p>
                <select
                  value={currentOrder.payment_method || 'upi'}
                  onChange={(e) => handlePaymentMethodChange(e.target.value)}
                  className="text-gray-900 capitalize -ml-1 px-1 py-0.5 border border-transparent hover:border-gray-300 rounded bg-transparent text-sm"
                >
                  <option value="upi">UPI</option>
                  <option value="cod">COD</option>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
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
            {currentOrder.payment_method === 'cod' && currentOrder.payment_status !== 'received' && (
              <button
                onClick={handleMarkCodCollected}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Mark COD Collected — ₹{currentOrder.total_amount?.toFixed(2) || '0.00'}
              </button>
            )}
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
                <p className="text-gray-900">{formatDate(currentOrder.dispatch_date)}</p>
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
              onClick={handlePrintLabelOnly}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium text-sm"
              title="Prints only the shipping label — no invoice"
            >
              <Printer className="w-4 h-4" />
              Print Label
            </button>
            <button
              onClick={handlePrintAndPack}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm"
              title="Prints the shipping label, then opens the invoice PDF"
            >
              <Printer className="w-4 h-4" />
              Print Label + Invoice
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

      {showCreditNoteModal && cnForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Issue Credit Note</h2>
              <button onClick={() => setShowCreditNoteModal(false)} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-gray-600">
                Reverses invoice <strong>{linkedInvoice?.invoiceNumber || linkedInvoice?.invoice_number}</strong> without editing or deleting it — the original stays exactly as filed. Adjust the amounts below if this is a partial return.
              </p>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Reason</label>
                <input
                  value={cnForm.reason}
                  onChange={(e) => setCnForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Date</label>
                  <input
                    type="date"
                    value={cnForm.date}
                    onChange={(e) => setCnForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Taxable Value</label>
                  <input
                    type="number"
                    value={cnForm.taxableValue}
                    onChange={(e) => setCnForm(f => ({ ...f, taxableValue: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">CGST</label>
                  <input
                    type="number"
                    value={cnForm.cgstAmount}
                    onChange={(e) => setCnForm(f => ({ ...f, cgstAmount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">SGST</label>
                  <input
                    type="number"
                    value={cnForm.sgstAmount}
                    onChange={(e) => setCnForm(f => ({ ...f, sgstAmount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">IGST</label>
                  <input
                    type="number"
                    value={cnForm.igstAmount}
                    onChange={(e) => setCnForm(f => ({ ...f, igstAmount: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Total Amount</label>
                <input
                  type="number"
                  value={cnForm.totalAmount}
                  onChange={(e) => setCnForm(f => ({ ...f, totalAmount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Notes (optional)</label>
                <textarea
                  value={cnForm.notes}
                  onChange={(e) => setCnForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSaveCreditNote}
                  disabled={savingCreditNote}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-600 text-white rounded-lg font-medium text-sm hover:bg-rose-700 disabled:opacity-50"
                >
                  {savingCreditNote ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {savingCreditNote ? 'Issuing...' : 'Issue Credit Note'}
                </button>
                <button onClick={() => setShowCreditNoteModal(false)} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Skip for now</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
