import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, AlertTriangle, Loader2, PackageCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';
import { buildRunRecipe, shelfLifeFor, ddmmyy, addDays, boxesFor } from '../utils/batchRecipe';
import { formatDate } from '../utils/dateFormat';

// Batch in two taps: Save batch (uses ingredients + packaging from stock, once)
// and Finish batch (good boxes go into finished stock, once). Everything is
// written to production_runs, so the Production page shows the same batches.

const todayStr = () => new Date().toISOString().split('T')[0];
const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const num = (v) => parseFloat(v) || 0;
const kgText = (v) => `${Math.round(v * 100) / 100} kg`;

const SC_PHASES = [
  { value: 'P1', label: 'Phase 1 (days 1-14)' },
  { value: 'P2', label: 'Phase 2 (days 15-28)' },
];

export default function QuickBatch() {
  const { state, showToast } = useApp();
  const skus = useMemo(() => (state.skus || []).filter(s => s.skuCode || s.sku_code), [state.skus]);

  const [skuId, setSkuId] = useState('');
  const [packType, setPackType] = useState('weekly');
  const [boxes, setBoxes] = useState('20');
  const [madeOn, setMadeOn] = useState(todayStr());
  const [expiry, setExpiry] = useState('');
  const [expiryTouched, setExpiryTouched] = useState(false);
  const [phase, setPhase] = useState('P1');
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState(null); // { shortages, unmatched, run }
  const [msg, setMsg] = useState('');

  const [ingredients, setIngredients] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [runs, setRuns] = useState([]);
  const [finishForm, setFinishForm] = useState({}); // runId -> { made, rejected }
  const [finishingId, setFinishingId] = useState('');

  const reload = useCallback(async () => {
    const [ing, al, pr] = await Promise.all([
      dbService.getIngredients(), dbService.getIngredientAliases(), dbService.getProductionRuns(),
    ]);
    setIngredients(ing.data || []);
    setAliases(al.data || []);
    setRuns(pr.data || []);
  }, []);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { if (!skuId && skus.length) setSkuId(String(skus[0].id)); }, [skus, skuId]);

  const sku = skus.find(s => String(s.id) === String(skuId));
  const isRecipe = (sku?.skuType || 'weekly') === 'weekly';
  const isSeedCycle = /seed\s*cycle/i.test(sku?.name || '');
  const skuCode = sku?.skuCode || sku?.sku_code || '';
  const effectivePack = isRecipe ? packType : 'single';
  const shelfDays = sku ? shelfLifeFor(sku) : 30;

  // expiry follows made date + shelf life until she edits it by hand
  useEffect(() => {
    if (!expiryTouched) setExpiry(addDays(madeOn, shelfDays));
  }, [madeOn, shelfDays, expiryTouched, skuId]);
  useEffect(() => { setExpiryTouched(false); }, [skuId]);

  const recipe = useMemo(() => buildRunRecipe(sku, effectivePack, boxes), [sku, effectivePack, boxes]);

  const batchNumber = useMemo(() => {
    if (!skuCode) return '';
    const base = `${skuCode}-${ddmmyy(madeOn)}${isSeedCycle ? `-${phase}` : ''}`;
    const same = runs.filter(r => (r.batch_number || '').startsWith(base)).length;
    return same === 0 ? base : `${base}-${same + 1}`;
  }, [skuCode, madeOn, isSeedCycle, phase, runs]);

  // stock check, using the same name -> mapped ingredient rules the save uses
  const stockCheck = useMemo(() => recipe.ingredients.map(item => {
    const need = num(item.quantity_grams) / 1000;
    let ids = ingredients.filter(i => norm(i.name) === norm(item.ingredient_name)).map(i => i.id);
    if (!ids.length) ids = aliases.filter(a => norm(a.alias_name) === norm(item.ingredient_name)).map(a => a.ingredient_id);
    if (!ids.length) return { name: item.ingredient_name, need, have: 0, status: 'unmapped' };
    const have = ingredients.filter(i => ids.includes(i.id))
      .reduce((s, i) => s + (i.ingredient_batches || []).filter(b => b.status === 'active').reduce((t, b) => t + num(b.quantity_remaining), 0), 0);
    return { name: item.ingredient_name, need, have, status: have + 1e-9 >= need ? 'ok' : 'short' };
  }), [recipe, ingredients, aliases]);

  const hasShort = stockCheck.some(r => r.status === 'short');
  const hasUnmapped = stockCheck.some(r => r.status === 'unmapped');
  const boxesNum = parseInt(boxes, 10) || 0;

  const buildRunPayload = () => ({
    skuId: sku.id,
    skuName: isSeedCycle ? `${sku.name.trim()} ${phase}` : sku.name.trim(),
    skuCode,
    batchDate: madeOn,
    plannedQuantity: boxesNum,
    packType: effectivePack,
    status: 'planned',
    batchNumber,
    shelfLifeDays: Math.max(1, Math.round((new Date(expiry) - new Date(madeOn)) / 86400000)),
    expiryDate: expiry,
    ingredientsUsed: recipe.ingredients,
    packagingUsed: recipe.packaging,
  });

  const handleSave = async (allowUnmatched = false, existingRun = null) => {
    if (!sku) { showToast('Choose a product', 'error'); return; }
    if (boxesNum <= 0) { showToast('Enter how many boxes', 'error'); return; }
    if (!expiry) { showToast('Expiry date is missing', 'error'); return; }
    setSaving(true);
    setMsg('');
    let run = existingRun;
    if (!run) {
      const { data, error } = await dbService.createProductionRun(buildRunPayload());
      if (error || !data) { showToast('Could not save the batch', 'error'); setSaving(false); return; }
      run = data;
    }
    const res = await dbService.startProductionRun(run, { allowUnmatched });
    if (!res.ok) {
      if (res.shortages && res.shortages.length > 0) {
        // nothing was used; remove the empty run so it doesn't linger
        await dbService.deleteProductionRun(run.id);
        setProblem({ shortages: res.shortages, unmatched: res.unmatched || [], run: null });
      } else if (res.unmatched && res.unmatched.length > 0) {
        setProblem({ shortages: [], unmatched: res.unmatched, run });
      } else {
        await dbService.deleteProductionRun(run.id);
        showToast(res.error || 'Could not use stock for this batch', 'error');
      }
      setSaving(false);
      return;
    }
    setProblem(null);
    const used = (res.consumed || []).length;
    setMsg(`Batch ${batchNumber} saved. ${used} lot(s) used from stock${res.unmatched?.length ? `; ${res.unmatched.length} item(s) not mapped, not deducted` : ''}.`);
    showToast(`Batch ${batchNumber} saved`, 'success');
    await reload();
    setSaving(false);
  };

  const handleFinish = async (run) => {
    const f = finishForm[run.id] || {};
    const made = f.made !== undefined ? f.made : String(run.planned_quantity || '');
    if (made === '' || num(made) < 0) { showToast('Enter how many good boxes were finished', 'error'); return; }
    setFinishingId(run.id);
    const res = await dbService.finishProductionRun(run, { made: num(made), rejected: num(f.rejected) });
    setFinishingId('');
    if (!res.ok) {
      const why = res.shortages?.length ? `Not enough ${res.shortages[0].name} in stock` : (res.error || 'Could not finish the batch');
      showToast(why, 'error');
      return;
    }
    showToast(res.alreadyDone ? 'This batch was already finished' : `${num(made)} box(es) added to finished stock`, 'success');
    await reload();
  };

  const openRuns = runs.filter(r => ['planned', 'in_progress', 'quality_check'].includes(r.status));
  const doneRuns = runs.filter(r => r.status === 'completed').slice(0, 5);
  const field = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent';
  const chip = (on) => `px-3 py-2 rounded-lg text-sm font-medium border ${on ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-300 bg-white text-gray-600'}`;

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quick Batch</h1>
        <p className="text-sm text-gray-500">Save when you start. Finish when the boxes are done.</p>
      </div>

      {msg && (
        <div className="flex items-start gap-2 bg-green-50 border border-green-200 text-green-800 rounded-lg px-3 py-2 text-sm">
          <Check className="w-4 h-4 mt-0.5 flex-shrink-0" /> {msg}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Product</label>
          <select value={skuId} onChange={e => setSkuId(e.target.value)} className={field}>
            {skus.map(s => <option key={s.id} value={s.id}>{s.name.trim()}</option>)}
          </select>
        </div>
        {isRecipe && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setPackType('weekly')} className={chip(packType === 'weekly')}>Weekly box</button>
            <button type="button" onClick={() => setPackType('monthly')} className={chip(packType === 'monthly')}>Monthly pack (4 boxes)</button>
          </div>
        )}
        {isSeedCycle && (
          <div className="flex gap-2 flex-wrap">
            {SC_PHASES.map(p => <button key={p.value} type="button" onClick={() => setPhase(p.value)} className={chip(phase === p.value)}>{p.label}</button>)}
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{effectivePack === 'monthly' ? 'Packs' : 'Boxes'}</label>
            <input type="number" inputMode="numeric" min="1" value={boxes} onChange={e => setBoxes(e.target.value)} className={field} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Made on</label>
            <input type="date" value={madeOn} onChange={e => setMadeOn(e.target.value)} className={field} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Expiry</label>
            <input type="date" value={expiry} onChange={e => { setExpiry(e.target.value); setExpiryTouched(true); }} className={field} />
          </div>
        </div>
        <p className="text-xs text-gray-400">
          Expiry = made date + {shelfDays} days (the product&apos;s shelf life). You can change it.
        </p>
      </div>

      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-teal-700 uppercase mb-1">Print on the sachet and box</p>
        <p className="text-lg font-bold text-teal-900 break-words">{batchNumber || '—'}</p>
        <p className="text-sm text-teal-900">MFG {expiry || madeOn ? formatDate(madeOn) : '—'} · EXP {expiry ? formatDate(expiry) : '—'}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Taken from stock (oldest bill first)</p>
        {stockCheck.length === 0 ? (
          <p className="text-sm text-gray-400">
            No ingredient recipe on this product{recipe.packaging.length > 0 ? ', so only the packaging below will be used' : ', so nothing will be used from stock'}.
          </p>
        ) : stockCheck.map(r => (
          <div key={r.name} className="flex items-center justify-between gap-2 py-1.5 border-t first:border-t-0 border-gray-100 text-sm">
            <span className="truncate">{r.name}</span>
            <span className={`text-right flex-shrink-0 ${r.status === 'ok' ? 'text-gray-700' : r.status === 'short' ? 'text-red-600 font-medium' : 'text-amber-700'}`}>
              {kgText(r.need)}
              {r.status === 'short' && <span className="block text-[11px]">only {kgText(r.have)} in stock</span>}
              {r.status === 'unmapped' && <span className="block text-[11px]">not mapped to stock</span>}
            </span>
          </div>
        ))}
        {recipe.packaging.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            {recipe.packaging.map(p => (
              <div key={p.material_name} className="flex justify-between text-sm py-1">
                <span className="truncate">{p.material_name}</span><span>{p.quantity} {p.unit}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {(hasShort || hasUnmapped) && !problem && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-xs">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            {hasShort && 'Some ingredients are short, so the batch can\'t be saved until they are bought (Quick → Bill). '}
            {hasUnmapped && 'Some recipe names are not mapped to a stock item (Inventory → Recipe Mapping); they won\'t be deducted.'}
          </span>
        </div>
      )}

      {problem && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800 space-y-2">
          {problem.shortages.length > 0 && (
            <div>
              <p className="font-semibold">Not enough stock, nothing was used:</p>
              {problem.shortages.map(s => <p key={s.name}>{s.name}: need {kgText(s.need)}, have {kgText(s.have)}</p>)}
            </div>
          )}
          {problem.unmatched.length > 0 && (
            <div>
              <p className="font-semibold">Not mapped to a stock item:</p>
              <p>{problem.unmatched.join(', ')}</p>
              <p className="text-xs mt-1">Map them in Inventory → Recipe Mapping, or save without deducting these.</p>
              {problem.run && (
                <button type="button" onClick={() => handleSave(true, problem.run)}
                  className="mt-2 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium">
                  Save without deducting these
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {openRuns.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Open batches</h2>
          {openRuns.map(run => {
            const f = finishForm[run.id] || {};
            const label = run.batch_number || (run.sku_code ? `${run.sku_code}-${ddmmyy(run.batch_date)}` : run.run_number);
            const legacyNotStarted = !run.stock_deducted;
            return (
              <div key={run.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 break-words">{label}</p>
                    <p className="text-xs text-gray-500">
                      {run.sku_name} · {run.planned_quantity} {run.pack_type === 'monthly' ? 'packs' : 'boxes'} planned · {formatDate(run.batch_date)}
                      {run.expiry_date ? ` · EXP ${formatDate(run.expiry_date)}` : ''}
                    </p>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium flex-shrink-0">Making</span>
                </div>
                {legacyNotStarted && (
                  <p className="text-[11px] text-amber-700">Started in the old Production screen. Finishing it here will take its ingredients from stock now.</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-0.5">Good boxes finished</label>
                    <input type="number" inputMode="numeric" min="0"
                      value={f.made !== undefined ? f.made : String(run.planned_quantity || '')}
                      onChange={e => setFinishForm(p => ({ ...p, [run.id]: { ...p[run.id], made: e.target.value } }))}
                      className={field} />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-500 mb-0.5">Rejected / damaged</label>
                    <input type="number" inputMode="numeric" min="0" value={f.rejected ?? ''}
                      onChange={e => setFinishForm(p => ({ ...p, [run.id]: { ...p[run.id], rejected: e.target.value } }))}
                      className={field} placeholder="0" />
                  </div>
                </div>
                <button type="button" onClick={() => handleFinish(run)} disabled={finishingId === run.id}
                  className="w-full min-h-[44px] bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold rounded-lg flex items-center justify-center gap-2">
                  {finishingId === run.id ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><PackageCheck className="w-4 h-4" /> Finish batch, add to stock</>}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {doneRuns.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">Recently finished</h2>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {doneRuns.map(run => (
              <div key={run.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <span className="truncate">{run.batch_number || run.run_number} · {run.sku_name}</span>
                <span className="text-gray-500 flex-shrink-0">{run.actual_quantity || 0} done{run.rejected_quantity ? `, ${run.rejected_quantity} rejected` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sticky bottom-0 bg-gray-50 pt-2 pb-3">
        <button type="button" onClick={() => handleSave(false)} disabled={saving || hasShort}
          className="w-full min-h-[48px] bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white font-semibold rounded-xl flex items-center justify-center gap-2">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : hasShort ? 'Not enough stock' : 'Save batch'}
        </button>
      </div>
    </div>
  );
}
