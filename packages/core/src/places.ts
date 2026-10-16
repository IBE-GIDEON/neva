/**
 * Location suggestions for Nigeria (state capitals, major cities and well-known areas).
 * Suggestions only — people can type any town, area or estate.
 */
export const NIGERIA_PLACES: { name: string; region: string }[] = [
  // Lagos
  { name: 'Lagos', region: 'Lagos State' },
  { name: 'Ikeja', region: 'Lagos' },
  { name: 'Lekki', region: 'Lagos' },
  { name: 'Ajah', region: 'Lagos' },
  { name: 'Victoria Island', region: 'Lagos' },
  { name: 'Ikoyi', region: 'Lagos' },
  { name: 'Yaba', region: 'Lagos' },
  { name: 'Surulere', region: 'Lagos' },
  { name: 'Ikorodu', region: 'Lagos' },
  { name: 'Festac', region: 'Lagos' },
  { name: 'Ojo', region: 'Lagos' },
  { name: 'Badagry', region: 'Lagos' },
  { name: 'Epe', region: 'Lagos' },
  { name: 'Gbagada', region: 'Lagos' },
  { name: 'Maryland', region: 'Lagos' },
  { name: 'Ogba', region: 'Lagos' },
  { name: 'Magodo', region: 'Lagos' },
  { name: 'Oshodi', region: 'Lagos' },
  { name: 'Apapa', region: 'Lagos' },
  // FCT
  { name: 'Abuja', region: 'FCT' },
  { name: 'Wuse', region: 'Abuja' },
  { name: 'Garki', region: 'Abuja' },
  { name: 'Maitama', region: 'Abuja' },
  { name: 'Asokoro', region: 'Abuja' },
  { name: 'Gwarinpa', region: 'Abuja' },
  { name: 'Kubwa', region: 'Abuja' },
  { name: 'Lugbe', region: 'Abuja' },
  { name: 'Jabi', region: 'Abuja' },
  { name: 'Gwagwalada', region: 'FCT' },
  // South
  { name: 'Port Harcourt', region: 'Rivers' },
  { name: 'Benin City', region: 'Edo' },
  { name: 'Warri', region: 'Delta' },
  { name: 'Asaba', region: 'Delta' },
  { name: 'Sapele', region: 'Delta' },
  { name: 'Uyo', region: 'Akwa Ibom' },
  { name: 'Calabar', region: 'Cross River' },
  { name: 'Yenagoa', region: 'Bayelsa' },
  { name: 'Owerri', region: 'Imo' },
  { name: 'Aba', region: 'Abia' },
  { name: 'Umuahia', region: 'Abia' },
  { name: 'Enugu', region: 'Enugu' },
  { name: 'Nsukka', region: 'Enugu' },
  { name: 'Onitsha', region: 'Anambra' },
  { name: 'Awka', region: 'Anambra' },
  { name: 'Nnewi', region: 'Anambra' },
  { name: 'Abakaliki', region: 'Ebonyi' },
  // South-west
  { name: 'Ibadan', region: 'Oyo' },
  { name: 'Ogbomoso', region: 'Oyo' },
  { name: 'Abeokuta', region: 'Ogun' },
  { name: 'Ijebu-Ode', region: 'Ogun' },
  { name: 'Sagamu', region: 'Ogun' },
  { name: 'Ota', region: 'Ogun' },
  { name: 'Akure', region: 'Ondo' },
  { name: 'Ondo', region: 'Ondo' },
  { name: 'Osogbo', region: 'Osun' },
  { name: 'Ile-Ife', region: 'Osun' },
  { name: 'Ilesa', region: 'Osun' },
  { name: 'Ado-Ekiti', region: 'Ekiti' },
  // North-central
  { name: 'Ilorin', region: 'Kwara' },
  { name: 'Jos', region: 'Plateau' },
  { name: 'Makurdi', region: 'Benue' },
  { name: 'Lokoja', region: 'Kogi' },
  { name: 'Lafia', region: 'Nasarawa' },
  { name: 'Minna', region: 'Niger' },
  { name: 'Suleja', region: 'Niger' },
  // North
  { name: 'Kano', region: 'Kano' },
  { name: 'Kaduna', region: 'Kaduna' },
  { name: 'Zaria', region: 'Kaduna' },
  { name: 'Katsina', region: 'Katsina' },
  { name: 'Sokoto', region: 'Sokoto' },
  { name: 'Birnin Kebbi', region: 'Kebbi' },
  { name: 'Gusau', region: 'Zamfara' },
  { name: 'Dutse', region: 'Jigawa' },
  { name: 'Bauchi', region: 'Bauchi' },
  { name: 'Gombe', region: 'Gombe' },
  { name: 'Maiduguri', region: 'Borno' },
  { name: 'Damaturu', region: 'Yobe' },
  { name: 'Yola', region: 'Adamawa' },
  { name: 'Jalingo', region: 'Taraba' },
  // More areas outside Lagos (suggestions only — any place can be typed)
  { name: 'GRA Port Harcourt', region: 'Rivers' },
  { name: 'Rumuokoro', region: 'Rivers' },
  { name: 'Trans-Amadi', region: 'Rivers' },
  { name: 'Choba', region: 'Rivers' },
  { name: 'Eleme', region: 'Rivers' },
  { name: 'Bonny', region: 'Rivers' },
  { name: 'Bodija', region: 'Oyo' },
  { name: 'Ring Road Ibadan', region: 'Oyo' },
  { name: 'Challenge', region: 'Oyo' },
  { name: 'Oyo', region: 'Oyo' },
  { name: 'Iseyin', region: 'Oyo' },
  { name: 'Sabon Gari Kano', region: 'Kano' },
  { name: 'Nassarawa GRA', region: 'Kano' },
  { name: 'Wudil', region: 'Kano' },
  { name: 'Independence Layout', region: 'Enugu' },
  { name: 'New Haven', region: 'Enugu' },
  { name: 'Trans-Ekulu', region: 'Enugu' },
  { name: 'Ugbowo', region: 'Edo' },
  { name: 'GRA Benin', region: 'Edo' },
  { name: 'Ekpoma', region: 'Edo' },
  { name: 'Auchi', region: 'Edo' },
  { name: 'Barnawa', region: 'Kaduna' },
  { name: 'Kafanchan', region: 'Kaduna' },
  { name: 'Effurun', region: 'Delta' },
  { name: 'Ughelli', region: 'Delta' },
  { name: 'Agbor', region: 'Delta' },
  { name: 'Ikot Ekpene', region: 'Akwa Ibom' },
  { name: 'Eket', region: 'Akwa Ibom' },
  { name: 'Ogoja', region: 'Cross River' },
  { name: 'Orlu', region: 'Imo' },
  { name: 'Okigwe', region: 'Imo' },
  { name: 'Ekwulobia', region: 'Anambra' },
  { name: 'Ikare', region: 'Ondo' },
  { name: 'Owo', region: 'Ondo' },
  { name: 'Ikire', region: 'Osun' },
  { name: 'Ikere-Ekiti', region: 'Ekiti' },
  { name: 'Offa', region: 'Kwara' },
  { name: 'Bukuru', region: 'Plateau' },
  { name: 'Otukpo', region: 'Benue' },
  { name: 'Gboko', region: 'Benue' },
  { name: 'Okene', region: 'Kogi' },
  { name: 'Keffi', region: 'Nasarawa' },
  { name: 'Bida', region: 'Niger' },
  { name: 'Funtua', region: 'Katsina' },
  { name: 'Daura', region: 'Katsina' },
  { name: 'Azare', region: 'Bauchi' },
  { name: 'Mubi', region: 'Adamawa' },
  { name: 'Wukari', region: 'Taraba' },
  { name: 'Potiskum', region: 'Yobe' },
  { name: 'Hadejia', region: 'Jigawa' },
  { name: 'Mowe', region: 'Ogun' },
  { name: 'Ibafo', region: 'Ogun' },
  { name: 'Ilaro', region: 'Ogun' },
  { name: 'Karu', region: 'Nasarawa' },
  { name: 'Mararaba', region: 'Nasarawa' },
  { name: 'Nyanya', region: 'Abuja' },
  { name: 'Life Camp', region: 'Abuja' },
  { name: 'Utako', region: 'Abuja' },
  { name: 'Kuje', region: 'FCT' },
  { name: 'Ojota', region: 'Lagos' },
  { name: 'Ikotun', region: 'Lagos' },
  { name: 'Agege', region: 'Lagos' },
  { name: 'Sangotedo', region: 'Lagos' },
];

export const tidyPlace = (s: string) =>
  s
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(^|[\s-])\S/g, (c) => c.toUpperCase())
    .slice(0, 50);

/** Shown before anything is typed: major cities across the country, not one city's neighbourhoods. */
export const POPULAR_PLACES = ['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan', 'Kano', 'Benin City', 'Enugu', 'Kaduna', 'Owerri', 'Abeokuta', 'Uyo', 'Jos', 'Ilorin', 'Warri', 'Onitsha', 'Calabar', 'Akure', 'Asaba'];

/** Ranked suggestions: prefix matches first, then contains; also matches the state/region ("Rivers" → Port Harcourt areas). */
export function suggestPlaces(query: string, extra: string[] = [], limit = 6) {
  const q = query.trim().toLowerCase();
  const recent = extra.filter(Boolean).map((name) => ({ name, region: 'Recent' }));
  const pool = [...recent, ...NIGERIA_PLACES].filter((p, i, arr) => arr.findIndex((x) => x.name.toLowerCase() === p.name.toLowerCase()) === i);
  if (!q) {
    const popular = POPULAR_PLACES.map((n) => NIGERIA_PLACES.find((p) => p.name === n)!).filter(Boolean);
    return [...recent, ...popular].filter((p, i, arr) => arr.findIndex((x) => x.name.toLowerCase() === p.name.toLowerCase()) === i).slice(0, limit);
  }
  const starts = pool.filter((p) => p.name.toLowerCase().startsWith(q));
  const words = pool.filter((p) => !starts.includes(p) && p.name.toLowerCase().split(/[\s-]+/).some((w) => w.startsWith(q)));
  const region = pool.filter((p) => !starts.includes(p) && !words.includes(p) && p.region.toLowerCase().startsWith(q));
  const contains = pool.filter((p) => !starts.includes(p) && !words.includes(p) && !region.includes(p) && (p.name.toLowerCase().includes(q) || p.region.toLowerCase().includes(q)));
  return [...starts, ...words, ...region, ...contains].slice(0, limit);
}
