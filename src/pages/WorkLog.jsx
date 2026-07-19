import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { dbService } from '../services/supabase';
import { TimeInput12 } from './ProductionRuns';
import { Clock, X, Trash2, ClipboardList, Users, Edit2, Check } from 'lucide-react';

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
      </>)}
    </div>
  );
}

// ============================================
// STAFF DIRECTORY (full employee details)
// ============================================
const BLANK_STAFF = { name: '', employeeId: '', mobile: '', address: '', ratePerHour: '', role: 'production' };

function StaffDirectory({ staff, onChanged, showToast }) {
  const [form, setForm] = useState(BLANK_STAFF);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const startEdit = (s) => {
    setEditingId(s.id);
    setForm({
      name: s.name || '', employeeId: s.employee_id || '', mobile: s.mobile || '',
      address: s.address || '', ratePerHour: s.rate_per_hour ?? '', role: s.role || 'production',
    });
  };
  const cancel = () => { setEditingId(null); setForm(BLANK_STAFF); };

  const save = async () => {
    if (!form.name.trim() || form.ratePerHour === '') { showToast('Name and ₹/hour are required', 'error'); return; }
    setSaving(true);
    const { error } = editingId
      ? await dbService.updateStaff({ id: editingId, ...form })
      : await dbService.createStaff(form);
    setSaving(false);
    if (error) { showToast('Failed to save staff', 'error'); return; }
    showToast(editingId ? 'Staff updated' : 'Staff added', 'success');
    cancel();
    onChanged();
  };

  const remove = async (id) => {
    if (!confirm('Remove this staff member? Past records keep their name.')) return;
    const { error } = await dbService.deleteStaff(id);
    if (error) { showToast('Failed to remove', 'error'); return; }
    showToast('Staff removed');
    if (editingId === id) cancel();
    onChanged();
  };

  return (
    <div className="space-y-4">
      {/* Add / edit form */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-3">
        <p className="text-sm font-semibold text-gray-700">{editingId ? 'Edit staff' : 'Add staff'}</p>
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
            <label className="block text-xs text-gray-500 mb-1">₹/hour *</label>
            <input type="number" min="0" value={form.ratePerHour} onChange={e => setForm(f => ({ ...f, ratePerHour: e.target.value }))}
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
        <div className="flex justify-end gap-2">
          {editingId && <button onClick={cancel} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>}
          <button onClick={save} disabled={saving}
            className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 font-medium">
            {saving ? 'Saving...' : editingId ? 'Update staff' : '+ Add staff'}
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
              {staff.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.name}
                    {s.address && <span className="block text-xs text-gray-400 font-normal">{s.address}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.employee_id || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{s.mobile || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{s.role}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">₹{s.rate_per_hour}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(s)} className="text-blue-500 hover:text-blue-700 mr-3"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => remove(s.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
