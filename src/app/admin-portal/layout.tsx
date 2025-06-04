import { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Admin Portal - Bubblegum',
  description: 'Secure administrator access portal for Bubblegum platform',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
} 