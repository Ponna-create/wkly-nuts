import React, { useState } from 'react';
import { Plus, Edit, Trash2, Search, X, Star } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function VendorManagement() {
  const { state, dispatch, showToast } = useApp();
  const { vendors } = state;
  const [showForm, setShowForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    location: '',
    email: '',
    ingredients: [],
  });
  const [currentIngredient, setCurrentIngredient] = useState({
    name: '',
    quantityAvailable: '',
    unit: 'kg',
    pricePerUnit: '',
    quality: 5,
    notes: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      location: '',
      email: '',
      ingredients: [],
    });
    setCurrentIngredient({
      name: '',
      quantityAvailable: '',
      unit: 'kg',
      pricePerUnit: '',
      quality: 5,
      notes: '',
    });
    setEditingVendor(null);
    setShowForm(false);
  };

  const handleAddIngredient = () => {
    if (!currentIngredient.name || !currentIngredient.quantityAvailable || !currentIngredient.pricePerUnit) {
      showToast('Please fill in ingredient name, quantity and price', 'error');
      return;
    }

    const newIngredient = {
      id: Date.now() + Math.random(),
      ...currentIngredient,
      quantityAvailable: parseFloat(currentIngredient.quantityAvailable),
      pricePerUnit: parseFloat(currentIngredient.pricePerUnit),
    };

    setFormData({
      ...formData,
      ingredients: [...formData.ingredients, newIngredient],
    });

    setCurrentIngredient({
      name: '',
      quantityAvailable: '',
      unit: 'kg',
      pricePerUnit: '',
      quality: 5,
      notes: '',
    });

    showToast('Ingredient added', 'success');
  };

  const handleRemoveIngredient = (ingredientId) => {
    setFormData({
      ...formData,
      ingredients: formData.ingredients.filter(ing => ing.id !== ingredientId),
    });
  };

  const handleEditIngredient = (ingredient) => {
    setEditingIngredient(ingredient);
    setCurrentIngredient({
      name: ingredient.name,
      quantityAvailable: ingredient.quantityAvailable.toString(),
      unit: ingredient.unit,
      pricePerUnit: ingredient.pricePerUnit.toString(),
      quality: ingredient.quality,
      notes: ingredient.notes || '',
    });
  };

  const handleUpdateIngredient = () => {
    if (!currentIngredient.name || !currentIngredient.quantityAvailable || !currentIngredient.pricePerUnit) {
      showToast('Please fill in ingredient name, quantity and price', 'error');
      return;
    }

    const updatedIngredient = {
      ...currentIngredient,
      quantityAvailable: parseFloat(currentIngredient.quantityAvailable),
      pricePerUnit: parseFloat(currentIngredient.pricePerUnit),
    };

    setFormData({
      ...formData,
      ingredients: formData.ingredients.map(ing => 
        ing.id === editingIngredient.id ? { ...updatedIngredient, id: editingIngredient.id } : ing
      ),
    });

    setEditingIngredient(null);
    setCurrentIngredient({
      name: '',
      quantityAvailable: '',
      unit: 'kg',
      pricePerUnit: '',
      quality: 5,
      notes: '',
    });

    showToast('Ingredient updated', 'success');
  };

  const handleCancelEdit = () => {
    setEditingIngredient(null);
    setCurrentIngredient({
      name: '',
      quantityAvailable: '',
      unit: 'kg',
      pricePerUnit: '',
      quality: 5,
      notes: '',
    });
  };

  const handleSaveVendor = () => {
    if (!formData.name || !formData.phone || !formData.location) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    if (formData.ingredients.length === 0) {
      showToast('Please add at least one ingredient', 'error');
      return;
    }

    if (editingVendor) {
      dispatch({
        type: 'UPDATE_VENDOR',
        payload: { ...formData, id: editingVendor.id },
      });
      showToast('Vendor updated successfully', 'success');
    } else {
      dispatch({
        type: 'ADD_VENDOR',
        payload: { ...formData, id: Date.now() },
      });
      showToast('Vendor created successfully', 'success');
    }

    resetForm();
  };

  const handleEdit = (vendor) => {
    setFormData(vendor);
    setEditingVendor(vendor);
    setShowForm(true);
  };

  const handleDelete = (vendorId) => {
    if (window.confirm('Are you sure you want to delete this vendor?')) {
      dispatch({ type: 'DELETE_VENDOR', payload: vendorId });
      showToast('Vendor deleted', 'success');
    }
  };

  const filteredVendors = vendors.filter((vendor) =>
    vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vendor.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calculateTotalSpend = (vendor) => {
    return vendor.ingredients.reduce(
      (sum, ing) => sum + ing.quantityAvailable * ing.pricePerUnit,
      0
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendor Management</h1>
          <p className="text-gray-600 mt-1">Manage your ingredient suppliers</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create Vendor
        </button>
      </div>

      {/* Search Bar */}
      {!showForm && vendors.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search vendors by name or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      )}

      {/* Vendor Form */}
      {showForm && (
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              {editingVendor ? 'Edit Vendor' : 'Create New Vendor'}
            </h2>
            <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Vendor Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="label">
                Vendor Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-field"
                placeholder="Enter vendor name"
              />
            </div>
            <div>
              <label className="label">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="input-field"
                placeholder="Enter phone number"
              />
            </div>
            <div>
              <label className="label">
                Location/Address <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="input-field"
                placeholder="Enter location"
              />
            </div>
            <div>
              <label className="label">Email (Optional)</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input-field"
                placeholder="Enter email"
              />
            </div>
          </div>

          {/* Ingredients Section */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add Ingredients</h3>

            {/* Added Ingredients List */}
            {formData.ingredients.length > 0 && (
              <div className="mb-6 space-y-3">
                {formData.ingredients.map((ing) => (
                  <div
                    key={ing.id}
                    className="bg-gray-50 p-4 rounded-lg flex justify-between items-start"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-gray-900">{ing.name}</h4>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < ing.quality ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>
                          Quantity: {ing.quantityAvailable} {ing.unit} | Price: ₹{ing.pricePerUnit}/{ing.unit}
                        </p>
                        {ing.notes && <p>Notes: {ing.notes}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditIngredient(ing)}
                        className="text-primary hover:text-primary-700"
                        title="Edit ingredient"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRemoveIngredient(ing.id)}
                        className="text-red-500 hover:text-red-700"
                        title="Delete ingredient"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add/Edit Ingredient Form */}
            <div className="bg-blue-50 p-4 rounded-lg space-y-4">
              <h4 className="font-semibold text-gray-900">
                {editingIngredient ? 'Edit Ingredient' : 'Add New Ingredient'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="label text-sm">Ingredient Name</label>
                  <input
                    type="text"
                    value={currentIngredient.name}
                    onChange={(e) =>
                      setCurrentIngredient({ ...currentIngredient, name: e.target.value })
                    }
                    className="input-field"
                    placeholder="e.g., Almonds"
                  />
                </div>
                <div>
                  <label className="label text-sm">Quantity Available</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={currentIngredient.quantityAvailable}
                      onChange={(e) =>
                        setCurrentIngredient({
                          ...currentIngredient,
                          quantityAvailable: e.target.value,
                        })
                      }
                      className="input-field flex-1"
                      placeholder="100"
                    />
                    <select
                      value={currentIngredient.unit}
                      onChange={(e) =>
                        setCurrentIngredient({ ...currentIngredient, unit: e.target.value })
                      }
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="input-field w-24"
                      style={{ 
                        zIndex: 99999, 
                        position: 'relative',
                        pointerEvents: 'auto',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="kg">kg</option>
                      <option value="grams">grams</option>
                      <option value="pieces">pieces</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label text-sm">Price per Unit (₹)</label>
                  <input
                    type="number"
                    value={currentIngredient.pricePerUnit}
                    onChange={(e) =>
                      setCurrentIngredient({ ...currentIngredient, pricePerUnit: e.target.value })
                    }
                    className="input-field"
                    placeholder="500"
                  />
                </div>
                <div>
                  <label className="label text-sm">Quality Rating</label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() =>
                          setCurrentIngredient({ ...currentIngredient, quality: rating })
                        }
                        className="focus:outline-none"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            rating <= currentIngredient.quality
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="label text-sm">Notes (Optional)</label>
                  <textarea
                    value={currentIngredient.notes}
                    onChange={(e) =>
                      setCurrentIngredient({ ...currentIngredient, notes: e.target.value })
                    }
                    className="input-field"
                    rows="2"
                    placeholder="Any additional notes..."
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={editingIngredient ? handleUpdateIngredient : handleAddIngredient}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  {editingIngredient ? 'Update Ingredient' : 'Add Ingredient'}
                </button>
                {editingIngredient && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="btn-secondary"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={resetForm} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleSaveVendor} className="btn-primary">
              {editingVendor ? 'Update Vendor' : 'Save Vendor'}
            </button>
          </div>
        </div>
      )}

      {/* Vendor List */}
      {!showForm && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredVendors.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500 text-lg">
                {searchTerm ? 'No vendors found matching your search' : 'No vendors added yet'}
              </p>
            </div>
          ) : (
            filteredVendors.map((vendor) => (
              <div key={vendor.id} className="card">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{vendor.name}</h3>
                    <p className="text-sm text-gray-600">{vendor.location}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(vendor)}
                      className="text-primary hover:text-primary-700"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(vendor.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <p className="text-sm">
                    <span className="font-medium">Phone:</span> {vendor.phone}
                  </p>
                  {vendor.email && (
                    <p className="text-sm">
                      <span className="font-medium">Email:</span> {vendor.email}
                    </p>
                  )}
                  <p className="text-sm">
                    <span className="font-medium">Ingredients:</span> {vendor.ingredients.length}
                  </p>
                  <p className="text-sm font-semibold text-primary">
                    Total Inventory Value: ₹{calculateTotalSpend(vendor).toLocaleString('en-IN')}
                  </p>
                </div>

                {/* Ingredients List */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Available Ingredients</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {vendor.ingredients.map((ing) => (
                      <div
                        key={ing.id}
                        className="bg-gray-50 p-3 rounded-lg text-sm"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-gray-900">{ing.name}</span>
                          <div className="flex items-center gap-1">
                            {[...Array(ing.quality)].map((_, i) => (
                              <Star
                                key={i}
                                className="w-3 h-3 text-yellow-400 fill-yellow-400"
                              />
                            ))}
                          </div>
                        </div>
                        <div className="text-gray-600">
                          {ing.quantityAvailable} {ing.unit} @ ₹{ing.pricePerUnit}/{ing.unit}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
