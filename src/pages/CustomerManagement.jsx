import React, { useState } from 'react';
import { Plus, Edit, Trash2, Search, X, User, Mail, Phone, MapPin, Building2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function CustomerManagement() {
  const { state, dispatch, showToast } = useApp();
  const { customers } = state;
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
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

    if (editingCustomer) {
      dispatch({
        type: 'UPDATE_CUSTOMER',
        payload: { ...formData, id: editingCustomer.id },
      });
      showToast('Customer updated successfully', 'success');
    } else {
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
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Customer
        </button>
      </div>

      {/* Search Bar */}
      {!showForm && customers.length > 0 && (
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
      {!showForm && (
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

