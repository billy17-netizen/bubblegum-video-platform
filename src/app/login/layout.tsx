import { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Login - Bubblegum',
  description: 'Join the Bubblegum community. Login with your authentication code to access our short video platform.',
  keywords: 'login, bubblegum, short video, community, social media',
  openGraph: {
    title: 'Login - Bubblegum',
    description: 'Join the Bubblegum community',
    type: 'website',
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
} 