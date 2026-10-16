import type { Condition, VerificationLabel } from './types';

// Blueprint Appendix A
export const CATEGORIES = [
  { id: 'phones', name: 'Phones', icon: 'phone-portrait', subs: ['Android phones', 'iPhone', 'Feature phones'], attrs: ['Storage', 'RAM', 'Battery health', 'Dual SIM', 'Network lock', 'Warranty', 'Accessories'] },
  { id: 'computers', name: 'Computers', icon: 'laptop', subs: ['Laptops', 'Desktops', 'Tablets', 'Monitors'], attrs: ['CPU', 'RAM', 'Storage', 'GPU', 'Screen size', 'Battery condition', 'Charger', 'Warranty'] },
  { id: 'audio', name: 'Audio', icon: 'headset', subs: ['Earbuds', 'Headphones', 'Speakers', 'Microphones'], attrs: ['Connectivity', 'Battery life', 'Accessories', 'Warranty'] },
  { id: 'wearables', name: 'Wearables', icon: 'watch', subs: ['Smartwatches', 'Fitness bands'], attrs: ['Compatibility', 'Battery', 'Strap/accessories'] },
  { id: 'gaming', name: 'Gaming', icon: 'game-controller', subs: ['Consoles', 'Controllers', 'Games', 'Accessories'], attrs: ['Platform', 'Storage', 'Controllers included', 'Account lock status', 'Warranty'] },
  { id: 'power', name: 'Power', icon: 'battery-charging', subs: ['Power banks', 'UPS', 'Inverters', 'Solar accessories'], attrs: ['Capacity/rating', 'Outputs', 'Compatibility', 'Cables included'] },
  { id: 'smarthome', name: 'Smart home', icon: 'home', subs: ['Cameras', 'Bulbs', 'Sensors', 'Routers'], attrs: ['Compatibility', 'Connectivity', 'Platform support', 'Power source'] },
  { id: 'cameras', name: 'Cameras', icon: 'camera', subs: ['Mirrorless', 'DSLR', 'Drones', 'Action cams'], attrs: ['Sensor', 'Lens', 'Shutter count', 'Accessories', 'Warranty'] },
  { id: 'accessories', name: 'Accessories', icon: 'flash', subs: ['Chargers', 'Cables', 'Cases', 'Keyboards', 'Printers'], attrs: ['Compatibility', 'Connector type', 'Certification'] },
  { id: 'other', name: 'Other', icon: 'grid', subs: [], attrs: [] },
] as const;

/** Starter ideas for the free-text "Other" category; real suggestions also come from existing listings. */
export const OTHER_CATEGORY_IDEAS = ['Musical instruments', 'Car electronics', 'Office equipment', 'Home appliances', 'Fitness gear', 'Tools & hardware', 'Books & media', 'Fashion & accessories'];

export const normalizeCategory = (s: string) =>
  s
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase())
    .slice(0, 40);

/** Display label for a listing's category, including seller-defined ones. */
export const categoryLabel = (categoryId?: string, custom?: string) => (categoryId === 'other' && custom ? custom : CATEGORIES.find((c) => c.id === categoryId)?.name ?? '');

export type CategoryId = (typeof CATEGORIES)[number]['id'];

export const categoryById = (id?: string) => CATEGORIES.find((c) => c.id === id);

export const CONDITIONS: { id: Condition; label: string; short: string; color: string; definition: string }[] = [
  { id: 'new_sealed', label: 'New · sealed', short: 'New', color: '#7C7CFF', definition: 'Unused, factory-sealed where applicable. Seller should not imply manufacturer warranty unless valid.' },
  { id: 'new_open_box', label: 'New · open box', short: 'Open box', color: '#7C7CFF', definition: 'Unused or minimally handled, package opened. Seller explains why and lists any missing items.' },
  { id: 'used_excellent', label: 'Used · excellent', short: 'Excellent', color: '#8E8E98', definition: 'Used with minimal visible wear; all known functional issues disclosed.' },
  { id: 'used_good', label: 'Used · good', short: 'Good', color: '#8E8E98', definition: 'Normal wear; working status and defects clearly stated.' },
  { id: 'used_fair', label: 'Used · fair', short: 'Fair', color: '#8E8E98', definition: 'Noticeable wear or known functional limitation; details and photos required.' },
  { id: 'refurbished', label: 'Refurbished', short: 'Refurb', color: '#5B8DEF', definition: 'Repaired/restored. Refurbisher and parts/warranty info shown where known.' },
];

export const conditionById = (id: Condition) => CONDITIONS.find((c) => c.id === id)!;

// Blueprint §7 verification ladder — exact meaning, never "trusted seller".
export const VERIFICATIONS: Record<VerificationLabel, { label: string; meaning: string; notImplied: string; icon: string }> = {
  contact_confirmed: {
    label: 'Email confirmed',
    meaning: 'This seller confirmed their email address.',
    notImplied: 'It does not confirm identity, ownership of stock, or honesty.',
    icon: 'call',
  },
  business_submitted: {
    label: 'Business details submitted',
    meaning: 'This seller submitted business information to Neva.',
    notImplied: 'It is not a government endorsement unless separately checked.',
    icon: 'briefcase',
  },
  identity_checked: {
    label: 'Identity checked',
    meaning: 'This seller passed Neva’s defined identity-check process.',
    notImplied: 'It does not mean every listing is authentic or every transaction is safe.',
    icon: 'shield-checkmark',
  },
};


export const REPORT_REASONS = [
  'Scam or fraud',
  'Suspected stolen item',
  'Counterfeit / fake product',
  'Wrong condition or misleading listing',
  'Prohibited item',
  'Harassment or threats',
  'Spam',
  'Sharing personal info',
  'Something else',
];

export const QUICK_REPLIES = ['Is this still available?', 'What’s your last price?', 'Can I come and check it?', 'Do you deliver?', 'Any faults?'];

export const STATUS_BGS = ['#4338CA', '#1E3A8A', '#5B21B6', '#111827', '#312E81', '#1F2937', '#3730A3'];
