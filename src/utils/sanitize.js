const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, c => ESCAPE_MAP[c]);
}

const SCRIPT_RE = /<\s*script[\s>][\s\S]*?<\s*\/\s*script\s*>/gi;
const EVENT_RE = /\s+on\w+\s*=\s*(['"])[^'"]*\1/gi;
const EVENT_UNQUOTED_RE = /\s+on\w+\s*=\s*[^\s>]+/gi;

export function sanitizeHtml(html) {
  if (typeof html !== 'string') return '';
  return html
    .replace(SCRIPT_RE, '')
    .replace(EVENT_RE, '')
    .replace(EVENT_UNQUOTED_RE, '');
}
