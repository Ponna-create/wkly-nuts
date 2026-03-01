import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, Check, AlertCircle, Download } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';

// Sample CSV formats for the user to share with ChatGPT/Gemini
const EXPENSE_CSV_SAMPLE = `date,description,category,vendor,amount,gst_amount,total,payment_method,bill_number,notes
2026-03-01,Almonds 5kg,raw_materials,Jagan Traders,2500,125,2625,upi,INV-001,Premium quality
2026-03-01,Packing Tape 10 rolls,packaging,Local Store,400,20,420,cash,,
2026-03-02,ST Courier 5 parcels,courier,ST Courier,750,0,750,upi,AWB-123,March dispatches`;

const PO_CSV_SAMPLE = `date,vendor,item_name,quantity,unit,unit_price,gst_percent,total,status,notes
2026-03-01,Jagan Traders,Almonds,5,kg,500,5,2625,received,Premium California
2026-03-01,Jagan Traders,Cashews,3,kg,800,5,2520,received,W320 grade
2026-03-02,Local Packaging,Weekly Box,100,pcs,11,18,1298,ordered,21.6x14.0x10.2cm`;

const AI_PROMPT_TEMPLATE = `I have a purchase bill/invoice image. Please extract the data and format it as CSV with these columns:

For expenses: date,description,category,vendor,amount,gst_amount,total,payment_method,bill_number,notes
Categories: raw_materials, packaging, shipping, advertising, rent, utilities, equipment, salary, courier, misc

For purchase orders: date,vendor,item_name,quantity,unit,unit_price,gst_percent,total,status,notes

Please output ONLY the CSV data with headers, no other text.`;

// Auto-detect expense category from description/item text
function detectCategory(text) {
  const t = (text || '').toLowerCase();
  // Raw materials - nuts, seeds, dates, dry fruits
  if (/almond|cashew|pistachio|walnut|peanut|raisin|date|fig|apricot|seed|flax|sunflower|pumpkin|chia|sesame|melon|makhana|fox.?nut|cranberr|berry/.test(t)) return 'raw_materials';
  // Packaging
  if (/box|sachet|pouch|bag|label|sticker|tape|carton|wrapper|nitrogen|n2|shrink|seal|zipper/.test(t)) return 'packaging';
  // Shipping/Courier
  if (/courier|shipping|delivery|freight|transport|st courier|delhivery|bluedart|dtdc|speed post|postage/.test(t)) return 'courier';
  // Advertising
  if (/ad\b|ads\b|advertis|meta|facebook|instagram|google|campaign|marketing|promo|poster|banner|influencer/.test(t)) return 'advertising';
  // Rent
  if (/rent|lease|office space|godown|warehouse space/.test(t)) return 'rent';
  // Utilities
  if (/electric|water|internet|wifi|phone|recharge|gas|power/.test(t)) return 'utilities';
  // Equipment
  if (/machine|sealer|printer|scale|weighing|label printer|helett|laptop|computer/.test(t)) return 'equipment';
  // Salary
  if (/salary|wage|labour|labor|helper|worker|staff|payroll/.test(t)) return 'salary';
  return 'misc';
}

function parseCSV(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

export default function BillCSVImport({ type = 'expense', onClose, onImportComplete }) {
  const { showToast } = useApp();
  const fileRef = useRef(null);
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  const isExpense = type === 'expense';

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      setCsvText(text);
      handlePreview(text);
    };
    reader.readAsText(file);
  };

  const handlePreview = (text) => {
    const parsed = parseCSV(text || csvText);
    if (parsed.rows.length === 0) {
      showToast('No data found in CSV', 'error');
      return;
    }
    setPreview(parsed);
  };

  const handleImport = async () => {
    if (!preview || preview.rows.length === 0) return;
    setImporting(true);

    let success = 0;
    let failed = 0;

    for (const row of preview.rows) {
      try {
        if (isExpense) {
          const expenseData = {
            expense_date: row.date || new Date().toISOString().split('T')[0],
            description: row.description || row.item || '',
            category: row.category || detectCategory(row.description || row.item || row.vendor || ''),
            vendor_name: row.vendor || '',
            amount: parseFloat(row.amount) || 0,
            gst_amount: parseFloat(row.gst_amount || row.gst) || 0,
            total_amount: parseFloat(row.total) || parseFloat(row.amount) || 0,
            payment_method: row.payment_method || row.payment || 'cash',
            payment_status: 'paid',
            bill_number: row.bill_number || row.invoice || '',
            notes: row.notes || '',
          };
          const { error } = await dbService.createExpense(expenseData);
          if (error) throw error;
          success++;
        } else {
          // Purchase Order - create PO with line items
          const poData = {
            order_date: row.date || new Date().toISOString().split('T')[0],
            vendor_name: row.vendor || '',
            status: row.status || 'received',
            items: [{
              name: row.item_name || row.item || row.description || '',
              quantity: parseFloat(row.quantity) || 1,
              unit: row.unit || 'pcs',
              unit_price: parseFloat(row.unit_price || row.price) || 0,
              gst_percent: parseFloat(row.gst_percent || row.gst) || 5,
              total: parseFloat(row.total) || 0,
            }],
            total_amount: parseFloat(row.total) || 0,
            notes: row.notes || '',
          };
          const { error } = await dbService.createPurchaseOrder(poData);
          if (error) throw error;
          success++;
        }
      } catch (err) {
        console.error('Import row error:', err);
        failed++;
      }
    }

    setResults({ success, failed });
    setImporting(false);

    if (success > 0) {
      showToast(`Imported ${success} ${isExpense ? 'expenses' : 'purchase orders'}!`, 'success');
    }
    if (failed > 0) {
      showToast(`${failed} rows failed to import`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">
              Import {isExpense ? 'Expenses' : 'Purchase Orders'} from CSV
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* AI Prompt Helper */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-900">How to use this:</p>
                <p className="text-xs text-blue-700 mt-1">
                  1. Take a photo of your bill/invoice<br />
                  2. Upload to ChatGPT or Gemini<br />
                  3. Use the prompt below to get CSV output<br />
                  4. Copy-paste or download the CSV here
                </p>
              </div>
              <button
                onClick={() => setShowPrompt(!showPrompt)}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {showPrompt ? 'Hide Prompt' : 'Show AI Prompt'}
              </button>
            </div>
            {showPrompt && (
              <div className="mt-3">
                <pre className="text-xs bg-white p-3 rounded border border-blue-200 whitespace-pre-wrap font-mono">
                  {AI_PROMPT_TEMPLATE}
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(AI_PROMPT_TEMPLATE);
                    showToast('Prompt copied!', 'success');
                  }}
                  className="mt-2 text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                >
                  Copy Prompt
                </button>
              </div>
            )}
          </div>

          {/* Upload Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* File Upload */}
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition"
            >
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700">Upload CSV File</p>
              <p className="text-xs text-gray-500 mt-1">.csv files only</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Paste CSV */}
            <div className="border border-gray-200 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-700 mb-2">Or paste CSV data:</p>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={isExpense ? EXPENSE_CSV_SAMPLE.split('\n').slice(0, 3).join('\n') : PO_CSV_SAMPLE.split('\n').slice(0, 3).join('\n')}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={() => handlePreview(csvText)}
                disabled={!csvText.trim()}
                className="mt-2 text-xs px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
              >
                Preview Data
              </button>
            </div>
          </div>

          {/* Sample CSV Format */}
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-700 font-medium">
              View sample CSV format
            </summary>
            <pre className="mt-2 bg-gray-50 p-3 rounded border border-gray-200 whitespace-pre-wrap font-mono overflow-x-auto">
              {isExpense ? EXPENSE_CSV_SAMPLE : PO_CSV_SAMPLE}
            </pre>
          </details>

          {/* Preview Table */}
          {preview && preview.rows.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Preview ({preview.rows.length} rows)
              </h3>
              <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {preview.headers.map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                        {preview.headers.map(h => (
                          <td key={h} className="px-3 py-2 text-gray-700 whitespace-nowrap">
                            {row[h] || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Results */}
          {results && (
            <div className={`p-4 rounded-lg ${results.failed > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'} border`}>
              <div className="flex items-center gap-2">
                {results.failed > 0 ? (
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                ) : (
                  <Check className="w-5 h-5 text-green-600" />
                )}
                <p className="text-sm font-medium">
                  {results.success} imported successfully
                  {results.failed > 0 && `, ${results.failed} failed`}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleImport}
              disabled={!preview || preview.rows.length === 0 || importing}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              {importing ? (
                <>Importing...</>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Import {preview?.rows.length || 0} {isExpense ? 'Expenses' : 'POs'}
                </>
              )}
            </button>
            <button
              onClick={() => {
                if (results?.success > 0 && onImportComplete) onImportComplete();
                onClose();
              }}
              className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700"
            >
              {results ? 'Done' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
