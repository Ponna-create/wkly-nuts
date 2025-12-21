import React, { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, Search, X, User, Mail, Phone, MapPin, Building2, AlertTriangle, Merge } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function CustomerManagement() {
  const { state, dispatch, showToast } = useApp();
  const { customers, invoices } = state;
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDuplicates, setShowDuplicates] = useState(false);
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
      notes: customer.notes || '',
    });
    setEditingCustomer(customer);
    setShowForm(true);
  };

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

  const filteredCustomers = customers.filter((customer) =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (customer.phone && customer.phone.includes(searchTerm))
  );

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
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Customer
          </button>
        </div>
      </div>

      {/* Duplicates Section */}
      {showDuplicates && duplicateGroups.length > 0 && (
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
      {!showForm && !showDuplicates && customers.length > 0 && (
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
      {showForm && (
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

            {/* Address Information */}
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

      {/* Customers List */}
      {!showForm && !showDuplicates && (
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
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Contact</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Address</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                      <th className="text-right py-3 px-4 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((customer) => (
                      <tr key={customer.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-4">
                          <div className="font-medium text-gray-900">{customer.name}</div>
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
    </div>
  );
}

