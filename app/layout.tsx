import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  ),
  title: 'AnyTone Codeplug Visualizer',
  description:
    'Explore AnyTone CPS channels, zones, scan lists, and DMR talkgroups before changing a codeplug.',
  openGraph: {
    title: 'AnyTone Codeplug Visualizer',
    description: 'Understand zones, scan lists, and DMR talkgroups.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AnyTone Codeplug Visualizer',
    description: 'Understand zones, scan lists, and DMR talkgroups.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
