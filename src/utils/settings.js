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

// Business info used on invoices & shipping labels (GSTIN, registered/return
// address). Kept fully editable here — not hardcoded — so it can be added,
// changed, or cleared any time without a code change.
export const getBusinessInfo = () => getSetting('businessInfo', {
  companyName: 'WKLY Nuts',
  gstin: '',
  registeredAddress: '',
  returnAddress: '',
  phone: '',
});
export const setBusinessInfo = (info) => setSetting('businessInfo', info);

// Channels manually added on the Omni Channels page that don't have any real
// orders yet — without this they'd have nowhere to persist and "Add Channel"
// would silently do nothing.
export const getManualChannels = () => getSetting('manualChannels', []);
export const addManualChannel = (channel) => {
  const list = getManualChannels();
  if (!list.includes(channel)) {
    list.push(channel);
    setSetting('manualChannels', list);
  }
};
