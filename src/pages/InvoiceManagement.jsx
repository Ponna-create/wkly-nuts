import React, { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, Search, X, FileText, CheckCircle, AlertCircle, Clock, DollarSign, Package, User, Save, Printer, Download } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dbService, isSupabaseAvailable } from '../services/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logo from '../assets/wkly-nuts-logo.png';

export default function InvoiceManagement() {
  const { state, dispatch, showToast } = useApp();
  const { invoices, customers, skus, pricingStrategies, inventory } = state;
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [formData, setFormData] = useState({
    customerId: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    items: [],
    gstRate: 5, // GST Rate: 5% or 12%
    discountAmount: 0,
    discountPercent: 0,
    shippingCharge: 0,
    advancePaid: 0,
    notes: '',
    terms: 'Payment due within 15 days',
    status: 'draft',
  });

  const [currentItem, setCurrentItem] = useState({
    skuId: '',
    packType: 'weekly', // 'weekly', 'monthly', or 'single' for single unit SKUs
    quantity: '',
    unitPrice: '',
    priceOverridden: false,
  });

  // Get pricing for SKU and pack type
  const getPricingForSku = (skuId, packType) => {
    return pricingStrategies.find(
      (p) => String(p.skuId) === String(skuId) && p.packType === packType
    );
  };

  // Get stock for SKU and pack type
  const getStockForSku = (skuId, packType) => {
    const inv = inventory.find(inv => String(inv.skuId) === String(skuId));
    if (!inv) return 0;
    if (packType === 'single') {
      return inv.singleUnitsAvailable || 0;
    }
    return packType === 'weekly' ? inv.weeklyPacksAvailable : inv.monthlyPacksAvailable;
  };

  // Handle SKU selection - auto-fetch price
  const handleSkuChange = (skuId) => {
    const sku = skus.find(s => String(s.id) === String(skuId));
    if (!sku) return;

    // Auto-set packType based on SKU type
    const defaultPackType = sku.skuType === 'single' ? 'single' : 'weekly';

    setCurrentItem({
      ...currentItem,
      skuId,
      packType: defaultPackType,
      priceOverridden: false,
    });

    // Auto-fetch price from pricing strategy
    const pricing = getPricingForSku(skuId, defaultPackType);
    if (pricing && pricing.sellingPrice) {
      setCurrentItem({
        ...currentItem,
        skuId,
        packType: defaultPackType,
        unitPrice: pricing.sellingPrice.toString(),
        priceOverridden: false,
      });
    } else {
      setCurrentItem({
        ...currentItem,
        skuId,
        packType: defaultPackType,
        unitPrice: '',
        priceOverridden: false,
      });
    }
  };

  // Handle pack type change - re-fetch price
  const handlePackTypeChange = (packType) => {
    setCurrentItem({
      ...currentItem,
      packType,
      priceOverridden: false,
    });

    if (currentItem.skuId) {
      const pricing = getPricingForSku(currentItem.skuId, packType);
      if (pricing && pricing.sellingPrice) {
        setCurrentItem({
          ...currentItem,
          packType,
          unitPrice: pricing.sellingPrice.toString(),
          priceOverridden: false,
        });
      } else {
        setCurrentItem({
          ...currentItem,
          packType,
          unitPrice: '',
          priceOverridden: false,
        });
      }
    }
  };

  // Handle price change - mark as overridden
  const handlePriceChange = (price) => {
    setCurrentItem({
      ...currentItem,
      unitPrice: price,
      priceOverridden: true,
    });
  };

  // Add item to invoice
  const handleAddItem = () => {
    if (!currentItem.skuId || !currentItem.quantity || !currentItem.unitPrice) {
      showToast('Please fill in SKU, quantity, and price', 'error');
      return;
    }

    const sku = skus.find(s => String(s.id) === String(currentItem.skuId));
    const quantity = parseFloat(currentItem.quantity);
    const unitPrice = parseFloat(currentItem.unitPrice);
    const total = quantity * unitPrice;

    // Check stock availability
    const availableStock = getStockForSku(currentItem.skuId, currentItem.packType);
    const isSingleUnit = sku?.skuType === 'single';
    if (availableStock < quantity) {
      const confirm = window.confirm(
        `Warning: Only ${availableStock.toFixed(2)} ${isSingleUnit ? 'units' : 'packs'} available. Do you want to proceed?`
      );
      if (!confirm) return;
    }

    const newItem = {
      id: Date.now() + Math.random(),
      skuId: currentItem.skuId,
      skuName: sku?.name || 'Unknown SKU',
      packType: currentItem.packType,
      quantity,
      unitPrice,
      total,
      priceOverridden: currentItem.priceOverridden,
    };

    setFormData({
      ...formData,
      items: [...formData.items, newItem],
    });

    // Reset current item
    setCurrentItem({
      skuId: '',
      packType: 'weekly',
      quantity: '',
      unitPrice: '',
      priceOverridden: false,
    });

    showToast('Item added', 'success');
  };

  // Remove item
  const handleRemoveItem = (itemId) => {
    setFormData({
      ...formData,
      items: formData.items.filter(item => item.id !== itemId),
    });
  };

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + item.total, 0);
    
    // Calculate discount (can be percentage or fixed amount)
    let discount = 0;
    if (formData.discountPercent > 0) {
      discount = (subtotal * parseFloat(formData.discountPercent || 0)) / 100;
    } else {
      discount = parseFloat(formData.discountAmount || 0);
    }
    
    const afterDiscount = subtotal - discount;
    
    // Calculate GST
    const gstAmount = (afterDiscount * parseFloat(formData.gstRate || 0)) / 100;
    
    // Shipping charge
    const shipping = parseFloat(formData.shippingCharge || 0);
    
    // Total amount
    const total = afterDiscount + gstAmount + shipping;
    
    // Advance paid
    const advance = parseFloat(formData.advancePaid || 0);
    
    // Balance due
    const balanceDue = total - advance;

    return { subtotal, discount, afterDiscount, gstAmount, shipping, total, advance, balanceDue };
  };

  const { subtotal, discount, afterDiscount, gstAmount, shipping, total, advance, balanceDue } = calculateTotals();

  const resetForm = () => {
    setFormData({
      customerId: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: '',
      items: [],
      gstRate: 5,
      discountAmount: 0,
      discountPercent: 0,
      shippingCharge: 0,
      advancePaid: 0,
      notes: '',
      terms: 'Payment due within 15 days',
      status: 'draft',
    });
    setCurrentItem({
      skuId: '',
      packType: 'weekly',
      quantity: '',
      unitPrice: '',
      priceOverridden: false,
    });
    setEditingInvoice(null);
    setShowForm(false);
  };

  const handleSaveInvoice = async () => {
    if (!formData.customerId) {
      showToast('Please select a customer', 'error');
      return;
    }

    // Auto-sync local customers to database if needed
    let customerId = formData.customerId;
    if (isSupabaseAvailable()) {
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(formData.customerId)) {
        // Customer is local-only, sync to database first
        const localCustomer = customers.find(
          (c) => String(c.id) === String(formData.customerId)
        );
        if (!localCustomer) {
          showToast('Customer not found', 'error');
          return;
        }
        
        console.log('🔄 Syncing local customer to database:', localCustomer.name);
        showToast('Syncing customer to database...', 'info');
        
        // Check if customer already exists in database by phone number
        const normalizedPhone = localCustomer.phone?.replace(/\D/g, '');
        const existingCustomers = customers.filter(
          (c) => c.phone && normalizedPhone && 
          c.phone.replace(/\D/g, '') === normalizedPhone &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(c.id))
        );
        
        if (existingCustomers.length > 0) {
          // Customer already exists in database, use existing ID
          customerId = existingCustomers[0].id;
          console.log('✅ Customer already exists in database with ID:', customerId);
          // Replace the temporary customer with the existing one
          dispatch({ 
            type: 'REPLACE_CUSTOMER', 
            payload: { tempId: localCustomer.id, customer: existingCustomers[0] } 
          });
        } else {
          const createResult = await dbService.createCustomer(localCustomer);
          if (createResult.error) {
            console.error('Error syncing customer:', createResult.error);
            showToast('Error syncing customer to database', 'error');
            return;
          }
          
          // Use the new database customer ID
          customerId = createResult.data.id;
          console.log('✅ Customer synced successfully with ID:', customerId);
          
          // Replace the temporary customer with the database customer
          dispatch({ 
            type: 'REPLACE_CUSTOMER', 
            payload: { tempId: localCustomer.id, customer: createResult.data } 
          });
        }
        
        // Update form data with new customer ID
        setFormData({ ...formData, customerId });
        showToast('Customer synced successfully', 'success');
      }
    }

    if (formData.items.length === 0) {
      showToast('Please add at least one item', 'error');
      return;
    }

    // Auto-sync local SKUs to database if needed
    if (isSupabaseAvailable()) {
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      for (let i = 0; i < formData.items.length; i++) {
        const item = formData.items[i];
        if (!uuidPattern.test(item.skuId)) {
          // SKU is local-only, sync to database first
          const localSku = skus.find(s => String(s.id) === String(item.skuId));
          if (!localSku) {
            showToast(`SKU not found: ${item.skuName}`, 'error');
            return;
          }
          
          console.log('🔄 Syncing local SKU to database:', localSku.name);
          showToast(`Syncing SKU: ${localSku.name}...`, 'info');
          
          const createResult = await dbService.createSKU(localSku);
          if (createResult.error) {
            console.error('Error syncing SKU:', createResult.error);
            showToast(`Error syncing SKU: ${localSku.name}`, 'error');
            return;
          }
          
          // Update the item with the new database SKU ID
          formData.items[i].skuId = createResult.data.id;
          console.log('✅ SKU synced successfully with ID:', createResult.data.id);
          
          // Update the app state with the synced SKU
          dispatch({ type: 'UPDATE_SKU', payload: { ...localSku, id: createResult.data.id } });
          showToast(`SKU synced: ${localSku.name}`, 'success');
        }
      }
    }

    // Generate invoice number if status is 'paid' and invoice number is not set
    let invoiceNumber = editingInvoice?.invoiceNumber || null;
    
    if (formData.status === 'paid' && (!invoiceNumber || invoiceNumber === 'N/A')) {
      console.log('✅ Status is "paid" - Generating invoice number...');
      
      // Generate invoice number format: INV-YYYY-XXXXX
      const year = new Date().getFullYear();
      
      // Get all existing invoices to find the highest number
      if (isSupabaseAvailable()) {
        const allInvoicesRes = await dbService.getInvoices();
        const existingNumbers = (allInvoicesRes.data || [])
          .map(inv => inv.invoiceNumber || inv.invoice_number)
          .filter(num => num && num.startsWith(`INV-${year}`));
        
        // Extract numbers and find the highest
        const numbers = existingNumbers.map(num => {
          const match = num.match(/INV-\d{4}-(\d{5})/);
          return match ? parseInt(match[1], 10) : 0;
        });
        
        const highestNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
        const nextNumber = highestNumber + 1;
        invoiceNumber = `INV-${year}-${String(nextNumber).padStart(5, '0')}`;
        
        console.log('📋 Generated invoice number:', invoiceNumber);
      } else {
        // For local storage, use a simpler approach
        const invoiceCount = invoices.filter(inv => 
          inv.invoiceNumber && inv.invoiceNumber.startsWith(`INV-${year}`)
        ).length;
        invoiceNumber = `INV-${year}-${String(invoiceCount + 1).padStart(5, '0')}`;
      }
    }
    
    const invoiceData = {
      customerId: customerId, // Use synced customer ID (may be different from formData if auto-synced)
      invoiceDate: formData.invoiceDate,
      dueDate: formData.dueDate || null,
      items: formData.items.map(item => ({
        skuId: item.skuId,
        skuName: item.skuName,
        packType: item.packType,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
      subtotal,
      gstRate: parseFloat(formData.gstRate || 0),
      gstAmount,
      discountAmount: discount,
      discountPercent: parseFloat(formData.discountPercent || 0),
      shippingCharge: shipping,
      advancePaid: advance,
      totalAmount: total,
      balanceDue: formData.status === 'paid' ? 0 : balanceDue, // Balance due is 0 when paid
      status: formData.status,
      invoiceNumber: invoiceNumber,
      notes: formData.notes || null,
      terms: formData.terms || null,
    };

    try {
      if (editingInvoice) {
        invoiceData.id = editingInvoice.id;
        // Keep existing invoice number if editing (unless we just generated one for paid status)
        if (!invoiceNumber || invoiceNumber === editingInvoice.invoiceNumber) {
          invoiceData.invoiceNumber = editingInvoice.invoiceNumber;
        }
        
        // Save to database
        if (isSupabaseAvailable()) {
          const updateResult = await dbService.updateInvoice(invoiceData);
          if (updateResult.error) {
            console.error('Error updating invoice:', updateResult.error);
            showToast('Error updating invoice', 'error');
            return;
          }
          // Update with database response
          dispatch({ type: 'UPDATE_INVOICE', payload: updateResult.data });
        } else {
          dispatch({ type: 'UPDATE_INVOICE', payload: invoiceData });
        }
        
        // Reduce inventory if status changed to 'paid' from another status
        const wasNotPaid = editingInvoice.status !== 'paid';
        const isNowPaid = formData.status === 'paid';
        
        if (wasNotPaid && isNowPaid && invoiceData.items && invoiceData.items.length > 0) {
          console.log('📦 Reducing inventory stock (status changed to paid)...');
          try {
            for (const item of invoiceData.items) {
              await dbService.updateInventoryStock(
                item.skuId,
                item.packType,
                item.quantity,
                'subtract'
              );
              console.log(`✅ Reduced ${item.quantity} ${item.packType} packs of ${item.skuName}`);
            }
            // Reload inventory to reflect changes
            if (isSupabaseAvailable()) {
              const inventoryResult = await dbService.getInventory();
              if (!inventoryResult.error) {
                dispatch({ type: 'SET_INVENTORY', payload: inventoryResult.data });
              }
            }
            showToast('Invoice updated and inventory reduced', 'success');
          } catch (error) {
            console.error('Error reducing stock:', error);
            showToast('Invoice updated but inventory update failed', 'warning');
          }
        } else {
          showToast('Invoice updated successfully', 'success');
        }
      } else {
        // Create new invoice - save to database first
        console.log('📝 Creating new invoice with data:', {
          customerId: invoiceData.customerId,
          invoiceDate: invoiceData.invoiceDate,
          itemsCount: invoiceData.items.length,
          subtotal: invoiceData.subtotal,
          totalAmount: invoiceData.totalAmount,
          status: invoiceData.status
        });
        
        if (isSupabaseAvailable()) {
          const createResult = await dbService.createInvoice(invoiceData);
          if (createResult.error) {
            console.error('❌❌❌ Error creating invoice:', createResult.error);
            console.error('Error details:', {
              code: createResult.error.code,
              message: createResult.error.message,
              details: createResult.error.details,
              hint: createResult.error.hint
            });
            
            // Show more detailed error message
            let errorMessage = 'Error creating invoice';
            if (createResult.error.message) {
              errorMessage += ': ' + createResult.error.message;
            }
            showToast(errorMessage, 'error');
            return;
          }
          
          console.log('✅ Invoice created successfully:', createResult.data.id);
          // Use the database ID from the response
          dispatch({ type: 'ADD_INVOICE', payload: createResult.data });
          showToast('Invoice created successfully', 'success');
        } else {
          dispatch({ type: 'ADD_INVOICE', payload: { ...invoiceData, id: Date.now() + Math.random(), invoiceNumber: invoiceNumber || 'N/A' } });
          showToast('Invoice created successfully', 'success');
        }
      }
      
      // Reduce inventory stock if status is 'paid'
      if (formData.status === 'paid' && invoiceData.items && invoiceData.items.length > 0) {
        console.log('📦 Reducing inventory stock for paid invoice...');
        try {
          for (const item of invoiceData.items) {
            await dbService.updateInventoryStock(
              item.skuId,
              item.packType,
              item.quantity,
              'subtract'
            );
            console.log(`✅ Reduced ${item.quantity} ${item.packType} packs of ${item.skuName}`);
          }
          // Reload inventory to reflect changes
          if (isSupabaseAvailable()) {
            const inventoryResult = await dbService.getInventory();
            if (!inventoryResult.error) {
              dispatch({ type: 'SET_INVENTORY', payload: inventoryResult.data });
            }
          }
          showToast('Inventory updated successfully', 'success');
        } catch (error) {
          console.error('Error reducing stock:', error);
          showToast('Warning: Invoice created but inventory update failed', 'warning');
        }
      }
      
      resetForm();
    } catch (error) {
      console.error('Error saving invoice:', error);
      showToast('Error saving invoice', 'error');
    }
  };

  const handleEdit = (invoice) => {
    // Try to find customer ID - check both invoice.customerId and invoice.customer.id
    let customerId = invoice.customerId || '';
    
    // If customerId is empty but invoice has customer object, try to use customer.id
    if (!customerId && invoice.customer && invoice.customer.id) {
      customerId = invoice.customer.id;
    }
    
    // If customerId still doesn't match any customer in the list, try to find by name/phone
    if (customerId && !customers.find(c => String(c.id) === String(customerId))) {
      if (invoice.customer && invoice.customer.name) {
        // Try to find customer by name and phone
        const matchingCustomer = customers.find(c => 
          c.name === invoice.customer.name && 
          c.phone === invoice.customer.phone
        );
        if (matchingCustomer) {
          customerId = matchingCustomer.id;
        } else {
          // Customer not found in list - show warning but allow selection
          console.warn('Customer from invoice not found in customers list:', invoice.customer);
        }
      }
    }
    
    setFormData({
      customerId: customerId,
      invoiceDate: invoice.invoiceDate || invoice.invoice_date || new Date().toISOString().split('T')[0],
      dueDate: invoice.dueDate || invoice.due_date || '',
      items: invoice.items || [],
      gstRate: invoice.gstRate || invoice.gst_rate || 5,
      discountAmount: invoice.discountAmount || invoice.discount_amount || 0,
      discountPercent: invoice.discountPercent || invoice.discount_percent || 0,
      shippingCharge: invoice.shippingCharge || invoice.shipping_charge || 0,
      advancePaid: invoice.advancePaid || invoice.advance_paid || 0,
      notes: invoice.notes || '',
      terms: invoice.terms || invoice.paymentTerms || invoice.payment_terms || 'Payment due within 15 days',
      status: invoice.status || 'draft',
    });
    setEditingInvoice(invoice);
    setShowForm(true);
  };

  const handleDelete = async (invoiceId) => {
    if (window.confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
      dispatch({ type: 'DELETE_INVOICE', payload: invoiceId });
      showToast('Invoice deleted', 'success');
    }
  };

  const handleStatusChange = async (invoiceId, newStatus) => {
    console.log('=== handleStatusChange START ===');
    console.log('Invoice ID:', invoiceId);
    console.log('New Status:', newStatus);
    
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) {
      console.error('Invoice not found in local state! ID:', invoiceId);
      return;
    }
    
    // Handle both camelCase and snake_case for invoice number
    const currentInvoiceNumber = invoice.invoiceNumber || invoice.invoice_number;
    console.log('Found invoice:', {
      id: invoice.id,
      currentInvoiceNumber: currentInvoiceNumber,
      currentStatus: invoice.status,
      invoiceNumber_camel: invoice.invoiceNumber,
      invoice_number_snake: invoice.invoice_number
    });

    // Use let instead of const to allow reassignment when updating from database
    let updatedInvoice = {
      ...invoice,
      status: newStatus,
      paymentDate: newStatus === 'paid' ? new Date().toISOString().split('T')[0] : invoice.paymentDate,
      // Update balance due to 0 when status is paid
      balanceDue: newStatus === 'paid' ? 0 : invoice.balanceDue,
      // Ensure invoiceNumber is set (handle both formats)
      invoiceNumber: currentInvoiceNumber || 'N/A',
    };

    // Generate invoice number and reduce stock only when status changes to "paid"
    if (newStatus === 'paid') {
      console.log('✅✅✅ Status is "paid" - INVOICE NUMBER GENERATION REQUIRED');
      console.log('Current invoice number value:', currentInvoiceNumber);
      console.log('Invoice number check:', {
        isFalsy: !currentInvoiceNumber,
        isNA: currentInvoiceNumber === 'N/A',
        isNull: currentInvoiceNumber === null,
        isUndefined: currentInvoiceNumber === undefined,
        isEmpty: currentInvoiceNumber === ''
      });
      
      // CRITICAL: ALWAYS generate invoice number when status is 'paid' if it's missing or 'N/A'
      // Check both formats and also check for empty string
      const needsGeneration = !currentInvoiceNumber || 
                              currentInvoiceNumber === 'N/A' || 
                              currentInvoiceNumber === null || 
                              currentInvoiceNumber === undefined ||
                              currentInvoiceNumber === '';
      
      if (needsGeneration) {
        console.log('🔢🔢🔢 Invoice number MUST be generated - starting generation process...');
        const year = new Date().getFullYear();
        
        // Get accurate count from database if available
        let invoiceCount = 1;
        let generatedNumber = '';
        let maxAttempts = 10; // Prevent infinite loop
        let attempt = 0;
        
        if (isSupabaseAvailable()) {
          try {
            // Query database for all invoices with invoice numbers for this year
            const allInvoicesRes = await dbService.getInvoices();
            if (allInvoicesRes.data) {
              const existingPaidInvoices = allInvoicesRes.data.filter(inv => {
                const invNum = inv.invoiceNumber || inv.invoice_number;
                return invNum && invNum !== 'N/A' && invNum !== null && invNum !== undefined && invNum.startsWith(`INV-${year}`);
              });
              
              // Get the highest invoice number to avoid duplicates
              const invoiceNumbers = existingPaidInvoices
                .map(inv => {
                  const invNum = inv.invoiceNumber || inv.invoice_number;
                  const match = invNum.match(/INV-\d{4}-(\d+)/);
                  return match ? parseInt(match[1], 10) : 0;
                })
                .filter(num => num > 0);
              
              invoiceCount = invoiceNumbers.length > 0 ? Math.max(...invoiceNumbers) + 1 : 1;
              console.log('Found', existingPaidInvoices.length, 'existing invoices for year', year);
              console.log('Highest invoice number:', invoiceCount - 1, 'Next will be:', invoiceCount);
            }
          } catch (error) {
            console.error('Error counting invoices from database, using local count:', error);
            // Fallback to local count
            const existingPaidInvoices = invoices.filter(inv => {
              const invNum = inv.invoiceNumber || inv.invoice_number;
              return invNum && invNum !== 'N/A' && invNum !== null && invNum !== undefined && invNum.startsWith(`INV-${year}`);
            });
            invoiceCount = existingPaidInvoices.length + 1;
          }
        } else {
          // Fallback to local count
          const existingPaidInvoices = invoices.filter(inv => {
            const invNum = inv.invoiceNumber || inv.invoice_number;
            return invNum && invNum !== 'N/A' && invNum !== null && invNum !== undefined && invNum.startsWith(`INV-${year}`);
          });
          invoiceCount = existingPaidInvoices.length + 1;
        }
        
        // Generate unique invoice number
        do {
          generatedNumber = `INV-${year}-${String(invoiceCount).padStart(5, '0')}`;
          attempt++;
          invoiceCount++;
        } while (attempt < maxAttempts && invoices.some(inv => {
          const invNum = inv.invoiceNumber || inv.invoice_number;
          return invNum === generatedNumber;
        }));
        
        updatedInvoice.invoiceNumber = generatedNumber;
        // Also set invoice_number for consistency
        updatedInvoice.invoice_number = generatedNumber;
        console.log('✅✅✅✅✅ SUCCESS: Generated invoice number:', updatedInvoice.invoiceNumber, 'for invoice:', invoice.id);
        console.log('✅ Invoice count used:', invoiceCount);
        console.log('✅ Updated invoice object BEFORE stock reduction:', {
          id: updatedInvoice.id,
          invoiceNumber: updatedInvoice.invoiceNumber,
          invoice_number: updatedInvoice.invoice_number,
          status: updatedInvoice.status
        });
        
        // CRITICAL VERIFICATION: Double-check the invoice number is set
        if (!updatedInvoice.invoiceNumber || updatedInvoice.invoiceNumber === 'N/A') {
          console.error('❌❌❌ CRITICAL ERROR: Invoice number was NOT set correctly!');
          console.error('Expected:', generatedNumber);
          console.error('Actual:', updatedInvoice.invoiceNumber);
          showToast('Error: Failed to generate invoice number', 'error');
          return;
        }
      } else {
        console.log('⚠️ Invoice already has number:', currentInvoiceNumber);
        console.log('Skipping invoice number generation');
        // Ensure it's set in both formats
        updatedInvoice.invoiceNumber = currentInvoiceNumber;
        updatedInvoice.invoice_number = currentInvoiceNumber;
      }
      
      // Reduce stock only when invoice is marked as paid
      if (invoice.items && invoice.items.length > 0) {
        try {
          for (const item of invoice.items) {
            await dbService.updateInventoryStock(
              item.skuId,
              item.packType,
              item.quantity,
              'subtract'
            );
          }
          
          // Reload inventory to reflect changes
          const inventoryRes = await dbService.getInventory();
          if (inventoryRes.data) {
            dispatch({ type: 'LOAD_INVENTORY', payload: inventoryRes.data });
          }
        } catch (error) {
          console.error('Error reducing stock:', error);
          showToast('Error reducing stock', 'error');
        }
      }
    }

    // Save to database first (before updating local state) to ensure persistence
    console.log('=== Saving to database ===');
    
    // CRITICAL: Capture the generated invoice number BEFORE any database operations
    const finalInvoiceNumber = updatedInvoice.invoiceNumber;
    console.log('🔒 LOCKED invoice number before DB operations:', finalInvoiceNumber);
    
    try {
      if (isSupabaseAvailable()) {
        console.log('Supabase is available, proceeding with database save');
        console.log('Invoice data to save:', {
          id: updatedInvoice.id,
          invoiceNumber: updatedInvoice.invoiceNumber,
          status: updatedInvoice.status,
          customerId: updatedInvoice.customerId,
          totalAmount: updatedInvoice.totalAmount
        });
        
        // Ensure invoice number is set before proceeding
        if (finalInvoiceNumber && finalInvoiceNumber !== 'N/A') {
          updatedInvoice.invoiceNumber = finalInvoiceNumber;
          console.log('✅ Invoice number locked in:', updatedInvoice.invoiceNumber);
        }
        
        // CRITICAL: Verify invoice number is still set before database operations
        console.log('🔍 VERIFICATION: Invoice number before DB check:', updatedInvoice.invoiceNumber);
        if (!updatedInvoice.invoiceNumber || updatedInvoice.invoiceNumber === 'N/A') {
          console.error('❌❌❌ CRITICAL: Invoice number is missing before database operations!');
          console.error('This should NEVER happen if invoice number generation ran correctly.');
          showToast('Error: Invoice number not generated. Please try again.', 'error');
          return;
        }
        
        // CRITICAL: If invoice has an ID (UUID format), it MUST exist in database - always UPDATE, never CREATE
        const hasValidUUID = updatedInvoice.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(updatedInvoice.id);
        console.log('🔍 Invoice has valid UUID?', hasValidUUID, 'ID:', updatedInvoice.id);
        
        let invoiceExists = false;
        
        if (hasValidUUID) {
          // If we have a valid UUID, ALWAYS try to UPDATE first - don't check existence
          // The invoice MUST exist if it has a UUID from the database
          console.log('✅ Valid UUID detected - will UPDATE invoice (not CREATE)');
          invoiceExists = true; // Assume it exists if we have a valid UUID
          
          // But also verify it exists in database
          console.log('Verifying invoice exists in database by ID...');
          const allInvoicesRes = await dbService.getInvoices();
          console.log('Fetched invoices from database:', allInvoicesRes.data?.length || 0, 'invoices');
          
          if (allInvoicesRes.error) {
            console.error('Error fetching invoices:', allInvoicesRes.error);
          }
          
          // Check if invoice exists by ID
          const foundById = allInvoicesRes.data?.some(inv => inv.id === invoiceId);
          console.log('Invoice found in database by ID?', foundById);
          
          if (!foundById) {
            // Not found by ID, try to find by customer and date
            console.log('Not found by ID, searching by customer and date...');
            if (updatedInvoice.customerId && updatedInvoice.invoiceDate) {
              const existingInvoice = allInvoicesRes.data?.find(inv => 
                inv.customerId === updatedInvoice.customerId && 
                inv.invoiceDate === updatedInvoice.invoiceDate
              );
              if (existingInvoice) {
                console.log('✅ Found existing invoice by customer and date, using its ID');
                updatedInvoice.id = existingInvoice.id;
                invoiceId = existingInvoice.id;
                invoiceExists = true;
              } else {
                console.log('⚠️ Invoice not found in database, but has UUID - will still try UPDATE');
                // Keep invoiceExists = true to force UPDATE attempt
              }
            }
          } else {
            invoiceExists = true;
          }
        } else {
          // No valid UUID - invoice doesn't exist in database, will need to create
          console.log('⚠️ No valid UUID - invoice will be created in database');
          invoiceExists = false;
        }
        
        console.log('🎯 Final decision - Invoice exists in database?', invoiceExists);
        console.log('🎯 Will perform:', invoiceExists ? 'UPDATE' : 'CREATE');
        
        if (!invoiceExists) {
          console.log('📝 Invoice not found in database, creating it first...');
          // Invoice doesn't exist in database, create it first
          const invoiceToCreate = { ...updatedInvoice };
          
          // CRITICAL: Ensure invoice number is set before creating
          if (!invoiceToCreate.invoiceNumber || invoiceToCreate.invoiceNumber === 'N/A') {
            console.error('❌ CRITICAL: Cannot create invoice without invoice number!');
            console.error('Invoice number is:', invoiceToCreate.invoiceNumber);
            showToast('Error: Invoice number not generated. Cannot create invoice.', 'error');
            return;
          }
          
          // Remove the local ID so database can generate a new UUID
          if (!invoiceToCreate.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceToCreate.id)) {
            console.log('Removing invalid ID, letting database generate UUID');
            delete invoiceToCreate.id; // Let database generate UUID
          }
          
          console.log('Creating invoice with data:', {
            invoiceNumber: invoiceToCreate.invoiceNumber,
            status: invoiceToCreate.status,
            customerId: invoiceToCreate.customerId
          });
          
          const createResult = await dbService.createInvoice(invoiceToCreate);
          if (createResult.error) {
            // Handle duplicate key error - invoice number already exists
            if (createResult.error.code === '23505' && createResult.error.message?.includes('invoice_number')) {
              console.error('❌ Duplicate invoice number detected! Regenerating...');
              // Regenerate invoice number and try update instead
              const year = new Date().getFullYear();
              const allInvoicesRes2 = await dbService.getInvoices();
              const existingNumbers = (allInvoicesRes2.data || [])
                .map(inv => inv.invoiceNumber || inv.invoice_number)
                .filter(num => num && num.startsWith(`INV-${year}`));
              
              // Find next available number
              let newCount = 1;
              while (existingNumbers.includes(`INV-${year}-${String(newCount).padStart(5, '0')}`)) {
                newCount++;
              }
              updatedInvoice.invoiceNumber = `INV-${year}-${String(newCount).padStart(5, '0')}`;
              console.log('Regenerated invoice number:', updatedInvoice.invoiceNumber);
              
              // Try to update existing invoice instead
              const updateResult = await dbService.updateInvoice(updatedInvoice);
              if (updateResult.error) {
                console.error('❌ Error updating invoice after duplicate:', updateResult.error);
                showToast('Error saving invoice to database', 'error');
                return;
              }
              updatedInvoice = updateResult.data;
            } else {
              console.error('❌ Error creating invoice in database:', createResult.error);
              showToast('Error saving invoice to database', 'error');
              return;
            }
          } else {
            console.log('✅ Invoice created in database:', {
              id: createResult.data.id,
              invoiceNumber: createResult.data.invoiceNumber,
              status: createResult.data.status
            });
            // Update the invoice ID in local state to match database
            updatedInvoice = { ...createResult.data, id: createResult.data.id };
          }
        } else {
          console.log('📝 Invoice exists in database, updating it...');
          // Invoice exists, update it
          // CRITICAL: Ensure the generated invoice number is still set
          if (finalInvoiceNumber && finalInvoiceNumber !== 'N/A') {
            updatedInvoice.invoiceNumber = finalInvoiceNumber;
            console.log('🔒 Re-applying locked invoice number:', finalInvoiceNumber);
          }
          
          console.log('Updating invoice with invoice number:', updatedInvoice.invoiceNumber);
          console.log('Full invoice data being sent:', {
            id: updatedInvoice.id,
            invoiceNumber: updatedInvoice.invoiceNumber,
            status: updatedInvoice.status,
            customerId: updatedInvoice.customerId
          });
          
          // Double-check before sending to database
          if (!updatedInvoice.invoiceNumber || updatedInvoice.invoiceNumber === 'N/A') {
            console.error('❌ CRITICAL ERROR: Invoice number is missing or N/A before database update!');
            console.error('Expected:', finalInvoiceNumber);
            console.error('Actual:', updatedInvoice.invoiceNumber);
            showToast('Error: Invoice number not generated', 'error');
            return;
          }
          
          const updateResult = await dbService.updateInvoice(updatedInvoice);
          if (updateResult.error) {
            console.error('❌ Error updating invoice in database:', updateResult.error);
            console.error('Error details:', JSON.stringify(updateResult.error, null, 2));
            showToast('Error saving invoice to database', 'error');
            return;
          }
          
          console.log('✅ Invoice updated in database successfully:', {
            id: updateResult.data.id,
            invoiceNumber: updateResult.data.invoiceNumber,
            status: updateResult.data.status
          });
          
          // Verify the invoice number was saved
          if (!updateResult.data.invoiceNumber || updateResult.data.invoiceNumber === 'N/A') {
            console.error('❌ WARNING: Invoice number was not saved! Expected:', updatedInvoice.invoiceNumber);
            console.error('Database returned:', updateResult.data.invoiceNumber);
          }
          
          // Use the data returned from database (which has the correct invoice number)
          updatedInvoice = updateResult.data;
        }
      } else {
        console.log('⚠️ Supabase is not available, skipping database save');
      }
    } catch (error) {
      console.error('❌ Exception while saving invoice to database:', error);
      console.error('Error stack:', error.stack);
      showToast('Error saving invoice to database', 'error');
      return;
    }
    
    // Update local state with the database response
    console.log('=== Updating local state ===');
    console.log('Updated invoice before dispatch:', {
      id: updatedInvoice.id,
      invoiceNumber: updatedInvoice.invoiceNumber,
      status: updatedInvoice.status
    });
    dispatch({ type: 'UPDATE_INVOICE', payload: updatedInvoice });
    console.log('✅ Local state updated');
    
    // Reload invoices from database to ensure UI is in sync
    console.log('=== Reloading invoices from database ===');
    try {
      // Give a small delay for the database sync to complete
      console.log('Waiting 500ms for database sync...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const invoicesRes = await dbService.getInvoices();
      if (invoicesRes.data) {
        console.log('Reloaded', invoicesRes.data.length, 'invoices from database');
        dispatch({ type: 'LOAD_INVOICES', payload: invoicesRes.data });
        const reloadedInvoice = invoicesRes.data.find(inv => inv.id === invoiceId);
        console.log('✅ Invoice reloaded from database:', {
          id: reloadedInvoice?.id,
          invoiceNumber: reloadedInvoice?.invoiceNumber,
          status: reloadedInvoice?.status
        });
        
        if (!reloadedInvoice) {
          console.error('❌ Invoice not found after reload! ID:', invoiceId);
        } else if (!reloadedInvoice.invoiceNumber || reloadedInvoice.invoiceNumber === 'N/A') {
          console.error('❌ Invoice number still missing after reload!');
        }
      } else if (invoicesRes.error) {
        console.error('❌ Error reloading invoices:', invoicesRes.error);
      }
    } catch (error) {
      console.error('❌ Exception while reloading invoices:', error);
      // Don't show error toast here as the update might have succeeded
    }
    
    const invoiceNumberMsg = newStatus === 'paid' && (!invoice.invoiceNumber || invoice.invoiceNumber === 'N/A') 
      ? ` - Invoice number ${updatedInvoice.invoiceNumber} generated and stock reduced` 
      : '';
    showToast(`Invoice marked as ${newStatus}${invoiceNumberMsg}`, 'success');
    console.log('=== handleStatusChange END ===');
    console.log('Final invoice number:', updatedInvoice.invoiceNumber);
  };

  // Generate PDF Invoice - Simple & Clean Layout
  const generatePDF = async (invoice) => {
    try {
      // Validate invoice data
      if (!invoice) {
        showToast('Invalid invoice data', 'error');
        return;
      }
      
      // Try to get the latest invoice data from state first
      let latestInvoice = invoices.find(inv => inv.id === invoice.id) || invoice;
      
      // If invoice not found in state, try to fetch from database
      if (!latestInvoice || !latestInvoice.id) {
        if (isSupabaseAvailable() && invoice.id) {
          console.log('⚠️ Invoice not in state, fetching from database...');
          try {
            const fetchResult = await dbService.getInvoices();
            if (fetchResult.data) {
              const fetchedInvoice = fetchResult.data.find(inv => inv.id === invoice.id);
              if (fetchedInvoice) {
                latestInvoice = fetchedInvoice;
                console.log('✅ Fetched invoice from database:', fetchedInvoice);
              }
            }
          } catch (error) {
            console.error('Error fetching invoice from database:', error);
          }
        }
      }
      
      if (!latestInvoice) {
        showToast('Invoice not found', 'error');
        return;
      }
      
      // Use the latest invoice data
      invoice = latestInvoice;

      // Debug: Log invoice data to see what fields are available
      console.log('📄 Generating PDF for invoice:', {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber || invoice.invoice_number,
        status: invoice.status,
        terms: invoice.terms || invoice.paymentTerms || invoice.payment_terms,
        notes: invoice.notes,
        hasTerms: !!(invoice.terms || invoice.paymentTerms || invoice.payment_terms),
        hasNotes: !!invoice.notes,
        allKeys: Object.keys(invoice).filter(k => k.includes('term') || k.includes('note') || k.includes('status')),
        fullInvoiceKeys: Object.keys(invoice) // Show ALL keys for debugging
      });
      
      // CRITICAL: Ensure notes, terms, and status are properly set (handle null/undefined)
      // Always ensure these fields exist, even if empty
      invoice.notes = invoice.notes || null;
      invoice.terms = invoice.terms || invoice.paymentTerms || invoice.payment_terms || null;
      invoice.status = invoice.status || 'draft';
      
      console.log('📄 After normalization:', {
        notes: invoice.notes,
        terms: invoice.terms,
        status: invoice.status,
        hasNotes: !!invoice.notes,
        hasTerms: !!invoice.terms,
        hasStatus: !!invoice.status
      });

      // Check if invoice has items
      if (!invoice.items || !Array.isArray(invoice.items) || invoice.items.length === 0) {
        showToast('Invoice has no items. Cannot generate PDF.', 'error');
        return;
      }

      // Create PDF with compression to reduce file size
      const doc = new jsPDF({
        compress: true,
        unit: 'mm',
        format: 'a4'
      });
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      let yPos = margin;

      // Company Logo (Top Left)
      const loadLogo = () => {
        return new Promise((resolve) => {
          try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              try {
                // Compress logo size to reduce PDF file size
                doc.addImage(img, 'PNG', margin, yPos, 30, 30, undefined, 'FAST');
                resolve(true);
              } catch (e) {
                resolve(false);
              }
            };
            img.onerror = () => resolve(false);
            img.src = logo;
            setTimeout(() => resolve(false), 1000);
          } catch (error) {
            resolve(false);
          }
        });
      };
      
      const logoLoaded = await loadLogo();
      if (!logoLoaded) {
        // Fallback to text if logo fails
        doc.setFontSize(16);
        doc.setTextColor(34, 197, 94);
        doc.setFont(undefined, 'bold');
        doc.text('WKLY Nuts', margin, yPos + 8);
      }

      // Company Name and Address (Right side, top)
      const rightX = pageWidth - margin;
      let companyY = margin;
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Dhanish Enterprises', rightX, companyY, { align: 'right' });
      companyY += 6;
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text('No.1, Chelliamman koil,', rightX, companyY, { align: 'right' });
      companyY += 5;
      doc.text('Ambattur, Chennai,', rightX, companyY, { align: 'right' });
      companyY += 5;
      doc.text('TamilNadu - 600058', rightX, companyY, { align: 'right' });
      
      // Invoice Number and Date (Right side, below company address)
      const invoiceDate = invoice.invoiceDate || invoice.invoice_date;
      const invoiceNum = invoice.invoiceNumber || invoice.invoice_number || 'N/A';
      const dateStr = invoiceDate ? new Date(invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
      
      companyY += 8;
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`Invoice#: ${invoiceNum}`, rightX, companyY, { align: 'right' });
      companyY += 5;
      doc.text(`Date: ${dateStr}`, rightX, companyY, { align: 'right' });
      
      // Bill To Section (Left side) - Moved down to balance layout
      // Start Bill To section lower to balance with company details on right
      const billToStartY = companyY + 5; // Start below company details to balance
      yPos = billToStartY;
      let customerData = invoice.customer;
      if (!customerData && invoice.customerId) {
        customerData = customers.find(c => String(c.id) === String(invoice.customerId));
      }
      
      if (customerData) {
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Bill To:', margin, yPos);
        yPos += 8; // Increased spacing significantly
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text(customerData.name || 'No Name', margin, yPos);
        doc.setFont(undefined, 'normal');
        yPos += 7; // Increased spacing significantly to prevent overlap
        if (customerData.address) {
          doc.text(customerData.address, margin, yPos);
          yPos += 6; // Increased spacing significantly
        }
        if (customerData.city || customerData.state) {
          const addressLine = [customerData.city, customerData.state, customerData.pincode].filter(Boolean).join(', ');
          if (addressLine) {
            doc.text(addressLine, margin, yPos);
            yPos += 6; // Increased spacing significantly
          }
        }
        if (customerData.phone) {
          doc.text(customerData.phone, margin, yPos);
          yPos += 6; // Increased spacing significantly
        }
        if (customerData.gstin) {
          doc.text(`GSTIN: ${customerData.gstin}`, margin, yPos);
          yPos += 6; // Increased spacing significantly
        }
      }
      
      // Invoice Title (Center) - Moved down after header sections
      const centerX = pageWidth / 2;
      const invoiceTitleY = Math.max(yPos, companyY) + 10;
      doc.setFontSize(20);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('INVOICE', centerX, invoiceTitleY, { align: 'center' });
      
      yPos = invoiceTitleY + 15;

      // Items Table - Fixed column widths, using Rs. instead of ₹ to prevent rendering issues
      const tableData = invoice.items.map((item, index) => [
        (index + 1).toString(),
        item.skuName || 'Unknown SKU',
        item.packType ? `${item.packType.charAt(0).toUpperCase() + item.packType.slice(1)} Pack` : 'N/A',
        (item.quantity || 0).toFixed(2),
        `Rs. ${(item.unitPrice || 0).toFixed(2)}`, // Using Rs. instead of ₹
        `Rs. ${(item.total || 0).toFixed(2)}`, // Using Rs. instead of ₹
      ]);

      // Use autoTable - Fixed widths to prevent overflow
      const autoTableOptions = {
        startY: yPos,
        head: [['#', 'Item', 'Description', 'Qty', 'Rate', 'Amount']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [34, 197, 94], textColor: 255, fontStyle: 'bold' }, // Green to match logo theme
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 45, halign: 'left' },
          2: { cellWidth: 45, halign: 'left' },
          3: { cellWidth: 18, halign: 'right' },
          4: { cellWidth: 25, halign: 'right' },
          5: { cellWidth: 25, halign: 'right' },
        },
        margin: { left: margin, right: margin },
      };

      // Try doc.autoTable first, fallback to autoTable function
      if (typeof doc.autoTable === 'function') {
        doc.autoTable(autoTableOptions);
      } else if (typeof autoTable === 'function') {
        autoTable(doc, autoTableOptions);
      } else {
        throw new Error('autoTable plugin is not available. Please ensure jspdf-autotable is properly installed.');
      }

      // Get final Y position after table
      if (doc.lastAutoTable && doc.lastAutoTable.finalY) {
        yPos = doc.lastAutoTable.finalY + 15;
      } else {
        // Fallback: estimate position based on rows
        yPos += (tableData.length * 7) + 20;
      }

      // Calculate table right edge to align summary with Amount column
      // Table columns: #(12) + Item(45) + Description(45) + Qty(18) + Rate(25) + Amount(25) = 170mm
      // Table starts at margin, so right edge is at margin + 170
      const tableRightEdge = margin + 12 + 45 + 45 + 18 + 25 + 25; // Sum of all column widths
      
      // Summary Section - Aligned with table's Amount column
      const summaryX = pageWidth - margin - 60; // Left side of summary labels
      const summaryRightX = tableRightEdge; // Align with Amount column right edge
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      
      // Get all values
      const subtotal = parseFloat(invoice.subtotal || 0);
      const discountAmount = parseFloat(invoice.discountAmount || invoice.discount_amount || 0);
      const discountPercent = parseFloat(invoice.discountPercent || invoice.discount_percent || 0);
      const shippingCharge = parseFloat(invoice.shippingCharge || invoice.shipping_charge || 0);
      const gstRate = parseFloat(invoice.gstRate || invoice.gst_rate || 0);
      const gstAmount = parseFloat(invoice.gstAmount || invoice.gst_amount || 0);
      const advancePaid = parseFloat(invoice.advancePaid || invoice.advance_paid || 0);
      const totalAmount = parseFloat(invoice.totalAmount || invoice.total_amount || 0);
      const balanceDue = totalAmount - advancePaid;
      
      // Sub Total (always show) - Using Rs. instead of ₹ to prevent rendering issues
      doc.text('Sub Total:', summaryX, yPos);
      doc.text(`Rs. ${subtotal.toFixed(2)}`, summaryRightX, yPos, { align: 'right' });
      yPos += 6;
      
      // Discount (always show, even if 0)
      const discountLabel = discountPercent > 0 
        ? `Discount(${discountPercent.toFixed(2)}%):`
        : 'Discount:';
      doc.text(discountLabel, summaryX, yPos);
      if (discountAmount > 0) {
        doc.text(`(-)Rs. ${discountAmount.toFixed(2)}`, summaryRightX, yPos, { align: 'right' });
      } else {
        doc.text(`Rs. 0.00`, summaryRightX, yPos, { align: 'right' });
      }
      yPos += 6;
      
      // Shipping charge (always show, even if 0)
      doc.text('Shipping charge:', summaryX, yPos);
      doc.text(`Rs. ${shippingCharge.toFixed(2)}`, summaryRightX, yPos, { align: 'right' });
      yPos += 6;
      
      // GST (always show if rate is set, even if 0)
      if (gstRate > 0) {
        doc.text(`GST(${gstRate}%):`, summaryX, yPos);
        doc.text(`Rs. ${gstAmount.toFixed(2)}`, summaryRightX, yPos, { align: 'right' });
        yPos += 6;
      }
      
      // Advance paid (always show, even if 0)
      doc.text('Advance paid:', summaryX, yPos);
      if (advancePaid > 0) {
        doc.text(`(-)Rs. ${advancePaid.toFixed(2)}`, summaryRightX, yPos, { align: 'right' });
      } else {
        doc.text(`Rs. 0.00`, summaryRightX, yPos, { align: 'right' });
      }
      yPos += 6;
      
      // Separator line
      doc.setDrawColor(200, 200, 200);
      doc.line(summaryX, yPos, summaryRightX, yPos);
      yPos += 6;
      
      // Total (always show)
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('Total:', summaryX, yPos);
      doc.text(`Rs. ${totalAmount.toFixed(2)}`, summaryRightX, yPos, { align: 'right' });
      yPos += 8;
      
      // Balance Due (always show)
      // Thicker line
      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.5);
      doc.line(summaryX, yPos, summaryRightX, yPos);
      yPos += 6;
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('Balance Due:', summaryX, yPos);
      // Show "Paid" if invoice status is paid, otherwise show balance amount
      const invoiceStatus = invoice.status || 'draft';
      if (invoiceStatus === 'paid') {
        doc.setTextColor(34, 197, 94); // Green color for "Paid"
        doc.text('Paid', summaryRightX, yPos, { align: 'right' });
      } else {
        doc.setTextColor(0, 0, 0); // Black for balance amount
        doc.text(`Rs. ${balanceDue.toFixed(2)}`, summaryRightX, yPos, { align: 'right' });
      }
      yPos += 10;

      // Calculate available width for text sections (used by Payment Terms and Notes)
      // A4 width is 210mm, margin is 15mm, so available is 180mm, but use 170mm for better margins
      const textAvailableWidth = pageWidth - (2 * margin) - 10; // Subtract 10mm for better margins and readability

      // Payment Terms Section (ALWAYS show) - wrapped in try-catch to ensure it always renders
      try {
        console.log('🔵 STARTING Payment Terms Section - yPos:', yPos, 'pageHeight:', pageHeight);
        const terms = invoice.terms || invoice.paymentTerms || invoice.payment_terms || '';
        console.log('🔍 Payment Terms check in PDF:', { 
          terms, 
          rawTerms: invoice.terms,
          paymentTerms: invoice.paymentTerms,
          payment_terms: invoice.payment_terms,
          hasTerms: !!(terms && terms.trim()),
          invoiceKeys: Object.keys(invoice)
        });
        // Check if we have enough space, otherwise add new page
        if (yPos > pageHeight - 50) {
          console.log('📄 Adding new page for Payment Terms');
          doc.addPage();
          yPos = margin;
        }
        
        yPos += 8;
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Payment Terms:', margin, yPos);
        console.log('✅ Payment Terms label rendered at yPos:', yPos);
        yPos += 7;
        
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(60, 60, 60);
        
        if (terms && terms.trim()) {
          // Clean and normalize the terms text for better formatting
          // Preserve intentional line breaks but normalize excessive whitespace
          let cleanedTerms = terms
            .replace(/₹/g, 'Rs. ') // Replace rupee symbol with Rs. to avoid encoding issues in PDF
            .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space (but keep newlines)
            .replace(/\n\s*\n\s*\n+/g, '\n\n') // Replace 3+ newlines with double newline (paragraph break)
            .replace(/[ \t]+\n/g, '\n') // Remove trailing spaces before newlines
            .replace(/\n[ \t]+/g, '\n') // Remove leading spaces after newlines
            .trim();
          
          // Split long text into multiple lines with proper word wrapping
          // splitTextToSize automatically handles word boundaries
          const termsLines = doc.splitTextToSize(cleanedTerms, textAvailableWidth);
          // Add each line with consistent spacing
          termsLines.forEach((line, index) => {
            // Check if we need a new page
            if (yPos > pageHeight - 20) {
              doc.addPage();
              yPos = margin + 5;
            }
            // Trim the line to remove any leading/trailing spaces for cleaner formatting
            const trimmedLine = line.trim();
            if (trimmedLine) {
              // Use consistent left alignment
              doc.text(trimmedLine, margin, yPos, { align: 'left' });
              // Use consistent line height for uniform spacing
              yPos += 6; // Consistent line height for better readability
            }
          });
          console.log('✅ Payment Terms added to PDF');
        } else {
          // Show "N/A" if no terms provided
          doc.setTextColor(120, 120, 120); // Gray for N/A
          doc.text('N/A', margin, yPos);
          yPos += 5.5;
          console.log('⚠️ Payment Terms not found, showing N/A');
        }
        yPos += 3; // Extra spacing after section
      } catch (error) {
        console.error('❌ Error rendering Payment Terms section:', error);
        // Still show the section label even if content fails
        try {
          if (yPos > pageHeight - 50) {
            doc.addPage();
            yPos = margin;
          }
          yPos += 8;
          doc.setFontSize(10);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(0, 0, 0);
          doc.text('Payment Terms:', margin, yPos);
          yPos += 7;
          doc.setFontSize(9);
          doc.setFont(undefined, 'normal');
          doc.setTextColor(120, 120, 120);
          doc.text('N/A', margin, yPos);
          yPos += 8;
        } catch (fallbackError) {
          console.error('❌ Error in Payment Terms fallback:', fallbackError);
        }
      }

      // Notes Section (ALWAYS show) - wrapped in try-catch to ensure it always renders
      try {
        console.log('🔵 STARTING Notes Section - yPos:', yPos, 'pageHeight:', pageHeight);
        const notes = invoice.notes || '';
        console.log('🔍 Notes check in PDF:', { 
          notes, 
          rawNotes: invoice.notes,
          hasNotes: !!(notes && notes.trim()),
          invoiceKeys: Object.keys(invoice)
        });
        // Check if we have enough space, otherwise add new page
        if (yPos > pageHeight - 50) {
          console.log('📄 Adding new page for Notes');
          doc.addPage();
          yPos = margin;
        }
        
        yPos += 8;
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Notes:', margin, yPos);
        console.log('✅ Notes label rendered at yPos:', yPos);
        yPos += 7;
        
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(60, 60, 60);
        
        if (notes && notes.trim()) {
          // Clean and normalize the notes text for better formatting
          // Preserve intentional line breaks but normalize excessive whitespace
          let cleanedNotes = notes
            .replace(/₹/g, 'Rs. ') // Replace rupee symbol with Rs. to avoid encoding issues in PDF
            .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space (but keep newlines)
            .replace(/\n\s*\n\s*\n+/g, '\n\n') // Replace 3+ newlines with double newline (paragraph break)
            .replace(/[ \t]+\n/g, '\n') // Remove trailing spaces before newlines
            .replace(/\n[ \t]+/g, '\n') // Remove leading spaces after newlines
            .trim();
          
          // Split long text into multiple lines with proper word wrapping
          // splitTextToSize automatically handles word boundaries
          const notesLines = doc.splitTextToSize(cleanedNotes, textAvailableWidth);
          
          // Add each line with consistent spacing and page break handling
          notesLines.forEach((line, index) => {
            // Check if we need a new page before adding this line
            if (yPos > pageHeight - 20) {
              doc.addPage();
              yPos = margin + 5;
            }
            // Trim the line to remove any leading/trailing spaces for cleaner formatting
            const trimmedLine = line.trim();
            if (trimmedLine) {
              // Use consistent left alignment
              doc.text(trimmedLine, margin, yPos, { align: 'left' });
              // Use consistent line height for uniform spacing
              yPos += 6; // Consistent line height for better readability
            }
          });
          console.log('✅ Notes added to PDF');
        } else {
          // Show "N/A" if no notes provided
          doc.setTextColor(120, 120, 120); // Gray for N/A
          doc.text('N/A', margin, yPos);
          yPos += 5.5;
          console.log('⚠️ Notes not found, showing N/A');
        }
        yPos += 3; // Extra spacing after section
      } catch (error) {
        console.error('❌ Error rendering Notes section:', error);
        // Still show the section label even if content fails
        try {
          if (yPos > pageHeight - 50) {
            doc.addPage();
            yPos = margin;
          }
          yPos += 8;
          doc.setFontSize(10);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(0, 0, 0);
          doc.text('Notes:', margin, yPos);
          yPos += 7;
          doc.setFontSize(9);
          doc.setFont(undefined, 'normal');
          doc.setTextColor(120, 120, 120);
          doc.text('N/A', margin, yPos);
          yPos += 8;
        } catch (fallbackError) {
          console.error('❌ Error in Notes fallback:', fallbackError);
        }
      }

      // Status Section (ALWAYS show status for clarity) - wrapped in try-catch to ensure it always renders
      try {
        console.log('🔵 STARTING Status Section - yPos:', yPos, 'pageHeight:', pageHeight);
        console.log('🔍 Status check:', { invoiceStatus, shouldShow: true });
        // Check if we have enough space
        if (yPos > pageHeight - 40) {
          console.log('📄 Adding new page for Status');
          doc.addPage();
          yPos = margin;
        }
        
        yPos += 8;
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Status:', margin, yPos);
        console.log('✅ Status label rendered at yPos:', yPos);
        yPos += 7;
        
        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        // Color code based on status
        if (invoiceStatus === 'paid') {
          doc.setTextColor(34, 197, 94); // Green for paid
        } else if (invoiceStatus === 'sent') {
          doc.setTextColor(255, 152, 0); // Orange
        } else if (invoiceStatus === 'draft') {
          doc.setTextColor(100, 100, 100); // Gray
        } else {
          doc.setTextColor(0, 0, 0); // Black
        }
        doc.text(invoiceStatus.charAt(0).toUpperCase() + invoiceStatus.slice(1), margin, yPos);
        yPos += 8;
        console.log('✅ Status added to PDF:', invoiceStatus);
      } catch (error) {
        console.error('❌ Error rendering Status section:', error);
        // Still show the section label even if content fails
        try {
          if (yPos > pageHeight - 40) {
            doc.addPage();
            yPos = margin;
          }
          yPos += 8;
          doc.setFontSize(10);
          doc.setFont(undefined, 'bold');
          doc.setTextColor(0, 0, 0);
          doc.text('Status:', margin, yPos);
          yPos += 7;
          doc.setFontSize(9);
          doc.setFont(undefined, 'normal');
          doc.setTextColor(100, 100, 100);
          doc.text('Draft', margin, yPos);
          yPos += 8;
        } catch (fallbackError) {
          console.error('❌ Error in Status fallback:', fallbackError);
        }
      }

      // Simple Footer
      if (yPos < pageHeight - 30) {
        yPos += 10;
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.setFont(undefined, 'italic');
        doc.text('Thanks for your business.', margin, yPos);
      }
      
      // Page number
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
      }

      // Save PDF
      const fileName = `Invoice-${invoice.invoiceNumber || invoice.id}-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      showToast('PDF generated successfully', 'success');
    } catch (error) {
      console.error('Error generating PDF:', error);
      console.error('Invoice data:', invoice);
      showToast(`Error generating PDF: ${error.message || 'Unknown error'}`, 'error');
    }
  };

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    let filtered = invoices;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(inv => inv.status === statusFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(inv =>
        inv.invoiceNumber?.toLowerCase().includes(term) ||
        inv.customer?.name?.toLowerCase().includes(term)
      );
    }

    // Debug: Log all invoices with missing customers
    const invoicesWithMissingCustomers = filtered.filter(inv => !inv.customer && inv.customerId);
    if (invoicesWithMissingCustomers.length > 0) {
      console.log('🔍 Invoices with missing customers:', invoicesWithMissingCustomers.map(inv => ({
        invoiceNumber: inv.invoiceNumber,
        invoiceId: inv.id,
        customerId: inv.customerId,
        invoiceDate: inv.invoiceDate
      })));
    }

    return filtered;
  }, [invoices, statusFilter, searchTerm]);

  // Helper function to find customer by ID (exposed for debugging)
  const findCustomerById = (customerId) => {
    return customers.find(c => String(c.id) === String(customerId));
  };

  // Helper function to check invoices with missing customers (exposed for debugging)
  React.useEffect(() => {
    // Expose helper functions to window for debugging
    if (typeof window !== 'undefined') {
      window.debugInvoiceCustomers = {
        findMissingCustomers: () => {
          const missing = invoices.filter(inv => !inv.customer && inv.customerId);
          console.log('📋 Invoices with missing customers:', missing.map(inv => ({
            invoiceNumber: inv.invoiceNumber,
            invoiceId: inv.id,
            customerId: inv.customerId,
            invoiceDate: inv.invoiceDate,
            totalAmount: inv.totalAmount
          })));
          return missing;
        },
        findCustomerById: (customerId) => {
          const customer = customers.find(c => String(c.id) === String(customerId));
          console.log('👤 Customer found:', customer);
          return customer;
        },
        getAllCustomers: () => {
          console.log('👥 All customers:', customers.map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone
          })));
          return customers;
        },
        checkInvoice: (invoiceNumber) => {
          const invoice = invoices.find(inv => inv.invoiceNumber === invoiceNumber);
          if (invoice) {
            console.log('📄 Invoice details:', {
              invoiceNumber: invoice.invoiceNumber,
              invoiceId: invoice.id,
              customerId: invoice.customerId,
              customer: invoice.customer,
              customerExists: invoice.customer ? 'Yes' : 'No',
              customerInList: invoice.customerId ? findCustomerById(invoice.customerId) ? 'Yes' : 'No' : 'N/A'
            });
          } else {
            console.log('❌ Invoice not found:', invoiceNumber);
          }
          return invoice;
        }
      };
    }
  }, [invoices, customers]);

  // Export invoices to CSV with item details
  const exportInvoices = () => {
    const invoicesToExport = filteredInvoices.length > 0 ? filteredInvoices : invoices;
    
    // Create CSV content with detailed invoice and item information
    const csvRows = [];
    
    // Main invoice headers
    const invoiceHeaders = [
      'Invoice #',
      'Customer Name',
      'Customer Phone',
      'Customer Email',
      'Invoice Date',
      'Due Date',
      'Status',
      'Subtotal',
      'Discount Amount',
      'Discount %',
      'Shipping Charge',
      'GST Rate %',
      'GST Amount',
      'Advance Paid',
      'Total Amount',
      'Balance Due',
      'Payment Method',
      'Payment Date',
      'Notes',
      'Terms'
    ];
    
    // Item headers
    const itemHeaders = [
      'Item #',
      'Item SKU Name',
      'Item Description',
      'Pack Type',
      'Quantity',
      'Unit Price',
      'Item Total'
    ];
    
    // Combine headers
    const allHeaders = [...invoiceHeaders, ...itemHeaders].join(',');
    csvRows.push(allHeaders);
    
    // Process each invoice
    invoicesToExport.forEach((invoice) => {
      const customer = invoice.customer || (invoice.customerId ? customers.find(c => String(c.id) === String(invoice.customerId)) : null);
      
      // Base invoice row data
      const invoiceData = [
        invoice.invoiceNumber || 'N/A',
        customer?.name || 'No Customer',
        customer?.phone || '',
        customer?.email || '',
        invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString('en-IN') : '',
        invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : '',
        invoice.status || 'draft',
        (invoice.subtotal || 0).toFixed(2),
        (invoice.discountAmount || 0).toFixed(2),
        (invoice.discountPercent || 0).toFixed(2),
        (invoice.shippingCharge || 0).toFixed(2),
        (invoice.gstRate || 0).toFixed(2),
        (invoice.gstAmount || 0).toFixed(2),
        (invoice.advancePaid || 0).toFixed(2),
        (invoice.totalAmount || 0).toFixed(2),
        (invoice.balanceDue || 0).toFixed(2),
        invoice.paymentMethod || '',
        invoice.paymentDate ? new Date(invoice.paymentDate).toLocaleDateString('en-IN') : '',
        (invoice.notes || '').replace(/\n/g, ' ').replace(/,/g, ';'),
        (invoice.terms || '').replace(/\n/g, ' ').replace(/,/g, ';')
      ];
      
      // Get items for this invoice
      const items = invoice.items || [];
      
      if (items.length === 0) {
        // No items - just add invoice row with empty item columns
        const emptyItemData = ['', '', '', '', '', '', ''];
        const row = [...invoiceData, ...emptyItemData]
          .map(cell => {
            const cellStr = String(cell || '');
            if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          })
          .join(',');
        csvRows.push(row);
      } else {
        // Add one row per item
        items.forEach((item, itemIndex) => {
          const itemData = [
            itemIndex + 1,
            item.skuName || 'Unknown SKU',
            `${item.skuName || 'Unknown'} - ${item.packType ? (item.packType.charAt(0).toUpperCase() + item.packType.slice(1)) : ''} Pack`,
            item.packType ? `${item.packType.charAt(0).toUpperCase() + item.packType.slice(1)} Pack` : '',
            (item.quantity || 0).toFixed(2),
            (item.unitPrice || 0).toFixed(2),
            (item.total || 0).toFixed(2)
          ];
          
          const row = [...invoiceData, ...itemData]
            .map(cell => {
              const cellStr = String(cell || '');
              if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                return `"${cellStr.replace(/"/g, '""')}"`;
              }
              return cellStr;
            })
            .join(',');
          csvRows.push(row);
        });
      }
    });
    
    // Combine all rows
    const csvContent = csvRows.join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoices-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast(`Exported ${invoicesToExport.length} invoice(s) with item details to CSV`, 'success');
  };

  // Get status icon and color
  const getStatusInfo = (status) => {
    switch (status) {
      case 'draft':
        return { icon: FileText, color: 'bg-gray-100 text-gray-800', label: 'Draft' };
      case 'sent':
        return { icon: Clock, color: 'bg-blue-100 text-blue-800', label: 'Sent' };
      case 'paid':
        return { icon: CheckCircle, color: 'bg-green-100 text-green-800', label: 'Paid' };
      case 'overdue':
        return { icon: AlertCircle, color: 'bg-red-100 text-red-800', label: 'Overdue' };
      default:
        return { icon: FileText, color: 'bg-gray-100 text-gray-800', label: status };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoice Management</h1>
          <p className="text-gray-600 mt-1">Create and manage customer invoices</p>
        </div>
        <div className="flex gap-2">
          {!showForm && invoices.length > 0 && (
            <button
              onClick={exportInvoices}
              className="btn-secondary flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              Export
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Invoice
          </button>
        </div>
      </div>

      {/* Filters */}
      {!showForm && invoices.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by invoice number or customer name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
      )}

      {/* Invoice Form */}
      {showForm && (
        <div className="card space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">
              {editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}
            </h2>
            <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Customer Selection */}
          <div>
            <label className="label">
              Customer <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                className="input-field pl-10"
              >
                <option value="">Select Customer</option>
                {customers.map((customer) => (
                  <option 
                    key={customer.id} 
                    value={customer.id}
                  >
                    {customer.name} {customer.phone ? `(${customer.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
            {editingInvoice && editingInvoice.customer && formData.customerId && !customers.find(c => String(c.id) === String(formData.customerId)) && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                Original customer "{editingInvoice.customer.name}" not found in customer list. Please select a customer.
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Invoice Date</label>
              <input
                type="date"
                value={formData.invoiceDate}
                onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          {/* Add Items */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Items</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
              <div>
                <label className="label">SKU</label>
                <select
                  value={currentItem.skuId}
                  onChange={(e) => handleSkuChange(e.target.value)}
                  className="input-field"
                >
                  <option value="">Select SKU</option>
                  {skus.map((sku) => (
                    <option key={sku.id} value={sku.id}>
                      {sku.name}
                    </option>
                  ))}
                </select>
              </div>
              {currentItem.skuId && (() => {
                const selectedSku = skus.find(s => String(s.id) === String(currentItem.skuId));
                const isSingleUnit = selectedSku?.skuType === 'single';
                
                if (isSingleUnit) {
                  // Hide pack type selector for single unit SKUs
                  return null;
                }
                
                return (
                  <div>
                    <label className="label">Pack Type</label>
                    <select
                      value={currentItem.packType}
                      onChange={(e) => handlePackTypeChange(e.target.value)}
                      className="input-field"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                );
              })()}
              <div>
                <label className="label">Quantity</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={currentItem.quantity}
                  onChange={(e) => setCurrentItem({ ...currentItem, quantity: e.target.value })}
                  className="input-field"
                  placeholder="0"
                />
                {currentItem.skuId && (() => {
                  const selectedSku = skus.find(s => String(s.id) === String(currentItem.skuId));
                  const isSingleUnit = selectedSku?.skuType === 'single';
                  const stock = getStockForSku(currentItem.skuId, currentItem.packType);
                  
                  return (
                    <p className="text-xs text-gray-500 mt-1">
                      Available: {stock.toFixed(2)} {isSingleUnit ? 'units' : 'packs'}
                    </p>
                  );
                })()}
              </div>
              <div>
                <label className="label">
                  Unit Price (₹) {currentItem.priceOverridden && <span className="text-blue-600 text-xs">(Edited)</span>}
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={currentItem.unitPrice}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    className="input-field pl-9"
                    placeholder="0.00"
                  />
                </div>
                {currentItem.skuId && !currentItem.priceOverridden && (
                  <p className="text-xs text-gray-500 mt-1">
                    From Pricing Strategy
                  </p>
                )}
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleAddItem}
                  className="btn-primary w-full"
                  disabled={!currentItem.skuId || !currentItem.quantity || !currentItem.unitPrice}
                >
                  <Plus className="w-4 h-4 inline mr-1" />
                  Add
                </button>
              </div>
            </div>

            {/* Items List */}
            {formData.items.length > 0 ? (
              <div className="mt-4 border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-2 px-4 font-semibold text-gray-700">SKU</th>
                      <th className="text-left py-2 px-4 font-semibold text-gray-700">Type</th>
                      <th className="text-right py-2 px-4 font-semibold text-gray-700">Qty</th>
                      <th className="text-right py-2 px-4 font-semibold text-gray-700">Unit Price</th>
                      <th className="text-right py-2 px-4 font-semibold text-gray-700">Total</th>
                      <th className="text-center py-2 px-4 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item) => (
                      <tr key={item.id} className="border-t hover:bg-gray-50">
                        <td className="py-2 px-4">{item.skuName}</td>
                        <td className="py-2 px-4 capitalize">
                          {item.packType === 'single' ? 'Single Unit' : `${item.packType} Pack`}
                        </td>
                        <td className="py-2 px-4 text-right">{item.quantity}</td>
                        <td className="py-2 px-4 text-right">
                          ₹{item.unitPrice.toFixed(2)}
                          {item.priceOverridden && (
                            <span className="ml-1 text-xs text-blue-600" title="Price overridden">*</span>
                          )}
                        </td>
                        <td className="py-2 px-4 text-right font-medium">₹{item.total.toFixed(2)}</td>
                        <td className="py-2 px-4 text-center">
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">No items added yet</p>
                    <p className="text-xs text-yellow-700 mt-1">
                      Fill in the fields above (SKU, Pack Type, Quantity, Unit Price) and click the <strong>"+ Add"</strong> button to add items to this invoice.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Totals */}
          {formData.items.length > 0 && (
            <div className="border-t pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="label">GST Rate (%)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.gstRate}
                      onChange={(e) => setFormData({ ...formData, gstRate: e.target.value })}
                      className="input-field"
                      placeholder="5"
                    />
                  </div>
                  <div>
                    <label className="label">Discount Percent (%)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.discountPercent}
                      onChange={(e) => setFormData({ ...formData, discountPercent: e.target.value, discountAmount: 0 })}
                      className="input-field"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="label">Discount Amount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.discountAmount}
                      onChange={(e) => setFormData({ ...formData, discountAmount: e.target.value, discountPercent: 0 })}
                      className="input-field"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="label">Shipping Charge (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.shippingCharge}
                      onChange={(e) => setFormData({ ...formData, shippingCharge: e.target.value })}
                      className="input-field"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="label">Advance Paid (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.advancePaid}
                      onChange={(e) => setFormData({ ...formData, advancePaid: e.target.value })}
                      className="input-field"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">₹{subtotal.toFixed(2)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        Discount{formData.discountPercent > 0 ? ` (${formData.discountPercent}%)` : ''}:
                      </span>
                      <span className="font-medium text-red-600">-₹{discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">After Discount:</span>
                    <span className="font-medium">₹{afterDiscount.toFixed(2)}</span>
                  </div>
                  {gstAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">GST ({formData.gstRate}%):</span>
                      <span className="font-medium">₹{gstAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {shipping > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Shipping:</span>
                      <span className="font-medium">₹{shipping.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-gray-300">
                    <span className="text-lg font-bold text-gray-900">Total:</span>
                    <span className="text-lg font-bold text-primary-600">₹{total.toFixed(2)}</span>
                  </div>
                  {advance > 0 && (
                    <div className="flex justify-between pt-2">
                      <span className="text-gray-600">Advance Paid:</span>
                      <span className="font-medium text-green-600">-₹{advance.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-gray-300">
                    <span className="text-lg font-bold text-gray-900">Balance Due:</span>
                    {formData.status === 'paid' ? (
                      <span className="text-lg font-bold text-green-600">Paid</span>
                    ) : (
                      <span className="text-lg font-bold text-orange-600">₹{balanceDue.toFixed(2)}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Additional Info */}
          <div className="border-t pt-6 space-y-4">
            <div>
              <label className="label">Payment Terms</label>
              <textarea
                value={formData.terms}
                onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                className="input-field"
                rows="2"
                placeholder="Payment due within 15 days"
              />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input-field"
                rows="3"
                placeholder="Any additional notes..."
              />
            </div>
            <div>
              <label className="label">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="input-field"
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button onClick={resetForm} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleSaveInvoice} className="btn-primary flex items-center gap-2">
              <Save className="w-4 h-4" />
              {editingInvoice ? 'Update Invoice' : 'Create Invoice'}
            </button>
          </div>
        </div>
      )}

      {/* Invoices List */}
      {!showForm && (
        <div className="card">
          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No invoices yet</h3>
              <p className="text-gray-600 mb-4">Create your first invoice to get started</p>
              <button onClick={() => setShowForm(true)} className="btn-primary">
                <Plus className="w-5 h-5 inline mr-2" />
                Create Invoice
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  All Invoices ({filteredInvoices.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Invoice #</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Customer</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Amount</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((invoice) => {
                      const statusInfo = getStatusInfo(invoice.status);
                      const StatusIcon = statusInfo.icon;
                      
                      // Debug: Log invoices with missing customers
                      if (!invoice.customer && invoice.customerId) {
                        console.log('🔍 Invoice with customerId but no customer object:', {
                          invoiceNumber: invoice.invoiceNumber,
                          invoiceId: invoice.id,
                          customerId: invoice.customerId,
                          invoiceDate: invoice.invoiceDate
                        });
                      }
                      
                      return (
                        <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-4 px-4">
                            <div className="font-medium text-gray-900">{invoice.invoiceNumber || 'N/A'}</div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-sm text-gray-900">{invoice.customer?.name || 'No Customer'}</div>
                            {invoice.customer?.phone && (
                              <div className="text-xs text-gray-500">{invoice.customer.phone}</div>
                            )}
                            {!invoice.customer && invoice.customerId && (
                              <div className="text-xs text-red-500 mt-1" title={`Customer ID: ${invoice.customerId}`}>
                                ⚠️ Customer ID exists but customer not found
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-4 text-sm text-gray-600">
                            {invoice.invoiceDate 
                              ? new Date(invoice.invoiceDate).toLocaleDateString('en-IN')
                              : 'N/A'
                            }
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="font-semibold text-gray-900">₹{invoice.totalAmount?.toFixed(2) || '0.00'}</div>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => generatePDF(invoice)}
                                className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Download PDF"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              {invoice.status !== 'paid' && (
                                <button
                                  onClick={() => handleStatusChange(invoice.id, 'paid')}
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                  title="Mark as Paid"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleEdit(invoice)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(invoice.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

