'use client';

import { usePathname, useRouter } from 'next/navigation';

/** Path-based panel routing: /chats/:id, /updates/:uid, /explore/:listingId, /settings/:section … */
export function useNav() {
  const path = usePathname() || '/';
  const router = useRouter();
  const [section = 'chats', id] = path.split('/').filter(Boolean);
  return { section, id, path, go: (to: string) => router.push(to), replace: (to: string) => router.replace(to), back: () => router.back() };
}
