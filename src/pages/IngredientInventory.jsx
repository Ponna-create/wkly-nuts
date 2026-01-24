import React, { useState } from 'react';
import { Plus, ChevronDown, ChevronRight, Package, AlertCircle, Clock, Search, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

// Helper to format date
const formatDate = (date) => new Date(date).toLocaleDateString('en-IN');

// Helper for status colors
const getStatusColor = (status, expiryDate) => {
    if (status === 'expired') return 'bg-red-100 text-red-800';
    if (status === 'consumed') return 'bg-gray-100 text-gray-600';

    const daysToExpiry = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysToExpiry < 0) return 'bg-red-100 text-red-800'; // Expired but marked active
    if (daysToExpiry < 30) return 'bg-orange-100 text-orange-800'; // Expiring soon
    return 'bg-green-100 text-green-800'; // Good
};

export default function IngredientInventory() {
    const { state, dispatch, showToast } = useApp();
    const { ingredients, vendors } = state;

    const [expandedId, setExpandedId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddBatchModal, setShowAddBatchModal] = useState(false);

    // Add Batch Form State
    const [batchForm, setBatchForm] = useState({
        ingredientId: '',
        vendorId: '',
        batchNumber: '',
        quantity: '',
        price: '',
        expiryDate: '',
        receivedDate: new Date().toISOString().split('T')[0]
    });

    const filteredIngredients = ingredients.filter(ing =>
        ing.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAddBatch = async () => {
        if (!batchForm.ingredientId || !batchForm.vendorId || !batchForm.quantity || !batchForm.price || !batchForm.expiryDate) {
            showToast('Please fill all required fields', 'error');
            return;
        }

        try {
            dispatch({
                type: 'ADD_BATCH',
                payload: {
                    ...batchForm,
                    quantity: parseFloat(batchForm.quantity),
                    price: parseFloat(batchForm.price)
                }
            });
            showToast('Batch added successfully', 'success');
            setShowAddBatchModal(false);
            setBatchForm({
                ingredientId: '',
                vendorId: '',
                batchNumber: '',
                quantity: '',
                price: '',
                expiryDate: '',
                receivedDate: new Date().toISOString().split('T')[0]
            });
        } catch (error) {
            showToast('Error adding batch', 'error');
        }
    };

    const toggleExpand = (id) => {
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Ingredient Inventory</h1>
                    <p className="text-gray-600 mt-1">Track Raw Materials & Batches (FIFO)</p>
                </div>
                <button
                    onClick={() => setShowAddBatchModal(true)}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Receive Stock (New Batch)
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                    type="text"
                    placeholder="Search ingredients..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input-field pl-10"
                />
            </div>

            {/* Ingredient List */}
            <div className="space-y-4">
                {filteredIngredients.map(ing => (
                    <div key={ing.id} className="card overflow-hidden">
                        {/* Header / Summary Row */}
                        <div
                            className="flex items-center justify-between p-2 cursor-pointer hover:bg-gray-50 -m-6 p-6"
                            onClick={() => toggleExpand(ing.id)}
                        >
                            <div className="flex items-center gap-4">
                                {expandedId === ing.id ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">{ing.name}</h3>
                                    <div className="flex gap-4 text-sm text-gray-600 mt-1">
                                        <span>Total Stock: <span className="font-semibold text-gray-900">{ing.current_stock_total} {ing.unit}</span></span>
                                        {ing.batches?.length > 0 && (
                                            <span>Active Batches: <span className="font-semibold text-gray-900">{ing.ingredient_batches?.filter(b => b.status === 'active').length}</span></span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Status Indicator */}
                                {ing.current_stock_total <= (ing.safety_stock_level || 10) && (
                                    <div className="flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-1 rounded text-xs font-semibold">
                                        <AlertCircle className="w-4 h-4" /> Low Stock
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Expanded Batches View */}
                        {expandedId === ing.id && (
                            <div className="border-t bg-gray-50 -mx-6 mt-6 px-6 py-4">
                                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <Package className="w-4 h-4" /> Batch Details (FIFO)
                                </h4>

                                {(!ing.ingredient_batches || ing.ingredient_batches.length === 0) ? (
                                    <p className="text-gray-500 text-sm italic">No batch history found.</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-gray-500 font-medium border-b border-gray-200">
                                                <tr>
                                                    <th className="pb-2">Batch #</th>
                                                    <th className="pb-2">Qty Remaining</th>
                                                    <th className="pb-2">Expiry Date</th>
                                                    <th className="pb-2">Status</th>
                                                    <th className="pb-2">Usage Priority</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                                {ing.ingredient_batches
                                                    .sort((a, b) => new Date(a.expiry_date) - new Date(b.expiry_date)) // Sort by Expiry (FIFO)
                                                    .map((batch, idx) => {
                                                        const isExpired = new Date(batch.expiry_date) < new Date();
                                                        return (
                                                            <tr key={batch.id} className={batch.status !== 'active' ? 'opacity-50' : ''}>
                                                                <td className="py-2 font-mono text-xs">{batch.batch_number || 'N/A'}</td>
                                                                <td className="py-2 font-medium">{batch.quantity_remaining} {ing.unit}</td>
                                                                <td className="py-2 flex items-center gap-1">
                                                                    {formatDate(batch.expiry_date)}
                                                                    {isExpired && <AlertCircle className="w-3 h-3 text-red-500" />}
                                                                </td>
                                                                <td className="py-2">
                                                                    <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(batch.status, batch.expiry_date)} capitalize`}>
                                                                        {isExpired && batch.status === 'active' ? 'Expired' : batch.status}
                                                                    </span>
                                                                </td>
                                                                <td className="py-2 text-gray-500 text-xs">
                                                                    {batch.status === 'active' && !isExpired ? (idx === 0 ? 'High (Next to use)' : 'Queued') : '-'}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Add Batch Modal */}
            {showAddBatchModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-lg w-full p-6 shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">Receive New Stock (Add Batch)</h3>
                            <button onClick={() => setShowAddBatchModal(false)}><X className="w-5 h-5" /></button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="label">Ingredient</label>
                                <select
                                    className="input-field"
                                    value={batchForm.ingredientId}
                                    onChange={e => setBatchForm({ ...batchForm, ingredientId: e.target.value })}
                                >
                                    <option value="">Select Ingredient</option>
                                    {ingredients.map(ing => (
                                        <option key={ing.id} value={ing.id}>{ing.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="label">Vendor</label>
                                <select
                                    className="input-field"
                                    value={batchForm.vendorId}
                                    onChange={e => setBatchForm({ ...batchForm, vendorId: e.target.value })}
                                >
                                    <option value="">Select Vendor</option>
                                    {vendors.map(v => (
                                        <option key={v.id} value={v.id}>{v.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Quantity</label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        placeholder="0.00"
                                        value={batchForm.quantity}
                                        onChange={e => setBatchForm({ ...batchForm, quantity: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="label">Cost Price (Total/Unit)</label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        placeholder="₹"
                                        value={batchForm.price}
                                        onChange={e => setBatchForm({ ...batchForm, price: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Batch # (Optional)</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="e.g. B-001"
                                        value={batchForm.batchNumber}
                                        onChange={e => setBatchForm({ ...batchForm, batchNumber: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="label">Expiry Date</label>
                                    <input
                                        type="date"
                                        className="input-field"
                                        value={batchForm.expiryDate}
                                        onChange={e => setBatchForm({ ...batchForm, expiryDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-2">
                                <button onClick={() => setShowAddBatchModal(false)} className="btn-secondary">Cancel</button>
                                <button onClick={handleAddBatch} className="btn-primary">Save Batch</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
