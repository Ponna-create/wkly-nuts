import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate } from '../../utils/dateFormat';

const toISO = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const todayISO = () => toISO(new Date());
const daysAgoISO = (n) => toISO(new Date(Date.now() - n * 86400000));

// Single popover calendar for picking a from/to date range — replaces two
// separate "From" / "To" date boxes with one grid: first click sets the
// start, second click sets the end (clicking before the start restarts the
// range instead of erroring). Keeps the quick Today/Yesterday shortcuts.
export default function DateRangePicker({ from, to, onChange }) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const base = from ? new Date(from) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const wrapRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const pickDay = (iso) => {
    if (!from || (from && to)) {
      // Starting a fresh range
      onChange({ from: iso, to: '' });
    } else if (iso < from) {
      // Clicked before the current start — restart from here
      onChange({ from: iso, to: '' });
    } else {
      onChange({ from, to: iso });
      setOpen(false);
    }
  };

  const setPreset = (f, t) => { onChange({ from: f, to: t }); setOpen(false); };

  const monthLabel = viewMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const label = from && to
    ? `${formatDate(from)} to ${formatDate(to)}`
    : from
      ? `${formatDate(from)} to …`
      : 'All dates';

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:bg-gray-50"
      >
        <Calendar className="w-4 h-4 text-gray-500" />
        <span className={from ? 'text-gray-900' : 'text-gray-500'}>{label}</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-72">
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button onClick={() => setPreset(todayISO(), todayISO())} className="px-2.5 py-1 text-xs font-medium rounded-full bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100">Today</button>
            <button onClick={() => setPreset(daysAgoISO(1), daysAgoISO(1))} className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100">Yesterday</button>
            <button onClick={() => setPreset(daysAgoISO(6), todayISO())} className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100">Last 7 days</button>
            <button onClick={() => setPreset('', '')} className="px-2.5 py-1 text-xs font-medium rounded-full text-red-600 hover:bg-red-50">Clear</button>
          </div>

          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-semibold text-gray-800">{monthLabel}</span>
            <button onClick={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="p-1 hover:bg-gray-100 rounded"><ChevronRight className="w-4 h-4" /></button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d} className="text-[10px] font-semibold text-gray-400 py-1">{d}</div>
            ))}
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const iso = toISO(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
              const isStart = iso === from;
              const isEnd = iso === to;
              const inRange = from && to && iso > from && iso < to;
              const isToday = iso === todayISO();
              return (
                <button
                  key={i}
                  onClick={() => pickDay(iso)}
                  className={`text-xs py-1.5 rounded ${
                    isStart || isEnd ? 'bg-teal-600 text-white font-semibold' :
                    inRange ? 'bg-teal-50 text-teal-700' :
                    isToday ? 'border border-teal-400 text-teal-700' :
                    'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
