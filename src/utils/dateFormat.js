// Shared date display formatter — DB/inputs always store/use ISO (YYYY-MM-DD),
// but every place that *displays* a date to Priya should read DD-MM-YYYY, not
// the raw ISO string. Use this instead of rendering a date field directly.
export function formatDate(value) {
  if (!value) return '';
  const str = String(value).slice(0, 10); // strip time if it's a timestamp
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return str; // not ISO-shaped, leave as-is rather than guess
  const [, yyyy, mm, dd] = match;
  return `${dd}-${mm}-${yyyy}`;
}
