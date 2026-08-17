import React, { useState, useMemo, useEffect } from 'react';
import { X, Printer, CheckSquare, Square } from 'lucide-react';
import { generateA4LabelSheet } from '../../utils/a4LabelSheet';
import { dbService } from '../../services/supabase';
import DateRangePicker from '../common/DateRangePicker';

// Multiple shipping labels on one A4 sheet (2 cols x 3 rows) — for printers
// that aren't thermal/sticker printers. Separate from the one-per-page
// "Labels" print, which stays for when that format is still needed.
export default function A4LabelSheet({ orders, onClose, showToast, onPrinted }) {
  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Filter by date range — a Sat+Sun+Monday backlog can be pulled in
  // together instead of one calendar day at a time.
  const dateOrders = useMemo(() => {
    return (orders || []).filter(o => {
      const d = o.order_date || o.created_at?.split('T')[0];
      return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
    });
  }, [orders, dateFrom, dateTo]);

  useEffect(() => {
    setSelectedIds(new Set(dateOrders.map(o => o.id)));
  }, [dateOrders.length, dateFrom, dateTo]);

  const toggleOrder = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(selectedIds.size === dateOrders.length ? new Set() : new Set(dateOrders.map(o => o.id)));
  };

  const selectedOrders = dateOrders.filter(o => selectedIds.has(o.id));
  const pages = Math.ceil(selectedOrders.length / 6) || 0;

  const handlePrint = async () => {
    if (selectedOrders.length === 0) {
      showToast('No orders selected to print', 'error');
      return;
    }
    generateA4LabelSheet(selectedOrders);
    showToast(`${selectedOrders.length} label(s) on ${pages} A4 sheet${pages !== 1 ? 's' : ''} — downloaded`, 'success');
    // Stamp so the Sales Orders list can show these as printed.
    await Promise.all(selectedOrders.map(o => dbService.updateSalesOrder({ id: o.id, label_printed_at: new Date().toISOString() })));
    if (onPrinted) onPrinted();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">A4 Label Sheet</h2>
            <p className="text-sm text-gray-500">
              {selectedOrders.length} of {dateOrders.length} orders selected · 6 per A4 sheet · {pages} sheet{pages !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} disabled={selectedOrders.length === 0} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium disabled:opacity-50">
              <Printer className="w-4 h-4" /> Download PDF ({selectedOrders.length})
            </button>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
            <DateRangePicker
              from={dateFrom}
              to={dateTo}
              onChange={({ from, to }) => { setDateFrom(from); setDateTo(to); }}
            />
            <span className="text-sm text-gray-600 font-medium ml-auto">{dateOrders.length} orders</span>
          </div>

          {dateOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-400"><p>No orders in this date range</p></div>
          ) : (
            <div className="space-y-1">
              <button onClick={toggleAll} className="flex items-center gap-2 text-sm text-teal-600 font-medium mb-2 hover:text-teal-700">
                {selectedIds.size === dateOrders.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                {selectedIds.size === dateOrders.length ? 'Deselect All' : 'Select All'}
              </button>
              {dateOrders.map(order => (
                <div key={order.id} onClick={() => toggleOrder(order.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition ${selectedIds.has(order.id) ? 'bg-teal-50 border-teal-300' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                  {selectedIds.has(order.id) ? <CheckSquare className="w-4 h-4 text-teal-600 flex-shrink-0" /> : <Square className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{order.order_number}</span>
                      <span className="text-xs text-gray-500">{order.customer_name}</span>
                    </div>
                    <div className="text-xs text-gray-400 truncate">
                      {(order.items || []).map(i => `${i.sku_name || i.skuName} x${i.quantity}`).join(', ') || 'No items'}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">₹{(order.total_amount || 0).toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
