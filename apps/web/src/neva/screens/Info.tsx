'use client';

import { categoryLabel, compactNumber, conditionById, formatNaira, type Listing, timeAgo, VERIFICATIONS } from '@neva/core';
import { Aperture, Bookmark, BookmarkCheck, CircleHelp, Clock, Flag, ImageOff, Info, MapPin, MessageCircle, MessagesSquare, Pause, Pencil, Play, Share2, ShieldCheck, Star, Store, Tag, Trash2, Truck, UserRound, UserX, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { shareLink, shareUrl } from '../components/ShareLink';
import { Avatar, Cond, Modal, Verified } from '../components/ui';
import { useNav } from '../nav';
import { isStoryLive, openDrawer, openLightbox, openSell, showToast, useStore, useUI } from '../store';

const close = () => useUI.setState({ drawer: null });

/** Right-hand drawer: shop (contact) info or listing details. */
export function InfoDrawer() {
  const drawer = useUI((s) => s.drawer);
  useEffect(() => {
    // Escape closes the drawer only when no lightbox / modal is stacked on top of it.
    const k = (e: KeyboardEvent) => e.key === 'Escape' && !useUI.getState().lightbox && !document.querySelector('.overlay') && close();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  if (!drawer) return null;
  return (
    <aside className="drawer force">
      <div className="slide-head">
        <button className="icon-btn" onClick={close} aria-label="Close">
          <X size={21} />
        </button>
        <h2>{drawer.kind === 'shop' ? 'Shop info' : 'Listing'}</h2>
      </div>
      <div className="scroll" style={{ background: 'var(--app-bg)' }}>
        {drawer.kind === 'shop' ? <ShopInfo key={drawer.id} id={drawer.id} /> : <ListingInfo key={drawer.id} id={drawer.id} />}
      </div>
    </aside>
  );
}

function useMessage() {
  const { go } = useNav();
  return (userId: string, listingId?: string) => {
    const cid = useStore.getState().startConversation(userId, listingId);
    // Opening a fresh chat from a listing starts with a friendly prompt, like the app.
    const s = useStore.getState();
    if (listingId && !(s.messages[cid]?.length) && !s.conversations[cid]?.draft) s.setDraftText(cid, 'Is this still available?');
    close();
    go(`/chats/${cid}`);
  };
}

function ShopInfo({ id }: { id: string }) {
  const user = useStore((s) => s.users[id]);
  const meId = useStore((s) => s.meId);
  const following = useStore((s) => s.follows.includes(id));
  const blocked = useStore((s) => s.blocked.includes(id));
  const listings = useStore((s) => s.listings);
  const reviews = useStore((s) => s.reviews);
  const canReview = useStore((s) => s.canReview(id));
  const { go } = useNav();
  const message = useMessage();
  const items = useMemo(() => Object.values(listings).filter((l) => l.sellerId === id && (l.status === 'active' || l.status === 'sold')).sort((a, b) => b.createdAt - a.createdAt), [listings, id]);
  const theirReviews = reviews.filter((r) => r.sellerId === id);
  const myReview = theirReviews.find((r) => r.reviewerId === meId);
  const users = useStore((s) => s.users);
  const hasStory = useStore((s) => s.stories.some((st) => st.userId === id && isStoryLive(st)));
  const storyUnseen = useStore((s) => s.stories.some((st) => st.userId === id && isStoryLive(st) && !s.viewedStories.includes(st.id)));
  const [allItems, setAllItems] = useState(false);
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: theirReviews.filter((r) => r.rating === n).length }));
  const distMax = Math.max(1, ...dist.map((d) => d.c));

  if (!user)
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <UserX size={28} className="muted" />
        <div style={{ marginTop: 8 }}>This account isn’t available.</div>
      </div>
    );
  const isMe = id === meId;
  const shopTitle = user.shopName && user.shopName !== user.displayName ? user.shopName : user.displayName;
  const shareProfile = () => shareLink({ title: `${shopTitle} on Neva`, text: `${shopTitle} on Neva`, url: shareUrl('shop', id) });
  return (
    <>
      <div className="card" style={{ padding: 0, textAlign: 'center' }}>
        <div style={{ height: 110, background: user.coverUri ? `center/cover url(${user.coverUri})` : 'var(--gradient)', opacity: user.coverUri ? 1 : 0.55 }} />
        <div style={{ marginTop: -60, display: 'flex', justifyContent: 'center' }}>
          <div style={{ border: '4px solid var(--panel)', borderRadius: '50%', background: 'var(--panel)' }} title={hasStory ? 'View status' : undefined}>
            <Avatar user={user} size={120} ring={hasStory} seen={!storyUnseen} onClick={hasStory ? () => { close(); go(`/updates/${id}`); } : undefined} />
          </div>
        </div>
        <div style={{ padding: '10px 24px 22px' }}>
          <div style={{ fontSize: 22, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
            {user.shopName && user.shopName !== user.displayName ? user.shopName : user.displayName}
            <Verified user={user} />
          </div>
          <div className="muted" style={{ marginTop: 4 }}>@{user.username}{user.city ? ` · ${user.city}` : ''}</div>
          {user.shopType && (
            <div className="faint" style={{ marginTop: 4, fontSize: 13, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5 }}>
              {user.shopType === 'retail' ? <Store size={14} /> : <UserRound size={14} />} {user.shopType === 'retail' ? 'Shop' : 'Individual seller'}
            </div>
          )}
          {user.responseNote && (
            <div className="faint" style={{ marginTop: 4, fontSize: 13, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5 }}>
              <Clock size={14} /> {user.responseNote}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 22, marginTop: 14, fontSize: 13.5 }}>
            <span><b>{items.filter((l) => l.status === 'active').length}</b> <span className="muted">listings</span></span>
            <span><b>{compactNumber(user.followers)}</b> <span className="muted">followers</span></span>
            <span><b>{user.rating ? `★ ${user.rating.avg}` : '—'}</b> <span className="muted">{user.rating ? `(${user.rating.count})` : 'no ratings'}</span></span>
          </div>
          {!isMe && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 18 }}>
              {!blocked && (
                <button className="btn primary sm" onClick={() => message(id)}>
                  <MessageCircle size={16} /> Message
                </button>
              )}
              <button className="btn line sm" onClick={() => useStore.getState().toggleFollow(id)}>
                {following ? 'Following' : 'Follow'}
              </button>
              <button className="btn line sm" onClick={shareProfile} aria-label="Share profile" title="Share profile">
                <Share2 size={16} />
              </button>
            </div>
          )}
          {isMe && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 16 }}>
              <button className="btn line sm" onClick={() => { close(); go('/settings/profile'); }}>
                <Pencil size={15} /> Edit profile
              </button>
              <button className="btn line sm" onClick={shareProfile}>
                <Share2 size={15} /> Share
              </button>
            </div>
          )}
        </div>
      </div>

      {(user.bio || user.joinedAt) && (
        <div className="card">
          <div className="muted" style={{ fontSize: 13.5, marginBottom: 6 }}>About</div>
          {user.bio && <div style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{user.bio}</div>}
          <div className="faint" style={{ fontSize: 13, marginTop: 8 }}>Joined {new Date(user.joinedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</div>
        </div>
      )}

      <div className="card">
        <div className="muted" style={{ fontSize: 13.5, marginBottom: 10 }}>Verification</div>
        {user.verifications.length === 0 && <div className="faint" style={{ fontSize: 13.5 }}>No verification yet. Inspect items in person before paying.</div>}
        {user.verifications.map((v) => (
          <div key={v} style={{ display: 'flex', gap: 12, padding: '6px 0' }}>
            <ShieldCheck size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div>{VERIFICATIONS[v].label}</div>
              <div className="faint" style={{ fontSize: 12.5, lineHeight: 1.45 }}>{VERIFICATIONS[v].meaning} {VERIFICATIONS[v].notImplied}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ display: 'flex', marginBottom: 12 }}>
          <span className="muted grow" style={{ fontSize: 13.5 }}>Listings</span>
          <span className="faint" style={{ fontSize: 13 }}>{items.length}</span>
        </div>
        {items.length === 0 ? (
          <div className="faint" style={{ fontSize: 13.5 }}>Nothing listed yet.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {(allItems ? items : items.slice(0, 9)).map((l) => (
              <button key={l.id} onClick={() => openDrawer({ kind: 'listing', id: l.id })} style={{ aspectRatio: '1', borderRadius: 6, overflow: 'hidden', background: 'var(--input)', position: 'relative' }} title={l.title}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {l.images[0] ? <img src={l.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: l.status === 'sold' ? 0.5 : 1 }} /> : <ImageOff size={18} className="faint" />}
                <span style={{ position: 'absolute', left: 4, bottom: 4, background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '1px 5px', borderRadius: 4 }}>
                  {l.status === 'sold' ? 'Sold' : formatNaira(l.priceMinor)}
                </span>
              </button>
            ))}
          </div>
        )}
        {items.length > 9 && (
          <button className="btn ghost sm" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }} onClick={() => setAllItems((v) => !v)}>
            {allItems ? 'Show less' : `See all ${items.length}`}
          </button>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <span className="muted grow" style={{ fontSize: 13.5 }}>Ratings</span>
          {canReview && (
            <button className="btn ghost sm" onClick={() => useUI.setState({ review: id })}>
              <Star size={15} /> {myReview ? 'Edit your rating' : 'Rate seller'}
            </button>
          )}
        </div>
        {(user.rating || theirReviews.length > 0) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '4px 0 14px' }}>
            <div style={{ textAlign: 'center', minWidth: 72 }}>
              <div style={{ fontSize: 32, fontWeight: 600, lineHeight: 1.1 }}>{user.rating ? user.rating.avg.toFixed(1) : '–'}</div>
              <Stars value={Math.round(user.rating?.avg ?? 0)} />
              <div className="faint" style={{ fontSize: 12, marginTop: 2 }}>{user.rating ? `${user.rating.count} rating${user.rating.count === 1 ? '' : 's'}` : 'No ratings'}</div>
            </div>
            <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {dist.map((d) => (
                <div key={d.n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="faint" style={{ fontSize: 12, width: 8 }}>{d.n}</span>
                  <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--input)', overflow: 'hidden' }}>
                    <div style={{ width: `${(d.c / distMax) * 100}%`, height: '100%', borderRadius: 3, background: 'var(--text)' }} />
                  </div>
                  <span className="faint" style={{ fontSize: 12, width: 16, textAlign: 'right' }}>{d.c}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {theirReviews.length === 0 && <div className="faint" style={{ fontSize: 13.5 }}>{canReview ? 'Be the first to rate this seller.' : 'Ratings come from people who have chatted with this seller.'}</div>}
        {theirReviews.map((r) => {
          const by = users[r.reviewerId];
          return (
            <div key={r.id} style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar user={by} size={32} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="ellipsis" style={{ fontWeight: 500, fontSize: 14 }}>{r.reviewerId === meId ? 'You' : by?.displayName ?? 'Neva user'}</div>
                  <div className="faint" style={{ fontSize: 12 }}>{timeAgo(r.createdAt)}</div>
                </div>
                <Stars value={r.rating} />
              </div>
              {r.text && <div style={{ marginTop: 6, lineHeight: 1.45 }}>{r.text}</div>}
              <div className="faint" style={{ fontSize: 12, marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                {r.verificationType === 'conversation' ? <MessagesSquare size={13} /> : <CircleHelp size={13} />}
                {r.verificationType === 'conversation' ? 'Reviewer chatted with this seller on Neva' : 'Unverified review — no linked interaction'}
              </div>
            </div>
          );
        })}
      </div>

      {!isMe && (
        <div className="card" style={{ padding: '8px 0' }}>
          <div className="lrow danger" onClick={() => { useStore.getState().toggleBlock(id); showToast(blocked ? 'Unblocked' : `${user.displayName} blocked`); }}>
            <div className="ic"><UserX size={20} /></div>
            <div className="tt">{blocked ? 'Unblock' : 'Block'} {user.displayName}</div>
          </div>
          <div className="lrow danger" onClick={() => useUI.setState({ report: { type: 'user', target: id, name: user.displayName } })}>
            <div className="ic"><Flag size={20} /></div>
            <div className="tt">Report {user.displayName}</div>
          </div>
        </div>
      )}
    </>
  );
}

function ListingInfo({ id }: { id: string }) {
  const l = useStore((s) => s.listings[id]);
  const seller = useStore((s) => (l ? s.users[l.sellerId] : undefined));
  const meId = useStore((s) => s.meId);
  const saved = useStore((s) => s.saved.includes(id));
  const blocked = useStore((s) => (l ? s.blocked.includes(l.sellerId) : false));
  const following = useStore((s) => (l ? s.follows.includes(l.sellerId) : false));
  const all = useStore((s) => s.listings);
  const message = useMessage();
  const [img, setImg] = useState(0);
  const [condOpen, setCondOpen] = useState(false);
  const similar = useMemo(
    () => (l ? Object.values(all).filter((x) => x.id !== l.id && x.status === 'active' && x.categoryId === l.categoryId).sort((a, b) => (b.publishedAt ?? b.createdAt) - (a.publishedAt ?? a.createdAt)).slice(0, 6) : []),
    [all, l],
  );

  useEffect(() => {
    const s = useStore.getState();
    if (s.listings[id] && s.listings[id]!.sellerId !== s.meId) s.bumpView(id);
  }, [id]);

  if (!l || l.status === 'removed')
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <ImageOff size={28} className="muted" />
        <div style={{ marginTop: 8 }}>This listing is no longer available.</div>
      </div>
    );
  const mine = l.sellerId === meId;
  const st = useStore.getState;
  const attrs = Object.entries(l.attributes ?? {}).filter(([, v]) => v);
  const specs: [string, string][] = [
    ['Category', categoryLabel(l.categoryId, l.customCategory) + (l.subcategory ? ` · ${l.subcategory}` : '')],
    ...(l.brand ? [['Brand', l.brand] as [string, string]] : []),
    ...(l.model ? [['Model', l.model] as [string, string]] : []),
    ...attrs,
  ];
  const cond = conditionById(l.condition);
  const share = () => shareLink({ title: l.title, text: `${l.title} — ${formatNaira(l.priceMinor)} on Neva`, url: shareUrl('listing', id) });
  const toStatus = () => {
    st().addStory(l.images[0] ? { imageUri: l.images[0], caption: l.title, listingId: id } : { text: `${l.title}\n${formatNaira(l.priceMinor)}`, listingId: id });
    showToast('Posted to your status');
  };

  return (
    <>
      <div className="card" style={{ padding: 0 }}>
        <div style={{ aspectRatio: '4 / 3', background: 'var(--input)', display: 'grid', placeItems: 'center', cursor: l.images[img] ? 'zoom-in' : undefined, position: 'relative' }} onClick={() => l.images[img] && openLightbox(l.images, img)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {l.images[img] ? <img src={l.images[img]} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageOff size={30} className="faint" />}
          {l.status !== 'active' && <span style={{ position: 'absolute', left: 12, top: 12, background: 'rgba(0,0,0,.7)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '4px 8px', borderRadius: 6, textTransform: 'uppercase' }}>{l.status}</span>}
        </div>
        {l.images.length > 1 && (
          <div style={{ display: 'flex', gap: 6, padding: '10px 16px 0', overflowX: 'auto' }}>
            {l.images.map((u, i) => (
              <button key={i} onClick={() => setImg(i)} style={{ width: 54, height: 54, borderRadius: 6, overflow: 'hidden', flexShrink: 0, outline: i === img ? '2px solid var(--accent)' : 'none', outlineOffset: 1 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
            ))}
          </div>
        )}
        <div style={{ padding: '16px 24px 20px' }}>
          <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: -0.4 }}>{formatNaira(l.priceMinor)}</div>
          {l.negotiable && <div className="faint" style={{ fontSize: 12.5 }}>Open to offers</div>}
          <div style={{ fontSize: 17, marginTop: 8, lineHeight: 1.35 }}>{l.title}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, alignItems: 'center' }}>
            <button onClick={() => setCondOpen(true)} title="What does this condition mean?" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Cond c={l.condition} />
              <Info size={14} className="faint" />
            </button>
            <span className="muted" style={{ fontSize: 13, display: 'inline-flex', gap: 4, alignItems: 'center' }}><MapPin size={14} /> {l.area ? `${l.area}, ` : ''}{l.city}</span>
            {l.delivery && <span className="muted" style={{ fontSize: 13, display: 'inline-flex', gap: 4, alignItems: 'center' }}><Truck size={14} /> Delivery</span>}
          </div>
          <div className="faint" style={{ fontSize: 12.5, marginTop: 10 }}>
            Listed {timeAgo(l.publishedAt ?? l.createdAt)}{mine ? ` · ${l.views} views · ${l.saves} saves · ${l.enquiries} chats` : ''}
          </div>

          {mine ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
              <button className="btn primary sm" onClick={() => { st().editListing(id); openSell(id); }}><Pencil size={15} /> Edit</button>
              {l.status === 'active' && <button className="btn line sm" onClick={() => { st().setListingStatus(id, 'sold'); showToast('Marked as sold'); }}><Tag size={15} /> Mark sold</button>}
              {l.status === 'active' ? (
                <button className="btn line sm" onClick={() => { st().setListingStatus(id, 'paused'); showToast('Listing paused'); }}><Pause size={15} /> Pause</button>
              ) : (
                <button className="btn line sm" onClick={() => { st().setListingStatus(id, 'active'); showToast('Listing is live again'); }}><Play size={15} /> {l.status === 'sold' ? 'Relist' : 'Resume'}</button>
              )}
              {l.status === 'active' && <button className="btn line sm" onClick={toStatus}><Aperture size={15} /> Share to my status</button>}
              <button className="btn line sm" onClick={share}><Share2 size={15} /> Share</button>
              <button className="btn danger sm" onClick={() => { if (confirm('Delete this listing?')) { st().setListingStatus(id, 'removed'); close(); showToast('Listing deleted'); } }}><Trash2 size={15} /> Delete</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              {!blocked && l.status === 'active' && (
                <button className="btn primary sm" style={{ flex: 1 }} onClick={() => message(l.sellerId, id)}>
                  <MessageCircle size={16} /> Message seller
                </button>
              )}
              <button className="btn line sm" onClick={() => { st().toggleSave(id); showToast(saved ? 'Removed from saved' : 'Saved'); }}>
                {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />} {saved ? 'Saved' : 'Save'}
              </button>
              <button className="btn line sm" onClick={share} aria-label="Share listing" title="Share">
                <Share2 size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {l.description && (
        <div className="card">
          <div className="muted" style={{ fontSize: 13.5, marginBottom: 6 }}>Description</div>
          <div style={{ lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{l.description}</div>
        </div>
      )}

      <div className="card">
        <div className="muted" style={{ fontSize: 13.5, marginBottom: 10 }}>Details</div>
        <div className="spec">
          {specs.map(([k, v]) => (
            <div key={k}><span>{k}</span><span>{v}</span></div>
          ))}
          <div><span>Handover</span><span>{[l.pickup && 'Pickup', l.delivery && 'Delivery'].filter(Boolean).join(' · ')}</span></div>
        </div>
      </div>

      {seller && (
        <div className="card" style={{ padding: '8px 0' }}>
          <div className="lrow" onClick={() => openDrawer({ kind: 'shop', id: seller.id })}>
            <Avatar user={seller} size={44} online={seller.online} />
            <div className="grow">
              <div className="tt" style={{ display: 'flex', gap: 5, alignItems: 'center' }}>{seller.shopName ?? seller.displayName}<Verified user={seller} /></div>
              <div className="st">@{seller.username}{seller.rating ? ` · ★ ${seller.rating.avg} (${seller.rating.count})` : ''}</div>
            </div>
            {!mine && (
              <button className={`btn sm ${following ? 'line' : 'primary'}`} onClick={(e) => { e.stopPropagation(); st().toggleFollow(seller.id); showToast(following ? `Unfollowed ${seller.displayName}` : `Following ${seller.displayName}`); }}>
                {following ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <div className="faint" style={{ fontSize: 12.5, lineHeight: 1.5 }}>Meet in a public place and inspect the item before paying. Never pay a deposit to someone you haven’t met.</div>
        {!mine && (
          <button className="btn danger sm" style={{ marginTop: 12 }} onClick={() => useUI.setState({ report: { type: 'listing', target: id, name: l.title } })}>
            <Flag size={15} /> Report listing
          </button>
        )}
      </div>

      {similar.length > 0 && (
        <div className="card">
          <div className="muted" style={{ fontSize: 13.5, marginBottom: 10 }}>Similar items</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {similar.map((x) => <ListingCard key={x.id} l={x} />)}
          </div>
        </div>
      )}

      {condOpen && (
        <Modal title={cond.label} onClose={() => setCondOpen(false)} footer={<button className="btn primary" onClick={() => setCondOpen(false)}>Got it</button>}>
          <div style={{ lineHeight: 1.55 }}>{cond.definition}</div>
          <div className="faint" style={{ fontSize: 13, lineHeight: 1.5 }}>This is the seller’s declared condition. If the item doesn’t match, you can report the listing.</div>
        </Modal>
      )}
    </>
  );
}

const Stars = ({ value }: { value: number }) => (
  <span style={{ color: 'var(--accent)', letterSpacing: 1, fontSize: 13, whiteSpace: 'nowrap' }} aria-label={`${value} out of 5`}>
    {'★'.repeat(value)}
    <span className="faint">{'★'.repeat(5 - value)}</span>
  </span>
);

/** Explore grid card. */
export function ListingCard({ l }: { l: Listing }) {
  return (
    <div className="lcard" onClick={() => openDrawer({ kind: 'listing', id: l.id })}>
      <div className="ph">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {l.images[0] ? <img src={l.images[0]} alt="" /> : <ImageOff size={24} />}
        {l.status !== 'active' && <span className="tag">{l.status}</span>}
      </div>
      <div className="info">
        <div className="pr">{formatNaira(l.priceMinor)}</div>
        <div className="ti ellipsis">{l.title}</div>
        <div className="lo ellipsis">{l.city} · {timeAgo(l.publishedAt ?? l.createdAt)}</div>
      </div>
    </div>
  );
}
