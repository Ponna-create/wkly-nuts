import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';
import { TimeInput12 } from './ProductionRuns';
import { Clock, X, Trash2, ClipboardList, Users } from 'lucide-react';

const ACTIVITIES = [
  'Order confirmation', 'Customer replies (WhatsApp)', 'Delivery packing / fulfilment',
  'Address printing', 'Tracking updates', 'Review follow-up', 'Other',
];

const parseHM = (t) => { if (!t) return null; const [h, m] = String(t).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const money = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function WorkLog() {
  const { showToast } = useApp();
  const [staff, setStaff] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    workDate: new Date().toISOString().split('T')[0],
    activity: '',
    start: '',
    end: '',
    staff: [],
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [staffRes, logRes] = await Promise.all([dbService.getStaff(), dbService.getWorkLog()]);
    setStaff(staffRes.data || []);
    setEntries(logRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const hours = (() => {
    const sm = parseHM(form.start), em = parseHM(form.end);
    return (sm != null && em != null && em > sm) ? (em - sm) / 60 : 0;
  })();
  const hourly = form.staff.reduce((s, st) => s + (parseFloat(st.rate) || 0), 0);
  const cost = hours * hourly;

  const toggleStaff = (member) => setForm(f => {
    const exists = f.staff.some(x => x.id === member.id);
    return { ...f, staff: exists ? f.staff.filter(x => x.id !== member.id) : [...f.staff, { id: member.id, name: member.name, rate: member.rate_per_hour }] };
  });

  const handleAdd = async () => {
    if (!form.activity) { showToast('Pick an activity', 'error'); return; }
    if (form.staff.length === 0) { showToast('Pick who did the work', 'error'); return; }
    if (hours <= 0) { showToast('Enter a valid start and end time', 'error'); return; }
    setSaving(true);
    const { data, error } = await dbService.createWorkLogEntry({
      workDate: form.workDate, activity: form.activity, startTime: form.start, endTime: form.end,
      staff: form.staff, hours, cost, notes: form.notes,
    });
    setSaving(false);
    if (error) { showToast('Failed to save', 'error'); return; }
    if (data) setEntries(prev => [data, ...prev]);
    setForm(f => ({ ...f, activity: '', start: '', end: '', staff: [], notes: '' }));
    showToast('Work logged', 'success');
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this entry?')) return;
    const { error } = await dbService.deleteWorkLogEntry(id);
    if (error) { showToast('Failed to delete', 'error'); return; }
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  // This-month totals + per-staff breakdown
  const monthPrefix = new Date().toISOString().slice(0, 7);
  const monthEntries = entries.filter(e => (e.work_date || '').startsWith(monthPrefix));
  const monthHours = monthEntries.reduce((s, e) => s + (parseFloat(e.hours) || 0), 0);
  const monthCost = monthEntries.reduce((s, e) => s + (parseFloat(e.cost) || 0), 0);
  const perStaff = {};
  monthEntries.forEach(e => (e.staff || []).forEach(st => {
    if (!perStaff[st.name]) perStaff[st.name] = { hours: 0, cost: 0 };
    perStaff[st.name].hours += (parseFloat(e.hours) || 0);
    perStaff[st.name].cost += (parseFloat(e.hours) || 0) * (parseFloat(st.rate) || 0);
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Daily Work Log</h1>
        <p className="text-gray-500 mt-1 text-sm">Sales &amp; fulfilment time (overhead) — separate from making the product.</p>
      </div>

      {/* Month summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">This month · entries</p>
          <p className="text-2xl font-bold">{monthEntries.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">This month · hours</p>
          <p className="text-2xl font-bold text-teal-600">{monthHours.toFixed(1)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 col-span-2">
          <p className="text-sm text-gray-500">This month · overhead labour</p>
          <p className="text-2xl font-bold text-teal-600">{money(monthCost)}</p>
        </div>
      </div>

      {Object.keys(perStaff).length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><Users className="w-4 h-4 text-teal-600" /> This month by person</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(perStaff).map(([name, v]) => (
              <div key={name} className="bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 text-sm">
                <span className="font-medium text-gray-800">{name}</span>
                <span className="text-teal-700 ml-2">{v.hours.toFixed(1)} hr · {money(v.cost)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add form */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
        <p className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Clock className="w-4 h-4 text-teal-600" /> Log work</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date</label>
            <input type="date" value={form.workDate} max={new Date().toISOString().split('T')[0]}
              onChange={e => setForm(f => ({ ...f, workDate: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Activity</label>
            <input type="text" list="worklog-activities" value={form.activity}
              onChange={e => setForm(f => ({ ...f, activity: e.target.value }))}
              placeholder="e.g. Delivery packing" className="w-full border rounded-lg px-3 py-2 text-sm" />
            <datalist id="worklog-activities">{ACTIVITIES.map(a => <option key={a} value={a} />)}</datalist>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Who did it</label>
          {staff.length === 0 ? (
            <p className="text-xs text-amber-600">No staff set up yet. Add staff from a production run → “Manage staff”.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {staff.map(member => {
                const picked = form.staff.some(x => x.id === member.id);
                return (
                  <button type="button" key={member.id} onClick={() => toggleStaff(member)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${picked ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-300 hover:border-teal-400'}`}>
                    {picked ? '✓ ' : ''}{member.name} <span className="opacity-70">₹{member.rate_per_hour}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Start time</label>
            <div className="flex items-center gap-2">
              <TimeInput12 value={form.start} onChange={v => setForm(f => ({ ...f, start: v }))} />
              <button type="button" onClick={() => setForm(f => ({ ...f, start: nowHM() }))}
                className="text-[11px] px-2 py-1 rounded bg-teal-100 text-teal-700 font-medium hover:bg-teal-200 whitespace-nowrap">▶ now</button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">End time</label>
            <div className="flex items-center gap-2">
              <TimeInput12 value={form.end} onChange={v => setForm(f => ({ ...f, end: v }))} />
              <button type="button" onClick={() => setForm(f => ({ ...f, end: nowHM() }))}
                className="text-[11px] px-2 py-1 rounded bg-teal-100 text-teal-700 font-medium hover:bg-teal-200 whitespace-nowrap">⏹ now</button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
          <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="e.g. 4 orders packed" className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-sm text-gray-500">
            {hours > 0 ? <>{hours.toFixed(2)} hr × {money(hourly)}/hr = <span className="font-bold text-teal-700">{money(cost)}</span></> : 'Pick staff and times'}
          </span>
          <button onClick={handleAdd} disabled={saving}
            className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium">
            {saving ? 'Saving...' : 'Add entry'}
          </button>
        </div>
      </div>

      {/* Entries */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading work log...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No work logged yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-xs text-gray-500 border-b bg-gray-50">
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Activity</th>
                <th className="text-left px-4 py-3 font-medium">Who</th>
                <th className="text-right px-4 py-3 font-medium">Hours</th>
                <th className="text-right px-4 py-3 font-medium">Cost</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{e.work_date ? new Date(e.work_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{e.activity}{e.notes && <span className="block text-xs text-gray-400 font-normal">{e.notes}</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{(e.staff || []).map(s => s.name).join(', ') || '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{(parseFloat(e.hours) || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-teal-700">{money(e.cost)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(e.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400">This time is <strong>overhead</strong> — it feeds net profit, kept separate from the cost of making each batch.</p>
    </div>
  );
}
