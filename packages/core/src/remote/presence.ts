/**
 * Online / last seen, WhatsApp-style, via Supabase Realtime Presence.
 * You show as online while the app is open in the foreground. Turning off "Show last seen & online"
 * hides yours and hides everyone else's from you. last_seen_at on profiles is refreshed while you're online.
 */
import { ME_ID } from '../constants';
import { useLive } from '../store';
import type { Ctx } from './context';

const HEARTBEAT_MS = 60_000;

export function startPresence(ctx: Ctx): () => void {
  const channel = ctx.sb.channel('neva-online', { config: { presence: { key: ctx.userId } } });
  const online = new Set<string>();
  let tracked = false;
  let subscribed = false;

  const showing = () => ctx.store.getState().settings.showLastSeen;
  const wantOnline = () => showing() && useLive.getState().foreground;

  const bumpLastSeen = () => {
    if (!showing() || !ctx.alive) return;
    void ctx.sb.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', ctx.userId).then(() => {});
  };

  /** Copy the presence set onto store users (others only). */
  const apply = () => {
    const show = showing();
    ctx.store.setState((s) => {
      let changed = false;
      const users = { ...s.users };
      for (const [id, u] of Object.entries(users)) {
        if (id === ME_ID) continue;
        const on = show && online.has(id);
        if (!!u.online !== on) {
          users[id] = { ...u, online: on, lastSeenAt: on ? u.lastSeenAt : u.online ? Date.now() : u.lastSeenAt };
          changed = true;
        }
      }
      return changed ? { users } : {};
    });
  };

  const syncTracking = async () => {
    if (!subscribed || !ctx.alive) return;
    if (wantOnline() && !tracked) {
      tracked = true;
      await channel.track({ at: Date.now() }).catch(() => (tracked = false));
      bumpLastSeen();
    } else if (!wantOnline() && tracked) {
      tracked = false;
      await channel.untrack().catch(() => {});
      bumpLastSeen();
    }
  };

  channel
    .on('presence', { event: 'sync' }, () => {
      online.clear();
      for (const key of Object.keys(channel.presenceState())) if (key !== ctx.userId) online.add(key);
      apply();
    })
    .subscribe((status) => {
      subscribed = status === 'SUBSCRIBED';
      if (subscribed) void syncTracking();
    });

  const beat = setInterval(() => {
    if (wantOnline()) bumpLastSeen();
  }, HEARTBEAT_MS);

  const unsubLive = useLive.subscribe((s, p) => {
    if (s.foreground !== p.foreground) void syncTracking();
  });
  let userCount = Object.keys(ctx.store.getState().users).length;
  const unsubStore = ctx.store.subscribe((s, p) => {
    if (s.settings.showLastSeen !== p.settings.showLastSeen) {
      void syncTracking();
      apply();
    }
    const n = Object.keys(s.users).length;
    if (n !== userCount) {
      userCount = n;
      apply(); // people added later (search, new chats) pick up their online state
    }
  });

  return () => {
    clearInterval(beat);
    unsubLive();
    unsubStore();
    bumpLastSeen();
    void ctx.sb.removeChannel(channel).catch(() => {});
  };
}
