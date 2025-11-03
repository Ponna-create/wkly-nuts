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

  // Import JSON backup - MERGE mode (adds to existing data)
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

        // Ask user what to do
        const backupDate = importedData.exportedAt ? new Date(importedData.exportedAt).toLocaleString() : 'unknown date';
        const choice = window.confirm(
          `Import backup from ${backupDate}?\n\n` +
          `✅ OK = MERGE (add to existing data)\n` +
          `❌ Cancel = REPLACE (delete all current data first)\n\n` +
          `Click OK to merge, or Cancel to replace.`
        );

        const shouldMerge = choice; // OK = merge (true), Cancel = replace (false)

        if (!shouldMerge) {
          // REPLACE MODE: Clear existing data first
          const replaceConfirm = window.confirm(
            `⚠️ WARNING: This will DELETE all current data and replace with backup!\n\n` +
            `Current: ${state.vendors.length} vendors, ${state.skus.length} SKUs\n` +
            `Backup: ${importedData.vendors.length} vendors, ${importedData.skus.length} SKUs\n\n` +
            `Are you sure you want to REPLACE all data?`
          );
          
          if (!replaceConfirm) {
            event.target.value = ''; // Reset file input
            return;
          }

          // Delete existing data
          state.vendors.forEach(v => dispatch({ type: 'DELETE_VENDOR', payload: v.id }));
          state.skus.forEach(s => dispatch({ type: 'DELETE_SKU', payload: s.id }));
          state.pricingStrategies.forEach(p => dispatch({ type: 'DELETE_PRICING', payload: p.id }));
          state.salesTargets.forEach(t => dispatch({ type: 'DELETE_SALES_TARGET', payload: t.id }));
        }

        // Get existing IDs to avoid duplicates when merging
        const existingVendorIds = new Set(state.vendors.map(v => String(v.id)));
        const existingSKUIds = new Set(state.skus.map(s => String(s.id)));
        const existingPricingIds = new Set(state.pricingStrategies.map(p => String(p.id)));
        const existingSalesTargetIds = new Set(state.salesTargets.map(t => String(t.id)));

        let addedCount = { vendors: 0, skus: 0, pricing: 0, targets: 0 };
        let skippedCount = { vendors: 0, skus: 0, pricing: 0, targets: 0 };

        // Add imported vendors (merge: generate new IDs, replace: use existing IDs)
        importedData.vendors.forEach((vendor, idx) => {
          if (shouldMerge && existingVendorIds.has(String(vendor.id))) {
            // Skip exact duplicate IDs when merging
            skippedCount.vendors++;
          } else {
            // Generate new ID if merging (to avoid conflicts)
            const vendorToAdd = shouldMerge 
              ? { ...vendor, id: `imported_vendor_${Date.now()}_${idx}_${Math.random()}` }
              : vendor;
            dispatch({ type: 'ADD_VENDOR', payload: vendorToAdd });
            addedCount.vendors++;
          }
        });
        
        // Add imported SKUs
        importedData.skus.forEach((sku, idx) => {
          if (shouldMerge && existingSKUIds.has(String(sku.id))) {
            skippedCount.skus++;
          } else {
            const skuToAdd = shouldMerge 
              ? { ...sku, id: `imported_sku_${Date.now()}_${idx}_${Math.random()}` }
              : sku;
            dispatch({ type: 'ADD_SKU', payload: skuToAdd });
            addedCount.skus++;
          }
        });
        
        // Add imported pricing strategies (always add when merging, as they're unique per SKU+PackType)
        importedData.pricingStrategies.forEach((pricing, idx) => {
          if (shouldMerge && existingPricingIds.has(String(pricing.id))) {
            skippedCount.pricing++;
          } else {
            const pricingToAdd = shouldMerge 
              ? { ...pricing, id: `imported_pricing_${Date.now()}_${idx}_${Math.random()}` }
              : pricing;
            dispatch({ type: 'ADD_PRICING', payload: pricingToAdd });
            addedCount.pricing++;
          }
        });
        
        // Add imported sales targets
        importedData.salesTargets.forEach((target, idx) => {
          if (shouldMerge && existingSalesTargetIds.has(String(target.id))) {
            skippedCount.targets++;
          } else {
            const targetToAdd = shouldMerge 
              ? { ...target, id: `imported_sales_${Date.now()}_${idx}_${Math.random()}` }
              : target;
            dispatch({ type: 'ADD_SALES_TARGET', payload: targetToAdd });
            addedCount.targets++;
          }
        });

        // Show summary
        const mergeMsg = shouldMerge 
          ? `Merged: ${addedCount.vendors} vendors, ${addedCount.skus} SKUs, ${addedCount.pricing} pricing, ${addedCount.targets} targets. Skipped duplicates.`
          : `Replaced: ${addedCount.vendors} vendors, ${addedCount.skus} SKUs, ${addedCount.pricing} pricing, ${addedCount.targets} targets.`;
        
        showToast(mergeMsg, 'success');
        
        // Reload after a delay to sync with database
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (error) {
        console.error('Import error:', error);
        showToast('Error importing data. Please check the file format.', 'error');
      }
    };

    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  };

  // Import Excel file - converts Excel format back to app data structure
  const handleImportExcel = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Parse each sheet
        const importedData = {
          vendors: [],
          skus: [],
          pricingStrategies: [],
          salesTargets: [],
        };

        // Parse Vendors sheet
        if (workbook.SheetNames.includes('Vendors')) {
          const vendorsSheet = workbook.Sheets[workbook.SheetNames[workbook.SheetNames.indexOf('Vendors')]];
          const vendorsData = XLSX.utils.sheet_to_json(vendorsSheet);
          
          // Group by vendor name
          const vendorMap = new Map();
          let vendorIdCounter = Date.now();
          vendorsData.forEach(row => {
            const vendorName = row['Vendor Name'];
            if (!vendorMap.has(vendorName)) {
              vendorMap.set(vendorName, {
                id: `vendor_${vendorIdCounter++}`,
                name: vendorName,
                phone: row['Vendor Phone'] || '',
                location: row['Vendor Location'] || '',
                email: row['Vendor Email'] || '',
                ingredients: []
              });
            }
            vendorMap.get(vendorName).ingredients.push({
              id: `ingredient_${Date.now()}_${Math.random()}`,
              name: row['Ingredient Name'] || '',
              quantityAvailable: parseFloat(row['Quantity Available']) || 0,
              unit: row['Unit'] || 'kg',
              pricePerUnit: parseFloat(row['Price per Unit (₹)']) || 0,
              quality: parseFloat(row['Quality Rating']) || 5,
              notes: row['Notes'] || '',
            });
          });
          importedData.vendors = Array.from(vendorMap.values());
        }

        // Parse SKUs sheet
        if (workbook.SheetNames.includes('SKUs')) {
          const skusSheet = workbook.Sheets[workbook.SheetNames[workbook.SheetNames.indexOf('SKUs')]];
          const skusData = XLSX.utils.sheet_to_json(skusSheet);
          
          // Group by SKU name
          const skuMap = new Map();
          let skuIdCounter = Date.now() + 1000000;
          skusData.forEach(row => {
            const skuName = row['SKU Name'];
            if (!skuMap.has(skuName)) {
              skuMap.set(skuName, {
                id: `sku_${skuIdCounter++}`,
                name: skuName,
                description: row['Description'] || '',
                targetWeightPerSachet: parseFloat(row['Target Weight (g)']) || 0,
                recipes: {
                  MON: [], TUE: [], WED: [], THU: [], FRI: [], SAT: [], SUN: []
                }
              });
            }
            const day = row['Day'] || 'MON';
            if (skuMap.get(skuName).recipes[day]) {
              skuMap.get(skuName).recipes[day].push({
                id: `recipe_${Date.now()}_${Math.random()}`,
                ingredientName: row['Ingredient'] || '',
                gramsPerSachet: parseFloat(row['Grams per Sachet']) || 0,
                percentage: parseFloat(row['Percentage']) || 0,
                vendorName: row['Vendor'] || '',
                pricePerGram: parseFloat(row['Price per Gram (₹)']) || 0,
              });
            }
          });
          importedData.skus = Array.from(skuMap.values());
        }

        // Parse Pricing sheet
        if (workbook.SheetNames.includes('Pricing')) {
          const pricingSheet = workbook.Sheets[workbook.SheetNames[workbook.SheetNames.indexOf('Pricing')]];
          const pricingData = XLSX.utils.sheet_to_json(pricingSheet);
          
          let pricingIdCounter = Date.now() + 2000000;
          importedData.pricingStrategies = pricingData.map((row, idx) => ({
            id: `pricing_${pricingIdCounter++}_${idx}`,
            skuName: row['SKU Name'] || '',
            packType: (row['Pack Type'] || 'Weekly').toLowerCase() === 'weekly' ? 'weekly' : 'monthly',
            rawMaterialCost: parseFloat(row['Raw Material Cost (₹)']) || 0,
            sachetPackagingCost: parseFloat(row['Sachet Packaging Cost (₹)']) || 0,
            packBoxCost: parseFloat(row['Pack Box Cost (₹)']) || 0,
            operatingCost: parseFloat(row['Operating Cost (₹)']) || 0,
            marketingCost: parseFloat(row['Marketing Cost (₹)']) || 0,
            shippingCost: parseFloat(row['Shipping Cost (₹)']) || 0,
            otherCosts: parseFloat(row['Other Costs (₹)']) || 0,
            totalCost: parseFloat(row['Total Cost (₹)']) || 0,
            profitMargin: parseFloat(row['Profit Margin (%)']) || 0,
            profitAmount: parseFloat(row['Profit Amount (₹)']) || 0,
            sellingPrice: parseFloat(row['Selling Price (₹)']) || 0,
          }));
        }

        // Parse Sales Targets sheet
        if (workbook.SheetNames.includes('Sales Targets')) {
          const salesSheet = workbook.Sheets[workbook.SheetNames[workbook.SheetNames.indexOf('Sales Targets')]];
          const salesData = XLSX.utils.sheet_to_json(salesSheet);
          
          // Group by month/year
          const salesMap = new Map();
          salesData.forEach(row => {
            const monthStr = row['Month'] || '';
            // Parse month string like "January 2024" or "1/2024"
            let month, year;
            try {
              const date = new Date(monthStr);
              if (!isNaN(date.getTime())) {
                month = date.getMonth();
                year = date.getFullYear();
              } else {
                // Fallback: try to extract from string
                const match = monthStr.match(/(\d{1,2})\/(\d{4})/);
                if (match) {
                  month = parseInt(match[1]) - 1;
                  year = parseInt(match[2]);
                } else {
                  month = new Date().getMonth();
                  year = new Date().getFullYear();
                }
              }
            } catch {
              month = new Date().getMonth();
              year = new Date().getFullYear();
            }
            
            const key = `${year}-${month}`;
            if (!salesMap.has(key)) {
              salesMap.set(key, {
                id: `sales_${Date.now()}_${Math.random()}`,
                year: year,
                month: month,
                targets: []
              });
            }
            salesMap.get(key).targets.push({
              id: `target_${Date.now()}_${Math.random()}`,
              skuName: row['SKU Name'] || '',
              packType: (row['Pack Type'] || 'Weekly').toLowerCase() === 'weekly' ? 'weekly' : 'monthly',
              targetUnits: parseFloat(row['Target Units']) || 0,
              sellingPrice: parseFloat(row['Selling Price (₹)']) || 0,
              costPerUnit: parseFloat(row['Cost per Unit (₹)']) || 0,
              profitPerUnit: parseFloat(row['Profit per Unit (₹)']) || 0,
              projectedRevenue: parseFloat(row['Projected Revenue (₹)']) || 0,
              projectedProfit: parseFloat(row['Projected Profit (₹)']) || 0,
            });
          });
          importedData.salesTargets = Array.from(salesMap.values());
        }

        // Ask user what to do (merge or replace)
        const choice = window.confirm(
          `Import Excel file?\n\n` +
          `Found: ${importedData.vendors.length} vendors, ${importedData.skus.length} SKUs, ` +
          `${importedData.pricingStrategies.length} pricing strategies, ${importedData.salesTargets.length} sales targets\n\n` +
          `✅ OK = MERGE (add to existing data)\n` +
          `❌ Cancel = REPLACE (delete all current data first)`
        );

        const shouldMerge = choice;

        if (!shouldMerge) {
          const replaceConfirm = window.confirm(
            `⚠️ WARNING: This will DELETE all current data and replace with Excel import!\n\n` +
            `Current: ${state.vendors.length} vendors, ${state.skus.length} SKUs\n` +
            `Import: ${importedData.vendors.length} vendors, ${importedData.skus.length} SKUs\n\n` +
            `Are you sure?`
          );
          
          if (!replaceConfirm) {
            event.target.value = '';
            return;
          }

          // Delete existing data
          state.vendors.forEach(v => dispatch({ type: 'DELETE_VENDOR', payload: v.id }));
          state.skus.forEach(s => dispatch({ type: 'DELETE_SKU', payload: s.id }));
          state.pricingStrategies.forEach(p => dispatch({ type: 'DELETE_PRICING', payload: p.id }));
          state.salesTargets.forEach(t => dispatch({ type: 'DELETE_SALES_TARGET', payload: t.id }));
        }

        // Get existing IDs
        const existingVendorNames = new Set(state.vendors.map(v => v.name.toLowerCase()));
        const existingSKUNames = new Set(state.skus.map(s => s.name.toLowerCase()));

        let addedCount = { vendors: 0, skus: 0, pricing: 0, targets: 0 };
        let skippedCount = { vendors: 0, skus: 0, pricing: 0, targets: 0 };

        // Add vendors
        importedData.vendors.forEach(vendor => {
          if (shouldMerge && existingVendorNames.has(vendor.name.toLowerCase())) {
            skippedCount.vendors++;
          } else {
            dispatch({ type: 'ADD_VENDOR', payload: vendor });
            addedCount.vendors++;
            if (shouldMerge) existingVendorNames.add(vendor.name.toLowerCase());
          }
        });

        // Add SKUs
        importedData.skus.forEach(sku => {
          if (shouldMerge && existingSKUNames.has(sku.name.toLowerCase())) {
            skippedCount.skus++;
          } else {
            dispatch({ type: 'ADD_SKU', payload: sku });
            addedCount.skus++;
            if (shouldMerge) existingSKUNames.add(sku.name.toLowerCase());
          }
        });

        // Add pricing strategies
        importedData.pricingStrategies.forEach(pricing => {
          dispatch({ type: 'ADD_PRICING', payload: pricing });
          addedCount.pricing++;
        });

        // Add sales targets
        importedData.salesTargets.forEach(target => {
          dispatch({ type: 'ADD_SALES_TARGET', payload: target });
          addedCount.targets++;
        });

        const mergeMsg = shouldMerge 
          ? `Merged: ${addedCount.vendors} vendors, ${addedCount.skus} SKUs, ${addedCount.pricing} pricing, ${addedCount.targets} targets.`
          : `Replaced: ${addedCount.vendors} vendors, ${addedCount.skus} SKUs, ${addedCount.pricing} pricing, ${addedCount.targets} targets.`;
        
        showToast(mergeMsg, 'success');
        
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (error) {
        console.error('Excel import error:', error);
        showToast('Error importing Excel file. Please ensure it was exported from this app.', 'error');
      }
    };

    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  // Clear all data
  const handleClearData = () => {
    if (window.confirm('⚠️ Are you sure you want to delete ALL data? This cannot be undone!\n\nTip: Export a backup first!')) {
      // Delete from database first (if configured), then clear local storage
      state.vendors.forEach(v => dispatch({ type: 'DELETE_VENDOR', payload: v.id }));
      state.skus.forEach(s => dispatch({ type: 'DELETE_SKU', payload: s.id }));
      state.pricingStrategies.forEach(p => dispatch({ type: 'DELETE_PRICING', payload: p.id }));
      state.salesTargets.forEach(t => dispatch({ type: 'DELETE_SALES_TARGET', payload: t.id }));
      
      // Also clear localStorage
      localStorage.removeItem('wklyNutsAppData');
      
      showToast('All data cleared successfully. Reloading...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
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
        Export your data to Excel or create a backup. Import JSON backups or Excel files (.xlsx). 
        You can choose to merge (add to existing) or replace all data when importing.
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

        {/* Import - supports both JSON and Excel */}
        <div className="relative">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 w-full"
            title="Import backup file (JSON) or Excel file (.xlsx)"
          >
            <Upload className="w-4 h-4" />
            Import (JSON/Excel)
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.xlsx,.xls"
            onChange={(e) => {
              const file = e.target.files[0];
              if (!file) return;
              const ext = file.name.split('.').pop()?.toLowerCase();
              if (ext === 'json') {
                handleImportJSON(e);
              } else if (ext === 'xlsx' || ext === 'xls') {
                handleImportExcel(e);
              } else {
                showToast('Please select a JSON or Excel file', 'error');
                e.target.value = '';
              }
            }}
            className="hidden"
          />
        </div>

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
