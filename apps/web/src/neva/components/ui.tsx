'use client';

import { type Condition, conditionById, initials, type Profile } from '@neva/core';
import { BadgeCheck, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { type MouseEvent as ReactMouseEvent, type ReactNode, useEffect, useRef, useState } from 'react';

import { useLive, useUI } from '../store';

const TONES = ['#5B5BD6', '#3E63DD', '#6E56CF', '#4A5578', '#3A4A6B', '#5D4E8C', '#2F6FB0', '#4B4FA8'];
const hash = (s: string) => Array.from(s).reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

export function Avatar({ user, size = 49, ring, seen, online, onClick }: { user?: Pick<Profile, 'displayName' | 'avatarUri'>; size?: number; ring?: boolean; seen?: boolean; online?: boolean; onClick?: () => void }) {
  const name = user?.displayName ?? '?';
  const face = (
    <div className="avatar" style={{ width: size, height: size, background: TONES[Math.abs(hash(name)) % TONES.length], fontSize: size * 0.38 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {user?.avatarUri ? <img src={user.avatarUri} alt="" /> : initials(name)}
    </div>
  );
  return (
    <div className="av-wrap" onClick={onClick} style={{ cursor: onClick ? 'pointer' : undefined }}>
      {ring ? (
        <div className={`ring${seen ? ' seen' : ''}`}>
          <div>{face}</div>
        </div>
      ) : (
        face
      )}
      {online && <span className="av-online" />}
    </div>
  );
}

export const Verified = ({ user }: { user?: Profile }) =>
  user?.verifications.includes('identity_checked') ? <BadgeCheck size={15} color="var(--accent)" style={{ flexShrink: 0 }} /> : null;

export const Badge = ({ count, muted }: { count: number; muted?: boolean }) => (count ? <span className={`badge${muted ? ' muted' : ''}`}>{count > 99 ? '99+' : count}</span> : null);

export function Cond({ c, short }: { c: Condition; short?: boolean }) {
  const d = conditionById(c);
  const dot = c.startsWith('new') ? 'var(--accent)' : c === 'refurbished' ? '#3b82f6' : 'var(--text2)';
  return (
    <span className="cond">
      <i style={{ background: dot }} />
      {short ? d.short : d.label}
    </span>
  );
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div style={{ padding: '56px 36px', textAlign: 'center', color: 'var(--text2)' }}>
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--input)', display: 'grid', placeItems: 'center', margin: '0 auto 14px', color: 'var(--text)' }}>{icon}</div>
      <div style={{ color: 'var(--text)', fontWeight: 600, fontSize: 16, marginBottom: 6 }}>{title}</div>
      {body && <div style={{ fontSize: 14, lineHeight: 1.5 }}>{body}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, large }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; large?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${large ? ' lg' : ''}`} role="dialog" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export type MenuItem = { label: string; icon?: ReactNode; danger?: boolean; onClick: () => void } | null | false | undefined | '';

/** WhatsApp-style dropdown anchored to its trigger. */
export function Dropdown({ trigger, items, align = 'right', header, onOpenChange }: { trigger: (open: () => void, isOpen: boolean) => ReactNode; items: MenuItem[]; align?: 'left' | 'right'; header?: ReactNode; onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const onChange = useRef(onOpenChange);
  useEffect(() => {
    onChange.current = onOpenChange;
  });
  useEffect(() => onChange.current?.(open), [open]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      {trigger(() => setOpen((o) => !o), open)}
      {open && (
        <div className="menu" style={{ top: '100%', marginTop: 4, [align]: 0 }}>
          {header}
          {items.filter(Boolean).map((it) => {
            const i = it as Exclude<MenuItem, null | false | undefined | ''>;
            return (
              <button key={i.label} className={i.danger ? 'danger' : ''} onClick={() => { setOpen(false); i.onClick(); }}>
                {i.icon}
                {i.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ToastHost() {
  const toast = useLive((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => useLive.setState({ toast: null }), 2400);
    return () => clearTimeout(id);
  }, [toast]);
  return toast ? <div className="toast">{toast.text}</div> : null;
}

const closeLightbox = () => useUI.setState({ lightbox: null });

/** Full-screen photo viewer. Accepts a single image (legacy) or a gallery with prev/next. */
export function Lightbox() {
  const lb = useUI((s) => s.lightbox);
  const images = !lb ? [] : typeof lb === 'string' ? [lb] : lb.images;
  const index = lb && typeof lb !== 'string' ? lb.index : 0;
  const count = images.length;
  useEffect(() => {
    if (!count) return;
    const step = (d: number) => {
      const cur = useUI.getState().lightbox;
      if (cur && typeof cur !== 'string') useUI.setState({ lightbox: { ...cur, index: (cur.index + d + cur.images.length) % cur.images.length } });
    };
    // Capture phase so the drawer / modal / status viewer underneath don't also react.
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft' && count > 1) step(-1);
      else if (e.key === 'ArrowRight' && count > 1) step(1);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [count]);
  if (!count) return null;
  const go = (d: number) => (e: ReactMouseEvent) => {
    e.stopPropagation();
    useUI.setState({ lightbox: { images, index: (index + d + count) % count } });
  };
  const navBtn = { position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 48, height: 48, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.1)', color: '#fff', cursor: 'pointer' } as const;
  return (
    <div className="lightbox" onClick={closeLightbox} role="dialog" aria-label="Photo viewer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={images[index]} alt="" onClick={count > 1 ? go(1) : undefined} style={count > 1 ? { cursor: 'pointer' } : undefined} />
      <button onClick={(e) => { e.stopPropagation(); closeLightbox(); }} aria-label="Close" style={{ position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff', background: 'rgba(255,255,255,.1)' }}>
        <X size={22} />
      </button>
      {count > 1 && (
        <>
          <button onClick={go(-1)} aria-label="Previous photo" style={{ ...navBtn, left: 20 }}>
            <ChevronLeft size={26} />
          </button>
          <button onClick={go(1)} aria-label="Next photo" style={{ ...navBtn, right: 20 }}>
            <ChevronRight size={26} />
          </button>
          <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,.85)', fontSize: 13.5, fontWeight: 500, background: 'rgba(0,0,0,.45)', padding: '4px 12px', borderRadius: 999 }}>
            {index + 1} / {count}
          </div>
        </>
      )}
    </div>
  );
}
