import React from 'react';
import { X, Phone, MapPin, IndianRupee, ShoppingBag, Copy, MessageCircle } from 'lucide-react';
import { formatDateShort } from '../utils/dateFormat';

const STATUS_STYLE = {
  follow_up: 'bg-blue-100 text-blue-800', confirmed: 'bg-cyan-100 text-cyan-800',
  packing: 'bg-yellow-100 text-yellow-800', fulfilled: 'bg-orange-100 text-orange-800',
  collected: 'bg-pink-100 text-pink-800', dispatched: 'bg-purple-100 text-purple-800',
  transit: 'bg-indigo-100 text-indigo-800', delivered: 'bg-green-100 text-green-800',
  completed: 'bg-teal-100 text-teal-800', cancelled: 'bg-gray-100 text-gray-800',
  returned: 'bg-rose-100 text-rose-800',
};

// Full purchase history for one customer — every order, every line item, so
// "why does this customer show ₹2,697 for Seed Cycle" is answerable at a
// glance instead of a mystery. Pulled straight from the same order objects
// already in memory for the segment calc; no extra fetch needed.
export default function CustomerDetailModal({ profile, orders, onClose }) {
  if (!profile) return null;

  const customerOrders = (orders || [])
    .filter(o => (o.customer_id || o.customer_name) === profile.key)
    .sort((a, b) => new Date(b.order_date) - new Date(a.order_date));

  const copyPhone = () => {
    navigator.clipboard.writeText(profile.phone);
  };
  const openWa = () => {
    const phone = (profile.phone || '').replace(/[^0-9]/g, '');
    if (!phone) return;
    const formatted = phone.startsWith('91') ? phone : `91${phone}`;
    window.open(`https://wa.me/${formatted}`, '_blank');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{profile.name}</h2>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
              {profile.phone && (
                <button onClick={copyPhone} className="flex items-center gap-1 hover:text-teal-600" title="Copy phone">
                  <Phone className="w-3.5 h-3.5" /> {profile.phone} <Copy className="w-3 h-3" />
                </button>
              )}
              {profile.city && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {profile.city}</span>}
              {profile.phone && (
                <button onClick={openWa} className="flex items-center gap-1 text-green-600 hover:text-green-700">
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </button>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50">
          <div>
            <p className="text-xs text-gray-500">Orders</p>
            <p className="text-lg font-bold text-gray-900">{profile.orderCount}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 flex items-center gap-0.5"><IndianRupee className="w-3 h-3" /> LTV</p>
            <p className="text-lg font-bold text-gray-900">₹{profile.ltv.toFixed(0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">First order</p>
            <p className="text-sm font-medium text-gray-700">{formatDateShort(profile.firstOrderDate)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Last order</p>
            <p className="text-sm font-medium text-gray-700">{formatDateShort(profile.lastOrderDate)} <span className="text-gray-400">({profile.daysSinceLast}d ago)</span></p>
          </div>
        </div>

        {/* Order history */}
        <div className="overflow-y-auto p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><ShoppingBag className="w-4 h-4" /> Order History ({customerOrders.length})</h3>
          {customerOrders.map(o => (
            <div key={o.id} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-900">{o.order_number}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[o.status] || 'bg-gray-100 text-gray-700'}`}>{o.status?.replace('_', ' ')}</span>
                  {o.order_source && <span className="text-xs text-gray-400">via {o.order_source}</span>}
                </div>
                <span className="text-xs text-gray-500">{formatDateShort(o.order_date)}</span>
              </div>
              <div className="space-y-1">
                {(o.items || []).map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm text-gray-600">
                    <span>{item.sku_name || item.skuName || 'Item'}{item.pack_type === 'monthly' || item.packType === 'monthly' ? ' (Monthly)' : ''} × {item.quantity || item.qty}</span>
                    <span>₹{(parseFloat(item.total) || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100 text-sm">
                <span className="text-gray-500">{o.payment_method ? `${o.payment_method.toUpperCase()} · ${o.payment_status || '—'}` : ''}</span>
                <span className="font-bold text-gray-900">₹{(parseFloat(o.total_amount) || 0).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
