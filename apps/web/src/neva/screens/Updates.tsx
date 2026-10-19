'use client';

import { formatNaira, STATUS_BGS, type Story, timeAgo, STORY_DURATION_MS, STORY_MAX_VIDEO_BYTES, STORY_MAX_VIDEO_SECONDS } from '@neva/core';
import { ArrowLeft, ChevronLeft, ChevronRight, CircleDashed, Flag, ImageOff, ImagePlus, LoaderCircle, MessageCircle, MoreVertical, Plus, SendHorizontal, Store, Trash2, Type, UserPlus, Video, VideoOff, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Avatar, Dropdown, Empty, Modal } from '../components/ui';
import { pickImages } from '../lib/images';
import { useNav } from '../nav';
import { isStoryLive, openDrawer, showToast, useStore, useUI } from '../store';
import { Intro } from './Chats';
import { InfoDrawer } from './Info';

const DURATION = STORY_DURATION_MS;
const REACTIONS = ['😍', '🔥', '😂', '😮', '👏🏽', '💯'];
const WEEK = 7 * 24 * 60 * 60 * 1000;
// Session-wide sound preference for video statuses (muted until the user opts in).
let storyMuted = true;
const SPIN_CSS = '@keyframes neva-story-spin { to { transform: rotate(360deg); } }';

/** Reads a local video's length in seconds; handles recorder webm files that report Infinity until seeked. */
function readVideoSeconds(uri: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    const done = (d: number) => {
      v.onloadedmetadata = v.ontimeupdate = v.onerror = null;
      v.removeAttribute('src');
      v.load();
      if (Number.isFinite(d) && d > 0) resolve(d);
      else reject(new Error('no duration'));
    };
    v.onerror = () => done(NaN);
    v.onloadedmetadata = () => {
      if (Number.isFinite(v.duration)) return done(v.duration);
      v.ontimeupdate = () => done(v.duration);
      v.currentTime = Number.MAX_SAFE_INTEGER;
    };
    v.src = uri;
  });
}

export function UpdatesSection() {
  const { id: userId, go } = useNav();
  const stories = useStore((s) => s.stories);
  const viewed = useStore((s) => s.viewedStories);
  const users = useStore((s) => s.users);
  const meId = useStore((s) => s.meId);
  const drawer = useUI((s) => s.drawer);
  const [composer, setComposer] = useState(false);
  const follows = useStore((s) => s.follows);
  const listings = useStore((s) => s.listings);
  const [since] = useState(() => Date.now() - WEEK);
  const drops = useMemo(() => {
    return Object.values(listings)
      .filter((l) => follows.includes(l.sellerId) && l.status === 'active' && (l.publishedAt ?? l.createdAt) >= since)
      .sort((a, b) => (b.publishedAt ?? b.createdAt) - (a.publishedAt ?? a.createdAt))
      .slice(0, 12);
  }, [listings, follows, since]);

  const groups = useMemo(() => {
    const by: Record<string, Story[]> = {};
    stories.filter((s) => isStoryLive(s) && s.userId !== meId).forEach((s) => (by[s.userId] ??= []).push(s));
    return Object.entries(by)
      .map(([uid, list]) => ({ uid, list, unseen: list.some((s) => !viewed.includes(s.id)), latest: Math.max(...list.map((s) => s.createdAt)) }))
      .sort((a, b) => b.latest - a.latest);
  }, [stories, viewed, meId]);
  const recent = groups.filter((g) => g.unseen);
  const seen = groups.filter((g) => !g.unseen);
  const mine = stories.filter((s) => s.userId === meId && isStoryLive(s));

  const Row = ({ g }: { g: (typeof groups)[number] }) => (
    <div className={`lrow${userId === g.uid ? ' on' : ''}`} onClick={() => go(`/updates/${g.uid}`)}>
      <Avatar user={users[g.uid]} size={44} ring seen={!g.unseen} />
      <div className="grow">
        <div className="tt">{users[g.uid]?.displayName ?? 'Unknown'}</div>
        <div className="st">{timeAgo(g.latest)}</div>
      </div>
    </div>
  );

  return (
    <>
      <div className={`side${userId ? ' hide-sm' : ''}`}>
        <div className="side-head">
          <h1>Updates</h1>
          <button className="icon-btn" title="New status" aria-label="New status" onClick={() => setComposer(true)}>
            <Plus size={22} />
          </button>
        </div>
        <div className="scroll">
          <div className={`lrow${userId === meId ? ' on' : ''}`} onClick={() => (mine.length ? go(`/updates/${meId}`) : setComposer(true))}>
            <div style={{ position: 'relative' }}>
              <Avatar user={users[meId]} size={44} ring={mine.length > 0} seen />
              {!mine.length && <span style={{ position: 'absolute', right: -2, bottom: -2, width: 18, height: 18, borderRadius: '50%', background: 'var(--accent-strong)', color: '#fff', display: 'grid', placeItems: 'center', border: '2px solid var(--panel)' }}><Plus size={11} strokeWidth={3} /></span>}
            </div>
            <div className="grow">
              <div className="tt">My status</div>
              <div className="st">{mine.length ? `${mine.length} update${mine.length > 1 ? 's' : ''} · ${timeAgo(mine[mine.length - 1]!.createdAt)}` : 'Click to add a status update'}</div>
            </div>
          </div>
          {recent.length > 0 && <div className="section-label">Recent</div>}
          {recent.map((g) => <Row key={g.uid} g={g} />)}
          {seen.length > 0 && <div className="section-label">Viewed</div>}
          {seen.map((g) => <Row key={g.uid} g={g} />)}
          {follows.length === 0 && groups.length > 0 && (
            <div className="lrow" onClick={() => go('/explore')}>
              <div className="ic"><UserPlus size={20} /></div>
              <div className="grow">
                <div className="tt">Find sellers to follow</div>
                <div className="st">Their new stock and status updates show up here</div>
              </div>
            </div>
          )}
          {drops.length > 0 && (
            <>
              <div className="section-label">New drops from sellers you follow</div>
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '0 16px 12px' }}>
                {drops.map((l) => (
                  <button key={l.id} onClick={() => openDrawer({ kind: 'listing', id: l.id })} title={l.title} style={{ width: 112, flexShrink: 0, textAlign: 'left' }}>
                    <div style={{ width: 112, height: 112, borderRadius: 10, overflow: 'hidden', background: 'var(--input)', display: 'grid', placeItems: 'center', position: 'relative' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {l.images[0] ? <img src={l.images[0]} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageOff size={18} className="faint" />}
                      <span style={{ position: 'absolute', left: 6, bottom: 6 }}><Avatar user={users[l.sellerId]} size={22} /></span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginTop: 6 }}>{formatNaira(l.priceMinor)}</div>
                    <div className="ellipsis muted" style={{ fontSize: 12 }}>{l.title}</div>
                    <div className="faint" style={{ fontSize: 11.5 }}>{timeAgo(l.publishedAt ?? l.createdAt)}</div>
                  </button>
                ))}
              </div>
            </>
          )}
          {groups.length === 0 && <Empty icon={<CircleDashed size={26} />} title="No updates yet" body="Statuses from people you chat with or follow show up here for 24 hours." action={<button className="btn line sm" onClick={() => go('/explore')}>Find sellers to follow</button>} />}
        </div>
      </div>
      <div className={`main${userId ? '' : ' hide-sm'}`}>
        {userId ? <StoryViewer key={userId} userId={userId} order={[meId, ...recent.map((g) => g.uid), ...seen.map((g) => g.uid)]} onDone={() => go('/updates')} /> : <Intro title="Share status updates" body="Post new stock, price drops and what’s happening at your shop. Updates disappear after 24 hours." />}
      </div>
      {drawer && <InfoDrawer />}
      {composer && <StatusComposer onClose={() => setComposer(false)} />}
    </>
  );
}

function StoryViewer({ userId, order, onDone }: { userId: string; order: string[]; onDone: () => void }) {
  const { go } = useNav();
  const all = useStore((s) => s.stories);
  const user = useStore((s) => s.users[userId]);
  const listings = useStore((s) => s.listings);
  const meId = useStore((s) => s.meId);
  const list = useMemo(() => all.filter((s) => s.userId === userId && isStoryLive(s)).sort((a, b) => a.createdAt - b.createdAt), [all, userId]);
  const [i, setI] = useState(() => {
    const v = useStore.getState().viewedStories;
    const firstUnseen = list.findIndex((s) => !v.includes(s.id));
    return firstUnseen > 0 ? firstUnseen : 0;
  });
  const [progress, setProgress] = useState(0);
  const [held, setHeld] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const releaseHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setHeld(false);
  };
  const [typing, setTyping] = useState(false);
  const [reply, setReply] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const overlay = useUI((s) => !!s.report || !!s.drawer);
  const paused = held || typing || menuOpen || overlay;
  const story = list[i];
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [muted, setMuted] = useState(storyMuted);
  // A video status drives the progress bar from the video itself; a failed one falls back to the timer.
  const isVideo = !!story?.videoUri && !videoFailed;

  // Move to the next person's status when this one ends, like WhatsApp.
  const nextPerson = () => {
    const at = order.indexOf(userId);
    const next = order.slice(at + 1).find((u) => u !== meId);
    if (userId !== meId && next) go(`/updates/${next}`);
    else onDone();
  };
  const forward = () => (i < list.length - 1 ? setI(i + 1) : nextPerson());
  const backward = () => i > 0 && setI(i - 1);

  useEffect(() => {
    if (story) useStore.getState().markStoryViewed(story.id);
    setProgress(0);
    setVideoFailed(false);
    setBuffering(true);
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Video: play/pause with the shared paused state; progress = currentTime / duration.
  useEffect(() => {
    const v = videoRef.current;
    if (!isVideo || !v) return;
    if (paused) {
      v.pause();
      return;
    }
    v.play().catch((e: unknown) => {
      // Sound autoplay blocked by the browser: fall back to muted playback.
      if (e instanceof DOMException && e.name === 'NotAllowedError' && !v.muted) {
        storyMuted = true;
        setMuted(true);
        v.muted = true;
        v.play().catch(() => {});
      }
    });
    let raf = 0;
    const tick = () => {
      const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : story?.videoSeconds;
      if (d && !v.paused) setProgress(Math.min(1, v.currentTime / d));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [story?.id, paused, isVideo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted, story?.id]);
  useEffect(() => {
    if (!story || paused || isVideo) return;
    const start = Date.now() - progress * DURATION;
    const t = setInterval(() => {
      const p = (Date.now() - start) / DURATION;
      if (p >= 1) {
        clearInterval(t);
        forward();
      } else setProgress(p);
    }, 50);
    return () => clearInterval(t);
  }, [story?.id, paused, i, isVideo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (typing || menuOpen || useUI.getState().report || useUI.getState().drawer) return;
      if (e.key === 'Escape') onDone();
      if (e.key === 'ArrowRight') forward();
      if (e.key === 'ArrowLeft') backward();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!story || !user) return <Intro title="No status to show" body="This update has expired." />;
  const listing = story.listingId ? listings[story.listingId] : undefined;
  const sendReply = (body = reply.trim()) => {
    if (!body) return;
    const cid = useStore.getState().startConversation(userId, story.listingId);
    useStore.getState().sendMessage(cid, { type: 'story_reply', body, storyImage: story.videoUri ? undefined : story.imageUri });
    if (body === reply.trim()) setReply('');
    showToast(REACTIONS.includes(body) ? `Reacted ${body}` : 'Reply sent');
  };
  const messageUser = () => {
    const cid = useStore.getState().startConversation(userId);
    go(`/chats/${cid}`);
  };
  const ui = { opacity: held ? 0 : 1 };

  return (
    <div className="status-stage">
      <button className="icon-btn fade-ui" style={{ position: 'absolute', top: 16, right: 16, color: '#fff', ...ui }} onClick={onDone} aria-label="Close">
        <X size={24} />
      </button>
      <button className="icon-btn fade-ui" style={{ position: 'absolute', left: 'calc(50% - min(86vh, 760px) * 9 / 32 - 64px)', color: '#fff', background: 'rgba(255,255,255,.1)', visibility: i > 0 ? 'visible' : 'hidden', ...ui }} onClick={backward} aria-label="Previous">
        <ChevronLeft size={24} />
      </button>
      <button className="icon-btn fade-ui" style={{ position: 'absolute', right: 'calc(50% - min(86vh, 760px) * 9 / 32 - 64px)', color: '#fff', background: 'rgba(255,255,255,.1)', ...ui }} onClick={forward} aria-label="Next">
        <ChevronRight size={24} />
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div
          className="story"
          // Hold to pause (mouse or finger). A short delay keeps quick taps (next/previous) from flashing the UI.
          onPointerDown={() => {
            if (holdTimer.current) clearTimeout(holdTimer.current);
            holdTimer.current = setTimeout(() => setHeld(true), 180);
          }}
          onPointerUp={releaseHold}
          onPointerCancel={releaseHold}
          onPointerLeave={releaseHold}
          onContextMenu={(e) => e.preventDefault()}
          style={{ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'manipulation' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {story.videoUri ? (
            videoFailed ? (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 10, background: '#111', color: 'rgba(255,255,255,.7)', fontSize: 14 }}>
                <VideoOff size={28} />
                Video unavailable
              </div>
            ) : (
              <>
                <video
                  key={story.id}
                  ref={videoRef}
                  src={story.videoUri}
                  playsInline
                  autoPlay
                  muted={muted}
                  preload="auto"
                  onWaiting={() => setBuffering(true)}
                  onPlaying={() => setBuffering(false)}
                  onCanPlay={() => setBuffering(false)}
                  onEnded={() => forward()}
                  onError={() => { setVideoFailed(true); setBuffering(false); setProgress(0); }}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', background: '#000' }}
                />
                {buffering && (
                  <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', color: 'rgba(255,255,255,.75)' }}>
                    <style>{SPIN_CSS}</style>
                    <LoaderCircle size={30} style={{ animation: 'neva-story-spin .9s linear infinite' }} />
                  </div>
                )}
              </>
            )
          ) : story.imageUri ? <img src={story.imageUri} alt="" draggable={false} /> : <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 32, background: story.bg ?? STATUS_BGS[0], color: '#fff', fontSize: 26, fontWeight: 600, textAlign: 'center', lineHeight: 1.3, whiteSpace: 'pre-wrap' }}>{story.text}</div>}
          <div className="bars fade-ui" style={ui}>
            {list.map((s, j) => <div key={s.id}><i style={{ width: `${(j < i ? 1 : j === i ? progress : 0) * 100}%` }} /></div>)}
          </div>
          <div className="fade-ui story-head" style={{ position: 'absolute', top: 22, left: 12, right: 12, display: 'flex', alignItems: 'center', gap: 10, color: '#fff', zIndex: 2, ...ui }}>
            <button className="only-sm" onMouseDown={(e) => e.stopPropagation()} onClick={onDone} aria-label="Close" style={{ color: '#fff', display: 'grid', placeItems: 'center', marginLeft: -4 }}>
              <ArrowLeft size={22} />
            </button>
            <Avatar user={user} size={36} onClick={userId !== meId ? () => openDrawer({ kind: 'shop', id: userId }) : undefined} />
            <div className="grow" style={{ textShadow: '0 1px 6px rgba(0,0,0,.4)' }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{userId === meId ? 'My status' : user.displayName}</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>{timeAgo(story.createdAt)}</div>
            </div>
            {isVideo && (
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => { storyMuted = !muted; setMuted(!muted); if (videoRef.current) videoRef.current.muted = !muted; }}
                aria-label={muted ? 'Unmute' : 'Mute'}
                title={muted ? 'Unmute' : 'Mute'}
                style={{ color: '#fff', display: 'grid', placeItems: 'center', width: 32, height: 32 }}
              >
                {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
              </button>
            )}
            {userId === meId && (
              <button onMouseDown={(e) => e.stopPropagation()} onClick={() => { if (confirm('Delete this status?')) { useStore.getState().deleteStory(story.id); if (list.length <= 1) onDone(); else setI(Math.max(0, i - 1)); } }} style={{ color: '#fff' }} aria-label="Delete status">
                <Trash2 size={19} />
              </button>
            )}
            {userId !== meId && (
              <div onMouseDown={(e) => e.stopPropagation()}>
                <Dropdown
                  onOpenChange={setMenuOpen}
                  trigger={(open) => (
                    <button onClick={open} style={{ color: '#fff', display: 'grid', placeItems: 'center', width: 32, height: 32 }} aria-label="Status options">
                      <MoreVertical size={20} />
                    </button>
                  )}
                  items={[
                    { label: 'Message', icon: <MessageCircle size={17} />, onClick: messageUser },
                    { label: 'View shop', icon: <Store size={17} />, onClick: () => openDrawer({ kind: 'shop', id: userId }) },
                    { label: 'Report status', icon: <Flag size={17} />, danger: true, onClick: () => useUI.setState({ report: { type: 'story', target: story.id, name: user.displayName } }) },
                  ]}
                />
              </div>
            )}
          </div>
          <div style={{ position: 'absolute', inset: '70px 0 100px', display: 'flex' }}>
            <div style={{ flex: 1, cursor: 'w-resize' }} onClick={backward} />
            <div style={{ flex: 2, cursor: 'e-resize' }} onClick={forward} />
          </div>
          {(story.caption || listing) && (
            <div className="fade-ui" style={{ position: 'absolute', left: 12, right: 12, bottom: 16, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', ...ui }}>
              {story.caption && <div style={{ color: '#fff', fontWeight: 500, textAlign: 'center', textShadow: '0 1px 8px rgba(0,0,0,.6)' }}>{story.caption}</div>}
              {listing && (
                <button onMouseDown={(e) => e.stopPropagation()} onClick={() => openDrawer({ kind: 'listing', id: listing.id })} style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(255,255,255,.95)', color: '#000', borderRadius: 12, padding: '6px 12px 6px 6px' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {listing.images[0] && <img src={listing.images[0]} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />}
                  <div style={{ textAlign: 'left' }}>
                    <div className="ellipsis" style={{ fontWeight: 600, fontSize: 13, maxWidth: 200 }}>{listing.title}</div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{formatNaira(listing.priceMinor)}</div>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
        {userId !== meId ? (
          <div className="fade-ui" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: 'min(440px, 92vw)', ...ui }}>
          {!typing && (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
              {REACTIONS.map((e) => (
                <button key={e} onClick={() => sendReply(e)} aria-label={`React ${e}`} style={{ fontSize: 26, lineHeight: 1, width: 44, height: 44, borderRadius: '50%', display: 'grid', placeItems: 'center' }}>
                  {e}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <input
              className="box"
              style={{ background: '#1f1f22', border: '1px solid rgba(255,255,255,.08)', color: '#fff', borderRadius: 22 }}
              placeholder={listing ? 'Ask about this item…' : `Reply to ${user.displayName.split(' ')[0]}…`}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onFocus={() => setTyping(true)}
              onBlur={() => setTyping(false)}
              onKeyDown={(e) => e.key === 'Enter' && sendReply()}
            />
            <button className={`send-btn${reply.trim() ? ' go' : ''}`} style={{ color: '#fff' }} disabled={!reply.trim()} onClick={() => sendReply()} aria-label="Send reply">
              <SendHorizontal size={20} />
            </button>
          </div>
          </div>
        ) : (
          <div className="fade-ui" style={{ color: 'rgba(255,255,255,.7)', fontSize: 13, ...ui }}>{story.viewers ?? 0} views</div>
        )}
      </div>
    </div>
  );
}

function StatusComposer({ onClose }: { onClose: () => void }) {
  const myListings = useStore(useShallow((s) => Object.values(s.listings).filter((l) => l.sellerId === s.meId && l.status === 'active')));
  const [mode, setMode] = useState<'text' | 'photo' | 'video'>('text');
  const [text, setText] = useState('');
  const [bg, setBg] = useState(0);
  const [img, setImg] = useState<string>();
  const [video, setVideo] = useState<{ uri: string; seconds: number }>();
  const [videoError, setVideoError] = useState('');
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Object URLs we created; revoked on unmount unless handed to the store.
  const urls = useRef<{ all: string[]; kept?: string }>({ all: [] });
  useEffect(() => {
    const u = urls.current;
    return () => u.all.forEach((x) => x !== u.kept && URL.revokeObjectURL(x));
  }, []);
  const [caption, setCaption] = useState('');
  const [listingId, setListingId] = useState('');
  const can = mode === 'text' ? !!text.trim() : mode === 'photo' ? !!img : !!video && !reading;
  const pickVideo = async (file?: File) => {
    if (!file) return;
    setVideoError('');
    if (file.type && !file.type.startsWith('video/')) return setVideoError('That file isn’t a video — choose an MP4, MOV or WebM.');
    if (file.size > STORY_MAX_VIDEO_BYTES) return setVideoError('Video is too large (max 50 MB)');
    const uri = URL.createObjectURL(file);
    urls.current.all.push(uri);
    setReading(true);
    try {
      const seconds = await readVideoSeconds(uri);
      // Small tolerance: phone-trimmed clips often land at 30.0x seconds.
      if (seconds > STORY_MAX_VIDEO_SECONDS + 0.5) {
        URL.revokeObjectURL(uri);
        setVideoError(`Videos can be up to ${STORY_MAX_VIDEO_SECONDS} seconds — trim it and try again`);
        return;
      }
      setVideo({ uri, seconds: Math.min(seconds, STORY_MAX_VIDEO_SECONDS) });
    } catch {
      URL.revokeObjectURL(uri);
      setVideoError('Couldn’t read that video — try a different file.');
    } finally {
      setReading(false);
    }
  };
  const post = () => {
    if (!can) return;
    const link = listingId || undefined;
    const cap = caption.trim() || undefined;
    if (mode === 'text') useStore.getState().addStory({ text: text.trim(), bg: STATUS_BGS[bg], listingId: link });
    else if (mode === 'photo') useStore.getState().addStory({ imageUri: img, caption: cap, listingId: link });
    else if (video) {
      urls.current.kept = video.uri;
      useStore.getState().addStory({ videoUri: video.uri, videoSeconds: video.seconds, caption: cap, listingId: link });
    }
    showToast('Status posted · visible for 24 hours');
    onClose();
  };
  return (
    <Modal title="New status" onClose={onClose} footer={<button className="btn primary" disabled={!can} onClick={post}>Post status</button>}>
      <div className="pills" style={{ padding: 0 }}>
        <button className={`pill${mode === 'text' ? ' on' : ''}`} onClick={() => setMode('text')}><Type size={14} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />Text</button>
        <button className={`pill${mode === 'photo' ? ' on' : ''}`} onClick={() => setMode('photo')}><ImagePlus size={14} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />Photo</button>
        <button className={`pill${mode === 'video' ? ' on' : ''}`} onClick={() => setMode('video')}><Video size={14} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />Video</button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/*"
        hidden
        onChange={(e) => { void pickVideo(e.target.files?.[0]); e.target.value = ''; }}
      />
      {mode === 'text' ? (
        <>
          <textarea autoFocus style={{ background: STATUS_BGS[bg], color: '#fff', border: 0, outline: 0, borderRadius: 12, fontSize: 22, fontWeight: 600, textAlign: 'center', minHeight: 200, padding: 24, resize: 'none' }} placeholder="Type a status" maxLength={240} value={text} onChange={(e) => setText(e.target.value)} />
          <div style={{ display: 'flex', gap: 10 }}>
            {STATUS_BGS.map((c, j) => <button key={c} onClick={() => setBg(j)} style={{ width: 26, height: 26, borderRadius: 13, background: c, outline: j === bg ? '2px solid var(--text)' : 'none', outlineOffset: 2 }} aria-label="Background colour" />)}
          </div>
        </>
      ) : mode === 'video' ? (
        <>
          {video ? (
            <div style={{ position: 'relative' }}>
              <video key={video.uri} src={video.uri} controls playsInline muted preload="metadata" style={{ display: 'block', maxHeight: 320, width: '100%', borderRadius: 12, objectFit: 'contain', background: '#000' }} />
              <button className="btn line sm" style={{ position: 'absolute', top: 8, right: 8, background: 'var(--panel)' }} disabled={reading} onClick={() => fileRef.current?.click()}>Change</button>
              <span style={{ position: 'absolute', left: 8, top: 8, background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 12, fontWeight: 600, borderRadius: 6, padding: '2px 6px' }}>0:{String(Math.round(video.seconds)).padStart(2, '0')}</span>
            </div>
          ) : (
            <button className="btn line" style={{ height: 120, borderRadius: 12, borderStyle: 'dashed' }} disabled={reading} onClick={() => fileRef.current?.click()}>
              <Video size={20} /> {reading ? 'Reading video…' : `Choose a video (up to ${STORY_MAX_VIDEO_SECONDS}s)`}
            </button>
          )}
          {videoError && <div role="alert" style={{ color: 'var(--danger)', fontSize: 13 }}>{videoError}</div>}
          <input className="field" placeholder="Add a caption…" maxLength={200} value={caption} onChange={(e) => setCaption(e.target.value)} />
        </>
      ) : (
        <>
          {img ? (
            <div style={{ position: 'relative' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" style={{ maxHeight: 320, width: '100%', borderRadius: 12, objectFit: 'contain', background: '#000' }} />
              <button className="btn line sm" style={{ position: 'absolute', top: 8, right: 8, background: 'var(--panel)' }} onClick={async () => setImg((await pickImages())[0] ?? img)}>Change</button>
            </div>
          ) : (
            <button className="btn line" style={{ height: 120, borderRadius: 12, borderStyle: 'dashed' }} onClick={async () => setImg((await pickImages())[0])}>
              <ImagePlus size={20} /> Choose a photo
            </button>
          )}
          <input className="field" placeholder="Add a caption…" maxLength={200} value={caption} onChange={(e) => setCaption(e.target.value)} />
        </>
      )}
      {myListings.length > 0 && (
        <div>
          <label className="flabel">Link a listing (optional)</label>
          <select className="box" value={listingId} onChange={(e) => setListingId(e.target.value)}>
            <option value="">None</option>
            {myListings.map((l) => <option key={l.id} value={l.id}>{l.title} · {formatNaira(l.priceMinor)}</option>)}
          </select>
        </div>
      )}
      <div className="faint" style={{ fontSize: 12.5 }}>Your status is visible to {useStore.getState().settings.statusPrivacy === 'everyone' ? 'everyone' : useStore.getState().settings.statusPrivacy === 'nobody' ? 'nobody' : 'your followers'} for 24 hours.</div>
    </Modal>
  );
}

