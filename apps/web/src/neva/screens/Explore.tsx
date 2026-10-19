'use client';

import { activeFilterCount, CATEGORIES, type Condition, CONDITIONS, type Listing, searchListings } from '@neva/core';
import { Bookmark, Compass, LayoutGrid, Package, PlusSquare, Search, SlidersHorizontal, Store, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Avatar, Empty, Verified } from '../components/ui';
import { LocationInput } from '../components/LocationInput';
import { useNav } from '../nav';
import { openDrawer, openSell, useStore, useUI } from '../store';
import { SellerDashboard } from './Dashboard';
import { InfoDrawer, ListingCard } from './Info';

type View = 'all' | 'following' | 'saved' | 'mine';
const VIEWS: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'Discover', icon: <Compass size={20} /> },
  { id: 'following', label: 'Following', icon: <Users size={20} /> },
  { id: 'saved', label: 'Saved', icon: <Bookmark size={20} /> },
  { id: 'mine', label: 'My listings', icon: <Store size={20} /> },
];

/** Explore: directory in the side panel, results grid in the main area, listing details in the right drawer. */
export function ExploreSection() {
  const { id, go } = useNav();
  const listings = useStore((s) => s.listings);
  const users = useStore((s) => s.users);
  const blocked = useStore((s) => s.blocked);
  const follows = useStore((s) => s.follows);
  const saved = useStore((s) => s.saved);
  const meId = useStore((s) => s.meId);
  const search = useStore((s) => s.search);
  const recent = useStore((s) => s.recentSearches);
  const interests = useStore((s) => s.interests);
  const personalization = useStore((s) => s.settings.personalization);
  const drawer = useUI((s) => s.drawer);
  const [showFilters, setShowFilters] = useState(false);
  /** Phone layout: the directory/filters panel opens as a full-screen sheet. */
  const [sheet, setSheet] = useState(false);
  const navTo = (to: string) => {
    setSheet(false);
    go(to);
  };
  const [openedAt] = useState(() => Date.now()); // fixed reference time keeps ranking stable across renders

  const view: View = (['following', 'saved', 'mine'] as const).find((v) => v === id) ?? 'all';
  const { query, filters } = search;
  const setSearch = useStore.getState().setSearch;

  const results = useMemo(() => {
    if (view === 'mine') return Object.values(listings).filter((l) => l.sellerId === meId && l.status !== 'removed').sort((a, b) => b.createdAt - a.createdAt);
    if (view === 'saved') return saved.map((sid) => listings[sid]).filter((l): l is Listing => !!l && l.status !== 'removed');
    const r = searchListings(Object.values(listings), users, query, filters, blocked).filter((l) => l.sellerId !== meId || view === 'all');
    if (view === 'following') return r.filter((l) => follows.includes(l.sellerId));
    if (query.trim() || filters.sort !== 'relevance' || !personalization) return r;
    // Personalised Discover (mobile explore): freshness + interest match + follow graph, explainable and deterministic.
    const score = (l: Listing) => {
      const ageH = (openedAt - (l.publishedAt ?? l.createdAt)) / 3600_000;
      let s = 100 / (1 + ageH / 24);
      if (interests.includes(l.categoryId)) s += 25;
      if (follows.includes(l.sellerId)) s += 15;
      return s + Math.min(10, l.images.length * 3 + Object.keys(l.attributes).length);
    };
    return r.map((l) => ({ l, s: score(l) })).sort((a, b) => b.s - a.s).map((x) => x.l);
  }, [view, listings, users, query, filters, blocked, follows, saved, meId, interests, personalization, openedAt]);

  // People whose name, @username or shop name match the query (store.searchPeople skips me and blocked users).
  const sellers = useMemo(() => (view === 'all' && query.trim() ? useStore.getState().searchPeople(query) : []), [view, query, users, blocked]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seller-defined names used by active listings in the Other category, most used first.
  const otherNames = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(listings).forEach((l) => {
      if (l.status === 'active' && l.categoryId === 'other' && l.customCategory && !blocked.includes(l.sellerId)) counts[l.customCategory] = (counts[l.customCategory] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [listings, blocked]);

  const counts = {
    all: Object.values(listings).filter((l) => l.status === 'active' && !blocked.includes(l.sellerId)).length,
    following: Object.values(listings).filter((l) => l.status === 'active' && follows.includes(l.sellerId)).length,
    saved: saved.filter((s) => listings[s] && listings[s]!.status !== 'removed').length,
    mine: Object.values(listings).filter((l) => l.sellerId === meId && l.status !== 'removed').length,
  };
  const nFilters = activeFilterCount(filters);
  const cat = CATEGORIES.find((c) => c.id === filters.categoryId);
  const forYou = view === 'all' && !query.trim() && filters.sort === 'relevance' && personalization && (follows.length > 0 || interests.length > 0);
  const heading = view === 'all' ? (query ? `Results for “${query}”` : cat ? cat.name : forYou ? 'For you' : 'Discover') : VIEWS.find((v) => v.id === view)!.label;
  const searchable = view === 'all' || view === 'following';

  return (
    <>
      <div className={`side explore-side${sheet ? ' open' : ''}`}>
        <div className="side-head">
          <h1>Explore</h1>
          <button className="btn ghost sm only-sm" onClick={() => setSheet(false)}>Done</button>
          <button className="icon-btn" title="Sell an item" aria-label="Sell an item" onClick={() => openSell()}>
            <PlusSquare size={21} />
          </button>
          <button className={`icon-btn${showFilters ? ' on' : ''}`} title="Filters" aria-label="Filters" onClick={() => setShowFilters(!showFilters)} style={{ position: 'relative' }}>
            <SlidersHorizontal size={20} />
            {nFilters > 0 && <span className="badge" style={{ position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, fontSize: 10, padding: '0 4px' }}>{nFilters}</span>}
          </button>
        </div>
        <div className="search">
          <Search size={17} />
          <input
            placeholder="Search items, brands, models"
            value={query}
            onChange={(e) => { setSearch({ query: e.target.value }); if (view !== 'all' && view !== 'following') navTo('/explore'); }}
            onKeyDown={(e) => e.key === 'Enter' && useStore.getState().pushRecentSearch(query)}
            onBlur={() => query.trim().length > 1 && useStore.getState().pushRecentSearch(query)}
          />
          {query && <button onClick={() => setSearch({ query: '' })} aria-label="Clear"><X size={16} /></button>}
        </div>
        <div className="scroll">
          {showFilters && <Filters onClose={() => setShowFilters(false)} />}
          {!query && recent.length > 0 && !showFilters && (
            <div className="pills" style={{ flexWrap: 'wrap', paddingTop: 4 }}>
              {recent.slice(0, 5).map((r) => <button key={r} className="pill" onClick={() => { setSearch({ query: r }); navTo('/explore'); }}>{r}</button>)}
              <button className="pill" onClick={() => useStore.getState().clearRecentSearches()} aria-label="Clear recent searches"><X size={13} style={{ display: 'inline', verticalAlign: -2 }} /></button>
            </div>
          )}
          {VIEWS.map((v) => (
            <div key={v.id} className={`lrow${view === v.id && (v.id !== 'all' || !filters.categoryId) ? ' on' : ''}`} style={{ minHeight: 52 }} onClick={() => { if (v.id === 'all') setSearch({ filters: { categoryId: undefined } }); navTo(v.id === 'all' ? '/explore' : `/explore/${v.id}`); }}>
              <div className="ic">{v.icon}</div>
              <div className="tt grow">{v.label}</div>
              <span className="faint" style={{ fontSize: 13 }}>{counts[v.id] || ''}</span>
            </div>
          ))}
          <div className="section-label">Categories</div>
          {CATEGORIES.map((c) => (
            <div key={c.id} className={`lrow${view === 'all' && filters.categoryId === c.id ? ' on' : ''}`} style={{ minHeight: 46, paddingLeft: 28 }} onClick={() => { setSearch({ filters: { categoryId: filters.categoryId === c.id ? undefined : c.id } }); navTo('/explore'); }}>
              <div className="tt grow" style={{ fontSize: 15 }}>{c.name}</div>
              <span className="faint" style={{ fontSize: 13 }}>{Object.values(listings).filter((l) => l.status === 'active' && l.categoryId === c.id).length || ''}</span>
            </div>
          ))}
          <div style={{ height: 20 }} />
        </div>
      </div>
      <div className="main">
        <div className="only-sm explore-top">
          <div className="explore-top-row">
            <h1>Explore</h1>
            <button className="icon-btn" aria-label="Sell an item" onClick={() => openSell()}><PlusSquare size={21} /></button>
            <button className="icon-btn" aria-label="Filters" style={{ position: 'relative' }} onClick={() => { setShowFilters(true); setSheet(true); }}>
              <SlidersHorizontal size={20} />
              {nFilters > 0 && <span className="badge" style={{ position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, fontSize: 10, padding: '0 4px' }}>{nFilters}</span>}
            </button>
          </div>
          <div className="search" style={{ margin: '0 0 8px' }}>
            <Search size={17} />
            <input
              placeholder="Search items, brands, models"
              value={query}
              onChange={(e) => { setSearch({ query: e.target.value }); if (view !== 'all' && view !== 'following') go('/explore'); }}
              onBlur={() => query.trim().length > 1 && useStore.getState().pushRecentSearch(query)}
            />
            {query && <button onClick={() => setSearch({ query: '' })} aria-label="Clear"><X size={16} /></button>}
          </div>
          <div className="pills" style={{ padding: '0 0 10px' }}>
            {VIEWS.map((v) => (
              <button key={v.id} className={`pill${view === v.id && (v.id !== 'all' || !filters.categoryId) ? ' on' : ''}`} onClick={() => { if (v.id === 'all') setSearch({ filters: { categoryId: undefined } }); go(v.id === 'all' ? '/explore' : `/explore/${v.id}`); }}>{v.label}</button>
            ))}
            {CATEGORIES.map((c) => (
              <button key={c.id} className={`pill${view === 'all' && filters.categoryId === c.id ? ' on' : ''}`} onClick={() => { setSearch({ filters: { categoryId: filters.categoryId === c.id ? undefined : c.id } }); go('/explore'); }}>{c.name}</button>
            ))}
          </div>
        </div>
        <div className="main-head">
          <LayoutGrid size={20} className="muted" />
          <div className="grow" style={{ fontSize: 16, fontWeight: 500 }}>{heading}</div>
          {view !== 'mine' && <span className="faint" style={{ fontSize: 13 }}>{results.length} item{results.length === 1 ? '' : 's'}</span>}
          {searchable && (
            <select className="box" style={{ width: 180, height: 36, background: 'var(--panel)' }} value={filters.sort} onChange={(e) => setSearch({ filters: { sort: e.target.value as typeof filters.sort } })}>
              <option value="relevance">Best match</option>
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </select>
          )}
        </div>
        <div className="scroll">
          <div className="dir">
            {view === 'all' && filters.categoryId === 'other' && otherNames.length > 0 && (
              <div className="pills" style={{ flexWrap: 'wrap', padding: '0 0 16px' }}>
                {otherNames.map((n) => (
                  <button key={n} className={`pill${query.trim().toLowerCase() === n.toLowerCase() ? ' on' : ''}`} onClick={() => setSearch({ query: query.trim().toLowerCase() === n.toLowerCase() ? '' : n })}>{n}</button>
                ))}
              </div>
            )}
            {sellers.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div className="flabel" style={{ marginBottom: 8 }}>Sellers</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {sellers.slice(0, 6).map((u) => (
                    <div key={u.id} className="lcard" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', minWidth: 220, maxWidth: 300 }} onClick={() => openDrawer({ kind: 'shop', id: u.id })}>
                      <Avatar user={u} size={40} />
                      <div className="grow">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}><span className="ellipsis">{u.shopName ?? u.displayName}</span><Verified user={u} /></div>
                        <div className="faint ellipsis" style={{ fontSize: 12.5 }}>@{u.username}{u.city ? ` · ${u.city}` : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {view === 'mine' ? (
              <SellerDashboard />
            ) : results.length > 0 ? (
              <div className="cards">{results.map((l) => <ListingCard key={l.id} l={l} />)}</div>
            ) : view === 'saved' ? (
              <Empty icon={<Bookmark size={26} />} title="Nothing saved yet" body="Save listings to compare them later." />
            ) : view === 'following' ? (
              <Empty icon={<Users size={26} />} title={follows.length ? 'No new listings from people you follow' : 'You’re not following anyone yet'} body="Follow sellers from their shop to see their listings here." />
            ) : counts.all ? (
              <Empty icon={<Search size={26} />} title="No matches" body="Try another search, category or fewer filters." action={(query || nFilters > 0) && <button className="btn line sm" onClick={() => setSearch({ query: '', filters: { categoryId: undefined, conditions: [], minPrice: undefined, maxPrice: undefined, city: undefined, delivery: undefined, sellerType: undefined } })}>Clear search & filters</button>} />
            ) : (
              <Empty icon={<Package size={26} />} title="No listings yet" body="Be the first to sell on Neva. Listings from sellers show up here." action={<button className="btn primary sm" onClick={() => openSell()}>Create a listing</button>} />
            )}
          </div>
        </div>
      </div>
      {drawer && <InfoDrawer />}
    </>
  );
}

function Filters({ onClose }: { onClose: () => void }) {
  const filters = useStore((s) => s.search.filters);
  const setSearch = useStore.getState().setSearch;
  const [city, setCity] = useState(filters.city ?? '');
  const toggleCond = (c: Condition) => setSearch({ filters: { conditions: filters.conditions.includes(c) ? filters.conditions.filter((x) => x !== c) : [...filters.conditions, c] } });
  const naira = (v?: number) => (v == null ? '' : String(Math.round(v / 100)));
  const toMinor = (s: string) => (s.replace(/\D/g, '') ? Number(s.replace(/\D/g, '')) * 100 : undefined);
  return (
    <div style={{ margin: '4px 12px 12px', padding: 16, borderRadius: 12, background: 'var(--input)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <b className="grow">Filters</b>
        <button className="btn ghost sm" onClick={() => { setCity(''); setSearch({ filters: { conditions: [], minPrice: undefined, maxPrice: undefined, city: undefined, delivery: undefined, sellerType: undefined } }); }}>Reset</button>
        <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={onClose} aria-label="Close filters"><X size={16} /></button>
      </div>
      <div>
        <div className="flabel">Condition</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CONDITIONS.map((c) => <button key={c.id} className={`pill${filters.conditions.includes(c.id) ? ' on' : ''}`} style={{ background: filters.conditions.includes(c.id) ? undefined : 'var(--panel)' }} onClick={() => toggleCond(c.id)}>{c.short}</button>)}
        </div>
      </div>
      <div>
        <div className="flabel">Price (₦)</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="box" style={{ background: 'var(--panel)' }} placeholder="Min" inputMode="numeric" value={naira(filters.minPrice)} onChange={(e) => setSearch({ filters: { minPrice: toMinor(e.target.value) } })} />
          <input className="box" style={{ background: 'var(--panel)' }} placeholder="Max" inputMode="numeric" value={naira(filters.maxPrice)} onChange={(e) => setSearch({ filters: { maxPrice: toMinor(e.target.value) } })} />
        </div>
      </div>
      <div>
        <div className="flabel">Location</div>
        <LocationInput clearable background="var(--panel)" placeholder="Anywhere in Nigeria" value={city} onChange={(v) => { setCity(v); setSearch({ filters: { city: v.trim() || undefined } }); }} />
      </div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <label className="check"><input type="checkbox" checked={!!filters.delivery} onChange={(e) => setSearch({ filters: { delivery: e.target.checked || undefined } })} /> Delivery available</label>
      </div>
      <div>
        <div className="flabel">Seller</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {([[undefined, 'Any'], ['retail', 'Shops'], ['individual', 'Individuals']] as const).map(([v, label]) => (
            <button key={label} className={`pill${filters.sellerType === v ? ' on' : ''}`} style={{ background: filters.sellerType === v ? undefined : 'var(--panel)' }} onClick={() => setSearch({ filters: { sellerType: v } })}>{label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
