import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';
import {
  Plus, Search, X, Edit2, Trash2, Factory, Play, CheckCircle2,
  Clock, AlertTriangle, ChevronDown, ChevronUp, Package, Hash,
  IndianRupee, Calendar, Filter
} from 'lucide-react';

const SKU_CODES = [
  { code: 'DP', name: 'Day Pack' },
  { code: 'SO', name: 'Soak Overnight' },
  { code: 'SC', name: 'Seed Cycle' },
  { code: 'DB', name: 'Date Bytes' },
];

const STATUSES = [
  { value: 'planned', label: 'Planned', color: 'bg-gray-100 text-gray-700', icon: Clock },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: Play },
  { value: 'quality_check', label: 'Quality Check', color: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: X },
];

const QUALITY_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'text-gray-500' },
  { value: 'passed', label: 'Passed', color: 'text-green-600' },
  { value: 'failed', label: 'Failed', color: 'text-red-600' },
  { value: 'partial', label: 'Partial', color: 'text-yellow-600' },
];

export default function ProductionRuns() {
  const { state, showToast } = useApp();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRun, setEditingRun] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    const { data } = await dbService.getProductionRuns();
    setRuns(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadRuns(); }, [loadRuns]);

  const filtered = runs.filter(r => {
    const matchesSearch = !search ||
      (r.run_number || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.sku_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.sku_code || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.instance_start || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const todayRuns = runs.filter(r => r.batch_date === new Date().toISOString().split('T')[0]);
  const activeRuns = runs.filter(r => ['in_progress', 'quality_check'].includes(r.status));
  const totalProduced = runs.filter(r => r.status === 'completed').reduce((sum, r) => sum + (r.actual_quantity || 0), 0);
  const totalCost = runs.filter(r => r.status === 'completed').reduce((sum, r) => sum + (parseFloat(r.total_cost) || 0), 0);

  const getStatusInfo = (status) => STATUSES.find(s => s.value === status) || STATUSES[0];

  const handleDelete = async (id) => {
    if (!confirm('Delete this production run?')) return;
    const { error } = await dbService.deleteProductionRun(id);
    if (error) { showToast('Failed to delete', 'error'); return; }
    setRuns(prev => prev.filter(r => r.id !== id));
    showToast('Production run deleted');
  };

  const handleStatusChange = async (run, newStatus) => {
    const updated = { ...run, status: newStatus };
    const { data, error } = await dbService.updateProductionRun(updated);
    if (error) { showToast('Failed to update status', 'error'); return; }
    setRuns(prev => prev.map(r => r.id === run.id ? (data || { ...run, status: newStatus }) : r));
    showToast(`Status updated to ${getStatusInfo(newStatus).label}`);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Calendar className="w-4 h-4" /> Today
          </div>
          <p className="text-2xl font-bold">{todayRuns.length}</p>
          <p className="text-xs text-gray-400">production runs</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-blue-500 text-sm mb-1">
            <Play className="w-4 h-4" /> Active
          </div>
          <p className="text-2xl font-bold text-blue-600">{activeRuns.length}</p>
          <p className="text-xs text-gray-400">in progress</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-green-500 text-sm mb-1">
            <Package className="w-4 h-4" /> Produced
          </div>
          <p className="text-2xl font-bold text-green-600">{totalProduced}</p>
          <p className="text-xs text-gray-400">units completed</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-amber-500 text-sm mb-1">
            <IndianRupee className="w-4 h-4" /> Total Cost
          </div>
          <p className="text-2xl font-bold">{totalCost.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}</p>
          <p className="text-xs text-gray-400">production cost</p>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search runs, SKU, instance..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500">
            <option value="all">All Status</option>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <button onClick={() => { setEditingRun(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Production Run
        </button>
      </div>

      {/* Runs List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading production runs...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Factory className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No production runs found</p>
          <button onClick={() => { setEditingRun(null); setShowForm(true); }}
            className="mt-3 text-emerald-600 text-sm font-medium">+ Start your first production run</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(run => {
            const statusInfo = getStatusInfo(run.status);
            const StatusIcon = statusInfo.icon;
            return (
              <div key={run.id} className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(expandedId === run.id ? null : run.id)}>
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <Factory className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{run.run_number}</span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full font-medium">{run.sku_name}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${statusInfo.color}`}>
                        <StatusIcon className="w-3 h-3" /> {statusInfo.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                      <span>{new Date(run.batch_date).toLocaleDateString('en-IN')}</span>
                      <span>{run.planned_quantity} planned</span>
                      {run.actual_quantity > 0 && <span className="text-green-600">{run.actual_quantity} done</span>}
                      {run.instance_start && (
                        <span className="flex items-center gap-1 text-gray-500">
                          <Hash className="w-3 h-3" />{run.instance_start}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {parseFloat(run.total_cost) > 0 && (
                      <p className="font-semibold text-gray-900 text-sm">{parseFloat(run.total_cost).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</p>
                    )}
                    <span className="text-xs text-gray-400">{run.pack_type}</span>
                  </div>
                  {expandedId === run.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>

                {expandedId === run.id && (
                  <div className="border-t bg-gray-50 p-4 space-y-4">
                    {/* Instance Numbers */}
                    {run.instance_start && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <p className="text-xs font-medium text-emerald-700 mb-1">SKU Instance Range</p>
                        <p className="font-mono text-sm text-emerald-900">{run.instance_start} &rarr; {run.instance_end}</p>
                      </div>
                    )}

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500 text-xs">Planned</span>
                        <p className="font-medium">{run.planned_quantity} units</p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">Actual</span>
                        <p className="font-medium">{run.actual_quantity || 0} units</p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">Rejected</span>
                        <p className="font-medium text-red-600">{run.rejected_quantity || 0}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs">Quality</span>
                        <p className={`font-medium ${QUALITY_STATUSES.find(q => q.value === run.quality_status)?.color || ''}`}>
                          {QUALITY_STATUSES.find(q => q.value === run.quality_status)?.label || 'Pending'}
                        </p>
                      </div>
                    </div>

                    {/* Costs */}
                    {(parseFloat(run.ingredient_cost) > 0 || parseFloat(run.packaging_cost) > 0 || parseFloat(run.labor_cost) > 0) && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500 text-xs">Ingredient Cost</span>
                          <p className="font-medium">{parseFloat(run.ingredient_cost || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Packaging Cost</span>
                          <p className="font-medium">{parseFloat(run.packaging_cost || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Labor Cost</span>
                          <p className="font-medium">{parseFloat(run.labor_cost || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Cost / Unit</span>
                          <p className="font-medium text-amber-700">{parseFloat(run.cost_per_unit || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</p>
                        </div>
                      </div>
                    )}

                    {/* Ingredients Used */}
                    {run.ingredients_used && run.ingredients_used.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Ingredients Used</p>
                        <div className="flex flex-wrap gap-1">
                          {run.ingredients_used.map((ing, i) => (
                            <span key={i} className="px-2 py-1 bg-white border rounded text-xs">
                              {ing.ingredient_name}: {ing.quantity_grams}g
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Packaging Used */}
                    {run.packaging_used && run.packaging_used.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Packaging Used</p>
                        <div className="flex flex-wrap gap-1">
                          {run.packaging_used.map((pkg, i) => (
                            <span key={i} className="px-2 py-1 bg-white border rounded text-xs">
                              {pkg.material_name}: {pkg.quantity} {pkg.unit}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {run.notes && <p className="text-sm text-gray-600 bg-white p-2 rounded">{run.notes}</p>}

                    {/* Status Actions */}
                    <div className="flex items-center gap-2 flex-wrap pt-2 border-t">
                      {run.status === 'planned' && (
                        <button onClick={(e) => { e.stopPropagation(); handleStatusChange(run, 'in_progress'); }}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                          <Play className="w-3.5 h-3.5" /> Start Production
                        </button>
                      )}
                      {run.status === 'in_progress' && (
                        <button onClick={(e) => { e.stopPropagation(); handleStatusChange(run, 'quality_check'); }}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700">
                          <AlertTriangle className="w-3.5 h-3.5" /> Send to QC
                        </button>
                      )}
                      {run.status === 'quality_check' && (
                        <button onClick={(e) => { e.stopPropagation(); handleStatusChange(run, 'completed'); }}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); setEditingRun(run); setShowForm(true); }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                      {run.status === 'planned' && (
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(run.id); }}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <ProductionRunForm
          run={editingRun}
          skus={state.skus}
          onClose={() => { setShowForm(false); setEditingRun(null); }}
          onSave={async (data) => {
            if (editingRun) {
              const { data: updated, error } = await dbService.updateProductionRun({ ...data, id: editingRun.id });
              if (error) { showToast('Failed to update', 'error'); return; }
              setRuns(prev => prev.map(r => r.id === editingRun.id ? (updated || { ...editingRun, ...data }) : r));
              showToast('Production run updated');
            } else {
              const { data: created, error } = await dbService.createProductionRun(data);
              if (error) { showToast('Failed to create: ' + error.message, 'error'); return; }
              if (created) setRuns(prev => [created, ...prev]);
              showToast('Production run created');
            }
            setShowForm(false);
            setEditingRun(null);
          }}
        />
      )}
    </div>
  );
}

function ProductionRunForm({ run, skus, onClose, onSave }) {
  const isEditing = !!run;
  const [form, setForm] = useState({
    skuCode: run?.sku_code || 'DP',
    skuName: run?.sku_name || 'Day Pack',
    batchDate: run?.batch_date || new Date().toISOString().split('T')[0],
    plannedQuantity: run?.planned_quantity || '',
    actualQuantity: run?.actual_quantity || '',
    rejectedQuantity: run?.rejected_quantity || '0',
    packType: run?.pack_type || 'weekly',
    status: run?.status || 'planned',
    qualityStatus: run?.quality_status || 'pending',
    qualityNotes: run?.quality_notes || '',
    ingredientCost: run?.ingredient_cost || '',
    packagingCost: run?.packaging_cost || '',
    laborCost: run?.labor_cost || '',
    notes: run?.notes || '',
    // Ingredients & packaging as arrays
    ingredientsUsed: run?.ingredients_used || [],
    packagingUsed: run?.packaging_used || [],
  });
  const [saving, setSaving] = useState(false);

  const totalCost = (parseFloat(form.ingredientCost) || 0) + (parseFloat(form.packagingCost) || 0) + (parseFloat(form.laborCost) || 0);
  const costPerUnit = form.actualQuantity > 0 ? totalCost / parseInt(form.actualQuantity) : form.plannedQuantity > 0 ? totalCost / parseInt(form.plannedQuantity) : 0;

  const handleSkuChange = (code) => {
    const sku = SKU_CODES.find(s => s.code === code);
    setForm(f => ({ ...f, skuCode: code, skuName: sku?.name || code }));
  };

  // Ingredient row management
  const addIngredient = () => setForm(f => ({
    ...f, ingredientsUsed: [...f.ingredientsUsed, { ingredient_name: '', quantity_grams: '' }]
  }));
  const updateIngredient = (idx, field, val) => setForm(f => ({
    ...f, ingredientsUsed: f.ingredientsUsed.map((ing, i) => i === idx ? { ...ing, [field]: val } : ing)
  }));
  const removeIngredient = (idx) => setForm(f => ({
    ...f, ingredientsUsed: f.ingredientsUsed.filter((_, i) => i !== idx)
  }));

  // Packaging row management
  const addPackaging = () => setForm(f => ({
    ...f, packagingUsed: [...f.packagingUsed, { material_name: '', quantity: '', unit: 'pcs' }]
  }));
  const updatePackaging = (idx, field, val) => setForm(f => ({
    ...f, packagingUsed: f.packagingUsed.map((pkg, i) => i === idx ? { ...pkg, [field]: val } : pkg)
  }));
  const removePackaging = (idx) => setForm(f => ({
    ...f, packagingUsed: f.packagingUsed.filter((_, i) => i !== idx)
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.plannedQuantity || parseInt(form.plannedQuantity) <= 0) return;
    setSaving(true);

    const payload = isEditing ? {
      ...form,
      actual_quantity: parseInt(form.actualQuantity) || 0,
      rejected_quantity: parseInt(form.rejectedQuantity) || 0,
      quality_status: form.qualityStatus,
      quality_notes: form.qualityNotes,
      ingredient_cost: parseFloat(form.ingredientCost) || 0,
      packaging_cost: parseFloat(form.packagingCost) || 0,
      labor_cost: parseFloat(form.laborCost) || 0,
      total_cost: totalCost,
      cost_per_unit: costPerUnit,
      ingredients_used: form.ingredientsUsed.filter(i => i.ingredient_name),
      packaging_used: form.packagingUsed.filter(p => p.material_name),
      notes: form.notes,
      status: form.status,
    } : {
      ...form,
      plannedQuantity: parseInt(form.plannedQuantity) || 0,
      actualQuantity: parseInt(form.actualQuantity) || 0,
      ingredientCost: parseFloat(form.ingredientCost) || 0,
      packagingCost: parseFloat(form.packagingCost) || 0,
      laborCost: parseFloat(form.laborCost) || 0,
      totalCost: totalCost,
      costPerUnit: costPerUnit,
      ingredientsUsed: form.ingredientsUsed.filter(i => i.ingredient_name),
      packagingUsed: form.packagingUsed.filter(p => p.material_name),
    };

    await onSave(payload);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg my-8">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{isEditing ? 'Edit Production Run' : 'New Production Run'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* SKU & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
              <select value={form.skuCode} onChange={e => handleSkuChange(e.target.value)}
                disabled={isEditing}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100">
                {SKU_CODES.map(s => <option key={s.code} value={s.code}>{s.code} - {s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch Date *</label>
              <input type="date" value={form.batchDate} onChange={e => setForm(f => ({ ...f, batchDate: e.target.value }))}
                disabled={isEditing}
                className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pack Type</label>
              <select value={form.packType} onChange={e => setForm(f => ({ ...f, packType: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="weekly">Weekly (7 sachets)</option>
                <option value="monthly">Monthly (4 boxes)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Planned Qty *</label>
              <input type="number" value={form.plannedQuantity} onChange={e => setForm(f => ({ ...f, plannedQuantity: e.target.value }))}
                disabled={isEditing}
                className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" min="1" required />
            </div>
          </div>

          {/* Instance Number Preview (new runs only) */}
          {!isEditing && form.skuCode && form.batchDate && form.plannedQuantity > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <p className="text-xs font-medium text-emerald-700 mb-1">Instance Numbers (auto-generated)</p>
              <p className="font-mono text-sm text-emerald-900">
                {form.skuCode}-{form.batchDate.slice(0, 4)}-{form.batchDate.slice(5).replace('-', '')}-001 &rarr; {form.skuCode}-{form.batchDate.slice(0, 4)}-{form.batchDate.slice(5).replace('-', '')}-{String(form.plannedQuantity).padStart(3, '0')}
              </p>
            </div>
          )}

          {/* Edit-only fields */}
          {isEditing && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Actual Qty</label>
                  <input type="number" value={form.actualQuantity} onChange={e => setForm(f => ({ ...f, actualQuantity: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" min="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rejected</label>
                  <input type="number" value={form.rejectedQuantity} onChange={e => setForm(f => ({ ...f, rejectedQuantity: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" min="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quality Status</label>
                  <select value={form.qualityStatus} onChange={e => setForm(f => ({ ...f, qualityStatus: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    {QUALITY_STATUSES.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quality Notes</label>
                  <input type="text" value={form.qualityNotes} onChange={e => setForm(f => ({ ...f, qualityNotes: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Any QC remarks" />
                </div>
              </div>
            </>
          )}

          {/* Ingredients Used */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Ingredients Used</label>
              <button type="button" onClick={addIngredient} className="text-xs text-emerald-600 hover:text-emerald-700">+ Add</button>
            </div>
            {form.ingredientsUsed.map((ing, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <input type="text" value={ing.ingredient_name} onChange={e => updateIngredient(i, 'ingredient_name', e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-1.5 text-sm" placeholder="Ingredient name" />
                <input type="number" value={ing.quantity_grams} onChange={e => updateIngredient(i, 'quantity_grams', e.target.value)}
                  className="w-24 border rounded-lg px-3 py-1.5 text-sm" placeholder="grams" />
                <button type="button" onClick={() => removeIngredient(i)} className="p-1 text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>

          {/* Packaging Used */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Packaging Materials</label>
              <button type="button" onClick={addPackaging} className="text-xs text-emerald-600 hover:text-emerald-700">+ Add</button>
            </div>
            {form.packagingUsed.map((pkg, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <input type="text" value={pkg.material_name} onChange={e => updatePackaging(i, 'material_name', e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-1.5 text-sm" placeholder="Material (box, sachet, tape...)" />
                <input type="number" value={pkg.quantity} onChange={e => updatePackaging(i, 'quantity', e.target.value)}
                  className="w-20 border rounded-lg px-3 py-1.5 text-sm" placeholder="Qty" />
                <select value={pkg.unit} onChange={e => updatePackaging(i, 'unit', e.target.value)}
                  className="w-20 border rounded-lg px-2 py-1.5 text-sm">
                  <option value="pcs">pcs</option>
                  <option value="rolls">rolls</option>
                  <option value="kg">kg</option>
                  <option value="liters">L</option>
                </select>
                <button type="button" onClick={() => removePackaging(i)} className="p-1 text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>

          {/* Costs */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ingredient Cost</label>
              <input type="number" step="0.01" value={form.ingredientCost} onChange={e => setForm(f => ({ ...f, ingredientCost: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Packaging Cost</label>
              <input type="number" step="0.01" value={form.packagingCost} onChange={e => setForm(f => ({ ...f, packagingCost: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Labor Cost</label>
              <input type="number" step="0.01" value={form.laborCost} onChange={e => setForm(f => ({ ...f, laborCost: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="0" />
            </div>
          </div>
          <div className="bg-emerald-50 rounded-lg p-3 flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-emerald-800">Total Cost</span>
              <span className="text-xs text-emerald-600 ml-2">({costPerUnit.toFixed(2)}/unit)</span>
            </div>
            <span className="text-lg font-bold text-emerald-900">{totalCost.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} placeholder="Production notes..." />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              {saving ? 'Saving...' : isEditing ? 'Update' : 'Create Run'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
