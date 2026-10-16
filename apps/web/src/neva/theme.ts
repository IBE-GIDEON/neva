'use client';

import { useEffect, useState } from 'react';

import { useStore } from './store';

/** Resolves system/dark/light and applies it as <html data-theme="…"> for globals.css. */
export function useApplyTheme() {
  const pref = useStore((s) => s.settings.theme);
  const [systemLight, setSystemLight] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    setSystemLight(mq.matches);
    const on = () => setSystemLight(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const mode = pref === 'system' ? (systemLight ? 'light' : 'dark') : pref;
  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'dark' ? '#111113' : '#ffffff');
  }, [mode]);
  return mode;
}
