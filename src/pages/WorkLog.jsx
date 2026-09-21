import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';
import { TimeInput12 } from './ProductionRuns';
import { Clock, X, Trash2, ClipboardList, Users, Edit2, Check, TrendingUp } from 'lucide-react';
import { formatDateShort } from '../utils/dateFormat';

const ACTIVITIES = [
  'Order confirmation', 'Customer replies (WhatsApp)', 'Delivery packing / fulfilment',
  'Address printing', 'Tracking updates', 'Review follow-up', 'Other',
];

const parseHM = (t) => { if (!t) return null; const [h, m] = String(t).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const money = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function WorkLog() {
  const { showToast } = useApp();
  const [activeTab, setActiveTab] = useState('log'); // 'log' | 'staff'
  const [staff, setStaff] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);

  const BLANK_FORM = {
    workDate: new Date().toISOString().split('T')[0],
    activity: '',
    start: '',
    end: '',
    staff: [],
    notes: '',
  };
  const [form, setForm] = useState(BLANK_FORM);

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

    if (editingEntryId) {
      const { data, error } = await dbService.updateWorkLogEntry({
        id: editingEntryId, workDate: form.workDate, activity: form.activity,
        startTime: form.start, endTime: form.end, staff: form.staff, hours, cost, notes: form.notes,
      });
      setSaving(false);
      if (error) { showToast('Failed to update', 'error'); return; }
      if (data) setEntries(prev => prev.map(e => e.id === editingEntryId ? data : e));
      setEditingEntryId(null);
      setForm(BLANK_FORM);
      showToast('Entry updated', 'success');
      return;
    }

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

  const startEditEntry = (e) => {
    setEditingEntryId(e.id);
    setForm({
      workDate: e.work_date || new Date().toISOString().split('T')[0],
      activity: e.activity || '',
      start: e.start_time || '',
      end: e.end_time || '',
      staff: e.staff || [],
      notes: e.notes || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditEntry = () => {
    setEditingEntryId(null);
    setForm(BLANK_FORM);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this entry?')) return;
    const { error } = await dbService.deleteWorkLogEntry(id);
    if (error) { showToast('Failed to delete', 'error'); return; }
    setEntries(prev => prev.filter(e => e.id !== id));
    if (editingEntryId === id) cancelEditEntry();
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
        <h1 className="text-2xl font-bold text-gray-900">Work &amp; Staff</h1>
        <p className="text-gray-500 mt-1 text-sm">Log sales &amp; fulfilment time (overhead), and manage your staff directory.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-gray-100 max-w-md">
        <button onClick={() => setActiveTab('log')}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium flex-1 transition-all ${activeTab === 'log' ? 'bg-teal-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
          <ClipboardList className="w-4 h-4" /> Work Log
        </button>
        <button onClick={() => setActiveTab('staff')}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium flex-1 transition-all ${activeTab === 'staff' ? 'bg-teal-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
          <Users className="w-4 h-4" /> Staff ({staff.length})
        </button>
      </div>

      {activeTab === 'staff' && <StaffDirectory staff={staff} onChanged={load} showToast={showToast} />}

      {activeTab === 'log' && (<>
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
        <p className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Clock className="w-4 h-4 text-teal-600" /> {editingEntryId ? 'Edit work entry' : 'Log work'}</p>
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
          <label className="block text-xs text-gray-500 mb-1">
            Who did it {form.staff.length > 0 && <span className="text-teal-600 font-medium">({form.staff.length} selected)</span>}
          </label>
          {staff.length === 0 ? (
            <p className="text-xs text-amber-600">No staff yet. Add your team in the <strong>Staff</strong> tab above.</p>
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
          <div className="flex items-center gap-2">
            {editingEntryId && (
              <button onClick={cancelEditEntry} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
            )}
            <button onClick={handleAdd} disabled={saving}
              className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium">
              {saving ? 'Saving...' : editingEntryId ? 'Update entry' : 'Add entry'}
            </button>
          </div>
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
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{e.work_date ? formatDateShort(e.work_date) : '—'}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{e.activity}{e.notes && <span className="block text-xs text-gray-400 font-normal">{e.notes}</span>}</td>
                  <td className="px-4 py-3 text-gray-600">{(e.staff || []).map(s => s.name).join(', ') || '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{(parseFloat(e.hours) || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-teal-700">{money(e.cost)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => startEditEntry(e)} className="text-blue-500 hover:text-blue-700 mr-3"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(e.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400">This time is <strong>overhead</strong> — it feeds net profit, kept separate from the cost of making each batch.</p>
      </>)}
    </div>
  );
}

// ============================================
// STAFF DIRECTORY (full employee details)
// ============================================
const BLANK_STAFF = { name: '', employeeId: '', mobile: '', address: '', ratePerHour: '', role: 'production' };
const todayISO = () => new Date().toISOString().split('T')[0];

// "3 increments · last +₹10 on 01-08-2026 · about every 4 months"
function incrementSummary(history) {
  const rows = (history || []).filter(h => h.effective_date <= todayISO());
  if (rows.length === 0) return null;
  const last = rows[0];
  let every = '';
  if (rows.length >= 2) {
    const first = new Date(rows[rows.length - 1].effective_date);
    const latest = new Date(last.effective_date);
    const months = (latest - first) / (1000 * 60 * 60 * 24 * 30.4) / (rows.length - 1);
    if (months > 0) every = ` · about every ${months < 1 ? '<1' : Math.round(months)} month${Math.round(months) === 1 ? '' : 's'}`;
  }
  return `${rows.length} increment${rows.length === 1 ? '' : 's'} · last ${last.increment >= 0 ? '+' : '−'}₹${Math.abs(last.increment)} on ${formatDateShort(last.effective_date)}${every}`;
}

// Edit popup: details + a proper Increment section (amount + effective date),
// so a raise is recorded with its date instead of silently overwriting the rate.
function EditStaffModal({ member, onClose, onSaved, showToast }) {
  const [form, setForm] = useState({
    name: member.name || '', employeeId: member.employee_id || '', mobile: member.mobile || '',
    address: member.address || '', role: member.role || 'production',
  });
  const [increment, setIncrement] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const current = parseFloat(member.rate_per_hour) || 0;
  const inc = parseFloat(increment);
  const hasIncrement = increment !== '' && !Number.isNaN(inc) && inc !== 0;
  const newRate = current + (hasIncrement ? inc : 0);
  const history = member.rate_history || [];
  const summary = incrementSummary(history);

  const save = async () => {
    if (!form.name.trim()) { showToast('Name is required', 'error'); return; }
    if (hasIncrement && !effectiveDate) { showToast('Pick the date the increment starts', 'error'); return; }
    if (hasIncrement && newRate < 0) { showToast('Rate cannot go below ₹0', 'error'); return; }
    setSaving(true);
    const { error } = await dbService.updateStaff({ id: member.id, ...form });
    if (error) { setSaving(false); showToast('Failed to save staff', 'error'); return; }
    if (hasIncrement) {
      const { error: incErr } = await dbService.addStaffIncrement({ staffId: member.id, effectiveDate, oldRate: current, increment: inc });
      if (incErr) { setSaving(false); showToast('Details saved, but the increment failed — try again', 'error'); onSaved(true); return; }
    }
    setSaving(false);
    showToast(hasIncrement ? `Saved. ₹${current} → ₹${newRate}/hr from ${formatDateShort(effectiveDate)}` : 'Staff updated', 'success');
    onSaved();
  };

  const removeIncrement = async (id) => {
    if (!confirm('Delete this increment record? The rate goes back to what it was before it.')) return;
    const { error } = await dbService.deleteStaffIncrement(id);
    if (error) { showToast('Failed to delete', 'error'); return; }
    showToast('Increment removed');
    onSaved(true);
  };

  const field = 'w-full border rounded-lg px-3 py-2 text-sm';
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-lg font-bold text-gray-900">Edit staff — {member.name}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name *</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={field} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Employee ID</label>
              <input type="text" value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} className={field} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Mobile</label>
              <input type="tel" value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} className={field} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={field}>
                <option value="production">Production</option>
                <option value="sales">Sales / Fulfilment</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Address</label>
              <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={field} placeholder="Optional" />
            </div>
          </div>

          {/* Pay + increment */}
          <div className="border border-teal-200 bg-teal-50 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-teal-800 flex items-center gap-1.5"><TrendingUp className="w-4 h-4" /> Pay &amp; increment</p>
              <p className="text-sm text-gray-700">Current rate: <strong>₹{current}/hr</strong></p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Increment (₹/hour)</label>
                <input type="number" value={increment} onChange={e => setIncrement(e.target.value)} className={field} placeholder="e.g. 10" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Effective from</label>
                <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} className={field} />
              </div>
            </div>
            {hasIncrement && (
              <p className="text-sm text-teal-800 font-medium">₹{current} {inc >= 0 ? '+' : '−'} ₹{Math.abs(inc)} = <strong>₹{newRate}/hr</strong> from {formatDateShort(effectiveDate)}
                {effectiveDate > todayISO() && <span className="text-xs text-gray-500 font-normal"> (starts on that date)</span>}
              </p>
            )}
            <p className="text-xs text-gray-500">Past work-log entries keep the rate they were logged with. Use a negative number for a reduction.</p>
          </div>

          {/* History */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Increment history</p>
            {summary && <p className="text-xs text-teal-700 mb-2">{summary}</p>}
            {history.length === 0 ? (
              <p className="text-xs text-gray-400">No increments recorded yet.</p>
            ) : (
              <div className="border rounded-lg divide-y">
                {history.map(h => (
                  <div key={h.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-gray-600">{formatDateShort(h.effective_date)}{h.effective_date > todayISO() && <span className="ml-1 text-xs text-amber-600">(upcoming)</span>}</span>
                    <span className="text-gray-800">₹{parseFloat(h.old_rate)} → <strong>₹{parseFloat(h.new_rate)}</strong> <span className={h.increment >= 0 ? 'text-green-600' : 'text-red-600'}>({h.increment >= 0 ? '+' : '−'}₹{Math.abs(h.increment)})</span></span>
                    <button onClick={() => removeIncrement(h.id)} className="text-red-400 hover:text-red-600 ml-2"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex justify-end gap-2 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium">
            {saving ? 'Saving...' : hasIncrement ? 'Save & apply increment' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StaffDirectory({ staff, onChanged, showToast }) {
  const [form, setForm] = useState(BLANK_STAFF);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Keep the open popup in sync after a save/delete reloads the list
  const liveMember = editingId ? staff.find(s => s.id === editingId) : null;

  const save = async () => {
    if (!form.name.trim() || form.ratePerHour === '') { showToast('Name and ₹/hour are required', 'error'); return; }
    setSaving(true);
    const { error } = await dbService.createStaff(form);
    setSaving(false);
    if (error) { showToast('Failed to save staff', 'error'); return; }
    showToast('Staff added', 'success');
    setForm(BLANK_STAFF);
    onChanged();
  };

  const remove = async (id) => {
    if (!confirm('Remove this staff member? Past records keep their name.')) return;
    const { error } = await dbService.deleteStaff(id);
    if (error) { showToast('Failed to remove', 'error'); return; }
    showToast('Staff removed');
    onChanged();
  };

  return (
    <div className="space-y-4">
      {/* Add form (editing happens in the popup) */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Add staff</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Name *</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Ravi Kumar" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Employee ID</label>
            <input type="text" value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. EMP-01" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Mobile</label>
            <input type="tel" value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="10-digit number" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Starting ₹/hour *</label>
            <input type="number" min="0" value={form.ratePerHour || ''} onChange={e => setForm(f => ({ ...f, ratePerHour: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="40" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Role</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="production">Production</option>
              <option value="sales">Sales / Fulfilment</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Address</label>
            <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Optional" />
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={save} disabled={saving}
            className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium">
            {saving ? 'Saving...' : '+ Add staff'}
          </button>
        </div>
      </div>

      {/* Directory */}
      {staff.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No staff yet — add your team above.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-xs text-gray-500 border-b bg-gray-50">
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Emp ID</th>
                <th className="text-left px-4 py-3 font-medium">Mobile</th>
                <th className="text-left px-4 py-3 font-medium">Role</th>
                <th className="text-right px-4 py-3 font-medium">₹/hour</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staff.map(s => {
                const summary = incrementSummary(s.rate_history);
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.name}
                      {s.address && <span className="block text-xs text-gray-400 font-normal">{s.address}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.employee_id || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{s.mobile || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{s.role}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">₹{s.rate_per_hour}
                      {summary && <span className="block text-[11px] text-teal-700 font-normal">{summary}</span>}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => setEditingId(s.id)} title="Edit / add increment" className="text-blue-500 hover:text-blue-700 mr-3"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => remove(s.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {liveMember && (
        <EditStaffModal
          key={liveMember.id + ':' + (liveMember.rate_history || []).length}
          member={liveMember}
          onClose={() => setEditingId(null)}
          onSaved={(keepOpen) => { onChanged(); if (keepOpen !== true) setEditingId(null); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}
