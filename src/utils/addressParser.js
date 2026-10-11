// Pulls pincode/state/city out of a customer's freely-typed/pasted address.
// Built to tolerate the messy real-world formats customers actually send:
// "Tamilnadu" vs "Tamil Nadu" vs "TAMIL NADU", a pincode with a stray space
// in the middle ("606 601"), or no state mentioned at all (falls back to
// inferring it from the pincode's postal circle).

const STATES = [
  'Tamil Nadu', 'Kerala', 'Karnataka', 'Andhra Pradesh', 'Telangana', 'Maharashtra',
  'Gujarat', 'Rajasthan', 'Delhi', 'Uttar Pradesh', 'Madhya Pradesh', 'West Bengal',
  'Bihar', 'Odisha', 'Punjab', 'Haryana', 'Jharkhand', 'Chhattisgarh', 'Assam', 'Goa',
  'Himachal Pradesh', 'Uttarakhand', 'Jammu and Kashmir', 'Puducherry', 'Chandigarh',
  'Meghalaya', 'Manipur', 'Mizoram', 'Tripura', 'Nagaland', 'Arunachal Pradesh', 'Sikkim',
];

const CITIES = [
  'Chennai', 'Mumbai', 'Bangalore', 'Bengaluru', 'Hyderabad', 'Delhi', 'Kolkata', 'Pune',
  'Ahmedabad', 'Jaipur', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Trichy', 'Salem',
  'Erode', 'Tirunelveli', 'Vellore', 'Nellore', 'Vijayawada', 'Visakhapatnam', 'Kochi',
  'Thiruvananthapuram', 'Thrissur', 'Kozhikode', 'Puducherry', 'Pondicherry', 'Cuddalore',
  'Tiruvallur', 'Kancheepuram', 'Thanjavur', 'Dindigul', 'Theni', 'Tirupur', 'Ariyalur',
  'Gudur', 'Chromepet', 'Ambattur', 'Perambur', 'Kodambakkam', 'Thiruvannamalai',
  'Gummidipoondi', 'Thiruthuraipoondi', 'Sankarankovil', 'Virudhachalam', 'Anakaputhur',
  'Porur', 'Velachery', 'Avadi', 'Royapettah',
];

// India Post pincode → state, by leading digits. Longer prefixes win, so the
// small UTs / carve-outs (Puducherry, Goa, Chandigarh, Sikkim) are listed
// as 3-digit or 6-digit-range exceptions on top of the 2-digit circles.
// This is what decides CGST+SGST (Tamil Nadu) vs IGST (everywhere else), so
// it covers the whole country rather than only the usual destinations.
const PIN_PREFIX_STATE = {
  '11': 'Delhi', '12': 'Haryana', '13': 'Haryana', '14': 'Punjab', '15': 'Punjab',
  '16': 'Punjab', '17': 'Himachal Pradesh', '18': 'Jammu and Kashmir', '19': 'Jammu and Kashmir',
  '20': 'Uttar Pradesh', '21': 'Uttar Pradesh', '22': 'Uttar Pradesh', '23': 'Uttar Pradesh',
  '24': 'Uttar Pradesh', '25': 'Uttar Pradesh', '26': 'Uttar Pradesh', '27': 'Uttar Pradesh',
  '28': 'Uttar Pradesh', '30': 'Rajasthan', '31': 'Rajasthan', '32': 'Rajasthan',
  '33': 'Rajasthan', '34': 'Rajasthan', '36': 'Gujarat', '37': 'Gujarat', '38': 'Gujarat',
  '39': 'Gujarat', '40': 'Maharashtra', '41': 'Maharashtra', '42': 'Maharashtra',
  '43': 'Maharashtra', '44': 'Maharashtra', '45': 'Madhya Pradesh', '46': 'Madhya Pradesh',
  '47': 'Madhya Pradesh', '48': 'Madhya Pradesh', '49': 'Chhattisgarh', '50': 'Telangana',
  '51': 'Andhra Pradesh', '52': 'Andhra Pradesh', '53': 'Andhra Pradesh',
  '56': 'Karnataka', '57': 'Karnataka', '58': 'Karnataka', '59': 'Karnataka',
  '60': 'Tamil Nadu', '61': 'Tamil Nadu', '62': 'Tamil Nadu', '63': 'Tamil Nadu', '64': 'Tamil Nadu',
  '67': 'Kerala', '68': 'Kerala', '69': 'Kerala', '70': 'West Bengal', '71': 'West Bengal',
  '72': 'West Bengal', '73': 'West Bengal', '74': 'West Bengal', '75': 'Odisha', '76': 'Odisha',
  '77': 'Odisha', '78': 'Assam', '79': 'Arunachal Pradesh', '80': 'Bihar', '81': 'Jharkhand',
  '82': 'Jharkhand', '83': 'Jharkhand', '84': 'Bihar', '85': 'Bihar',
  // 3-digit exceptions
  '403': 'Goa', '737': 'Sikkim', '790': 'Arunachal Pradesh', '793': 'Meghalaya',
  '794': 'Meghalaya', '795': 'Manipur', '796': 'Mizoram', '797': 'Nagaland', '798': 'Nagaland',
  '799': 'Tripura', '244': 'Uttarakhand', '246': 'Uttarakhand', '247': 'Uttar Pradesh',
  '248': 'Uttarakhand', '249': 'Uttarakhand', '262': 'Uttarakhand', '263': 'Uttarakhand',
  '160': 'Chandigarh', '744': 'Andaman and Nicobar Islands', '682': 'Kerala',
};

export function stateFromPincode(pin) {
  const p = String(pin || '').replace(/\D/g, '');
  if (p.length !== 6) return null;
  const n = parseInt(p, 10);
  // Puducherry (605001-605014) sits inside the Tamil Nadu circle but is a
  // separate UT for GST — Karaikal (609602-609609), Mahe (673310-673311), Yanam (533464).
  if ((n >= 605001 && n <= 605014) || (n >= 609602 && n <= 609609) ||
      (n >= 673310 && n <= 673311) || n === 533464) return 'Puducherry';
  return PIN_PREFIX_STATE[p.slice(0, 3)] || PIN_PREFIX_STATE[p.slice(0, 2)] || null;
}

// Cities whose state is unambiguous enough to use as a last-resort fallback
// when there's no pincode to go by at all (e.g. "Chennai-11" style old codes).
const CITY_STATE = {
  chennai: 'Tamil Nadu', coimbatore: 'Tamil Nadu', madurai: 'Tamil Nadu',
  tiruchirappalli: 'Tamil Nadu', trichy: 'Tamil Nadu', salem: 'Tamil Nadu',
  erode: 'Tamil Nadu', tirunelveli: 'Tamil Nadu', vellore: 'Tamil Nadu',
  thanjavur: 'Tamil Nadu', dindigul: 'Tamil Nadu', theni: 'Tamil Nadu', tirupur: 'Tamil Nadu',
  cuddalore: 'Tamil Nadu', tiruvallur: 'Tamil Nadu', kancheepuram: 'Tamil Nadu',
  ariyalur: 'Tamil Nadu', thiruvannamalai: 'Tamil Nadu', lalgudi: 'Tamil Nadu',
  bangalore: 'Karnataka', bengaluru: 'Karnataka',
  hyderabad: 'Telangana', kochi: 'Kerala', thiruvananthapuram: 'Kerala',
  thrissur: 'Kerala', kozhikode: 'Kerala', mumbai: 'Maharashtra', pune: 'Maharashtra',
  delhi: 'Delhi', kolkata: 'West Bengal', ahmedabad: 'Gujarat', jaipur: 'Rajasthan',
  vijayawada: 'Andhra Pradesh', visakhapatnam: 'Andhra Pradesh', nellore: 'Andhra Pradesh',
  puducherry: 'Puducherry', pondicherry: 'Puducherry',
};

const lettersOnly = (s) => s.toLowerCase().replace(/[^a-z]/g, '');

// Makes sure the state NAME is written in the saved address text (labels and
// courier slips are printed from it). If it's already there in any spelling
// ("Tamilnadu", "TAMIL NADU") it's left alone; otherwise it's put just before a
// trailing pincode, or at the end: "...Lalgudi, Trichy 621601"
// → "...Lalgudi, Trichy, Tamil Nadu 621601".
export function addressWithState(address, state) {
  const a = String(address || '').trim();
  const st = String(state || '').trim();
  if (!a || !st) return a;
  if (lettersOnly(a).includes(lettersOnly(st))) return a;
  const m = a.match(/^([\s\S]*?)[,\s-]*(\d{3}\s?\d{3})\s*$/);
  if (m && m[1].trim()) return `${m[1].trim().replace(/[,\s]+$/, '')}, ${st} ${m[2].replace(/\s/g, '')}`;
  return `${a.replace(/[,\s]+$/, '')}, ${st}`;
}

// Best-effort state for a customer/order address: explicit state text wins,
// then the 6-digit pincode, then a well-known city. Returns '' if unknown —
// callers should then ASK rather than guess.
export function inferState({ state, address, city, pincode } = {}) {
  if (state && String(state).trim()) return String(state).trim();
  const parsed = parseAddress([address, city, pincode].filter(Boolean).join(' '));
  if (parsed.state) return parsed.state;
  const fromPin = stateFromPincode(pincode);
  if (fromPin) return fromPin;
  const c = String(city || '').toLowerCase().trim();
  return CITY_STATE[c] || '';
}

export function parseAddress(text) {
  const result = {};
  if (!text) return result;

  // Pincode: 6 digits, tolerating one stray space/hyphen in the middle
  const pinMatch = text.match(/\b(\d{3})[\s-]?(\d{3})\b/);
  const pincode = pinMatch ? pinMatch[1] + pinMatch[2] : null;
  if (pincode) result.pincode = pincode;

  // City
  const lowerText = text.toLowerCase();
  const foundCity = CITIES.find(c => lowerText.includes(c.toLowerCase()));
  if (foundCity) result.city = foundCity;

  // State: compare with spaces/punctuation stripped so "Tamilnadu", "TAMIL NADU"
  // and "Tamil Nadu" all match the same way
  const normalizedText = lettersOnly(text);
  const foundState = STATES.find(s => normalizedText.includes(lettersOnly(s)));
  if (foundState) {
    result.state = foundState;
  } else if (pincode && stateFromPincode(pincode)) {
    result.state = stateFromPincode(pincode);
  } else if (foundCity && CITY_STATE[foundCity.toLowerCase()]) {
    result.state = CITY_STATE[foundCity.toLowerCase()];
  } else {
    // a town name we know (Lalgudi, Thanjavur...) even though it isn't in CITIES
    const town = Object.keys(CITY_STATE).find(t => new RegExp(`\\b${t}\\b`).test(lowerText));
    if (town) result.state = CITY_STATE[town];
  }

  // Old-style postal division numbers ("Trichy-4", "Chennai-11") predate the
  // 6-digit PIN system but people (especially long-time residents) still
  // write addresses this way. Deliberately NOT converted into a guessed PIN
  // here — getting even one digit wrong can misroute a package, which is
  // worse than leaving it blank. Just flagged so the warning shown to
  // whoever's placing the order can say *why* it's missing and what to ask
  // the customer for, instead of a generic "no pincode found".
  if (!pincode) {
    const oldStyleMatch = text.match(/\b([A-Za-z]+)\s*-\s*(\d{1,3})\b/);
    if (oldStyleMatch) {
      const cityMatch = CITIES.find(c => c.toLowerCase() === oldStyleMatch[1].toLowerCase());
      if (cityMatch) result.oldStylePostalCode = `${cityMatch}-${oldStyleMatch[2]}`;
    }
  }

  return result;
}
