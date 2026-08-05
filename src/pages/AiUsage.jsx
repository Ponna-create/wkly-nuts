import React, { useState, useEffect, useMemo } from 'react';
import { Sparkles, ImageIcon, CheckCircle, Edit3, XCircle, Clock, Zap } from 'lucide-react';
import { dbService } from '../services/supabase';

// Simple bar, same pattern as Reports.jsx's SimpleBar — kept local since
// this is the only other place that needs it right now.
function SimpleBar({ label, value, maxValue, color }) {
  const pct = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-40 text-gray-600 truncate text-right">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
        <div className={`h-full ${color} rounded-full flex items-center justify-end pr-2 transition-all duration-500`}
          style={{ width: `${Math.max(pct, 2)}%` }}>
          {pct > 15 && <span className="text-xs text-white font-medium">{value}</span>}
        </div>
      </div>
      {pct <= 15 && <span className="text-xs text-gray-600 font-medium w-10">{value}</span>}
    </div>
  );
}

// Tracks how well Scan Slips (Gemini-powered courier OCR) is actually doing
// — not just "it ran N times" but "of what it read, how much needed you to
// step in." Every photo processed through TrackingScanner logs one row here
// (see dbService.logAiScan / resolveAiScan), so this page is purely a
// read-and-aggregate view over that log.
export default function AiUsage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await dbService.getAiScanLog();
    setRows(data || []);
    setLoading(false);
  };

  const stats = useMemo(() => {
    const total = rows.length;
    const count = (outcome) => rows.filter(r => r.outcome === outcome).length;
    const autoLinked = count('auto_linked');
    const userConfirmed = count('user_confirmed');
    const userReassigned = count('user_reassigned');
    const userAssigned = count('user_assigned');
    const skipped = count('skipped');
    const failed = count('failed');
    const pending = count('pending_review');
    const resolved = total - pending; // everything with a final outcome
    const neededHelp = userConfirmed + userReassigned + userAssigned;
    // "Accuracy" here means: of the photos it could actually read something
    // off of (excludes outright unreadable ones), how many linked correctly
    // without you touching them.
    const readable = resolved - failed;
    const accuracyPct = readable > 0 ? Math.round((autoLinked / readable) * 100) : null;
    return { total, autoLinked, userConfirmed, userReassigned, userAssigned, skipped, failed, pending, resolved, neededHelp, accuracyPct };
  }, [rows]);

  const recent = rows.slice(0, 25);

  const outcomeBadge = (outcome) => {
    const map = {
      auto_linked: { bg: 'bg-green-100', text: 'text-green-800', label: 'Auto-linked' },
      user_confirmed: { bg: 'bg-teal-100', text: 'text-teal-800', label: 'You confirmed' },
      user_reassigned: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'You fixed a wrong guess' },
      user_assigned: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'You picked manually' },
      skipped: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Skipped' },
      failed: { bg: 'bg-red-100', text: 'text-red-800', label: "Couldn't read" },
      pending_review: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Pending' },
    };
    const b = map[outcome] || map.pending_review;
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${b.bg} ${b.text}`}>{b.label}</span>;
  };

  if (loading) return <div className="p-6 text-center text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-fuchsia-600" /> AI Usage
        </h1>
        <p className="text-gray-600 mt-1">How well Scan Slips is reading courier photos, and how much you're using it</p>
      </div>

      {stats.total === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          <ImageIcon className="w-10 h-10 mx-auto mb-2" />
          <p>No photos scanned yet — this fills in the first time you use Scan Slips on Sales Orders.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <ImageIcon className="w-4 h-4 text-gray-500" />
                <p className="text-sm text-gray-600">Images Scanned</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-500">Gemini API calls used — free tier, ₹0 so far</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-green-600" />
                <p className="text-sm text-gray-600">Auto-Linked</p>
              </div>
              <p className="text-2xl font-bold text-green-700">{stats.autoLinked}</p>
              <p className="text-xs text-gray-500">Zero taps needed</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <Edit3 className="w-4 h-4 text-amber-600" />
                <p className="text-sm text-gray-600">You Stepped In</p>
              </div>
              <p className="text-2xl font-bold text-amber-700">{stats.neededHelp}</p>
              <p className="text-xs text-gray-500">Confirmed, fixed, or picked manually</p>
            </div>
            <div className={`p-4 rounded-lg border ${stats.accuracyPct >= 70 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4" />
                <p className="text-sm text-gray-600">Accuracy</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats.accuracyPct != null ? `${stats.accuracyPct}%` : '—'}</p>
              <p className="text-xs text-gray-500">Auto-linked ÷ readable photos</p>
            </div>
          </div>

          {/* Breakdown bar — e.g. "5 uploaded: 3 auto-linked, 2 you confirmed" */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-bold text-gray-900 mb-3">Breakdown of every photo scanned ({stats.total})</h2>
            <div className="space-y-2">
              <SimpleBar label="Auto-linked" value={stats.autoLinked} maxValue={stats.total} color="bg-green-500" />
              <SimpleBar label="You confirmed" value={stats.userConfirmed} maxValue={stats.total} color="bg-teal-500" />
              <SimpleBar label="You fixed a wrong guess" value={stats.userReassigned} maxValue={stats.total} color="bg-amber-500" />
              <SimpleBar label="You picked manually" value={stats.userAssigned} maxValue={stats.total} color="bg-blue-500" />
              <SimpleBar label="Skipped" value={stats.skipped} maxValue={stats.total} color="bg-gray-400" />
              <SimpleBar label="Couldn't read" value={stats.failed} maxValue={stats.total} color="bg-red-500" />
              {stats.pending > 0 && <SimpleBar label="Still pending" value={stats.pending} maxValue={stats.total} color="bg-orange-400" />}
            </div>
          </div>

          {/* Recent scans */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <h2 className="text-sm font-bold text-gray-900 p-4 pb-0">Recent Scans</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm mt-3">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">When</th>
                    <th className="px-4 py-2 text-left">Order</th>
                    <th className="px-4 py-2 text-left">Tracking #</th>
                    <th className="px-4 py-2 text-left">Matched Via</th>
                    <th className="px-4 py-2 text-left">Confidence</th>
                    <th className="px-4 py-2 text-left">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recent.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap text-gray-500 text-xs">{new Date(r.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{r.order_number || '—'}</td>
                      <td className="px-4 py-2 whitespace-nowrap font-mono text-xs">{r.tracking_number || '—'}</td>
                      <td className="px-4 py-2 whitespace-nowrap capitalize">{r.matched_via || '—'}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{r.confidence != null ? `${Math.round(r.confidence * 100)}%` : '—'}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{outcomeBadge(r.outcome)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
