import type { Listing, Profile, SearchFilters } from './types';

// Blueprint §12 phase 1–2: token match + synonyms + light fuzzy matching, structured filters, deterministic sort.
const SYNONYMS: Record<string, string[]> = {
  iphone: ['apple', 'ios'],
  ps5: ['playstation', 'playstation 5'],
  ps4: ['playstation 4'],
  playstation: ['ps5', 'ps4'],
  macbook: ['mac', 'apple laptop'],
  airpods: ['earbuds', 'apple'],
  laptop: ['notebook', 'computer'],
  phone: ['mobile', 'smartphone'],
  samsung: ['galaxy'],
  galaxy: ['samsung'],
  headphones: ['headset', 'cans'],
  powerbank: ['power bank'],
  xbox: ['microsoft'],
};

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function lev(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length]![b.length]!;
}

export function searchListings(all: Listing[], users: Record<string, Profile>, query: string, f: SearchFilters, blocked: string[] = []) {
  const q = norm(query);
  const tokens = q ? q.split(' ') : [];

  const scored = all
    .filter((l) => l.status === 'active' && !blocked.includes(l.sellerId))
    .filter((l) => !f.categoryId || l.categoryId === f.categoryId)
    .filter((l) => !f.conditions.length || f.conditions.includes(l.condition))
    .filter((l) => f.minPrice == null || l.priceMinor >= f.minPrice)
    .filter((l) => f.maxPrice == null || l.priceMinor <= f.maxPrice)
    .filter((l) => !f.city || `${l.city} ${l.area ?? ''}`.toLowerCase().includes(f.city.trim().toLowerCase()))
    .filter((l) => !f.delivery || l.delivery)
    .filter((l) => !f.sellerType || (f.sellerType === 'retail' ? users[l.sellerId]?.shopType === 'retail' : users[l.sellerId]?.shopType !== 'retail'))
    .map((l) => {
      if (!tokens.length) return { l, score: 1 };
      const title = norm(`${l.title} ${l.brand ?? ''} ${l.model ?? ''} ${l.customCategory ?? ''}`);
      const rest = norm(`${l.categoryId} ${l.subcategory ?? ''} ${l.description} ${Object.values(l.attributes).join(' ')} ${users[l.sellerId]?.displayName ?? ''}`);
      const words = (title + ' ' + rest).split(' ');
      let score = 0;
      for (const tok of tokens) {
        const variants = [tok, ...(SYNONYMS[tok] ?? [])];
        let best = 0;
        for (const v of variants) {
          if (title.includes(v)) best = Math.max(best, v === tok ? 10 : 6);
          else if (rest.includes(v)) best = Math.max(best, v === tok ? 4 : 3);
          else if (tok.length >= 4 && words.some((w) => w.length >= 3 && lev(w, tok) <= 1)) best = Math.max(best, 3);
        }
        if (!best) return { l, score: 0 }; // every token must match something
        score += best;
      }
      if (l.model && q.includes(norm(l.model))) score += 15; // exact model outranks loose overlap
      return { l, score };
    })
    .filter((x) => x.score > 0);

  const tie = (a: Listing, b: Listing) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0) || a.id.localeCompare(b.id);
  switch (f.sort) {
    case 'newest':
      scored.sort((a, b) => tie(a.l, b.l));
      break;
    case 'price_asc':
      scored.sort((a, b) => a.l.priceMinor - b.l.priceMinor || tie(a.l, b.l));
      break;
    case 'price_desc':
      scored.sort((a, b) => b.l.priceMinor - a.l.priceMinor || tie(a.l, b.l));
      break;
    default:
      scored.sort((a, b) => b.score - a.score || tie(a.l, b.l));
  }
  return scored.map((x) => x.l);
}

export const activeFilterCount = (f: SearchFilters) =>
  (f.categoryId ? 1 : 0) + (f.conditions.length ? 1 : 0) + (f.minPrice != null || f.maxPrice != null ? 1 : 0) + (f.city ? 1 : 0) + (f.delivery ? 1 : 0) + (f.sellerType ? 1 : 0);
