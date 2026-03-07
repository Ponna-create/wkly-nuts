import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle, SkipForward } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/supabase';

export default function ZohoImport({ onClose, onImportComplete }) {
  const { state, showToast } = useApp();
  const { skus } = state;
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [groupedOrders, setGroupedOrders] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [columnMapping, setColumnMapping] = useState({
    orderNumber: '', customerName: '', phone: '', email: '',
    shippingAddress: '', city: '', state: '', pincode: '',
    status: '', amount: '', date: '', channel: '', payment: '',
    itemName: '', itemQuantity: '', itemRate: '',
  });

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setImportResults(null);
    setGroupedOrders(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        if (jsonData.length === 0) { showToast('No data found', 'error'); return; }

        // Auto-detect columns
        const headers = Object.keys(jsonData[0]);
        const mapping = { ...columnMapping };
        headers.forEach(h => {
          const l = h.toLowerCase();
          if (l.includes('sales order') || l.includes('order#') || l.includes('order number') || l === 'order id') mapping.orderNumber = h;
          if (l.includes('customer') && l.includes('name')) mapping.customerName = h;
          if (l.includes('phone') || l.includes('mobile')) mapping.phone = h;
          if (l === 'email' || l.includes('customer email')) mapping.email = h;
          if (l.includes('shipping') && l.includes('address')) mapping.shippingAddress = h;
          if (l.includes('shipping') && l.includes('city') || l === 'city') mapping.city = h;
          if (l.includes('shipping') && l.includes('state') || l === 'state') mapping.state = h;
          if ((l.includes('shipping') && l.includes('zip')) || l.includes('pincode') || l === 'zip') mapping.pincode = h;
          if (l.includes('order') && l.includes('status')) mapping.status = h;
          if (l === 'amount' || l.includes('total') || l.includes('grand total')) mapping.amount = h;
          if (l === 'date' || l.includes('order date') || l.includes('created')) mapping.date = h;
          if (l.includes('channel') || l.includes('source')) mapping.channel = h;
          if (l.includes('payment')) mapping.payment = h;
          if (l.includes('item name') || l.includes('product') || l === 'item') mapping.itemName = h;
          if ((l.includes('quantity') || l === 'qty') && !l.includes('ship')) mapping.itemQuantity = h;
          if (l.includes('item price') || l.includes('rate') || l.includes('unit price')) mapping.itemRate = h;
        });

        setColumnMapping(mapping);
        setParsedData(jsonData);

        // Group rows by order number (Zoho = 1 row per line item)
        const orderMap = new Map();
        for (const row of jsonData) {
          const orderNum = row[mapping.orderNumber] || `ROW-${orderMap.size + 1}`;
          if (!orderMap.has(orderNum)) {
            orderMap.set(orderNum, { header: row, items: [] });
          }
          // Add item if item name column exists
          if (mapping.itemName && row[mapping.itemName]) {
            orderMap.get(orderNum).items.push(row);
          }
        }
        setGroupedOrders(orderMap);
        showToast(`Found ${orderMap.size} orders (${jsonData.length} rows)`, 'success');
      } catch (err) {
        console.error('File parse error:', err);
        showToast('Error reading file', 'error');
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const mapZohoStatus = (zohoStatus) => {
    if (!zohoStatus) return 'packing';
    const l = zohoStatus.toLowerCase();
    if (l.includes('confirm') || l.includes('approved')) return 'packing';
    if (l.includes('pack')) return 'packed';
    if (l.includes('ship') || l.includes('dispatch')) return 'dispatched';
    if (l.includes('deliver')) return 'delivered';
    if (l.includes('cancel')) return 'cancelled';
    if (l.includes('draft') || l.includes('pending')) return 'follow_up';
    return 'packing';
  };

  const detectPackType = (itemName) => {
    const l = (itemName || '').toLowerCase();
    if (l.includes('monthly') || l.includes('month pack')) return 'monthly';
    return 'weekly';
  };

  const matchSku = (itemName) => {
    if (!itemName) return null;
    const l = itemName.toLowerCase();
    return skus.find(s =>
      l.includes(s.name.toLowerCase()) ||
      l.includes((s.code || '').toLowerCase()) ||
      l.includes((s.shortName || '').toLowerCase())
    );
  };

  const handleImport = async () => {
    if (!groupedOrders || groupedOrders.size === 0) return;
    setImporting(true);
    const results = { success: 0, skipped: 0, failed: 0, errors: [] };

    for (const [orderNum, orderGroup] of groupedOrders) {
      try {
        // Duplicate detection
        const existing = await dbService.findOrderByZohoId(String(orderNum));
        if (existing) {
          results.skipped++;
          continue;
        }

        const row = orderGroup.header;

        // Build items array
        const items = orderGroup.items.map(r => {
          const itemName = r[columnMapping.itemName] || '';
          const sku = matchSku(itemName);
          const qty = parseInt(r[columnMapping.itemQuantity]) || 1;
          const price = parseFloat(r[columnMapping.itemRate]) || 0;
          return {
            sku_id: sku?.id || null,
            sku_name: sku?.name || itemName,
            pack_type: detectPackType(itemName),
            quantity: qty,
            unit_price: price,
            total: qty * price,
          };
        });

        // Calculate totals from items if available, otherwise use amount column
        const itemsTotal = items.reduce((s, i) => s + (i.total || 0), 0);
        const amount = itemsTotal > 0 ? itemsTotal : (parseFloat(row[columnMapping.amount]) || 0);

        // Customer linking by phone
        const phone = row[columnMapping.phone] || '';
        const customer = phone ? await dbService.findCustomerByPhone(phone) : null;

        // Build address
        const addressParts = [
          row[columnMapping.shippingAddress],
          row[columnMapping.city],
          row[columnMapping.state],
          row[columnMapping.pincode],
        ].filter(Boolean);

        const paymentStr = (row[columnMapping.payment] || '').toLowerCase();
        const isPaid = paymentStr.includes('paid') || paymentStr.includes('received');

        const orderData = {
          customerName: customer?.name || row[columnMapping.customerName] || 'Unknown',
          customerId: customer?.id || null,
          orderSource: 'zoho',
          items: items,
          subtotal: amount,
          gstRate: 0,
          gstAmount: 0,
          discountPercent: 0,
          discountAmount: 0,
          shippingCharge: 0,
          totalAmount: amount,
          paymentMethod: isPaid ? 'upi' : 'cod',
          paymentStatus: isPaid ? 'received' : 'pending',
          amountPaid: isPaid ? amount : 0,
          transactionId: '',
          status: mapZohoStatus(row[columnMapping.status]),
          shippingAddress: addressParts.join(', '),
          notes: `Imported from Zoho: ${orderNum}`,
          zoho_order_id: String(orderNum),
        };

        const { error } = await dbService.createSalesOrder(orderData);
        if (error) {
          results.failed++;
          results.errors.push(`${orderNum}: ${error.message}`);
        } else {
          results.success++;
        }
      } catch (err) {
        results.failed++;
        results.errors.push(`${orderNum}: ${err.message}`);
      }
    }

    setImportResults(results);
    setImporting(false);
    if (results.success > 0) showToast(`Imported ${results.success} orders`, 'success');
    if (results.skipped > 0) showToast(`Skipped ${results.skipped} duplicates`, 'info');
    if (results.failed > 0) showToast(`${results.failed} failed`, 'error');
  };

  const orderCount = groupedOrders?.size || 0;
  const rowCount = parsedData?.length || 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-teal-600" />
            <h2 className="text-xl font-bold">Import from Zoho / CSV</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* File Upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition"
            onClick={() => fileInputRef.current?.click()}>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".csv,.xlsx,.xls" className="hidden" />
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            {file ? (
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="font-medium">Click to upload CSV or Excel file</p>
                <p className="text-sm text-gray-500 mt-1">Supports .csv, .xlsx from Zoho Commerce</p>
              </div>
            )}
          </div>

          {/* Preview */}
          {groupedOrders && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">Preview: {orderCount} orders ({rowCount} rows)</h3>
                {orderCount !== rowCount && (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                    Multi-item orders grouped
                  </span>
                )}
              </div>

              {/* Column Mapping */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <h4 className="text-xs font-semibold text-gray-700 mb-2">Detected Columns</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-xs">
                  {Object.entries(columnMapping).filter(([, v]) => v).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                      <span className="text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                      <span className="font-medium truncate">{value}</span>
                    </div>
                  ))}
                </div>
                {!columnMapping.itemName && (
                  <p className="mt-2 text-xs text-amber-600">
                    No item/product column detected — orders will import without line items
                  </p>
                )}
              </div>

              {/* Data Preview */}
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b text-xs text-gray-600">
                      <th className="px-3 py-2 text-left">Order #</th>
                      <th className="px-3 py-2 text-left">Customer</th>
                      <th className="px-3 py-2 text-left">Items</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(groupedOrders.entries()).slice(0, 10).map(([orderNum, group]) => (
                      <tr key={orderNum} className="border-b border-gray-100">
                        <td className="px-3 py-2 font-medium text-teal-600">{orderNum}</td>
                        <td className="px-3 py-2">{group.header[columnMapping.customerName] || '-'}</td>
                        <td className="px-3 py-2">
                          {group.items.length > 0 ? (
                            <span className="text-xs">
                              {group.items.map(i => i[columnMapping.itemName]).join(', ').substring(0, 40)}
                              {group.items.map(i => i[columnMapping.itemName]).join(', ').length > 40 ? '...' : ''}
                            </span>
                          ) : <span className="text-gray-400 text-xs">No items</span>}
                        </td>
                        <td className="px-3 py-2 text-right">{parseFloat(group.header[columnMapping.amount] || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">{group.header[columnMapping.status] || '-'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {orderCount > 10 && (
                  <div className="p-2 text-center text-xs text-gray-500 bg-gray-50">...and {orderCount - 10} more orders</div>
                )}
              </div>
            </div>
          )}

          {/* Import Results */}
          {importResults && (
            <div className="space-y-3">
              <h3 className="font-bold">Import Results</h3>
              <div className="flex flex-wrap gap-3">
                {importResults.success > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">{importResults.success} imported</span>
                  </div>
                )}
                {importResults.skipped > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <SkipForward className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">{importResults.skipped} duplicates skipped</span>
                  </div>
                )}
                {importResults.failed > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-medium text-red-700">{importResults.failed} failed</span>
                  </div>
                )}
              </div>
              {importResults.errors.length > 0 && (
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-xs font-medium text-red-700 mb-1">Errors:</p>
                  {importResults.errors.slice(0, 5).map((err, i) => <p key={i} className="text-xs text-red-600">{err}</p>)}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50 font-medium text-gray-700">
              {importResults ? 'Close' : 'Cancel'}
            </button>
            {groupedOrders && !importResults && (
              <button onClick={handleImport} disabled={importing}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium disabled:opacity-50">
                {importing ? `Importing...` : `Import ${orderCount} Orders`}
              </button>
            )}
            {importResults && importResults.success > 0 && (
              <button onClick={() => { if (onImportComplete) onImportComplete(); onClose(); }}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">Done</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
