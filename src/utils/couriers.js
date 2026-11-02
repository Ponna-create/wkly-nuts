// Which couriers we ship with and how each is tracked. ST Courier is checked
// automatically; any other courier is manual for now: a Track button opens its
// website and she marks the status. An added courier can carry a number pattern
// so Scan Slips recognises its numbers.
import { getSetting, setSetting } from './settings';
import { dbService } from '../services/supabase';
import { cleanTracking, isValidTracking, isIndiaPostNumber } from './slipNumbers';

export const ST_COURIER = 'ST Courier';
const BUILT_IN = [
  { name: ST_COURIER, link: 'https://stcourier.com/track/shipment', auto: true },
  { name: 'India Post', link: 'https://www.indiapost.gov.in/', auto: false },
];

export const getCouriers = () => [...BUILT_IN, ...getSetting('customCouriers', [])];
export const isBuiltInCourier = (name) => BUILT_IN.some(c => c.name === name);
export const setCustomCouriers = (list) => {
  setSetting('customCouriers', list);
  dbService.setAppSetting('customCouriers', list).catch(() => {});
};

// Turns one real number off a slip, like D12345678, into the rule for that
// courier: the same letters, and the same count of digits in the same places.
export function patternFromExample(example) {
  const n = cleanTracking(example);
  if (n.length < 6) return null;
  return `^${n.replace(/\d+/g, d => `\\d{${d.length}}`)}$`;
}

// The courier a number belongs to, or null if it fits none of them.
export function courierForNumber(raw, couriers = getCouriers()) {
  const n = cleanTracking(raw);
  if (isValidTracking(n)) return isIndiaPostNumber(n) ? 'India Post' : ST_COURIER;
  return couriers.find(c => c.pattern && new RegExp(c.pattern).test(n))?.name || null;
}

export const courierOf = (order) => (order.courier_name || '').trim() || ST_COURIER;
export const isStOrder = (order) => /^st\b/i.test(courierOf(order));

const OPEN = ['collected', 'dispatched', 'transit'];
export const isOnTheWay = (order) => OPEN.includes(order.status) && Boolean(order.tracking_number);
export const checkFailed = (order) => /check failed|no status shown|not an st|could not reach|not found/i.test(order.st_courier_status || '');

export const STUCK_DAYS = 5;
const daysSince = (ms) => Math.floor((Date.now() - ms) / 86400000);

// What only the courier can tell us after the slip is done: a parcel that came
// back or couldn't be delivered, or one that has stopped moving. A number ST
// can't find isn't in here; it shows on its own row, where the number can be fixed.
export function parcelAttention(order) {
  if (!isOnTheWay(order) || checkFailed(order)) return null;
  if (/undeliver|not delivered|non[- ]?deliver|\brto\b|return/i.test(order.st_courier_status || '')) {
    return { kind: 'problem', text: 'Not delivered' };
  }
  const lastEvent = (order.st_courier_status || '').match(/\(([A-Z][a-z]{2} \d{1,2}, \d{4})/);
  const since = Date.parse(lastEvent ? lastEvent[1] : (order.dispatch_date || ''));
  if (Number.isNaN(since)) return null;
  const days = daysSince(since);
  return days > STUCK_DAYS ? { kind: 'stuck', text: `No movement for ${days} days` } : null;
}
