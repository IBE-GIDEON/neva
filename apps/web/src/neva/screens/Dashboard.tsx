'use client';

import { compactNumber, formatNaira, type Listing, type ListingStatus, timeAgo } from '@neva/core';
import { Aperture, Bookmark, CheckCheck, ChevronRight, Eye, FileText, ImageOff, MessageCircle, Pause, Pencil, Play, Plus, Store, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Cond, Empty } from '../components/ui';
import { useNav } from '../nav';
import { openDrawer, openSell, showToast, useStore } from '../store';

type Tab = 'active' | 'paused' | 'sold';
const TABS: Tab[] = ['active', 'paused', 'sold'];

/** Seller dashboard for "My listings": totals, buyers waiting, status tabs and quick actions (mobile My shop). */
export function SellerDashboard() {
  const { go } = useNav();
  const meId = useStore((s) => s.meId);
  const all = useStore((s) => s.listings);
  const conversations = useStore((s) => s.conversations);
  const draft = useStore((s) => s.draft);
  const [tab, setTab] = useState<Tab>('active');

  const mine = useMemo(() => Object.values(all).filter((l) => l.sellerId === meId && l.status !== 'removed'), [all, meId]);
  const list = useMemo(() => mine.filter((l) => l.status === tab).sort((a, b) => b.createdAt - a.createdAt), [mine, tab]);
  const totals = mine.reduce((acc, l) => ({ views: acc.views + l.views, saves: acc.saves + l.saves, enquiries: acc.enquiries + l.enquiries }), { views: 0, saves: 0, enquiries: 0 });
  const waiting = Object.values(conversations).filter((c) => c.listingId && all[c.listingId]?.sellerId === meId && c.unread > 0 && c.status !== 'blocked').length;
  const newDraft = draft && !draft.editingId ? draft : null;

  const setStatus = (l: Listing, s: ListingStatus, msg: string) => {
    useStore.getState().setListingStatus(l.id, s);
    showToast(msg);
  };

  return (
    <div style={{ maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="lrow" style={{ border: '1px solid var(--border)', borderRadius: 12, minHeight: 72, padding: '12px 18px' }} onClick={() => openSell()}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--gradient)', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          {newDraft ? <FileText size={21} /> : <Plus size={22} />}
        </div>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="tt">{newDraft ? 'Continue your draft' : 'Sell something'}</div>
          <div className="st ellipsis">{newDraft ? `${newDraft.title || 'Untitled'} · pick up where you left off` : 'List in under 2 minutes. Free, no fees.'}</div>
        </div>
        <ChevronRight size={18} className="faint" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Metric icon={<Eye size={18} />} value={compactNumber(totals.views)} label="Views" />
        <Metric icon={<Bookmark size={18} />} value={compactNumber(totals.saves)} label="Saves" />
        <Metric icon={<MessageCircle size={18} />} value={compactNumber(totals.enquiries)} label="Enquiries" accent />
      </div>
      <div className="faint" style={{ fontSize: 12, marginTop: -8 }}>Views = listing opens by others. Enquiries = chats started from your listings.</div>

      {waiting > 0 && (
        <div className="lrow" style={{ border: '1px solid var(--border)', borderRadius: 12, minHeight: 52, padding: '10px 16px' }} onClick={() => go('/chats')}>
          <MessageCircle size={20} color="var(--accent)" />
          <div className="grow" style={{ fontWeight: 500 }}>{waiting} buyer{waiting > 1 ? 's' : ''} waiting for a reply</div>
          <ChevronRight size={18} className="faint" />
        </div>
      )}

      <div className="pills" style={{ padding: 0 }}>
        {TABS.map((k) => (
          <button key={k} className={`pill${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>
            {k[0]!.toUpperCase() + k.slice(1)} · {mine.filter((l) => l.status === k).length}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        tab === 'active' && mine.length === 0 ? (
          <Empty icon={<Store size={26} />} title="You haven’t listed anything" body="List a gadget in a minute. Buyers message you straight from the listing." action={<button className="btn primary sm" onClick={() => openSell()}>Sell an item</button>} />
        ) : (
          <Empty icon={<Store size={26} />} title={tab === 'active' ? 'No active listings' : `Nothing ${tab}`} body={tab === 'active' ? 'Clear photos and an honest condition get more chats.' : undefined} />
        )
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {list.map((l, i) => (
            <div key={l.id} className="lrow" style={{ alignItems: 'flex-start', padding: '12px 16px', borderTop: i ? '1px solid var(--border)' : undefined }} onClick={() => openDrawer({ kind: 'listing', id: l.id })}>
              <div style={{ width: 72, height: 72, borderRadius: 10, overflow: 'hidden', background: 'var(--input)', display: 'grid', placeItems: 'center', color: 'var(--text3)', flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {l.images[0] ? <img src={l.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageOff size={20} />}
              </div>
              <div className="grow" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div className="ellipsis" style={{ fontWeight: 500 }}>{l.title}</div>
                <div style={{ fontWeight: 600 }}>{formatNaira(l.priceMinor)}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <Cond c={l.condition} short />
                  <span className="faint" style={{ fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                    <span title="Views" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Eye size={13} /> {l.views}</span>
                    <span title="Saves" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Bookmark size={13} /> {l.saves}</span>
                    <span title="Enquiries" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MessageCircle size={13} /> {l.enquiries}</span>
                  </span>
                </div>
                <div className="faint" style={{ fontSize: 12 }}>{l.status === 'active' ? 'Active' : l.status === 'paused' ? 'Paused' : 'Sold'} · listed {timeAgo(l.createdAt)}</div>
              </div>
              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                <ActionBtn title="Edit" onClick={() => { useStore.getState().editListing(l.id); openSell(l.id); }}><Pencil size={17} /></ActionBtn>
                {l.status === 'active' && (
                  <>
                    <ActionBtn title="Mark as sold" onClick={() => setStatus(l, 'sold', 'Marked as sold')}><CheckCheck size={17} /></ActionBtn>
                    <ActionBtn title="Pause" onClick={() => setStatus(l, 'paused', 'Listing paused')}><Pause size={17} /></ActionBtn>
                    <ActionBtn
                      title="Post to my status"
                      onClick={() => {
                        useStore.getState().addStory({ imageUri: l.images[0], caption: l.title, listingId: l.id });
                        showToast('Posted to status');
                      }}>
                      <Aperture size={17} />
                    </ActionBtn>
                  </>
                )}
                {l.status !== 'active' && <ActionBtn title={l.status === 'sold' ? 'Relist' : 'Resume'} onClick={() => setStatus(l, 'active', 'Listing is live again')}><Play size={17} /></ActionBtn>}
                <ActionBtn title="Delete" onClick={() => confirm(`Delete “${l.title}”? Buyers will no longer see it.`) && setStatus(l, 'removed', 'Listing deleted')}><Trash2 size={17} /></ActionBtn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className="icon-btn" style={{ width: 34, height: 34 }} title={title} aria-label={title} onClick={onClick}>
      {children}
    </button>
  );
}

function Metric({ icon, value, label, accent }: { icon: React.ReactNode; value: string; label: string; accent?: boolean }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ width: 32, height: 32, borderRadius: 10, background: accent ? 'var(--accent-soft)' : 'var(--input)', color: accent ? 'var(--accent)' : 'var(--text)', display: 'grid', placeItems: 'center' }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
      <div className="muted" style={{ fontSize: 12.5 }}>{label}</div>
    </div>
  );
}
