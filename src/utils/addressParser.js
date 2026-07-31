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

// Postal-circle pincode ranges used to guess the state when it isn't
// mentioned in the text at all — kept to the states this business actually
// ships to most, so it stays a safe convenience default, not a guess for
// every pincode in India.
const PIN_STATE_RANGES = [
  [600000, 643999, 'Tamil Nadu'],
  [670000, 695999, 'Kerala'],
  [560000, 591999, 'Karnataka'],
  [500000, 509999, 'Telangana'],
  [510000, 535999, 'Andhra Pradesh'],
];

// Cities whose state is unambiguous enough to use as a last-resort fallback
// when there's no pincode to go by at all (e.g. "Chennai-11" style old codes).
const CITY_STATE = {
  chennai: 'Tamil Nadu', coimbatore: 'Tamil Nadu', madurai: 'Tamil Nadu',
  tiruchirappalli: 'Tamil Nadu', trichy: 'Tamil Nadu', salem: 'Tamil Nadu',
  erode: 'Tamil Nadu', tirunelveli: 'Tamil Nadu', vellore: 'Tamil Nadu',
  bangalore: 'Karnataka', bengaluru: 'Karnataka',
  hyderabad: 'Telangana', kochi: 'Kerala', thiruvananthapuram: 'Kerala',
  thrissur: 'Kerala', kozhikode: 'Kerala', mumbai: 'Maharashtra', pune: 'Maharashtra',
};

const lettersOnly = (s) => s.toLowerCase().replace(/[^a-z]/g, '');

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
  } else if (pincode) {
    const pinNum = parseInt(pincode, 10);
    const range = PIN_STATE_RANGES.find(([min, max]) => pinNum >= min && pinNum <= max);
    if (range) result.state = range[2];
  } else if (foundCity && CITY_STATE[foundCity.toLowerCase()]) {
    result.state = CITY_STATE[foundCity.toLowerCase()];
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
