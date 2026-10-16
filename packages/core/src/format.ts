export const formatNaira = (minor: number) => '₦' + Math.round(minor / 100).toLocaleString('en-NG');

export const formatCompactNaira = (minor: number) => {
  const n = minor / 100;
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2).replace(/\.?0+$/, '')}M`;
  if (n >= 1000) return `₦${Math.round(n / 1000)}k`;
  return `₦${n}`;
};

export const compactNumber = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k` : `${n}`);

const pad = (n: number) => String(n).padStart(2, '0');

export const clockTime = (ts: number) => {
  const d = new Date(ts);
  let h = d.getHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${pad(d.getMinutes())} ${ap}`;
};

const startOfDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** WhatsApp-style inbox timestamp */
export const inboxTime = (ts: number, now = Date.now()) => {
  const diffDays = Math.round((startOfDay(now) - startOfDay(ts)) / 86_400_000);
  if (diffDays === 0) return clockTime(ts);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return DAYS[new Date(ts).getDay()];
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
};

export const dayLabel = (ts: number, now = Date.now()) => {
  const diffDays = Math.round((startOfDay(now) - startOfDay(ts)) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return DAYS[new Date(ts).getDay()];
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

export const isSameDay = (a: number, b: number) => startOfDay(a) === startOfDay(b);

export const timeAgo = (ts: number, now = Date.now()) => {
  const s = Math.max(1, Math.floor((now - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
};

export const lastSeen = (online?: boolean, ts?: number, now = Date.now()) => {
  if (online) return 'online';
  if (!ts) return '';
  const diffDays = Math.round((startOfDay(now) - startOfDay(ts)) / 86_400_000);
  if (diffDays === 0) return `last seen today at ${clockTime(ts)}`;
  if (diffDays === 1) return `last seen yesterday at ${clockTime(ts)}`;
  return `last seen ${inboxTime(ts, now)}`;
};

export const initials = (name: string) =>
  name
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/** UUID v4 — matches the database's uuid primary keys, so ids made offline are valid server ids. The prefix is ignored (kept for call-site readability). */
export const uid = (_prefix = 'id') => {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

export const caseId = () => `NV-${Math.random().toString(36).slice(2, 6).toUpperCase()}${Date.now().toString().slice(-4)}`;
