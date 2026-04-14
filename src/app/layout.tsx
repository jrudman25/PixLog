import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { ToastProvider } from '@/components/providers/ToastProvider';
import InstallBanner from '@/components/layout/InstallBanner';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PixLog — Shared Photo Timelines',
  description:
    'Create collaborative photo timelines with friends and family. Upload photos, extract metadata, and relive memories in chronological order.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PixLog',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  openGraph: {
    title: 'PixLog — Shared Photo Timelines',
    description: 'Create collaborative photo timelines with friends.',
    siteName: 'PixLog',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a0b',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <AuthProvider>
          <ToastProvider>
            {children}
            <InstallBanner />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
