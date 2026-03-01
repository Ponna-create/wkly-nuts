import React, { useState } from 'react';
import { Database, Download, Upload, Check, AlertCircle, Clock, HardDrive, Loader2, RefreshCw } from 'lucide-react';
import { dbService } from '../services/supabase';
import { useApp } from '../context/AppContext';

export default function BackupSettings() {
  const { showToast } = useApp();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [lastBackup, setLastBackup] = useState(
    localStorage.getItem('wklyNutsLastBackup') || null
  );

  // ==========================================
  // EXPORT BACKUP
  // ==========================================
  const handleExport = async () => {
    setExporting(true);
    try {
      // Fetch ALL data from Supabase
      const [
        ordersRes, expensesRes, posRes, docsRes, prodRes,
        vendorsRes, skusRes, customersRes, invoicesRes, inventoryRes,
        ingredientsRes, packagingRes, packTxnRes
      ] = await Promise.all([
        dbService.getSalesOrders(),
        dbService.getExpenses(),
        dbService.getPurchaseOrders(),
        dbService.getDocuments(),
        dbService.getProductionRuns(),
        dbService.getVendors(),
        dbService.getSKUs(),
        dbService.getCustomers(),
        dbService.getInvoices(),
        dbService.getInventory(),
        dbService.getIngredients(),
        dbService.getPackagingMaterials(),
        dbService.getPackagingTransactions(),
      ]);

      const backup = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        appName: 'WKLY Nuts Business OS',
        data: {
          salesOrders: ordersRes.data || [],
          expenses: expensesRes.data || [],
          purchaseOrders: posRes.data || [],
          documents: docsRes.data || [],
          productionRuns: prodRes.data || [],
          vendors: vendorsRes.data || [],
          skus: skusRes.data || [],
          customers: customersRes.data || [],
          invoices: invoicesRes.data || [],
          inventory: inventoryRes.data || [],
          ingredients: ingredientsRes.data || [],
          packagingMaterials: packagingRes.data || [],
          packagingTransactions: packTxnRes.data || [],
        },
        counts: {
          salesOrders: (ordersRes.data || []).length,
          expenses: (expensesRes.data || []).length,
          purchaseOrders: (posRes.data || []).length,
          documents: (docsRes.data || []).length,
          productionRuns: (prodRes.data || []).length,
          vendors: (vendorsRes.data || []).length,
          skus: (skusRes.data || []).length,
          customers: (customersRes.data || []).length,
          invoices: (invoicesRes.data || []).length,
          inventory: (inventoryRes.data || []).length,
          ingredients: (ingredientsRes.data || []).length,
          packagingMaterials: (packagingRes.data || []).length,
          packagingTransactions: (packTxnRes.data || []).length,
        },
      };

      // Also save WhatsApp templates
      try {
        const templates = localStorage.getItem('wklyNutsWhatsAppTemplates');
        if (templates) backup.data.whatsappTemplates = JSON.parse(templates);
      } catch (e) { /* ignore */ }

      // Download as JSON file
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `wkly-nuts-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const now = new Date().toISOString();
      localStorage.setItem('wklyNutsLastBackup', now);
      setLastBackup(now);

      showToast(`Backup exported! ${Object.values(backup.counts).reduce((a, b) => a + b, 0)} total records`, 'success');
    } catch (error) {
      console.error('Backup error:', error);
      showToast('Failed to export backup', 'error');
    }
    setExporting(false);
  };

  // ==========================================
  // IMPORT BACKUP (restore)
  // ==========================================
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      setImporting(true);
      setImportResult(null);

      try {
        const text = await file.text();
        const backup = JSON.parse(text);

        if (!backup.version || !backup.data) {
          throw new Error('Invalid backup file format');
        }

        // Show summary before restoring
        const counts = backup.counts || {};
        setImportResult({
          type: 'preview',
          file: file.name,
          date: backup.exportDate,
          counts,
          backup,
        });
      } catch (error) {
        console.error('Import error:', error);
        showToast('Invalid backup file', 'error');
        setImportResult({ type: 'error', message: error.message });
      }
      setImporting(false);
    };
    input.click();
  };

  const confirmRestore = async () => {
    if (!importResult?.backup) return;
    setImporting(true);

    const backup = importResult.backup;
    let restored = 0;
    let errors = 0;

    // Restore WhatsApp templates
    if (backup.data.whatsappTemplates) {
      try {
        localStorage.setItem('wklyNutsWhatsAppTemplates', JSON.stringify(backup.data.whatsappTemplates));
        restored++;
      } catch (e) { errors++; }
    }

    // Save backup data to localStorage as fallback
    try {
      localStorage.setItem('wklyNutsBackupData', JSON.stringify(backup.data));
      restored++;
    } catch (e) { errors++; }

    setImportResult({
      type: 'done',
      restored,
      errors,
      message: `Backup data saved locally. ${Object.values(backup.counts || {}).reduce((a, b) => a + b, 0)} records available. Refresh the page to load the data.`,
    });
    setImporting(false);
    showToast('Backup restored! Templates and local cache updated.', 'success');
  };

  // ==========================================
  // AUTO-SAVE to localStorage
  // ==========================================
  const handleLocalSnapshot = async () => {
    setExporting(true);
    try {
      const [ordersRes, expensesRes, vendorsRes, customersRes] = await Promise.all([
        dbService.getSalesOrders(),
        dbService.getExpenses(),
        dbService.getVendors(),
        dbService.getCustomers(),
      ]);

      const snapshot = {
        date: new Date().toISOString(),
        salesOrders: ordersRes.data || [],
        expenses: expensesRes.data || [],
        vendors: vendorsRes.data || [],
        customers: customersRes.data || [],
      };

      localStorage.setItem('wklyNutsLocalSnapshot', JSON.stringify(snapshot));
      showToast('Local snapshot saved! Available offline.', 'success');
    } catch (error) {
      showToast('Failed to create local snapshot', 'error');
    }
    setExporting(false);
  };

  const localSnapshot = (() => {
    try {
      const s = localStorage.getItem('wklyNutsLocalSnapshot');
      if (s) return JSON.parse(s);
    } catch (e) { /* ignore */ }
    return null;
  })();

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Backup & Settings</h1>
        <p className="text-gray-600 mt-1">Export, import, and manage your business data</p>
      </div>

      {/* Backup Status */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Database className="w-6 h-6 text-teal-600" />
          <h2 className="text-lg font-semibold text-gray-900">Data Backup</h2>
        </div>

        {lastBackup && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-green-50 rounded-lg">
            <Check className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-800">
              Last backup: {new Date(lastBackup).toLocaleString('en-IN')}
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Export */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-teal-300 rounded-lg hover:bg-teal-50 hover:border-teal-400 transition disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
            ) : (
              <Download className="w-8 h-8 text-teal-600" />
            )}
            <div className="text-center">
              <p className="font-semibold text-gray-900">{exporting ? 'Exporting...' : 'Export Backup'}</p>
              <p className="text-xs text-gray-500 mt-1">Download all data as JSON file</p>
              <p className="text-xs text-gray-400">Save on your business laptop</p>
            </div>
          </button>

          {/* Import */}
          <button
            onClick={handleImport}
            disabled={importing}
            className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-blue-300 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition disabled:opacity-50"
          >
            {importing ? (
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            ) : (
              <Upload className="w-8 h-8 text-blue-600" />
            )}
            <div className="text-center">
              <p className="font-semibold text-gray-900">{importing ? 'Importing...' : 'Import Backup'}</p>
              <p className="text-xs text-gray-500 mt-1">Restore from a backup file</p>
              <p className="text-xs text-gray-400">Use when Supabase is down</p>
            </div>
          </button>
        </div>
      </div>

      {/* Import Preview/Result */}
      {importResult && importResult.type === 'preview' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Backup Preview: {importResult.file}</h3>
          <p className="text-xs text-blue-700 mb-3">
            Exported on: {new Date(importResult.date).toLocaleString('en-IN')}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {Object.entries(importResult.counts).map(([key, count]) => (
              <div key={key} className="bg-white rounded p-2 text-center">
                <p className="text-lg font-bold text-blue-900">{count}</p>
                <p className="text-[10px] text-blue-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={confirmRestore} disabled={importing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
              <Upload className="w-4 h-4" /> Restore This Backup
            </button>
            <button onClick={() => setImportResult(null)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {importResult && importResult.type === 'done' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Check className="w-5 h-5 text-green-600" />
            <p className="text-sm font-medium text-green-900">Restore Complete</p>
          </div>
          <p className="text-sm text-green-700">{importResult.message}</p>
        </div>
      )}

      {importResult && importResult.type === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-sm text-red-700">{importResult.message}</p>
          </div>
        </div>
      )}

      {/* Local Snapshot */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <HardDrive className="w-6 h-6 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Quick Local Snapshot</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Save a quick snapshot of key data (orders, expenses, vendors, customers) to this browser's local storage.
          Useful when you want offline access to recent data.
        </p>

        {localSnapshot && (
          <div className="flex items-center gap-2 mb-3 p-3 bg-gray-50 rounded-lg">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              Last snapshot: {new Date(localSnapshot.date).toLocaleString('en-IN')}
              {' '}({localSnapshot.salesOrders?.length || 0} orders, {localSnapshot.expenses?.length || 0} expenses)
            </span>
          </div>
        )}

        <button onClick={handleLocalSnapshot} disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-medium disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${exporting ? 'animate-spin' : ''}`} />
          {exporting ? 'Saving...' : 'Save Local Snapshot'}
        </button>
      </div>

      {/* Tips */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-amber-900 mb-2">Backup Tips</h3>
        <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
          <li>Export a full backup <strong>every week</strong> to your business laptop</li>
          <li>Keep the backup JSON file in a dedicated folder (e.g., D:\WKLY Nuts Backups\)</li>
          <li>The backup includes ALL data: orders, expenses, vendors, customers, production, etc.</li>
          <li>If Supabase is down, use "Import Backup" to restore your data locally</li>
          <li>Document files (images/PDFs) are stored in Supabase Storage separately - download important ones manually</li>
        </ul>
      </div>
    </div>
  );
}
