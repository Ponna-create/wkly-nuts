// App settings utility - stored in localStorage, synced across pages
const SETTINGS_KEY = 'wklyNutsSettings';

export const getSettings = () => {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch { return {}; }
};

export const getSetting = (key, defaultValue) => {
  return getSettings()[key] ?? defaultValue;
};

export const setSetting = (key, value) => {
  const settings = getSettings();
  settings[key] = value;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

// GST Rate - configurable (default 5%)
export const getGstRate = () => getSetting('gstRate', 5);
export const setGstRate = (rate) => setSetting('gstRate', rate);

// Database mode - 'auto', 'cloud', 'local'
export const getDbMode = () => getSetting('dbMode', 'auto');
export const setDbMode = (mode) => setSetting('dbMode', mode);

// Channel fee % — platform cut taken out of revenue before it reaches you
// (Amazon referral fee, Zoho payment gateway cut). Default 0 = not configured yet.
export const getChannelFees = () => getSetting('channelFees', { amazon: 0, zoho: 0 });
export const setChannelFee = (channel, pct) => {
  const fees = getChannelFees();
  fees[channel] = pct;
  setSetting('channelFees', fees);
};
