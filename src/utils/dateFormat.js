// Shared date display formatter — DB/inputs always store/use ISO (YYYY-MM-DD),
// but every place that *displays* a full date to Priya should read
// DD-MM-YYYY consistently across the whole app, not a raw ISO string and not
// the "10/08/2026" slash-separated style toLocaleDateString('en-IN') gives —
// both were showing up side by side depending on which screen you were on.
// Use this instead of rendering a date field directly, and instead of
// toLocaleDateString for a full day+month+year display.
export function formatDate(value) {
  if (!value) return '';
  // Accept a Date object directly (common when a value's been wrapped in
  // `new Date(x)` before formatting) as well as an ISO string/timestamp.
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    const dd = String(value.getDate()).padStart(2, '0');
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const yyyy = value.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  const str = String(value).slice(0, 10); // strip time if it's a timestamp
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return str; // not ISO-shaped, leave as-is rather than guess
  const [, yyyy, mm, dd] = match;
  return `${dd}-${mm}-${yyyy}`;
}

// Compact day+month only (no year) — for space-constrained labels that
// intentionally omit the year. Still numeric/dash-separated to match the
// full formatDate style rather than mixing in a text month name.
export function formatDateShort(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}`;
}

// For displays that show date + time together (e.g. "17-08-2026, 2:30 PM").
// Keeps the time portion exactly as toLocaleTimeString would give it —
// only the date part needed standardizing.
export function formatDateTime(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  const datePart = formatDate(d);
  const timePart = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return `${datePart}, ${timePart}`;
}
