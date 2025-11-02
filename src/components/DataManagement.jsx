import React, { useRef } from 'react';
import { Download, Upload, FileSpreadsheet, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext';

export default function DataManagement() {
  const { state, dispatch, showToast } = useApp();
  const fileInputRef = useRef(null);

  // Export all data to Excel
  const handleExportExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();

      // Vendors Sheet
      if (state.vendors.length > 0) {
        const vendorsData = [];
        state.vendors.forEach(vendor => {
          vendor.ingredients.forEach(ing => {
            vendorsData.push({
              'Vendor Name': vendor.name,
              'Vendor Phone': vendor.phone,
              'Vendor Location': vendor.location,
              'Vendor Email': vendor.email || '',
              'Ingredient Name': ing.name,
              'Quantity Available': ing.quantityAvailable,
              'Unit': ing.unit,
              'Price per Unit (₹)': ing.pricePerUnit,
              'Quality Rating': ing.quality,
              'Notes': ing.notes || '',
            });
          });
        });
        const vendorsSheet = XLSX.utils.json_to_sheet(vendorsData);
        XLSX.utils.book_append_sheet(workbook, vendorsSheet, 'Vendors');
      }

      // SKUs Sheet
      if (state.skus.length > 0) {
        const skusData = [];
        state.skus.forEach(sku => {
          ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].forEach(day => {
            sku.recipes[day].forEach(recipe => {
              skusData.push({
                'SKU Name': sku.name,
                'Description': sku.description,
                'Target Weight (g)': sku.targetWeightPerSachet,
                'Day': day,
                'Ingredient': recipe.ingredientName,
                'Grams per Sachet': recipe.gramsPerSachet,
                'Percentage': recipe.percentage,
                'Vendor': recipe.vendorName,
                'Price per Gram (₹)': recipe.pricePerGram,
              });
            });
          });
        });
        const skusSheet = XLSX.utils.json_to_sheet(skusData);
        XLSX.utils.book_append_sheet(workbook, skusSheet, 'SKUs');
      }

      // Pricing Sheet
      if (state.pricingStrategies.length > 0) {
        const pricingData = state.pricingStrategies.map(p => ({
          'SKU Name': p.skuName,
          'Pack Type': p.packType === 'weekly' ? 'Weekly' : 'Monthly',
          'Raw Material Cost (₹)': p.rawMaterialCost,
          'Sachet Packaging Cost (₹)': p.sachetPackagingCost,
          'Pack Box Cost (₹)': p.packBoxCost,
          'Operating Cost (₹)': p.operatingCost,
          'Marketing Cost (₹)': p.marketingCost,
          'Shipping Cost (₹)': p.shippingCost,
          'Other Costs (₹)': p.otherCosts,
          'Total Cost (₹)': p.totalCost,
          'Profit Margin (%)': p.profitMargin,
          'Profit Amount (₹)': p.profitAmount,
          'Selling Price (₹)': p.sellingPrice,
        }));
        const pricingSheet = XLSX.utils.json_to_sheet(pricingData);
        XLSX.utils.book_append_sheet(workbook, pricingSheet, 'Pricing');
      }

      // Sales Targets Sheet
      if (state.salesTargets.length > 0) {
        const salesData = [];
        state.salesTargets.forEach(target => {
          target.targets.forEach(t => {
            salesData.push({
              'Month': new Date(target.year, target.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
              'SKU Name': t.skuName,
              'Pack Type': t.packType === 'weekly' ? 'Weekly' : 'Monthly',
              'Target Units': t.targetUnits,
              'Selling Price (₹)': t.sellingPrice,
              'Cost per Unit (₹)': t.costPerUnit,
              'Profit per Unit (₹)': t.profitPerUnit,
              'Projected Revenue (₹)': t.projectedRevenue,
              'Projected Profit (₹)': t.projectedProfit,
            });
          });
        });
        const salesSheet = XLSX.utils.json_to_sheet(salesData);
        XLSX.utils.book_append_sheet(workbook, salesSheet, 'Sales Targets');
      }

      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `WKLY-Nuts-Data-${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);

      showToast('Data exported to Excel successfully!', 'success');
    } catch (error) {
      console.error('Export error:', error);
      showToast('Error exporting data to Excel', 'error');
    }
  };

  // Export raw JSON backup
  const handleExportJSON = () => {
    try {
      const dataToExport = {
        vendors: state.vendors,
        skus: state.skus,
        pricingStrategies: state.pricingStrategies,
        salesTargets: state.salesTargets,
        exportedAt: new Date().toISOString(),
        version: '1.0',
      };

      const jsonString = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `WKLY-Nuts-Backup-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);

      showToast('Backup file downloaded successfully!', 'success');
    } catch (error) {
      console.error('Export error:', error);
      showToast('Error creating backup file', 'error');
    }
  };

  // Import JSON backup
  const handleImportJSON = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);

        // Validate data structure
        if (!importedData.vendors || !importedData.skus || !importedData.pricingStrategies || !importedData.salesTargets) {
          showToast('Invalid backup file format', 'error');
          return;
        }

        // Confirm before importing
        const confirmMessage = `This will replace all current data with the backup from ${
          importedData.exportedAt ? new Date(importedData.exportedAt).toLocaleString() : 'unknown date'
        }. Continue?`;

        if (window.confirm(confirmMessage)) {
          // Import data by dispatching actions
          // First, clear existing data
          localStorage.removeItem('wklyNutsAppData');

          // Then set new data
          localStorage.setItem('wklyNutsAppData', JSON.stringify({
            vendors: importedData.vendors,
            skus: importedData.skus,
            pricingStrategies: importedData.pricingStrategies,
            salesTargets: importedData.salesTargets,
          }));

          // Reload page to load new data
          window.location.reload();
          
          showToast('Data imported successfully!', 'success');
        }
      } catch (error) {
        console.error('Import error:', error);
        showToast('Error importing data. Please check the file format.', 'error');
      }
    };

    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  };

  // Clear all data
  const handleClearData = () => {
    if (window.confirm('⚠️ Are you sure you want to delete ALL data? This cannot be undone!\n\nTip: Export a backup first!')) {
      localStorage.removeItem('wklyNutsAppData');
      window.location.reload();
      showToast('All data cleared successfully', 'success');
    }
  };

  const hasData = state.vendors.length > 0 || state.skus.length > 0 || 
                  state.pricingStrategies.length > 0 || state.salesTargets.length > 0;

  return (
    <div className="card bg-gradient-to-br from-blue-50 to-primary-50 border-2 border-primary-200">
      <div className="flex items-center gap-3 mb-4">
        <FileSpreadsheet className="w-6 h-6 text-primary" />
        <h3 className="text-lg font-bold text-gray-900">Data Management</h3>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Export your data to Excel or create a backup. Import to restore previous data.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Export to Excel */}
        <button
          onClick={handleExportExcel}
          disabled={!hasData}
          className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Export all data to Excel file"
        >
          <Download className="w-4 h-4" />
          Export Excel
        </button>

        {/* Export JSON Backup */}
        <button
          onClick={handleExportJSON}
          disabled={!hasData}
          className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Export complete backup file (JSON)"
        >
          <Download className="w-4 h-4" />
          Backup (JSON)
        </button>

        {/* Import JSON Backup */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          title="Import backup file to restore data"
        >
          <Upload className="w-4 h-4" />
          Import Backup
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportJSON}
          className="hidden"
        />

        {/* Clear All Data */}
        <button
          onClick={handleClearData}
          className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          title="Delete all data and start fresh"
        >
          <Trash2 className="w-4 h-4" />
          Clear All Data
        </button>
      </div>

      {/* Data Stats */}
      {hasData && (
        <div className="mt-4 pt-4 border-t border-primary-200">
          <p className="text-xs text-gray-600">
            Current data: {state.vendors.length} vendors, {state.skus.length} SKUs, 
            {' '}{state.pricingStrategies.length} pricing strategies, {state.salesTargets.length} sales targets
          </p>
        </div>
      )}

      {!hasData && (
        <div className="mt-4 pt-4 border-t border-primary-200">
          <p className="text-xs text-gray-500 italic">
            No data to export. Start by creating vendors and SKUs, or import a backup file.
          </p>
        </div>
      )}
    </div>
  );
}
