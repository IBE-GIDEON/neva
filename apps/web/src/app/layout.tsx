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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
