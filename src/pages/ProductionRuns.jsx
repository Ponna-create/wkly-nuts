import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';
import StockAlerts from '../components/StockAlerts';
import {
  Plus, Search, X, Edit2, Trash2, Factory, Play, CheckCircle2,
  Clock, AlertTriangle, ChevronDown, ChevronUp, Package, Hash,
  IndianRupee, Calendar, Filter, Leaf, Box, Printer, ArrowRight
} from 'lucide-react';

const SKU_CODES = [
  { code: 'DP', name: 'Day Pack' },
  { code: 'SO', name: 'Soak Overnight' },
  { code: 'SC', name: 'Seed Cycle', hasPhases: true },
  { code: 'DB', name: 'Date Bytes' },
];

// Seed Cycle phases - Phase 1 (Days 1-14) and Phase 2 (Days 15-28)
const SC_PHASES = [
  { value: 'phase1', label: 'Phase 1 (Days 1-14)', shortLabel: 'P1', description: 'Follicular & Ovulation phase seeds' },
  { value: 'phase2', label: 'Phase 2 (Days 15-28)', shortLabel: 'P2', description: 'Luteal & Menstruation phase seeds' },
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
  const [completionDialog, setCompletionDialog] = useState(null); // {run, processing, result}

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

  // Show completion confirmation dialog before marking as completed
  const handleRequestComplete = (run) => {
    const qty = run.actual_quantity || run.planned_quantity || 0;
    const ingredients = run.ingredients_used || [];
    const packaging = run.packaging_used || [];
    setCompletionDialog({ run, processing: false, result: null, qty, ingredients, packaging });
  };

  // Actually complete the production run
  const handleConfirmComplete = async () => {
    const { run } = completionDialog;
    setCompletionDialog(prev => ({ ...prev, processing: true }));

    // Update status to completed
    const updated = { ...run, status: 'completed', completed_at: new Date().toISOString() };
    const { data, error } = await dbService.updateProductionRun(updated);
    if (error) {
      showToast('Failed to update status', 'error');
      setCompletionDialog(null);
      return;
    }

    // Perform the 3 actions: deduct raw materials, deduct packaging, add finished goods
    const result = await dbService.completeProductionRun(run);
    setCompletionDialog(prev => ({ ...prev, processing: false, result }));

    // Update local state
    setRuns(prev => prev.map(r => r.id === run.id ? (data || { ...run, status: 'completed' }) : r));
  };

  const handleStatusChange = async (run, newStatus) => {
    // For completion, show confirmation dialog
    if (newStatus === 'completed') {
      handleRequestComplete(run);
      return;
    }

    const updated = { ...run, status: newStatus };
    const { data, error } = await dbService.updateProductionRun(updated);
    if (error) { showToast('Failed to update status', 'error'); return; }
    setRuns(prev => prev.map(r => r.id === run.id ? (data || { ...run, status: newStatus }) : r));
    showToast(`Status updated to ${getStatusInfo(newStatus).label}`);
  };

  // Generate batch label info
  const getBatchLabel = (run) => {
    const mfd = run.batch_date;
    const useByDate = new Date(mfd);
    useByDate.setDate(useByDate.getDate() + 30);
    const batchNo = run.instance_start || run.run_number;
    return {
      batchNo,
      mfd: new Date(mfd).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      useBy: useByDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      skuName: run.sku_name,
      quantity: run.actual_quantity || run.planned_quantity,
    };
  };

  const handlePrintBatchLabel = (run) => {
    const label = getBatchLabel(run);
    const printWindow = window.open('', '_blank', 'width=400,height=300');
    printWindow.document.write(`
      <html><head><title>Batch Label</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 16px; }
        .label { border: 2px solid #000; padding: 16px; width: 280px; }
        .row { display: flex; justify-content: space-between; margin: 6px 0; font-size: 14px; }
        .key { font-weight: bold; }
        .val { text-align: right; }
        h3 { margin: 0 0 8px; text-align: center; font-size: 16px; border-bottom: 1px solid #000; padding-bottom: 6px; }
      </style></head><body>
      <div class="label">
        <h3>WKLY Nuts - ${label.skuName}</h3>
        <div class="row"><span class="key">Net Qty:</span><span class="val">${label.quantity} pcs</span></div>
        <div class="row"><span class="key">Batch No:</span><span class="val">${label.batchNo}</span></div>
        <div class="row"><span class="key">MFD:</span><span class="val">${label.mfd}</span></div>
        <div class="row"><span class="key">Use By:</span><span class="val">${label.useBy}</span></div>
      </div>
      <script>window.onload=function(){window.print();}<\/script>
      </body></html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Stock Alerts Banner */}
      <StockAlerts compact={true} maxItems={3} />

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
            const label = getBatchLabel(run);
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
                      {run.seed_cycle_phase && (
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full font-medium">
                          {run.seed_cycle_phase === 'phase1' ? 'P1' : 'P2'}
                        </span>
                      )}
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
                    {/* Batch Label Info */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-blue-700">Batch Label Info</p>
                        <button onClick={(e) => { e.stopPropagation(); handlePrintBatchLabel(run); }}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                          <Printer className="w-3 h-3" /> Print Label
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div><span className="text-blue-500">Batch No:</span> <span className="font-mono font-bold text-blue-900">{label.batchNo}</span></div>
                        <div><span className="text-blue-500">MFD:</span> <span className="font-bold text-blue-900">{label.mfd}</span></div>
                        <div><span className="text-blue-500">Use By:</span> <span className="font-bold text-blue-900">{label.useBy}</span></div>
                        <div><span className="text-blue-500">Qty:</span> <span className="font-bold text-blue-900">{label.quantity} boxes</span></div>
                      </div>
                    </div>

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
                          <CheckCircle2 className="w-3.5 h-3.5" /> Mark as Produced
                        </button>
                      )}
                      {/* Also allow direct "Produced" from in_progress */}
                      {run.status === 'in_progress' && (
                        <button onClick={(e) => { e.stopPropagation(); handleStatusChange(run, 'completed'); }}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Mark as Produced
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); handlePrintBatchLabel(run); }}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Printer className="w-3.5 h-3.5" /> Print Label
                      </button>
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

      {/* Completion Confirmation Dialog */}
      {completionDialog && (
        <CompletionDialog
          dialog={completionDialog}
          onConfirm={handleConfirmComplete}
          onClose={() => setCompletionDialog(null)}
        />
      )}
    </div>
  );
}

// ============================================
// COMPLETION CONFIRMATION DIALOG
// ============================================
function CompletionDialog({ dialog, onConfirm, onClose }) {
  const { run, processing, result, qty, ingredients, packaging } = dialog;

  // Calculate MFD and Use By
  const mfd = new Date(run.batch_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const useByDate = new Date(run.batch_date);
  useByDate.setDate(useByDate.getDate() + 30);
  const useBy = useByDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            {result ? (
              <><CheckCircle2 className="w-5 h-5 text-green-600" /> Production Completed</>
            ) : (
              <><Factory className="w-5 h-5 text-emerald-600" /> Confirm Production Complete</>
            )}
          </h3>
        </div>

        <div className="p-4 space-y-4">
          {/* Batch Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs font-medium text-blue-700 mb-2">Batch Details</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-blue-500">SKU:</span> <span className="font-bold">{run.sku_name} ({run.sku_code})</span></div>
              <div><span className="text-blue-500">Batch:</span> <span className="font-mono font-bold">{run.instance_start || run.run_number}</span></div>
              <div><span className="text-blue-500">MFD:</span> <span className="font-bold">{mfd}</span></div>
              <div><span className="text-blue-500">Use By:</span> <span className="font-bold">{useBy}</span></div>
            </div>
          </div>

          {/* 3 Actions Summary */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">When you click "Produced", the system will:</p>

            {/* 1. Add Finished Goods */}
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${result?.finishedGoodsAdded ? 'bg-green-50 border-green-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-emerald-900">Add Finished Goods to Inventory</p>
                <p className="text-xs text-emerald-700">{run.sku_name} ({run.pack_type}): +{qty} boxes</p>
              </div>
              {result?.finishedGoodsAdded && <CheckCircle2 className="w-5 h-5 text-green-600" />}
            </div>

            {/* 2. Deduct Raw Materials */}
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${result && result.ingredientsDeducted > 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="w-7 h-7 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">Deduct Raw Materials (FIFO)</p>
                {ingredients.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {ingredients.map((ing, i) => (
                      <span key={i} className="px-1.5 py-0.5 bg-white border rounded text-[10px]">
                        {ing.ingredient_name}: {ing.quantity_grams}g
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-amber-700">No ingredients specified</p>
                )}
              </div>
              {result && result.ingredientsDeducted > 0 && <CheckCircle2 className="w-5 h-5 text-green-600" />}
            </div>

            {/* 3. Deduct Packaging */}
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${result && result.packagingDeducted > 0 ? 'bg-green-50 border-green-200' : 'bg-indigo-50 border-indigo-200'}`}>
              <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-indigo-900">Deduct Packaging Materials</p>
                {packaging.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {packaging.map((pkg, i) => (
                      <span key={i} className="px-1.5 py-0.5 bg-white border rounded text-[10px]">
                        {pkg.material_name}: {pkg.quantity} {pkg.unit}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-indigo-700">No packaging specified</p>
                )}
              </div>
              {result && result.packagingDeducted > 0 && <CheckCircle2 className="w-5 h-5 text-green-600" />}
            </div>
          </div>

          {/* Errors/Warnings */}
          {result?.errors?.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs font-medium text-red-700 mb-1">Warnings:</p>
              {result.errors.map((err, i) => (
                <p key={i} className="text-xs text-red-600">{err}</p>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t">
          {result ? (
            <button onClick={onClose}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">
              Done
            </button>
          ) : (
            <>
              <button onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button onClick={onConfirm} disabled={processing}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium flex items-center gap-2">
                {processing ? (
                  <><span className="animate-spin">&#9696;</span> Processing...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4" /> Produced</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// PRODUCTION RUN FORM (with enhanced dropdowns)
// ============================================
function ProductionRunForm({ run, skus, onClose, onSave }) {
  const isEditing = !!run;
  const [form, setForm] = useState({
    skuCode: run?.sku_code || 'DP',
    skuName: run?.sku_name || 'Day Pack',
    seedCyclePhase: run?.seed_cycle_phase || '',
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
    ingredientsUsed: run?.ingredients_used || [],
    packagingUsed: run?.packaging_used || [],
  });
  const [saving, setSaving] = useState(false);

  // Load available ingredients and packaging from DB for dropdowns
  const [availableIngredients, setAvailableIngredients] = useState([]);
  const [availablePackaging, setAvailablePackaging] = useState([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(true);

  useEffect(() => {
    const loadDropdowns = async () => {
      setLoadingDropdowns(true);
      const [ingRes, pkgRes] = await Promise.all([
        dbService.getIngredientsForProduction(),
        dbService.getPackagingForProduction(),
      ]);
      setAvailableIngredients(ingRes.data || []);
      setAvailablePackaging(pkgRes.data || []);
      setLoadingDropdowns(false);
    };
    loadDropdowns();
  }, []);

  const totalCost = (parseFloat(form.ingredientCost) || 0) + (parseFloat(form.packagingCost) || 0) + (parseFloat(form.laborCost) || 0);
  const costPerUnit = form.actualQuantity > 0 ? totalCost / parseInt(form.actualQuantity) : form.plannedQuantity > 0 ? totalCost / parseInt(form.plannedQuantity) : 0;

  const handleSkuChange = (code) => {
    const sku = SKU_CODES.find(s => s.code === code);
    setForm(f => ({
      ...f,
      skuCode: code,
      skuName: sku?.name || code,
      seedCyclePhase: code === 'SC' ? (f.seedCyclePhase || 'phase1') : '',
    }));
  };

  // Ingredient row management - with dropdown
  const addIngredient = () => setForm(f => ({
    ...f, ingredientsUsed: [...f.ingredientsUsed, { ingredient_name: '', quantity_grams: '' }]
  }));
  const updateIngredient = (idx, field, val) => {
    setForm(f => {
      const updated = f.ingredientsUsed.map((ing, i) => i === idx ? { ...ing, [field]: val } : ing);
      // If selecting ingredient from dropdown, also set the name
      if (field === 'ingredient_name') {
        const match = availableIngredients.find(ai => ai.name === val);
        if (match) {
          updated[idx] = { ...updated[idx], ingredient_name: match.name, _stock: match.current_stock_total, _unit: match.unit };
        }
      }
      return { ...f, ingredientsUsed: updated };
    });
  };
  const removeIngredient = (idx) => setForm(f => ({
    ...f, ingredientsUsed: f.ingredientsUsed.filter((_, i) => i !== idx)
  }));

  // Packaging row management - with dropdown
  const addPackaging = () => setForm(f => ({
    ...f, packagingUsed: [...f.packagingUsed, { material_name: '', quantity: '', unit: 'pcs' }]
  }));
  const updatePackaging = (idx, field, val) => {
    setForm(f => {
      const updated = f.packagingUsed.map((pkg, i) => i === idx ? { ...pkg, [field]: val } : pkg);
      if (field === 'material_name') {
        const match = availablePackaging.find(ap => ap.name === val);
        if (match) {
          updated[idx] = { ...updated[idx], material_name: match.name, unit: match.unit || 'pcs', _stock: match.current_stock };
        }
      }
      return { ...f, packagingUsed: updated };
    });
  };
  const removePackaging = (idx) => setForm(f => ({
    ...f, packagingUsed: f.packagingUsed.filter((_, i) => i !== idx)
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.plannedQuantity || parseInt(form.plannedQuantity) <= 0) return;
    setSaving(true);

    // Build display name with phase suffix for Seed Cycle
    const displaySkuName = form.skuCode === 'SC' && form.seedCyclePhase
      ? `${form.skuName} ${SC_PHASES.find(p => p.value === form.seedCyclePhase)?.shortLabel || ''}`
      : form.skuName;

    const payload = isEditing ? {
      ...form,
      skuName: displaySkuName,
      seed_cycle_phase: form.seedCyclePhase || null,
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
      skuName: displaySkuName,
      seedCyclePhase: form.seedCyclePhase || null,
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

  // MFD & Use By preview
  const mfdDisplay = form.batchDate ? new Date(form.batchDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';
  const useByDate = form.batchDate ? new Date(new Date(form.batchDate).getTime() + 30 * 24 * 60 * 60 * 1000) : null;
  const useByDisplay = useByDate ? useByDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';

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
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch Date (MFD) *</label>
              <input type="date" value={form.batchDate} onChange={e => setForm(f => ({ ...f, batchDate: e.target.value }))}
                disabled={isEditing}
                className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100" required />
            </div>
          </div>

          {/* Seed Cycle Phase Selector */}
          {form.skuCode === 'SC' && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <label className="block text-sm font-semibold text-purple-800 mb-2">Seed Cycle Phase *</label>
              <div className="grid grid-cols-2 gap-2">
                {SC_PHASES.map(phase => (
                  <button
                    key={phase.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, seedCyclePhase: phase.value }))}
                    className={`p-3 rounded-lg border-2 text-left transition ${
                      form.seedCyclePhase === phase.value
                        ? 'border-purple-500 bg-purple-100'
                        : 'border-gray-200 bg-white hover:border-purple-300'
                    }`}
                  >
                    <p className="font-semibold text-sm text-gray-900">{phase.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{phase.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
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

          {/* Batch Label Preview */}
          {form.skuCode && form.batchDate && form.plannedQuantity > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-medium text-blue-700 mb-2">Batch Label Preview</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-blue-500">Batch No:</span> <span className="font-mono font-bold text-blue-900">
                  {isEditing && run.instance_start ? run.instance_start : `${form.skuCode}-${form.batchDate.slice(0, 4)}-${form.batchDate.slice(5).replace('-', '')}-001`}
                </span></div>
                <div><span className="text-blue-500">Qty:</span> <span className="font-bold text-blue-900">{form.actualQuantity || form.plannedQuantity} boxes</span></div>
                <div><span className="text-blue-500">MFD:</span> <span className="font-bold text-blue-900">{mfdDisplay}</span></div>
                <div><span className="text-blue-500">Use By:</span> <span className="font-bold text-blue-900">{useByDisplay}</span></div>
              </div>
            </div>
          )}

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

          {/* Ingredients Used - DROPDOWN from inventory */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Leaf className="w-4 h-4 text-amber-600" /> Raw Materials Used
              </label>
              <button type="button" onClick={addIngredient} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">+ Add Ingredient</button>
            </div>
            {loadingDropdowns ? (
              <p className="text-xs text-gray-400">Loading ingredients...</p>
            ) : (
              form.ingredientsUsed.map((ing, i) => {
                const match = availableIngredients.find(ai => ai.name === ing.ingredient_name);
                return (
                  <div key={i} className="mb-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={ing.ingredient_name}
                        onChange={e => updateIngredient(i, 'ingredient_name', e.target.value)}
                        className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Select ingredient...</option>
                        {availableIngredients.map(ai => (
                          <option key={ai.id} value={ai.name}>
                            {ai.name} ({ai.current_stock_total} {ai.unit} available)
                          </option>
                        ))}
                      </select>
                      <input type="number" value={ing.quantity_grams} onChange={e => updateIngredient(i, 'quantity_grams', e.target.value)}
                        className="w-24 border rounded-lg px-3 py-1.5 text-sm" placeholder="grams" min="0" />
                      <button type="button" onClick={() => removeIngredient(i)} className="p-1 text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                    </div>
                    {match && ing.quantity_grams > 0 && (
                      <p className={`text-[10px] mt-0.5 ml-1 ${(parseFloat(ing.quantity_grams) / 1000) > match.current_stock_total ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                        {(parseFloat(ing.quantity_grams) / 1000) > match.current_stock_total
                          ? `Insufficient! Need ${(parseFloat(ing.quantity_grams) / 1000).toFixed(2)} kg, have ${match.current_stock_total} ${match.unit}`
                          : `Will use ${(parseFloat(ing.quantity_grams) / 1000).toFixed(2)} kg of ${match.current_stock_total} ${match.unit} available`
                        }
                      </p>
                    )}
                  </div>
                );
              })
            )}
            {form.ingredientsUsed.length === 0 && (
              <p className="text-xs text-gray-400 italic">No ingredients added. Click "+ Add Ingredient" to select from inventory.</p>
            )}
          </div>

          {/* Packaging Used - DROPDOWN from inventory */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Box className="w-4 h-4 text-indigo-600" /> Packaging Materials
              </label>
              <button type="button" onClick={addPackaging} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">+ Add Material</button>
            </div>
            {loadingDropdowns ? (
              <p className="text-xs text-gray-400">Loading packaging...</p>
            ) : (
              form.packagingUsed.map((pkg, i) => {
                const match = availablePackaging.find(ap => ap.name === pkg.material_name);
                return (
                  <div key={i} className="mb-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={pkg.material_name}
                        onChange={e => updatePackaging(i, 'material_name', e.target.value)}
                        className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Select material...</option>
                        {availablePackaging.map(ap => (
                          <option key={ap.id} value={ap.name}>
                            {ap.name} ({ap.current_stock} {ap.unit || 'pcs'} in stock)
                          </option>
                        ))}
                      </select>
                      <input type="number" value={pkg.quantity} onChange={e => updatePackaging(i, 'quantity', e.target.value)}
                        className="w-20 border rounded-lg px-3 py-1.5 text-sm" placeholder="Qty" min="0" />
                      <span className="text-xs text-gray-500 w-8">{pkg.unit}</span>
                      <button type="button" onClick={() => removePackaging(i)} className="p-1 text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                    </div>
                    {match && pkg.quantity > 0 && (
                      <p className={`text-[10px] mt-0.5 ml-1 ${parseFloat(pkg.quantity) > match.current_stock ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                        {parseFloat(pkg.quantity) > match.current_stock
                          ? `Insufficient! Need ${pkg.quantity}, have ${match.current_stock} ${match.unit || 'pcs'}`
                          : `Will use ${pkg.quantity} of ${match.current_stock} ${match.unit || 'pcs'} available`
                        }
                      </p>
                    )}
                  </div>
                );
              })
            )}
            {form.packagingUsed.length === 0 && (
              <p className="text-xs text-gray-400 italic">No packaging added. Click "+ Add Material" to select from inventory.</p>
            )}
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
