import React, { useState } from 'react';
import { X, Send } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/supabase';

export default function BulkTrackingEntry({ orders, onClose, onUpdate }) {
  const { showToast } = useApp();
  const [loading, setLoading] = useState(false);
  const [trackingData, setTrackingData] = useState(
    orders.map(order => ({
      orderId: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      tracking: '',
      courierName: order.courier_name || 'ST Courier'
    }))
  );

  const handleTrackingChange = (idx, tracking) => {
    setTrackingData(prev => {
      const updated = [...prev];
      updated[idx].tracking = tracking;
      return updated;
    });
  };

  const handleCourierChange = (idx, courier) => {
    setTrackingData(prev => {
      const updated = [...prev];
      updated[idx].courierName = courier;
      return updated;
    });
  };

  const handleSubmit = async () => {
    if (trackingData.every(t => !t.tracking)) {
      showToast('Please enter at least one tracking number', 'error');
      return;
    }

    setLoading(true);
    let successCount = 0;
    let errorCount = 0;

    for (const data of trackingData) {
      if (!data.tracking) continue;

      const order = orders.find(o => o.id === data.orderId);
      if (!order) continue;

      const { error } = await dbService.updateSalesOrder({
        ...order,
        tracking_number: data.tracking,
        courier_name: data.courierName,
        status: 'in_transit',
        dispatch_date: new Date().toISOString().split('T')[0],
      });

      if (error) {
        errorCount++;
      } else {
        successCount++;
      }
    }

    setLoading(false);

    if (successCount > 0) {
      showToast(`${successCount} orders updated successfully!`, 'success');
      onUpdate();
      onClose();
    }

    if (errorCount > 0) {
      showToast(`${errorCount} orders failed to update`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Bulk Tracking Entry</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {trackingData.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No dispatched orders to track</p>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Enter tracking numbers for {trackingData.length} dispatched order{trackingData.length !== 1 ? 's' : ''}
              </p>

              <div className="space-y-3">
                {trackingData.map((data, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-lg space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-gray-900">{data.orderNumber}</p>
                        <p className="text-sm text-gray-600">{data.customerName}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Tracking Number"
                        value={data.tracking}
                        onChange={(e) => handleTrackingChange(idx, e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        placeholder="Courier Name"
                        value={data.courierName}
                        onChange={(e) => handleCourierChange(idx, e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="p-4 bg-teal-50 rounded-lg border border-teal-200">
                <p className="text-sm font-medium text-teal-900">
                  {trackingData.filter(t => t.tracking).length} of {trackingData.length} orders have tracking numbers
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || trackingData.every(t => !t.tracking)}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  {loading ? 'Updating...' : 'Update & Send Messages'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
