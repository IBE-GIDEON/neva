import type { SupabaseClient } from '@supabase/supabase-js';

import { ME_ID } from '../constants';
import { setSyncHealth, showToast, type NevaStore } from '../store';

export type Bucket = 'avatars' | 'listing-media' | 'stories' | 'chat-media';

/**
 * Platform upload. Receives a local image (a `data:` URL on web; on mobile also `file://` / `content://` /
 * `ph://` URIs from the image picker) and must store it at exactly `path` inside `bucket`
 * (path always starts with `<auth uid>/`). Resolves with the storage path that was written.
 */
export type UploadImage = (bucket: Bucket, path: string, dataUrl: string) => Promise<string>;

export type Ctx = {
  store: NevaStore;
  sb: SupabaseClient;
  userId: string;
  upload: UploadImage;
  /** Columns / policies from supabase/migrations/0003_sync.sql are present. */
  v3: boolean;
  alive: boolean;
  /** Local conversation id ⇄ server conversation id (only differs in rare reconciliation cases). */
  convL2R: Map<string, string>;
  convR2L: Map<string, string>;
  /** Local conversation ids that exist on the server. */
  confirmedConvs: Set<string>;
  /** In-flight start_conversation calls keyed by local id. */
  pendingConvs: Map<string, Promise<string>>;
  /** Listing ids that exist on the server. */
  remoteListings: Set<string>;
  /** Review ids that exist on the server. */
  remoteReviews: Set<string>;
  timers: Set<ReturnType<typeof setTimeout>>;
};

/* ---------- id mapping (boundary only) ---------- */
export const toLocalUser = (ctx: Ctx, id: string) => (id === ctx.userId ? ME_ID : id);
export const toRemoteUser = (ctx: Ctx, id: string) => (id === ME_ID ? ctx.userId : id);
export const toLocalConv = (ctx: Ctx, id: string) => ctx.convR2L.get(id) ?? id;
export const toRemoteConv = (ctx: Ctx, id: string) => ctx.convL2R.get(id) ?? id;

export const isUuid = (s: string | undefined | null): s is string =>
  !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export const ts = (iso: string | null | undefined) => (iso ? Date.parse(iso) : undefined);
export const iso = (ms: number) => new Date(ms).toISOString();

/* ---------- storage ---------- */
export const isLocalUri = (u: string | undefined | null): u is string => !!u && /^(data|file|content|blob|ph|assets-library):/i.test(u);

/** Public URL for a stored path. Absolute URLs (e.g. a Google avatar) are passed through. */
export const publicUrl = (ctx: Ctx, bucket: Bucket, path: string | null | undefined): string | undefined => {
  if (!path) return undefined;
  if (/^(https?|data):/i.test(path)) return path;
  return ctx.sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
};

/** Reverse of publicUrl / signed URL for our own buckets; other absolute URLs are returned unchanged. */
export const pathFromUrl = (ctx: Ctx, bucket: Bucket, url: string): string => {
  const base = ctx.sb.storage.from(bucket).getPublicUrl('x').data.publicUrl.slice(0, -1); // …/object/public/<bucket>/
  if (url.startsWith(base)) return decodeURIComponent(url.slice(base.length).split('?')[0]!);
  const signed = base.replace('/object/public/', '/object/sign/');
  if (url.startsWith(signed)) return decodeURIComponent(url.slice(signed.length).split('?')[0]!);
  return url;
};

const extOf = (uri: string) => {
  const m = /^data:image\/(png|webp|jpe?g)/i.exec(uri) ?? /\.(png|webp|jpe?g)(\?|$)/i.exec(uri);
  const e = (m?.[1] ?? 'jpg').toLowerCase();
  return e === 'jpeg' ? 'jpg' : e;
};

/** Upload a local image if needed and return the value to store in a *_path column. */
export const storeImage = async (ctx: Ctx, bucket: Bucket, uri: string | undefined, name: string): Promise<string | null> => {
  if (!uri) return null;
  if (!isLocalUri(uri)) return pathFromUrl(ctx, bucket, uri);
  return ctx.upload(bucket, `${ctx.userId}/${name}.${extOf(uri)}`, uri);
};

/* ---------- errors ---------- */
type ErrLike = { code?: string; message?: string; status?: number; statusCode?: string | number } | null | undefined;

export const errCode = (e: unknown) => String((e as ErrLike)?.code ?? '');
const errMsg = (e: unknown) => String((e as ErrLike)?.message ?? e ?? '');

export const isNetworkError = (e: unknown) => {
  const msg = errMsg(e);
  return !errCode(e) && /fetch|network|timed? ?out|offline|abort|connection|load failed/i.test(msg);
};

/** Column / function / policy from 0003 not deployed yet. */
export const isSchemaMissing = (e: unknown) => ['42703', 'PGRST204', 'PGRST202', '42883', '42P01'].includes(errCode(e));

export const friendly = (e: unknown, fallback: string): string => {
  setSyncHealth({ lastError: `${fallback} — ${(e as { message?: string })?.message ?? String(e)}` });
  const msg = errMsg(e);
  if (isNetworkError(e)) return `${fallback} You seem to be offline.`;
  if (/rate_limited/.test(msg)) return 'You’re doing that too fast. Try again in a minute.';
  if (/blocked/.test(msg)) return 'You can’t message this person.';
  if (/listing unavailable/.test(msg)) return 'This listing is no longer available.';
  if (/removed listings/.test(msg)) return 'This listing was removed by moderation.';
  return fallback;
};

const recentToasts = new Map<string, number>();
/** showToast, but identical messages are shown at most once every 4 s (e.g. many messages failing offline). */
export const toast = (text: string, icon?: string) => {
  const now = Date.now();
  if ((recentToasts.get(text) ?? 0) > now - 4000) return;
  recentToasts.set(text, now);
  showToast(text, icon ?? 'alert-circle-outline');
};

/** Await a supabase builder and throw its error. */
export async function q<T>(b: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await b;
  if (error) throw error;
  return data;
}

export const chunk = <T,>(arr: T[], n = 100): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

export const uniq = <T,>(arr: (T | null | undefined)[]): T[] => [...new Set(arr.filter((x): x is T => x != null))];

/** Run a `.in(col, ids)` query in chunks and concatenate the rows. */
export async function selectIn<R>(ids: string[], run: (part: string[]) => PromiseLike<{ data: R[] | null; error: unknown }>): Promise<R[]> {
  if (!ids.length) return [];
  const parts = await Promise.all(chunk(ids).map((p) => q(run(p))));
  return parts.flatMap((p) => p ?? []);
}

export const later = (ctx: Ctx, ms: number, fn: () => void) => {
  const t = setTimeout(() => {
    ctx.timers.delete(t);
    if (ctx.alive) fn();
  }, ms);
  ctx.timers.add(t);
  return t;
};
