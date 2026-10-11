import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';
import { formatDate } from '../utils/dateFormat';

// Hours in one screen. Pick what the work was FOR (a batch, a product's prep,
// customer-order packing, or general), tick the people, set each person's own
// in / out time. One row per person goes to Work Log with the rate used that
// day, and batch hours roll up into the batch's cost.

const todayStr = () => new Date().toISOString().split('T')[0];
const num = (v) => parseFloat(v) || 0;
const round2 = (v) => Math.round(v * 100) / 100;
const nowHM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const toMin = (t) => {
  const m = String(t || '').match(/^(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
};
const hoursBetween = (a, b) => {
  const s = toMin(a), e = toMin(b);
  return s != null && e != null && e > s ? (e - s) / 60 : 0;
};

// rate in force on a given date: latest increment on or before it, else the base rate
function rateOn(member, date) {
  const rows = (member.rate_history || []).filter(h => h.effective_date <= date)
    .sort((a, b) => (a.effective_date < b.effective_date ? 1 : -1));
  if (rows.length > 0) return num(rows[0].new_rate);
  return num(member.base_rate_per_hour ?? member.rate_per_hour);
}

const SCOPES = [
  { value: 'batch', label: 'A batch' },
  { value: 'product', label: 'A product (before its batch)' },
  { value: 'fulfilment', label: 'Packing customer orders' },
  { value: 'general', label: 'General work' },
];

export default function QuickHours() {
  const { state, showToast } = useApp();
  const skus = useMemo(() => (state.skus || []).filter(s => s.skuCode || s.sku_code), [state.skus]);

  const [date, setDate] = useState(todayStr());
  const [scope, setScope] = useState('batch');
  const [runId, setRunId] = useState('');
  const [skuId, setSkuId] = useState('');
  const [defaultWork, setDefaultWork] = useState('');
  const [newWorkMode, setNewWorkMode] = useState(false);
  const [newWork, setNewWork] = useState('');
  const [sameIn, setSameIn] = useState('');
  const [sameOut, setSameOut] = useState('');
  const [sameInSet, setSameInSet] = useState(false);
  const [sameOutSet, setSameOutSet] = useState(false);
  const [rows, setRows] = useState({}); // staffId -> { on, work, inT, outT, inSet, outSet }
  const [saving, setSaving] = useState(false);

  const [staff, setStaff] = useState([]);
  const [workTypes, setWorkTypes] = useState([]);
  const [runs, setRuns] = useState([]);
  const [entries, setEntries] = useState([]);

  const load = useCallback(async () => {
    const [st, wt, pr, wl] = await Promise.all([
      dbService.getStaff(), dbService.getWorkTypes(), dbService.getProductionRuns(), dbService.getWorkLog(),
    ]);
    setStaff(st.data || []);
    setWorkTypes(wt.data || []);
    setRuns(pr.data || []);
    setEntries(wl.data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openRuns = runs.filter(r => ['planned', 'in_progress', 'quality_check'].includes(r.status));
  useEffect(() => {
    if (scope === 'batch' && !runId && openRuns.length === 1) setRunId(openRuns[0].id);
  }, [scope, runId, openRuns]);
  useEffect(() => { if (!skuId && skus.length) setSkuId(String(skus[0].id)); }, [skus, skuId]);
  useEffect(() => {
    if (!defaultWork && workTypes.length) setDefaultWork(workTypes[0].name);
  }, [workTypes, defaultWork]);
  // sensible default work when the scope is customer-order packing
  useEffect(() => {
    if (scope === 'fulfilment' && workTypes.some(w => w.name === 'Order packing')) setDefaultWork('Order packing');
  }, [scope, workTypes]);

  const rowOf = (id) => rows[id] || { on: false, work: '', inT: '', outT: '', inSet: false, outSet: false };
  const patchRow = (id, patch) => setRows(p => ({ ...p, [id]: { ...rowOf(id), ...(p[id] || {}), ...patch } }));

  const selected = staff.filter(m => rowOf(m.id).on);
  const calc = selected.map(m => {
    const r = rowOf(m.id);
    const hrs = hoursBetween(r.inT, r.outT);
    const rate = rateOn(m, date);
    return { m, r, hrs, rate, cost: hrs * rate };
  });
  const totalHours = calc.reduce((t, c) => t + c.hrs, 0);
  const totalCost = calc.reduce((t, c) => t + c.cost, 0);
  const run = runs.find(r => String(r.id) === String(runId));

  const applySame = () => {
    if (!sameIn || !sameOut) { showToast('Enter the in and out time first', 'error'); return; }
    setRows(p => {
      const next = { ...p };
      selected.forEach(m => { next[m.id] = { ...rowOf(m.id), ...(p[m.id] || {}), inT: sameIn, outT: sameOut }; });
      return next;
    });
  };

  // One tap for the whole group: stamps the time on every ticked person who has no
  // in (or out) time yet. Anyone who already has a time is left alone.
  const stampGroup = (which) => {
    const t = nowHM();
    if (selected.length === 0) { showToast('Tick the people first', 'error'); return; }
    setRows(p => {
      const next = { ...p };
      selected.forEach(m => {
        const cur = { ...rowOf(m.id), ...(p[m.id] || {}) };
        if (which === 'in' && !cur.inT) next[m.id] = { ...cur, inT: t, inSet: true };
        if (which === 'out' && !cur.outT) next[m.id] = { ...cur, outT: t, outSet: true };
      });
      return next;
    });
    if (which === 'in') { setSameIn(t); setSameInSet(true); } else { setSameOut(t); setSameOutSet(true); }
  };

  const addWorkType = async () => {
    const name = newWork.trim();
    if (!name) { showToast('Type the name of the work', 'error'); return; }
    const { data, error } = await dbService.createWorkType(name);
    if (error || !data) { showToast('Could not add this work type', 'error'); return; }
    await load();
    setDefaultWork(data.name);
    setNewWork('');
    setNewWorkMode(false);
  };

  const scopeLabel = () => {
    if (scope === 'batch') return run ? (run.batch_number || run.run_number) : '';
    if (scope === 'product') return skus.find(s => String(s.id) === String(skuId))?.name?.trim() || '';
    if (scope === 'fulfilment') return 'Customer orders';
    return 'General';
  };

  const handleSave = async () => {
    if (scope === 'batch' && !runId) { showToast('Choose the batch', 'error'); return; }
    if (scope === 'product' && !skuId) { showToast('Choose the product', 'error'); return; }
    if (selected.length === 0) { showToast('Tick who worked', 'error'); return; }
    for (const c of calc) {
      if (c.hrs <= 0) { showToast(`Check ${c.m.name}'s in and out time (out must be after in)`, 'error'); return; }
    }
    setSaving(true);
    let failed = 0;
    for (const c of calc) {
      const work = c.r.work || defaultWork || 'Work';
      const { error } = await dbService.createWorkLogEntry({
        workDate: date,
        activity: `${work}${scopeLabel() ? ` · ${scopeLabel()}` : ''}`,
        startTime: c.r.inT,
        endTime: c.r.outT,
        staff: [{ id: c.m.id, name: c.m.name, rate: c.rate }],
        hours: round2(c.hrs),
        cost: round2(c.cost),
        productionRunId: scope === 'batch' ? runId : null,
        skuId: scope === 'product' ? skuId : null,
        workScope: scope,
        workType: work,
      });
      if (error) failed += 1;
    }
    if (scope === 'batch') await dbService.recalcRunLabour(runId);
    setSaving(false);
    if (failed > 0) {
      showToast(`${calc.length - failed} saved, ${failed} failed. Check the list below before retrying.`, 'error');
    } else {
      showToast(`Hours saved for ${calc.length} ${calc.length === 1 ? 'person' : 'people'} · ₹${Math.round(totalCost)}`, 'success');
    }
    setRows({});
    setSameIn('');
    setSameOut('');
    setSameInSet(false);
    setSameOutSet(false);
    await load();
  };

  const handleDelete = async (entry) => {
    const { error } = await dbService.deleteWorkLogEntry(entry.id);
    if (error) { showToast('Could not delete this entry', 'error'); return; }
    if (entry.production_run_id) await dbService.recalcRunLabour(entry.production_run_id);
    showToast('Entry removed', 'success');
    await load();
  };

  const dayEntries = entries.filter(e => e.work_date === date);
  const dayCost = dayEntries.reduce((t, e) => t + num(e.cost), 0);
  const field = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent';
  const chip = (on) => `px-3 py-2 rounded-lg text-sm font-medium border text-left ${on ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-300 bg-white text-gray-600'}`;

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quick Hours</h1>
        <p className="text-sm text-gray-500">Who worked, on what, from when to when. Everyone has their own times.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={field} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Work</label>
            {newWorkMode ? (
              <div className="flex gap-1.5">
                <input autoFocus value={newWork} onChange={e => setNewWork(e.target.value)} className={field} placeholder="Name of work" />
                <button type="button" onClick={addWorkType} className="px-3 bg-teal-600 text-white rounded-lg text-sm font-medium">Add</button>
              </div>
            ) : (
              <select value={defaultWork} onChange={e => e.target.value === '__new' ? setNewWorkMode(true) : setDefaultWork(e.target.value)} className={field}>
                {workTypes.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                <option value="__new">+ Other (type a new work)</option>
              </select>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">This work is for</label>
          <div className="grid grid-cols-2 gap-2">
            {SCOPES.map(s => (
              <button key={s.value} type="button" onClick={() => setScope(s.value)} className={chip(scope === s.value)}>{s.label}</button>
            ))}
          </div>
        </div>

        {scope === 'batch' && (
          openRuns.length === 0 ? (
            <p className="text-xs text-amber-700">No open batch yet. Save a batch in Quick → Batch first, or choose another option above.</p>
          ) : (
            <select value={runId} onChange={e => setRunId(e.target.value)} className={field}>
              <option value="">Choose the batch…</option>
              {openRuns.map(r => (
                <option key={r.id} value={r.id}>
                  {(r.batch_number || r.run_number)} · {r.sku_name?.trim()} · {r.planned_quantity} boxes
                </option>
              ))}
            </select>
          )
        )}
        {scope === 'product' && (
          <div>
            <select value={skuId} onChange={e => setSkuId(e.target.value)} className={field}>
              {skus.map(s => <option key={s.id} value={s.id}>{s.name.trim()}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">For work done before the batch is started (for example removing shells). Its cost joins this product&apos;s next batch.</p>
          </div>
        )}
        {scope === 'fulfilment' && (
          <p className="text-xs text-gray-400">Time spent packing customer orders. Counted as fulfilment cost, not product cost.</p>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-gray-500 mb-0.5">Everyone in</label>
            <div className="flex gap-1.5">
              <input type="time" value={sameIn} onChange={e => setSameIn(e.target.value)} className={field} />
              <button type="button" disabled={sameInSet} onClick={() => stampGroup('in')}
                className="px-2.5 text-xs font-medium border border-gray-300 rounded-lg bg-white text-gray-700 disabled:bg-gray-100 disabled:text-gray-400">
                Now
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-0.5">Everyone out</label>
            <div className="flex gap-1.5">
              <input type="time" value={sameOut} onChange={e => setSameOut(e.target.value)} className={field} />
              <button type="button" disabled={sameOutSet} onClick={() => stampGroup('out')}
                className="px-2.5 text-xs font-medium border border-gray-300 rounded-lg bg-white text-gray-700 disabled:bg-gray-100 disabled:text-gray-400">
                Now
              </button>
            </div>
          </div>
        </div>
        <button type="button" onClick={applySame}
          className="w-full min-h-[40px] border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white">
          Apply typed times to ticked people
        </button>
        <p className="text-[11px] text-gray-400">Tick the people, then tap Now to start or stop all of them at once. Anyone can still be changed below.</p>

        {staff.length === 0 && <p className="text-sm text-gray-400">No staff yet. Add them in Work Log → Staff.</p>}
        {staff.map(m => {
          const r = rowOf(m.id);
          const c = calc.find(x => x.m.id === m.id);
          return (
            <div key={m.id} className={`rounded-lg border ${r.on ? 'border-teal-300 bg-teal-50/40' : 'border-gray-200'} p-3`}>
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="flex items-center gap-2 min-w-0">
                  <input type="checkbox" checked={r.on} onChange={e => patchRow(m.id, { on: e.target.checked })} className="w-4 h-4" />
                  <span className="font-medium text-gray-900 truncate">{m.name.trim()}</span>
                </span>
                <span className="text-xs text-gray-500 flex-shrink-0">₹{rateOn(m, date)}/hr</span>
              </label>
              {r.on && (
                <div className="mt-2 space-y-2">
                  <select value={r.work || ''} onChange={e => patchRow(m.id, { work: e.target.value })} className={field}>
                    <option value="">{defaultWork || 'Work'} (same as above)</option>
                    {workTypes.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-0.5">In</label>
                      <div className="flex gap-1.5">
                        <input type="time" value={r.inT} onChange={e => patchRow(m.id, { inT: e.target.value })} className={field} />
                        <button type="button" disabled={r.inSet} onClick={() => patchRow(m.id, { inT: nowHM(), inSet: true })}
                          className="px-2.5 text-xs font-medium border border-gray-300 rounded-lg bg-white text-gray-700 disabled:bg-gray-100 disabled:text-gray-400">
                          Now
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-0.5">Out</label>
                      <div className="flex gap-1.5">
                        <input type="time" value={r.outT} onChange={e => patchRow(m.id, { outT: e.target.value })} className={field} />
                        <button type="button" disabled={r.outSet} onClick={() => patchRow(m.id, { outT: nowHM(), outSet: true })}
                          className="px-2.5 text-xs font-medium border border-gray-300 rounded-lg bg-white text-gray-700 disabled:bg-gray-100 disabled:text-gray-400">
                          Now
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    {c && c.hrs > 0 ? `${round2(c.hrs)} hours = ₹${Math.round(c.cost)}` : 'Enter in and out time'}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {calc.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Total hours</span><b>{round2(totalHours)}</b></div>
          <div className="flex justify-between"><span className="text-gray-500">Labour cost</span><b>₹{Math.round(totalCost)}</b></div>
          {scope === 'batch' && run && num(run.planned_quantity) > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Labour per box ({run.planned_quantity})</span>
              <b>₹{round2((num(run.labor_cost) + totalCost) / num(run.planned_quantity))}</b>
            </div>
          )}
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          Hours on {formatDate(date)} {dayEntries.length > 0 && <span className="font-normal text-gray-400">· ₹{Math.round(dayCost)}</span>}
        </h2>
        {dayEntries.length === 0 ? (
          <p className="text-sm text-gray-400">Nothing logged for this date yet.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {dayEntries.map(e => (
              <div key={e.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{(e.staff || []).map(s => s.name?.trim()).join(', ') || '—'}</p>
                  <p className="text-xs text-gray-500 truncate">{e.activity} · {e.start_time}–{e.end_time}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-gray-700">₹{Math.round(num(e.cost))}</span>
                  <button type="button" aria-label="Remove entry" onClick={() => handleDelete(e)} className="text-gray-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 bg-gray-50 pt-2 pb-3">
        <button type="button" onClick={handleSave} disabled={saving}
          className="w-full min-h-[48px] bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white font-semibold rounded-xl flex items-center justify-center gap-2">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Check className="w-4 h-4" /> Save hours{calc.length > 0 ? ` · ₹${Math.round(totalCost)}` : ''}</>}
        </button>
      </div>
    </div>
  );
}
