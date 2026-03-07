import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Truck } from 'lucide-react';
import * as XLSX from 'xlsx';
import { dbService } from '../../services/supabase';

export default function TrackingCSVImport({ orders, onClose, onImportComplete, showToast }) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [matches, setMatches] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setImportResults(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' });
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        if (rows.length === 0) { showToast('No data found', 'error'); return; }

        // Auto-detect columns
        const headers = Object.keys(rows[0]);
        let trackingCol = '', orderCol = '', courierCol = '';
        headers.forEach(h => {
          const l = h.toLowerCase();
          if (l.includes('tracking') || l.includes('consignment') || l.includes('awb') || l.includes('docket')) trackingCol = h;
          if (l.includes('order') || l.includes('reference') || l.includes('ref')) orderCol = h;
          if (l.includes('courier') || l.includes('carrier') || l.includes('provider')) courierCol = h;
        });

        // Match tracking rows to existing orders
        const matched = rows.map(row => {
          const tracking = String(row[trackingCol] || '').trim();
          const orderRef = String(row[orderCol] || '').trim();
          const courier = String(row[courierCol] || 'ST Courier').trim();

          // Try to find matching order
          let matchedOrder = null;
          if (orderRef) {
            matchedOrder = orders.find(o =>
              (o.order_number || '').toLowerCase() === orderRef.toLowerCase() ||
              (o.zoho_order_id || '') === orderRef ||
              String(o.id) === orderRef
            );
          }

          return {
            tracking,
            orderRef,
            courier: courier || 'ST Courier',
            matchedOrder,
            selected: !!matchedOrder && !!tracking,
          };
        }).filter(m => m.tracking); // Only rows with tracking numbers

        setMatches(matched);
        showToast(`Found ${matched.length} tracking entries, ${matched.filter(m => m.matchedOrder).length} matched to orders`, 'success');
      } catch (err) {
        console.error('Parse error:', err);
        showToast('Error reading file', 'error');
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const toggleMatch = (idx) => {
    setMatches(prev => prev.map((m, i) => i === idx ? { ...m, selected: !m.selected } : m));
  };

  // Manual order assignment for unmatched rows
  const assignOrder = (idx, orderId) => {
    const order = orders.find(o => o.id === orderId);
    setMatches(prev => prev.map((m, i) => i === idx ? { ...m, matchedOrder: order, selected: !!order } : m));
  };

  const handleImport = async () => {
    const toImport = matches.filter(m => m.selected && m.matchedOrder && m.tracking);
    if (toImport.length === 0) return;

    setImporting(true);
    const results = { success: 0, failed: 0, errors: [] };

    for (const match of toImport) {
      try {
        const order = match.matchedOrder;
        await dbService.updateSalesOrder({
          ...order,
          tracking_number: match.tracking,
          courier_name: match.courier,
          status: 'dispatched',
          dispatch_date: order.dispatch_date || new Date().toISOString().split('T')[0],
        });
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`${match.orderRef}: ${err.message}`);
      }
    }

    setImportResults(results);
    setImporting(false);
    if (results.success > 0) showToast(`Updated ${results.success} orders with tracking`, 'success');
  };

  const matchedCount = matches.filter(m => m.matchedOrder).length;
  const selectedCount = matches.filter(m => m.selected).length;
  // Unmatched dispatched orders for manual assignment dropdown
  const dispatchableOrders = orders.filter(o =>
    ['packing', 'packed', 'dispatched'].includes(o.status) && !o.tracking_number
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-purple-600" />
            <h2 className="text-xl font-bold">Import Tracking from CSV</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-700">
            <p className="font-medium mb-1">How to use:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-xs">
              <li>Upload courier bill to ChatGPT/Gemini and ask for a CSV with: tracking_number, order_number, courier_name</li>
              <li>Upload the generated CSV here</li>
              <li>Review matches and click Import</li>
            </ol>
          </div>

          {/* File Upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition"
            onClick={() => fileInputRef.current?.click()}>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".csv,.xlsx,.xls" className="hidden" />
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            {file ? (
              <p className="font-medium">{file.name} <span className="text-gray-500 text-sm">({(file.size / 1024).toFixed(1)} KB)</span></p>
            ) : (
              <p className="text-sm text-gray-600">Upload courier tracking CSV</p>
            )}
          </div>

          {/* Matches Preview */}
          {matches.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">{matches.length} tracking entries ({matchedCount} matched)</h3>
                <span className="text-xs text-gray-500">{selectedCount} selected for import</span>
              </div>

              <div className="overflow-x-auto border rounded-lg max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="border-b text-xs text-gray-600">
                      <th className="px-2 py-2 w-8"></th>
                      <th className="px-2 py-2 text-left">Tracking #</th>
                      <th className="px-2 py-2 text-left">Order</th>
                      <th className="px-2 py-2 text-left">Courier</th>
                      <th className="px-2 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((m, idx) => (
                      <tr key={idx} className={`border-b border-gray-100 ${m.selected ? 'bg-green-50' : ''}`}>
                        <td className="px-2 py-2">
                          <input type="checkbox" checked={m.selected} onChange={() => toggleMatch(idx)}
                            disabled={!m.matchedOrder} className="rounded" />
                        </td>
                        <td className="px-2 py-2 font-mono text-xs">{m.tracking}</td>
                        <td className="px-2 py-2">
                          {m.matchedOrder ? (
                            <span className="text-green-700 font-medium text-xs">
                              {m.matchedOrder.order_number} - {m.matchedOrder.customer_name}
                            </span>
                          ) : (
                            <select onChange={e => assignOrder(idx, e.target.value)} value=""
                              className="text-xs border rounded px-1 py-0.5 w-full">
                              <option value="">Assign order...</option>
                              {dispatchableOrders.map(o => (
                                <option key={o.id} value={o.id}>{o.order_number} - {o.customer_name}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-2 py-2 text-xs">{m.courier}</td>
                        <td className="px-2 py-2">
                          {m.matchedOrder ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-amber-400" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import Results */}
          {importResults && (
            <div className="flex flex-wrap gap-3">
              {importResults.success > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">{importResults.success} orders updated</span>
                </div>
              )}
              {importResults.failed > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium text-red-700">{importResults.failed} failed</span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50 font-medium text-gray-700">
              {importResults ? 'Close' : 'Cancel'}
            </button>
            {matches.length > 0 && !importResults && (
              <button onClick={handleImport} disabled={importing || selectedCount === 0}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium disabled:opacity-50">
                <Truck className="w-4 h-4" />
                {importing ? 'Updating...' : `Update ${selectedCount} Orders`}
              </button>
            )}
            {importResults && importResults.success > 0 && (
              <button onClick={() => { if (onImportComplete) onImportComplete(); onClose(); }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium">Done</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
