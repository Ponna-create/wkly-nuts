import React, { useState, useMemo } from 'react';
import { Search, Trash2, AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { dbService } from '../../services/supabase';
import { formatDate } from '../../utils/dateFormat';

// Dedicated delete flow, separate from the day-to-day order list — deliberately
// slower than a per-row icon so a wrong click can't nuke an order in one tap.
// Orders that already have an invoice are blocked outright: deleting them would
// silently break the invoice number sequence and leave a GST filing referencing
// a supply that no longer exists in the app. The correct move there is to change
// status to Cancelled/Returned and, if it was already shipped, issue a Credit Note.
export default function DeleteOrderPanel({ orders, onClose, onDeleted, showToast }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return orders
      .filter((o) =>
        o.order_number?.toLowerCase().includes(q) ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.phone?.toLowerCase().includes(q) ||
        o.tracking_number?.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [orders, search]);

  const isInvoiced = !!selected?.invoice_id;
  const canDelete = selected && !isInvoiced && confirmText.trim() === selected.order_number;

  const handlePick = (order) => {
    setSelected(order);
    setConfirmText('');
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);
    const { error } = await dbService.deleteSalesOrder(selected.id);
    setDeleting(false);
    if (error) {
      showToast?.('Error deleting order', 'error');
      return;
    }
    showToast?.(`Order ${selected.order_number} deleted`, 'success');
    onDeleted?.();
    setSelected(null);
    setConfirmText('');
    setSearch('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-600" />
            Delete an Order
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {!selected ? (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search by order #, customer, phone, or tracking #..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
              {search.trim() && results.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No matching orders</p>
              )}
              <div className="space-y-1.5">
                {results.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => handlePick(o)}
                    className="w-full text-left px-3 py-2.5 border border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-gray-900">{o.order_number}</span>
                      <span className="text-sm font-medium text-gray-700">₹{o.total_amount?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-gray-500">{o.customer_name || 'N/A'} {o.phone ? `· ${o.phone}` : ''}</span>
                      <span className="text-xs text-gray-400">{formatDate(o.order_date)}</span>
                    </div>
                    {o.invoice_id && (
                      <span className="inline-flex items-center gap-1 mt-1 text-xs text-amber-700 font-medium">
                        <ShieldAlert className="w-3 h-3" /> Invoiced — cannot be deleted
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Order #</span><span className="font-medium text-gray-900">{selected.order_number}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Customer</span><span className="font-medium text-gray-900">{selected.customer_name || 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Phone</span><span className="text-gray-700">{selected.phone || '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-medium text-gray-900">₹{selected.total_amount?.toFixed(2) || '0.00'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Status</span><span className="text-gray-700 capitalize">{selected.status?.replace('_', ' ')}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Order date</span><span className="text-gray-700">{formatDate(selected.order_date)}</span></div>
              </div>

              {isInvoiced ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex gap-2">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">This order has an invoice — it can't be deleted.</p>
                    <p className="mt-1 text-amber-700">
                      Deleting it would break the invoice number sequence used for GST filing.
                      If the customer refused/returned the shipment, set status to <span className="font-medium">Returned (RTO)</span> or <span className="font-medium">Cancelled</span> instead — that offers to issue a Credit Note against the invoice, which is the correct way to reverse it.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 flex gap-2">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">This permanently deletes the order. There is no undo.</p>
                    <p className="mt-1 text-red-700">Type the order number <span className="font-mono font-semibold">{selected.order_number}</span> below to confirm.</p>
                  </div>
                </div>
              )}

              {!isInvoiced && (
                <input
                  type="text"
                  placeholder={`Type ${selected.order_number} to confirm`}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setSelected(null); setConfirmText(''); }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Back
                </button>
                {!isInvoiced && (
                  <button
                    onClick={handleDelete}
                    disabled={!canDelete || deleting}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {deleting ? 'Deleting...' : 'Delete Permanently'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
