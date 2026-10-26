import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Save } from 'lucide-react';
import { dbService } from '../services/supabase';

// Shelf count: type what's really on the shelf next to what the app thinks.
// Only items with a number typed are saved; each becomes an adjustment with
// before / counted / difference kept in the count log (dbService.saveStockCount).
// Also holds the "refuse hand-over when boxes are short" switch, meant to be
// turned on once a full count has made the box numbers true.

const num = (v) => parseFloat(v) || 0;
const fmt = (v) => Math.round(num(v) * 1000) / 1000;

export default function StockCount({ skus, finishedGoods, ingredients, onSaved, showToast }) {
  const [materials, setMaterials] = useState([]);
  const [counted, setCounted] = useState({}); // key -> typed value
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [blockShort, setBlockShort] = useState(false);

  const loadExtras = () => {
    dbService.getPackagingMaterials().then(({ data }) => setMaterials(data || []));
    dbService.getStockCounts(20).then(({ data }) => setHistory(data || []));
    dbService.getAppSetting('blockHandoverWhenShort').then(({ data }) => setBlockShort(data === true));
  };
  useEffect(loadExtras, []);

  const sections = useMemo(() => [
    {
      title: 'Finished boxes / units', type: 'finished',
      rows: (skus || []).map(s => {
        const inv = (finishedGoods || []).find(f => f.skuId === s.id);
        const isRecipe = (s.skuType || 'weekly') === 'weekly';
        return { key: `f:${s.id}`, type: 'finished', id: s.id, name: s.name, unit: isRecipe ? 'boxes' : 'units', isRecipe,
          before: isRecipe ? (inv?.weeklyPacksAvailable || 0) : (inv?.singleUnitsAvailable || 0) };
      }),
    },
    {
      title: 'Ingredients', type: 'ingredient',
      rows: (ingredients || []).map(i => ({ key: `i:${i.id}`, type: 'ingredient', id: i.id, name: i.name, unit: (i.unit || 'kg').toLowerCase(), before: num(i.current_stock_total) })),
    },
    {
      title: 'Packaging', type: 'packaging',
      rows: materials.map(m => ({ key: `p:${m.id}`, type: 'packaging', id: m.id, name: m.name, unit: m.unit || 'pcs', before: num(m.current_stock) })),
    },
  ], [skus, finishedGoods, ingredients, materials]);

  const entered = sections.flatMap(s => s.rows).filter(r => counted[r.key] !== undefined && counted[r.key] !== '');

  const save = async () => {
    if (entered.length === 0) { showToast('Type the counted number for at least one item', 'error'); return; }
    setSaving(true);
    const { error, saved } = await dbService.saveStockCount(entered.map(r => ({ ...r, counted: counted[r.key] })), note.trim());
    setSaving(false);
    if (error) showToast(`Saved ${saved}, but some failed: ${error.message}`, 'error');
    else showToast(`Count saved for ${saved} item(s)`, 'success');
    setCounted({});
    setNote('');
    loadExtras();
    if (onSaved) onSaved();
  };

  const toggleBlock = async () => {
    const next = !blockShort;
    setBlockShort(next);
    const { error } = await dbService.setAppSetting('blockHandoverWhenShort', next);
    if (error) { setBlockShort(!next); showToast('Could not change the setting', 'error'); return; }
    showToast(next ? 'Hand-over is now refused when boxes are short' : 'Hand-over only warns when boxes are short', 'success');
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-wrap items-center gap-3">
        <ClipboardCheck className="w-5 h-5 text-teal-600" />
        <div className="flex-1 min-w-[220px]">
          <p className="font-semibold text-gray-900 text-sm">Refuse hand-over when boxes are short</p>
          <p className="text-xs text-gray-500">Turn this on after a full shelf count, once the box numbers are true. Until then hand-over only warns.</p>
        </div>
        <button type="button" onClick={toggleBlock}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${blockShort ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
          {blockShort ? 'On' : 'Off'}
        </button>
      </div>

      <p className="text-sm text-gray-600">
        Type what is really on the shelf. Leave a box empty to skip that item. Each difference is saved as an adjustment, and the count log below keeps the before and after.
      </p>

      {sections.map(sec => (
        <div key={sec.type} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 font-semibold text-sm text-gray-700">{sec.title}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-500 uppercase">
                <th className="text-left px-4 py-2">Item</th><th className="text-right px-4 py-2">App says</th>
                <th className="text-right px-4 py-2">Counted</th><th className="text-right px-4 py-2">Difference</th>
              </tr></thead>
              <tbody>
                {sec.rows.map(r => {
                  const v = counted[r.key];
                  const has = v !== undefined && v !== '';
                  const diff = has ? fmt(num(v) - r.before) : null;
                  return (
                    <tr key={r.key} className={`border-t border-gray-100 ${has && diff !== 0 ? 'bg-amber-50' : ''}`}>
                      <td className="px-4 py-2">{r.name}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-600">{fmt(r.before)} {r.unit}</td>
                      <td className="px-4 py-2 text-right">
                        <input type="number" inputMode="decimal" min="0" step="any" value={v ?? ''}
                          onChange={e => setCounted(c => ({ ...c, [r.key]: e.target.value }))}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-right" aria-label={`Counted ${r.name}`} />
                      </td>
                      <td className={`px-4 py-2 text-right tabular-nums ${diff > 0 ? 'text-teal-700' : diff < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {has ? `${diff > 0 ? '+' : ''}${diff}` : '—'}
                      </td>
                    </tr>
                  );
                })}
                {sec.rows.length === 0 && <tr><td colSpan="4" className="px-4 py-3 text-gray-400">Nothing here yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center sticky bottom-2">
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional), e.g. Monthly count"
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <button type="button" onClick={save} disabled={saving || entered.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold text-sm disabled:opacity-40">
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : `Save count (${entered.length})`}
        </button>
      </div>

      {history.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 font-semibold text-sm text-gray-700">Count log (latest 20)</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {history.map(h => (
                  <tr key={h.id} className="border-t border-gray-100">
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{new Date(h.counted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                    <td className="px-4 py-2">{h.item_name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(h.before_qty)} → {fmt(h.counted_qty)} {h.unit || ''}</td>
                    <td className={`px-4 py-2 text-right tabular-nums ${h.difference > 0 ? 'text-teal-700' : h.difference < 0 ? 'text-red-600' : 'text-gray-400'}`}>{h.difference > 0 ? '+' : ''}{fmt(h.difference)}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{h.note || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
