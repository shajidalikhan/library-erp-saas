import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

import { AppProviders } from '@/providers';
import { ENV } from '@/lib/env';
import '@/styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: `${ENV.APP_NAME} — Modern Self Study Library ERP`,
    template: `%s · ${ENV.APP_NAME}`,
  },
  description:
    'Multi-tenant Self Study Library ERP. Manage students, seats, attendance, payments, reports, and staff from one professional dashboard.',
  metadataBase: new URL(ENV.APP_URL),
  applicationName: ENV.APP_NAME,
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1220' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
