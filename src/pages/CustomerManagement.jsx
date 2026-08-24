import React, { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, Search, X, User, Mail, Phone, MapPin, Building2, AlertTriangle, Merge, Download, Calendar, UserPlus, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';
import { formatDate } from '../utils/dateFormat';
import CustomerDetailModal from '../components/CustomerDetailModal';

export default function CustomerManagement() {
  const { state, dispatch, showToast } = useApp();
  const { customers, invoices, salesOrders } = state;
  const [activeTab, setActiveTab] = useState('customers'); // 'customers' | 'followups'
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [followUpData, setFollowUpData] = useState({
    name: '',
    phone: '',
    followUpDate: '',
    notes: '',
  });
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    gstin: '',
    customerType: 'individual',
    registrationDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      gstin: '',
      customerType: 'individual',
      registrationDate: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setEditingCustomer(null);
    setShowForm(false);
  };

  const handleSaveCustomer = () => {
    if (!formData.name || !formData.phone) {
      showToast('Please fill in name and phone number', 'error');
      return;
    }

    // Normalize phone number for duplicate checking
    const normalizedPhone = formData.phone.replace(/\D/g, '');

    if (editingCustomer) {
      dispatch({
        type: 'UPDATE_CUSTOMER',
        payload: { ...formData, id: editingCustomer.id },
      });
      showToast('Customer updated successfully', 'success');
    } else {
      // Check for duplicate by phone number
      const duplicateCustomer = customers.find(
        (c) => c.phone && normalizedPhone && 
        c.phone.replace(/\D/g, '') === normalizedPhone
      );
      
      if (duplicateCustomer) {
        showToast('A customer with this phone number already exists', 'error');
        return;
      }

      dispatch({
        type: 'ADD_CUSTOMER',
        payload: { ...formData, id: Date.now() + Math.random() },
      });
      showToast('Customer created successfully', 'success');
    }

    resetForm();
  };

  const handleEdit = (customer) => {
    setFormData({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      pincode: customer.pincode || '',
      gstin: customer.gstin || '',
      customerType: customer.customerType || 'individual',
      registrationDate: customer.registrationDate || customer.registration_date || customer.createdAt?.split('T')[0] || '',
      notes: customer.notes || '',
    });
    setEditingCustomer(customer);
    setShowForm(true);
  };

  const handleSaveFollowUp = async () => {
    if (!followUpData.name || !followUpData.phone) {
      showToast('Please fill in name and phone number', 'error');
      return;
    }
    setSavingFollowUp(true);
    const { data: customer, error } = await dbService.findOrCreateCustomer({
      name: followUpData.name,
      phone: followUpData.phone,
    });
    if (error || !customer) {
      showToast('Error saving follow-up customer', 'error');
      setSavingFollowUp(false);
      return;
    }
    dispatch({ type: 'REPLACE_CUSTOMER', payload: { tempId: customer.id, customer } });

    const { data: newOrder, error: orderError } = await dbService.createSalesOrder({
      customerId: customer.id,
      customerName: customer.name,
      orderDate: new Date().toISOString().split('T')[0],
      orderSource: 'whatsapp',
      items: [],
      status: 'follow_up',
      paymentStatus: 'pending',
      followUpDate: followUpData.followUpDate || null,
      followUpNotes: followUpData.notes || null,
    });
    setSavingFollowUp(false);

    if (orderError) {
      showToast('Customer saved, but follow-up entry failed', 'error');
      return;
    }

    dispatch({ type: 'ADD_SALES_ORDER', payload: newOrder });
    showToast('Follow-up customer added', 'success');
    setFollowUpData({ name: '', phone: '', followUpDate: '', notes: '' });
    setShowFollowUpForm(false);
    setActiveTab('followups');
  };

  const handleDeleteFollowUp = async (orderId) => {
    if (!window.confirm('Remove this follow-up lead?')) return;
    const { error } = await dbService.deleteSalesOrder(orderId);
    if (error) {
      showToast('Error removing follow-up', 'error');
      return;
    }
    dispatch({ type: 'DELETE_SALES_ORDER', payload: orderId });
    showToast('Follow-up removed', 'success');
  };

  const followUpLeads = useMemo(() =>
    (salesOrders || [])
      .filter(o => o.status === 'follow_up')
      .sort((a, b) => new Date(b.created_at || b.order_date || 0) - new Date(a.created_at || a.order_date || 0)),
    [salesOrders]
  );

  const handleDelete = (customerId) => {
    if (window.confirm('Are you sure you want to delete this customer? This action cannot be undone.')) {
      dispatch({ type: 'DELETE_CUSTOMER', payload: customerId });
      showToast('Customer deleted', 'success');
    }
  };

  // Detect duplicates by phone number
  const duplicateGroups = useMemo(() => {
    const groups = {};
    customers.forEach((customer) => {
      if (customer.phone) {
        const normalizedPhone = customer.phone.replace(/\D/g, '');
        if (normalizedPhone) {
          if (!groups[normalizedPhone]) {
            groups[normalizedPhone] = [];
          }
          groups[normalizedPhone].push(customer);
        }
      }
    });
    // Return only groups with more than one customer
    return Object.values(groups).filter((group) => group.length > 1);
  }, [customers]);

  const handleMergeDuplicates = (duplicateGroup) => {
    // Keep the first customer (usually the oldest/primary one)
    const primaryCustomer = duplicateGroup[0];
    const duplicatesToDelete = duplicateGroup.slice(1);

    // Merge data from duplicates into primary customer
    const mergedCustomer = { ...primaryCustomer };
    
    duplicatesToDelete.forEach((dup) => {
      // Merge fields that are missing in primary but present in duplicate
      if (!mergedCustomer.email && dup.email) mergedCustomer.email = dup.email;
      if (!mergedCustomer.address && dup.address) mergedCustomer.address = dup.address;
      if (!mergedCustomer.city && dup.city) mergedCustomer.city = dup.city;
      if (!mergedCustomer.state && dup.state) mergedCustomer.state = dup.state;
      if (!mergedCustomer.pincode && dup.pincode) mergedCustomer.pincode = dup.pincode;
      if (!mergedCustomer.gstin && dup.gstin) mergedCustomer.gstin = dup.gstin;
      if (!mergedCustomer.notes && dup.notes) mergedCustomer.notes = dup.notes;
      // Combine notes if both exist
      if (mergedCustomer.notes && dup.notes && mergedCustomer.notes !== dup.notes) {
        mergedCustomer.notes = `${mergedCustomer.notes}\n${dup.notes}`;
      }
    });

    // Update primary customer with merged data
    dispatch({ type: 'UPDATE_CUSTOMER', payload: mergedCustomer });

    // Update invoices that reference duplicate customers to point to primary customer
    duplicatesToDelete.forEach((dup) => {
      const relatedInvoices = invoices.filter(
        (inv) => inv.customerId && String(inv.customerId) === String(dup.id)
      );
      relatedInvoices.forEach((invoice) => {
        dispatch({
          type: 'UPDATE_INVOICE',
          payload: { ...invoice, customerId: primaryCustomer.id },
        });
      });
    });

    // Delete duplicate customers
    duplicatesToDelete.forEach((dup) => {
      dispatch({ type: 'DELETE_CUSTOMER', payload: dup.id });
    });

    const invoiceCount = duplicatesToDelete.reduce((count, dup) => {
      return count + invoices.filter(
        (inv) => inv.customerId && String(inv.customerId) === String(dup.id)
      ).length;
    }, 0);

    showToast(
      `Merged ${duplicatesToDelete.length} duplicate(s) into ${primaryCustomer.name}${invoiceCount > 0 ? ` and updated ${invoiceCount} invoice(s)` : ''}`,
      'success'
    );
    setShowDuplicates(false);
  };

  const handleDeleteDuplicates = (duplicateGroup) => {
    const primaryCustomer = duplicateGroup[0];
    const duplicatesToDelete = duplicateGroup.slice(1);

    if (window.confirm(`Delete ${duplicatesToDelete.length} duplicate(s) of ${primaryCustomer.name}?`)) {
      duplicatesToDelete.forEach((dup) => {
        dispatch({ type: 'DELETE_CUSTOMER', payload: dup.id });
      });
      showToast(`Deleted ${duplicatesToDelete.length} duplicate(s)`, 'success');
      setShowDuplicates(false);
    }
  };

  // Sort customers by creation date (oldest first) and add row numbers
  const sortedAndNumberedCustomers = useMemo(() => {
    // Sort by creation date (oldest first)
    const sorted = [...customers].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : (a.id || 0);
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : (b.id || 0);
      return dateA - dateB; // Oldest first
    });
    
    // Add row numbers
    return sorted.map((customer, index) => ({
      ...customer,
      rowNumber: index + 1
    }));
  }, [customers]);

  const filteredCustomers = sortedAndNumberedCustomers.filter((customer) =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (customer.phone && customer.phone.includes(searchTerm))
  );

  // Order count + LTV per customer, keyed by customer_id (falling back to
  // name for orders that predate a linked customer record) — same shape
  // CustomerDetailModal expects, so clicking a name here opens the exact
  // same purchase-history view as Customer Explorer.
  const customerOrderStats = useMemo(() => {
    const stats = new Map();
    (salesOrders || []).forEach(o => {
      const key = o.customer_id || o.customer_name;
      if (!key) return;
      const date = new Date(o.order_date);
      if (!stats.has(key)) stats.set(key, { orderCount: 0, ltv: 0, firstOrderDate: date, lastOrderDate: date });
      const s = stats.get(key);
      s.orderCount++;
      s.ltv += parseFloat(o.total_amount) || 0;
      if (date < s.firstOrderDate) s.firstOrderDate = date;
      if (date > s.lastOrderDate) s.lastOrderDate = date;
    });
    return stats;
  }, [salesOrders]);

  const [selectedCustomerProfile, setSelectedCustomerProfile] = useState(null);
  const openCustomerDetail = (customer) => {
    const key = customer.id || customer.name;
    const s = customerOrderStats.get(key) || { orderCount: 0, ltv: 0, firstOrderDate: null, lastOrderDate: null };
    const today = new Date();
    setSelectedCustomerProfile({
      key,
      name: customer.name,
      phone: customer.phone,
      city: customer.city,
      orderCount: s.orderCount,
      ltv: s.ltv,
      firstOrderDate: s.firstOrderDate,
      lastOrderDate: s.lastOrderDate,
      daysSinceLast: s.lastOrderDate ? Math.floor((today - s.lastOrderDate) / (1000 * 60 * 60 * 24)) : null,
    });
  };

  // Export customers to CSV
  const exportCustomers = () => {
    const customersToExport = filteredCustomers.length > 0 ? filteredCustomers : sortedAndNumberedCustomers;
    
    // CSV Headers
    const headers = [
      'Row #',
      'Name',
      'Phone',
      'Email',
      'Address',
      'City',
      'State',
      'Pincode',
      'GSTIN',
      'Customer Type',
      'Notes',
      'Created Date'
    ];
    
    // CSV Rows
    const rows = customersToExport.map(customer => [
      customer.rowNumber || '',
      customer.name || '',
      customer.phone || '',
      customer.email || '',
      customer.address || '',
      customer.city || '',
      customer.state || '',
      customer.pincode || '',
      customer.gstin || '',
      customer.customerType === 'business' ? 'Business' : 'Individual',
      customer.notes || '',
      customer.createdAt ? formatDate(customer.createdAt) : ''
    ]);
    
    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(cell => {
          // Escape commas and quotes in CSV
          const cellStr = String(cell || '');
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(',')
      )
    ].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `customers-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast(`Exported ${customersToExport.length} customer(s) to CSV`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Management</h1>
          <p className="text-gray-600 mt-1">Manage your customers and their information</p>
        </div>
        <div className="flex gap-2">
          {duplicateGroups.length > 0 && !showDuplicates && (
            <button
              onClick={() => setShowDuplicates(true)}
              className="btn-secondary flex items-center gap-2 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border-yellow-200"
            >
              <AlertTriangle className="w-5 h-5" />
              {duplicateGroups.length} Duplicate{duplicateGroups.length > 1 ? 's' : ''} Found
            </button>
          )}
          {!showForm && !showDuplicates && customers.length > 0 && (
            <button
              onClick={exportCustomers}
              className="btn-secondary flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              Export
            </button>
          )}
          <button
            onClick={() => setShowFollowUpForm(true)}
            className="btn-secondary flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
          >
            <UserPlus className="w-5 h-5" />
            Add Follow-up
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Customer
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('customers')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
            activeTab === 'customers' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          All Customers ({customers.length})
        </button>
        <button
          onClick={() => setActiveTab('followups')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition flex items-center gap-1.5 ${
            activeTab === 'followups' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <Clock className="w-4 h-4" />
          Follow-ups ({followUpLeads.length})
        </button>
      </div>

      {/* Add Follow-up Modal */}
      {showFollowUpForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Add Follow-up Customer</h2>
              <button onClick={() => setShowFollowUpForm(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                For enquiries that aren't confirmed yet — e.g. "I'll pay tomorrow". This creates a lead
                you can follow up on from the Sales Orders &rarr; Follow-up tab, separate from confirmed orders.
              </p>
              <div>
                <label className="label">Customer Name *</label>
                <input
                  type="text"
                  value={followUpData.name}
                  onChange={(e) => setFollowUpData(prev => ({ ...prev, name: e.target.value }))}
                  className="input-field"
                  placeholder="Enter customer name"
                />
              </div>
              <div>
                <label className="label">Phone Number *</label>
                <input
                  type="tel"
                  value={followUpData.phone}
                  onChange={(e) => setFollowUpData(prev => ({ ...prev, phone: e.target.value }))}
                  className="input-field"
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <label className="label">Follow-up Date</label>
                <input
                  type="date"
                  value={followUpData.followUpDate}
                  onChange={(e) => setFollowUpData(prev => ({ ...prev, followUpDate: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  value={followUpData.notes}
                  onChange={(e) => setFollowUpData(prev => ({ ...prev, notes: e.target.value }))}
                  className="input-field"
                  rows="3"
                  placeholder="What did the customer enquire about? Any preferences?"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowFollowUpForm(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleSaveFollowUp} disabled={savingFollowUp} className="btn-primary disabled:opacity-50">
                  {savingFollowUp ? 'Saving...' : 'Save Follow-up'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Duplicates Section */}
      {activeTab === 'customers' && showDuplicates && duplicateGroups.length > 0 && (
        <div className="card bg-yellow-50 border-yellow-200">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-bold text-yellow-900 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6" />
                Duplicate Customers Found
              </h2>
              <p className="text-yellow-700 mt-1">
                Found {duplicateGroups.length} group{duplicateGroups.length > 1 ? 's' : ''} of duplicate customers
              </p>
            </div>
            <button
              onClick={() => setShowDuplicates(false)}
              className="text-yellow-700 hover:text-yellow-900"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4">
            {duplicateGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="bg-white rounded-lg p-4 border border-yellow-200">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {group.length} duplicate{group.length > 1 ? 's' : ''} with phone: {group[0].phone}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      All have the same phone number: {group[0].phone}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleMergeDuplicates(group)}
                      className="btn-primary flex items-center gap-2 text-sm py-1.5 px-3"
                    >
                      <Merge className="w-4 h-4" />
                      Merge All
                    </button>
                    <button
                      onClick={() => handleDeleteDuplicates(group)}
                      className="btn-secondary flex items-center gap-2 text-sm py-1.5 px-3 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Duplicates
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {group.map((customer, idx) => (
                    <div
                      key={customer.id}
                      className={`p-3 rounded border ${
                        idx === 0
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{customer.name}</span>
                            {idx === 0 && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                Primary (will be kept)
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            <div>Phone: {customer.phone}</div>
                            {customer.email && <div>Email: {customer.email}</div>}
                            {customer.address && (
                              <div>
                                Address: {customer.address}
                                {customer.city && `, ${customer.city}`}
                                {customer.state && `, ${customer.state}`}
                                {customer.pincode && ` ${customer.pincode}`}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(customer.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Delete this duplicate"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Bar */}
      {activeTab === 'customers' && !showForm && !showDuplicates && customers.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search customers by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      )}

      {/* Customer Form */}
      {activeTab === 'customers' && showForm && (
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
            </h2>
            <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="input-field pl-10"
                      placeholder="Enter customer name"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Customer Type</label>
                  <select
                    value={formData.customerType}
                    onChange={(e) => setFormData({ ...formData, customerType: e.target.value })}
                    className="input-field"
                  >
                    <option value="individual">Individual</option>
                    <option value="business">Business</option>
                  </select>
                </div>
                <div>
                  <label className="label">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="input-field pl-10"
                      placeholder="Enter phone number"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Registration Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="date"
                      value={formData.registrationDate}
                      onChange={(e) => setFormData({ ...formData, registrationDate: e.target.value })}
                      className="input-field pl-10"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="input-field pl-10"
                      placeholder="Enter email address"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Address */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Address Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="label">Street Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="input-field pl-10"
                      placeholder="Enter street address"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="input-field"
                    placeholder="Enter city"
                  />
                </div>
                <div>
                  <label className="label">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="input-field"
                    placeholder="Enter state"
                  />
                </div>
                <div>
                  <label className="label">Pincode</label>
                  <input
                    type="text"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    className="input-field"
                    placeholder="Enter pincode"
                  />
                </div>
                <div>
                  <label className="label">GSTIN (for businesses)</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      value={formData.gstin}
                      onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                      className="input-field pl-10"
                      placeholder="Enter GSTIN (optional)"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Notes */}
            <div>
              <label className="label">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input-field"
                rows="3"
                placeholder="Any additional notes about this customer..."
              />
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button onClick={resetForm} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleSaveCustomer} className="btn-primary">
                {editingCustomer ? 'Update Customer' : 'Create Customer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Follow-ups List */}
      {activeTab === 'followups' && (
        <div className="card">
          {followUpLeads.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No follow-up leads yet</h3>
              <p className="text-gray-600 mb-4">Enquiries that aren't confirmed orders show up here</p>
              <button onClick={() => setShowFollowUpForm(true)} className="btn-primary">
                <UserPlus className="w-5 h-5 inline mr-2" />
                Add Follow-up
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Follow-up Leads ({followUpLeads.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Phone</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Follow-up Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Notes</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {followUpLeads.map((lead) => (
                      <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-4 font-medium text-gray-900">{lead.customer_name || 'N/A'}</td>
                        <td className="py-4 px-4 text-sm text-gray-900">{lead.phone || '—'}</td>
                        <td className="py-4 px-4 text-sm text-gray-900">
                          {lead.follow_up_date || <span className="text-gray-400 italic">Not set</span>}
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-600 max-w-xs truncate" title={lead.follow_up_notes}>
                          {lead.follow_up_notes || <span className="text-gray-400 italic">—</span>}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex justify-end">
                            <button
                              onClick={() => handleDeleteFollowUp(lead.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-4">
                To convert a lead into a real order, use <strong>New Order</strong> on the Sales Orders page —
                entering the same mobile number will find this customer automatically.
              </p>
            </>
          )}
        </div>
      )}

      {/* Customers List */}
      {activeTab === 'customers' && !showForm && !showDuplicates && (
        <div className="card">
          {customers.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No customers yet</h3>
              <p className="text-gray-600 mb-4">Get started by adding your first customer</p>
              <button onClick={() => setShowForm(true)} className="btn-primary">
                <Plus className="w-5 h-5 inline mr-2" />
                Add Customer
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  All Customers ({filteredCustomers.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-center py-3 px-4 font-semibold text-gray-700 w-16">#</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Contact</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Address</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Orders / LTV</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((customer) => (
                      <tr key={customer.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-4 text-center">
                          <div className="font-semibold text-gray-600">{customer.rowNumber || ''}</div>
                        </td>
                        <td className="py-4 px-4">
                          <button onClick={() => openCustomerDetail(customer)} className="text-left group">
                            <div className="font-medium text-gray-900 group-hover:text-teal-600 group-hover:underline">{customer.name}</div>
                          </button>
                          {customer.gstin && (
                            <div className="text-xs text-gray-500 mt-1">GST: {customer.gstin}</div>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm text-gray-900">{customer.phone}</div>
                          {customer.email && (
                            <div className="text-xs text-gray-500">{customer.email}</div>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm text-gray-900">
                            {customer.address && <div>{customer.address}</div>}
                            {(customer.city || customer.state) && (
                              <div className="text-gray-600">
                                {[customer.city, customer.state, customer.pincode]
                                  .filter(Boolean)
                                  .join(', ')}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          {(() => {
                            const s = customerOrderStats.get(customer.id) || customerOrderStats.get(customer.name);
                            return s ? (
                              <>
                                <div className="text-sm font-medium text-gray-900">{s.orderCount} order{s.orderCount !== 1 ? 's' : ''}</div>
                                <div className="text-xs text-gray-500">₹{s.ltv.toFixed(0)}</div>
                              </>
                            ) : <span className="text-xs text-gray-300">—</span>;
                          })()}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            customer.customerType === 'business'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {customer.customerType === 'business' ? 'Business' : 'Individual'}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEdit(customer)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(customer.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {selectedCustomerProfile && (
        <CustomerDetailModal profile={selectedCustomerProfile} orders={salesOrders} onClose={() => setSelectedCustomerProfile(null)} />
      )}
    </div>
  );
}

