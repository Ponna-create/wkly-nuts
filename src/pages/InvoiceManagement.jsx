import React, { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, Search, X, FileText, CheckCircle, AlertCircle, Clock, DollarSign, Package, User, Save, Printer, Download } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';
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
    packType: 'weekly',
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
    return packType === 'weekly' ? inv.weeklyPacksAvailable : inv.monthlyPacksAvailable;
  };

  // Handle SKU selection - auto-fetch price
  const handleSkuChange = (skuId) => {
    const sku = skus.find(s => String(s.id) === String(skuId));
    if (!sku) return;

    setCurrentItem({
      ...currentItem,
      skuId,
      priceOverridden: false,
    });

    // Auto-fetch price from pricing strategy
    const pricing = getPricingForSku(skuId, currentItem.packType);
    if (pricing && pricing.sellingPrice) {
      setCurrentItem({
        ...currentItem,
        skuId,
        unitPrice: pricing.sellingPrice.toString(),
        priceOverridden: false,
      });
    } else {
      setCurrentItem({
        ...currentItem,
        skuId,
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
    if (availableStock < quantity) {
      const confirm = window.confirm(
        `Warning: Only ${availableStock.toFixed(2)} packs available. Do you want to proceed?`
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

    if (formData.items.length === 0) {
      showToast('Please add at least one item', 'error');
      return;
    }

    const invoiceData = {
      customerId: formData.customerId,
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
      balanceDue,
      status: formData.status,
      notes: formData.notes || null,
      terms: formData.terms || null,
    };

    try {
      if (editingInvoice) {
        invoiceData.id = editingInvoice.id;
        invoiceData.invoiceNumber = editingInvoice.invoiceNumber;
        dispatch({ type: 'UPDATE_INVOICE', payload: invoiceData });
        showToast('Invoice updated successfully', 'success');
      } else {
        dispatch({ type: 'ADD_INVOICE', payload: { ...invoiceData, id: Date.now() + Math.random() } });
        showToast('Invoice created successfully', 'success');
        
        // Stock will be reduced only when invoice status changes to "paid"
        // (Moved to handleStatusChange function)
      }
      
      resetForm();
    } catch (error) {
      console.error('Error saving invoice:', error);
      showToast('Error saving invoice', 'error');
    }
  };

  const handleEdit = (invoice) => {
    setFormData({
      customerId: invoice.customerId || '',
      invoiceDate: invoice.invoiceDate || new Date().toISOString().split('T')[0],
      dueDate: invoice.dueDate || '',
      items: invoice.items || [],
      gstRate: invoice.gstRate || 5,
      discountAmount: invoice.discountAmount || 0,
      discountPercent: invoice.discountPercent || 0,
      shippingCharge: invoice.shippingCharge || 0,
      advancePaid: invoice.advancePaid || 0,
      notes: invoice.notes || '',
      terms: invoice.terms || 'Payment due within 15 days',
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
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;

    const updatedInvoice = {
      ...invoice,
      status: newStatus,
      paymentDate: newStatus === 'paid' ? new Date().toISOString().split('T')[0] : invoice.paymentDate,
    };

    // Generate invoice number and reduce stock only when status changes to "paid"
    if (newStatus === 'paid') {
      // Generate invoice number if not already generated
      if (!invoice.invoiceNumber || invoice.invoiceNumber === 'N/A') {
        const year = new Date().getFullYear();
        const invoiceCount = invoices.filter(inv => inv.status === 'paid' || (inv.invoiceNumber && inv.invoiceNumber !== 'N/A')).length + 1;
        updatedInvoice.invoiceNumber = `INV-${year}-${String(invoiceCount).padStart(5, '0')}`;
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

    dispatch({ type: 'UPDATE_INVOICE', payload: updatedInvoice });
    showToast(`Invoice marked as ${newStatus}${newStatus === 'paid' && (!invoice.invoiceNumber || invoice.invoiceNumber === 'N/A') ? ' - Invoice number generated and stock reduced' : ''}`, 'success');
  };

  // Generate PDF Invoice - Simple & Clean Layout
  const generatePDF = async (invoice) => {
    try {
      // Validate invoice data
      if (!invoice) {
        showToast('Invalid invoice data', 'error');
        return;
      }

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

    return filtered;
  }, [invoices, statusFilter, searchTerm]);

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
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create Invoice
        </button>
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
                disabled={!!editingInvoice}
              >
                <option value="">Select Customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} {customer.phone ? `(${customer.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
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
                {currentItem.skuId && (
                  <p className="text-xs text-gray-500 mt-1">
                    Available: {getStockForSku(currentItem.skuId, currentItem.packType).toFixed(2)} packs
                  </p>
                )}
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
                      <th className="text-left py-2 px-4 font-semibold text-gray-700">Pack Type</th>
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
                        <td className="py-2 px-4 capitalize">{item.packType}</td>
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

