// Placeholder for a real courier tracking status API (ST Courier or an
// aggregator like Shiprocket/Shipway). Wire the real call in here once the
// API key is available — every call site already expects this shape, so
// nothing else needs to change.
export async function fetchCourierStatus(trackingNumber, courierName) {
  return { status: null, note: 'Courier tracking API not connected yet' };
}
