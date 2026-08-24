import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { dbService } from '../services/supabase';
import { useApp } from '../context/AppContext';
import { orderCost } from '../utils/skuCost';
import { getManualChannels, addManualChannel } from '../utils/settings';

const SOURCE_LABELS = {
  whatsapp: 'WhatsApp', website: 'Website', instagram: 'Instagram', inst: 'Instagram',
  meta_ad: 'Meta Ads', amazon: 'Amazon', zoho: 'Zoho', referral: 'Referral',
  direct: 'Direct', collab: 'Collab', promotion: 'Promotion', other: 'Other',
};
const KNOWN_CHANNELS = ['whatsapp', 'website', 'zoho', 'instagram', 'amazon', 'meta_ad', 'direct', 'collab'];
const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const emptyExpense = { channel: '', name: '', amount: '', frequency: 'monthly', notes: '' };

// Per-SKU Amazon fee estimate — pulled from Amazon's own "Total fees" figure
// shown per listing in Seller Central > Manage Products, entered once here
// rather than parsed per order (see the platformFees calc above for why:
// exact per-order fees aren't worth chasing when a fixed estimate is close
// enough for margin visibility, and real reconciliation happens separately
// against the monthly Amazon statement).
function AmazonFeeEditor({ skus, showToast }) {
  const { dispatch } = useApp();
  const [editingId, setEditingId] = useState(null);
  const [draftValue, setDraftValue] = useState('');

  const startEdit = (sku) => {
    setEditingId(sku.id);
    setDraftValue(sku.weeklyPack?.amazonFee ?? '');
  };

  const save = (sku) => {
    const fee = parseFloat(draftValue) || 0;
    // Same pattern SKUManagement.jsx itself uses to save — the dispatch
    // wrapper persists via the full updateSKU() call, which needs the
    // complete SKU object (not a partial one) to avoid blanking other fields.
    dispatch({ type: 'UPDATE_SKU', payload: { ...sku, weeklyPack: { ...(sku.weeklyPack || {}), amazonFee: fee } } });
    showToast(`${sku.name} — Amazon fee set to ₹${fee}/unit`, 'success');
    setEditingId(null);
  };

  return (
    <div className="border-t pt-3">
      <p className="text-sm font-semibold text-gray-700 mb-2">Amazon fee per unit, by SKU</p>
      <p className="text-xs text-gray-400 mb-2">From Seller Central &gt; Manage Products &gt; "Total fees" per listing. Used to estimate margin — not the exact per-order fee.</p>
      <div className="space-y-1.5">
        {skus.map(sku => (
          <div key={sku.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
            <span className="font-medium text-gray-800">{sku.name}</span>
            {editingId === sku.id ? (
              <div className="flex items-center gap-2">
                <span className="text-gray-400">₹</span>
                <input type="number" step="0.01" min="0" autoFocus value={draftValue}
                  onChange={e => setDraftValue(e.target.value)}
                  className="w-20 border rounded px-2 py-1 text-sm" />
                <button onClick={() => save(sku)} className="text-teal-600 hover:text-teal-700 font-medium text-xs">Save</button>
                <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 text-xs">Cancel</button>
              </div>
            ) : (
              <button onClick={() => startEdit(sku)} className="text-gray-600 hover:text-teal-600 font-semibold">
                {sku.weeklyPack?.amazonFee ? `₹${sku.weeklyPack.amazonFee}/unit` : <span className="text-gray-400 font-normal italic">not set</span>}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OmniChannels() {
  const { state, showToast } = useApp();
  const [expenses, setExpenses] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingFor, setAddingFor] = useState(null); // channel key currently adding an expense row
  const [form, setForm] = useState(emptyExpense);
  const [expandedChannel, setExpandedChannel] = useState(null);
  const [addingChannel, setAddingChannel] = useState(false);
  const [newChannelKey, setNewChannelKey] = useState('');
  const [manualChannels, setManualChannels] = useState(getManualChannels());

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [expRes, campRes] = await Promise.all([
      dbService.getChannelExpenses(),
      dbService.getMarketingCampaigns(),
    ]);
    setExpenses(expRes.data || []);
    setCampaigns(campRes.data || []);
    setLoading(false);
  };

  const monthKey = new Date().toISOString().slice(0, 7);

  // Every channel that has real orders, already has expenses/fee configured,
  // was manually added, or is a known default
  const channelKeys = useMemo(() => {
    const set = new Set(KNOWN_CHANNELS);
    (state.salesOrders || []).forEach(o => set.add(o.order_source || 'other'));
    expenses.forEach(e => set.add(e.channel));
    manualChannels.forEach(c => set.add(c));
    return Array.from(set);
  }, [state.salesOrders, expenses, manualChannels]);

  const channels = useMemo(() => {
    const skus = state.skus || [];
    const ingredients = state.ingredients || [];
    const aliases = state.ingredientAliases || [];
    const orders = (state.salesOrders || []).filter(o => (o.order_date || '').slice(0, 7) === monthKey);

    return channelKeys.map(key => {
      const channelOrders = orders.filter(o => (o.order_source || 'other') === key);
      const revenue = channelOrders.reduce((s, o) => s + (parseFloat(o.total_amount) || 0), 0);
      const cogs = channelOrders.reduce((s, o) => s + orderCost(o, skus, ingredients, aliases), 0);

      const channelExpenses = expenses.filter(e => e.channel === key);
      const recurringMonthly = channelExpenses
        .filter(e => e.frequency !== 'one_time')
        .reduce((s, e) => s + (e.frequency === 'yearly' ? (parseFloat(e.amount) || 0) / 12 : (parseFloat(e.amount) || 0)), 0);
      const oneTimeTotal = channelExpenses
        .filter(e => e.frequency === 'one_time')
        .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

      const adSpend = campaigns
        .filter(c => (key === 'amazon' && c.platform === 'amazon') || (['instagram', 'inst', 'meta_ad'].includes(key) && (c.platform === 'meta' || c.platform === 'instagram')))
        .reduce((s, c) => s + (parseFloat(c.spend) || 0), 0);

      // Amazon platform fees — a fixed per-unit estimate set per SKU (from
      // Amazon's own "Total fees" shown in Manage Products), not parsed per
      // order. Deliberately an estimate for margin visibility, not the exact
      // per-order fee -- real fee/GST/TDS reconciliation happens separately
      // against the monthly Amazon statement. See docs/CRM_FRAMEWORK.md-style
      // reasoning: exact per-order fees aren't worth chasing here.
      const platformFees = key === 'amazon'
        ? channelOrders.reduce((s, o) => s + (o.items || []).reduce((is, item) => {
            const sku = skus.find(sk => String(sk.id) === String(item.sku_id || item.skuId));
            const feePerUnit = parseFloat(sku?.weeklyPack?.amazonFee) || 0;
            return is + feePerUnit * (parseFloat(item.quantity || item.qty) || 0);
          }, 0), 0)
        : 0;

      const net = revenue - cogs - recurringMonthly - adSpend - platformFees;

      return {
        key, label: SOURCE_LABELS[key] || key, orders: channelOrders.length, revenue, cogs,
        expenses: channelExpenses, recurringMonthly, oneTimeTotal, adSpend, platformFees, net,
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [channelKeys, state.salesOrders, state.skus, expenses, campaigns, monthKey]);

  const handleAddExpense = async (channel) => {
    if (!form.name.trim() || !form.amount) { showToast('Name and amount required', 'error'); return; }
    const { data, error } = await dbService.createChannelExpense({ ...form, channel, amount: parseFloat(form.amount) || 0 });
    if (error) { showToast('Failed to add expense', 'error'); return; }
    setExpenses(prev => [...prev, data]);
    setForm(emptyExpense);
    setAddingFor(null);
    showToast('Expense added', 'success');
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Remove this expense?')) return;
    const { error } = await dbService.deleteChannelExpense(id);
    if (error) { showToast('Failed to delete', 'error'); return; }
    setExpenses(prev => prev.filter(e => e.id !== id));
    showToast('Removed', 'success');
  };

  const totalNet = channels.reduce((s, c) => s + c.net, 0);
  const totalRevenue = channels.reduce((s, c) => s + c.revenue, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Omni Channels</h1>
          <p className="text-gray-600 mt-1">What each channel actually costs you and what it returns — an estimate, not perfect attribution.</p>
        </div>
        <div className="flex items-center gap-2">
          {addingChannel ? (
            <div className="flex items-center gap-2">
              <select value={newChannelKey} onChange={e => setNewChannelKey(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                <option value="">Select channel...</option>
                {Object.entries(SOURCE_LABELS).filter(([k]) => !channelKeys.includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button onClick={() => {
                  if (newChannelKey) {
                    addManualChannel(newChannelKey);
                    setManualChannels(getManualChannels());
                    setExpandedChannel(newChannelKey);
                    showToast(`${SOURCE_LABELS[newChannelKey] || newChannelKey} added`, 'success');
                  }
                  setAddingChannel(false); setNewChannelKey('');
                }}
                className="px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium">Add</button>
              <button onClick={() => { setAddingChannel(false); setNewChannelKey(''); }} className="px-3 py-2 text-sm text-gray-600">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setAddingChannel(true)} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium">
              <Plus className="w-4 h-4" /> Add Channel
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">This Month Revenue</p>
          <p className="text-2xl font-bold text-teal-600">{fmt(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Est. Net (all channels)</p>
          <p className={`text-2xl font-bold ${totalNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(totalNet)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 col-span-2">
          <p className="text-sm text-gray-500">Channels tracked</p>
          <p className="text-2xl font-bold text-gray-900">{channels.length}</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="space-y-3">
          {channels.map(c => {
            const isOpen = expandedChannel === c.key;
            return (
              <div key={c.key} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <button onClick={() => setExpandedChannel(isOpen ? null : c.key)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center"><Layers className="w-5 h-5 text-teal-700" /></div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">{c.label}</h3>
                      <p className="text-xs text-gray-500">{c.orders} orders this month · Revenue {fmt(c.revenue)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Est. Net</p>
                      <p className={`font-bold ${c.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(c.net)}</p>
                    </div>
                    {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t p-4 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-sm">
                      <div><p className="text-gray-400 text-xs">Revenue</p><p className="font-semibold text-teal-700">{fmt(c.revenue)}</p></div>
                      <div><p className="text-gray-400 text-xs">COGS (est.)</p><p className="font-semibold text-gray-700">{fmt(c.cogs)}</p></div>
                      {c.key === 'amazon' && (
                        <div><p className="text-gray-400 text-xs">Platform fees (est.)</p><p className="font-semibold text-orange-700">{fmt(c.platformFees)}</p></div>
                      )}
                      <div><p className="text-gray-400 text-xs">Fixed costs / mo</p><p className="font-semibold text-gray-700">{fmt(c.recurringMonthly)}</p></div>
                      <div><p className="text-gray-400 text-xs">Ad spend</p><p className="font-semibold text-gray-700">{fmt(c.adSpend)}</p></div>
                      <div><p className="text-gray-400 text-xs">Est. Net</p><p className={`font-bold ${c.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(c.net)}</p></div>
                    </div>

                    {c.key === 'amazon' && <AmazonFeeEditor skus={state.skus || []} showToast={showToast} />}

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-gray-700">Fixed / recurring costs</p>
                        <button onClick={() => { setForm(emptyExpense); setAddingFor(addingFor === c.key ? null : c.key); }}
                          className="text-xs text-teal-600 hover:text-teal-700 font-medium">+ Add Cost</button>
                      </div>
                      {c.expenses.length === 0 && addingFor !== c.key && (
                        <p className="text-xs text-gray-400 italic">No fixed costs added yet — e.g. domain, platform subscription.</p>
                      )}
                      <div className="space-y-1.5">
                        {c.expenses.map(e => (
                          <div key={e.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                            <div>
                              <span className="font-medium text-gray-800">{e.name}</span>
                              <span className="text-gray-400 ml-2 text-xs capitalize">{e.frequency.replace('_', ' ')}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-gray-900">{fmt(e.amount)}</span>
                              <button onClick={() => handleDeleteExpense(e.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {c.oneTimeTotal > 0 && (
                        <p className="text-xs text-gray-400 mt-1">+ {fmt(c.oneTimeTotal)} one-time costs logged (not counted in monthly Net)</p>
                      )}

                      {addingFor === c.key && (
                        <div className="mt-3 bg-teal-50 border border-teal-200 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <input type="text" placeholder="e.g. Domain" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className="border rounded-lg px-2 py-1.5 text-sm col-span-2 sm:col-span-1" />
                          <input type="number" placeholder="Amount ₹" value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                            className="border rounded-lg px-2 py-1.5 text-sm" min="0" />
                          <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
                            className="border rounded-lg px-2 py-1.5 text-sm">
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                            <option value="one_time">One-time</option>
                          </select>
                          <button onClick={() => handleAddExpense(c.key)} className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm font-medium">Save</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-400">
        Est. Net = Revenue − estimated COGS − amortized fixed costs (yearly ÷ 12) − attributed ad spend, for orders this month. Attribution isn't perfect
        (a customer can see a reel and order directly on Amazon) — treat this as a directional reference per channel, not a precise ledger.
      </p>
    </div>
  );
}
