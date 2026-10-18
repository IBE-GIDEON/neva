'use client';

import { usePathname } from 'next/navigation';

/**
 * Path-based panel routing: /chats/:id, /updates/:uid, /explore/:listingId, /settings/:section …
 * Every screen lives in the client app, so switching panels uses the browser history API (which Next.js
 * syncs with usePathname) instead of a server round trip — instant, no flicker.
 */
export function useNav() {
  const path = usePathname() || '/';
  const [section = 'chats', id] = path.split('/').filter(Boolean);
  return {
    section,
    id,
    path,
    go: (to: string) => {
      if (to !== window.location.pathname + window.location.search) window.history.pushState(null, '', to);
    },
    replace: (to: string) => window.history.replaceState(null, '', to),
    back: () => window.history.back(),
  };
}
