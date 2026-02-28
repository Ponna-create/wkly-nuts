import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { dbService } from '../../services/supabase';

export default function ZohoImport({ onClose, onImportComplete }) {
  const { showToast } = useApp();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [columnMapping, setColumnMapping] = useState({
    orderNumber: 'Sales Order#',
    customerName: 'Customer Name',
    status: 'Order Status',
    amount: 'Amount',
    date: 'Date',
    channel: 'Sales Channel',
    payment: 'Payment',
    shipped: 'Shipped',
  });

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setImportResults(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          showToast('No data found in file', 'error');
          return;
        }

        // Auto-detect column mappings
        const headers = Object.keys(jsonData[0]);
        const autoMapping = { ...columnMapping };

        headers.forEach(h => {
          const lower = h.toLowerCase();
          if (lower.includes('sales order') || lower.includes('order#') || lower.includes('order number')) {
            autoMapping.orderNumber = h;
          }
          if (lower.includes('customer') && lower.includes('name')) {
            autoMapping.customerName = h;
          }
          if (lower.includes('order') && lower.includes('status')) {
            autoMapping.status = h;
          }
          if (lower === 'amount' || lower.includes('total')) {
            autoMapping.amount = h;
          }
          if (lower === 'date' || lower.includes('order date')) {
            autoMapping.date = h;
          }
          if (lower.includes('channel') || lower.includes('source')) {
            autoMapping.channel = h;
          }
          if (lower.includes('payment')) {
            autoMapping.payment = h;
          }
          if (lower.includes('shipped') || lower.includes('shipping')) {
            autoMapping.shipped = h;
          }
        });

        setColumnMapping(autoMapping);
        setParsedData(jsonData);
        showToast(`Found ${jsonData.length} orders in file`, 'success');
      } catch (err) {
        console.error('File parse error:', err);
        showToast('Error reading file. Make sure it\'s a valid CSV or Excel file.', 'error');
      }
    };

    if (selectedFile.name.endsWith('.csv')) {
      reader.readAsBinaryString(selectedFile);
    } else {
      reader.readAsBinaryString(selectedFile);
    }
  };

  const mapZohoStatus = (zohoStatus) => {
    if (!zohoStatus) return 'packing';
    const lower = zohoStatus.toLowerCase();
    if (lower.includes('confirm') || lower.includes('approved')) return 'packing';
    if (lower.includes('pack')) return 'packed';
    if (lower.includes('ship') || lower.includes('dispatch')) return 'dispatched';
    if (lower.includes('deliver')) return 'delivered';
    if (lower.includes('cancel')) return 'cancelled';
    if (lower.includes('draft') || lower.includes('pending')) return 'follow_up';
    return 'packing';
  };

  const handleImport = async () => {
    if (!parsedData || parsedData.length === 0) return;

    setImporting(true);
    const results = { success: 0, failed: 0, errors: [] };

    for (const row of parsedData) {
      try {
        const orderData = {
          customerName: row[columnMapping.customerName] || 'Unknown',
          orderSource: 'zoho',
          items: [],
          subtotal: parseFloat(row[columnMapping.amount]) || 0,
          gstRate: 5,
          gstAmount: 0,
          discountPercent: 0,
          discountAmount: 0,
          shippingCharge: 0,
          totalAmount: parseFloat(row[columnMapping.amount]) || 0,
          paymentMethod: (row[columnMapping.payment] || '').toLowerCase().includes('paid') ? 'upi' : 'cod',
          paymentStatus: (row[columnMapping.payment] || '').toLowerCase().includes('paid') ? 'received' : 'pending',
          amountPaid: (row[columnMapping.payment] || '').toLowerCase().includes('paid')
            ? (parseFloat(row[columnMapping.amount]) || 0)
            : 0,
          transactionId: '',
          status: mapZohoStatus(row[columnMapping.status]),
          shippingAddress: '',
          notes: `Imported from Zoho: ${row[columnMapping.orderNumber] || ''}`,
          zoho_order_id: row[columnMapping.orderNumber] || '',
        };

        const { error } = await dbService.createSalesOrder(orderData);

        if (error) {
          results.failed++;
          results.errors.push(`${row[columnMapping.orderNumber]}: ${error.message}`);
        } else {
          results.success++;
        }
      } catch (err) {
        results.failed++;
        results.errors.push(`Row error: ${err.message}`);
      }
    }

    setImportResults(results);
    setImporting(false);

    if (results.success > 0) {
      showToast(`Successfully imported ${results.success} orders!`, 'success');
    }
    if (results.failed > 0) {
      showToast(`${results.failed} orders failed to import`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-teal-600" />
            <h2 className="text-xl font-bold text-gray-900">Import from Zoho / CSV</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* File Upload */}
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".csv,.xlsx,.xls"
              className="hidden"
            />
            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            {file ? (
              <div>
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="font-medium text-gray-900">Click to upload CSV or Excel file</p>
                <p className="text-sm text-gray-500 mt-1">Supports .csv, .xlsx, .xls from Zoho Commerce</p>
              </div>
            )}
          </div>

          {/* Preview */}
          {parsedData && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Preview ({parsedData.length} orders)</h3>
              </div>

              {/* Column Mapping */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Column Mapping</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(columnMapping).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-gray-500 w-24 capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                      <span className="font-medium text-gray-900">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Preview Table */}
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Order #</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Customer</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Amount</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 10).map((row, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="px-3 py-2 font-medium text-teal-600">{row[columnMapping.orderNumber]}</td>
                        <td className="px-3 py-2">{row[columnMapping.customerName]}</td>
                        <td className="px-3 py-2">₹{row[columnMapping.amount]}</td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">
                            {row[columnMapping.status]}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600">{row[columnMapping.date]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedData.length > 10 && (
                  <div className="p-2 text-center text-xs text-gray-500 bg-gray-50">
                    ...and {parsedData.length - 10} more orders
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Import Results */}
          {importResults && (
            <div className="space-y-3">
              <h3 className="font-bold text-gray-900">Import Results</h3>
              <div className="flex gap-4">
                {importResults.success > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">{importResults.success} imported</span>
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
                  {importResults.errors.slice(0, 5).map((err, idx) => (
                    <p key={idx} className="text-xs text-red-600">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700"
            >
              {importResults ? 'Close' : 'Cancel'}
            </button>
            {parsedData && !importResults && (
              <button
                onClick={handleImport}
                disabled={importing}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {importing ? `Importing... (${parsedData.length} orders)` : `Import ${parsedData.length} Orders`}
              </button>
            )}
            {importResults && importResults.success > 0 && (
              <button
                onClick={() => {
                  if (onImportComplete) onImportComplete();
                  onClose();
                }}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
