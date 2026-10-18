import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Neva',
  description: 'Buy and sell gadgets in conversation.',
  icons: { icon: '/neva-mark.png' },
};

export const viewport: Viewport = {
  themeColor: '#111113',
  width: 'device-width',
  initialScale: 1,
};

// Runs before the first paint so the saved theme is applied immediately (no dark→light flash on load).
const themeBoot = `try{var t=(JSON.parse(localStorage.getItem('neva-store-v1')||'{}').state||{}).settings;t=t&&t.theme||'system';if(t==='system')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
