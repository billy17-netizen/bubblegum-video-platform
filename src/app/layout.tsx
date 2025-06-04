import type { Metadata, Viewport } from "next";
import { Chivo, Tinos } from "next/font/google";
import "./globals.css";
import { NextAuthProvider } from "@/providers/NextAuthProvider";
import PWAInstaller from "@/components/PWAInstaller";
import PWARegister from "@/components/PWARegister";
import ExtensionErrorHandler from "@/components/ExtensionErrorHandler";

const chivo = Chivo({ 
  subsets: ["latin"],
  display: "swap",
  preload: true,
  variable: "--font-chivo",
});

const tinos = Tinos({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  preload: true,
  variable: "--font-tinos",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: {
    default: "Bubblegum - Short Video Platform",
    template: "%s | Bubblegum"
  },
  description: "Join Bubblegum, the vibrant short video platform where creativity meets community. Share, discover, and connect through engaging short-form content.",
  keywords: ["short video", "social media", "video sharing", "community", "entertainment", "content creation", "PWA", "mobile app"],
  authors: [{ name: "Bubblegum Team" }],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: process.env.NEXTAUTH_URL || "http://localhost:3000",
    siteName: "Bubblegum",
    title: "Bubblegum - Short Video Platform",
    description: "Join Bubblegum, the vibrant short video platform where creativity meets community.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bubblegum - Short Video Platform",
    description: "Join Bubblegum, the vibrant short video platform where creativity meets community.",
  },
  icons: {
    icon: [
      {
        url: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNCIgZmlsbD0iI2VjNDg5OSIvPjx0ZXh0IHg9IjE2IiB5PSIyMCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjEyIiBmb250LXdlaWdodD0iYm9sZCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iI2ZmZmZmZiI+QjwvdGV4dD48L3N2Zz4=",
        sizes: "32x32",
        type: "image/svg+xml"
      },
      {
        url: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyIiBoZWlnaHQ9IjE5MiIgdmlld0JveD0iMCAwIDE5MiAxOTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iOTYiIGN5PSI5NiIgcj0iODgiIGZpbGw9IiNlYzQ4OTkiLz48dGV4dCB4PSI5NiIgeT0iMTEwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iNjAiIGZvbnQtd2VpZ2h0PSJib2xkIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZmZmZmZmIj5CPC90ZXh0Pjwvc3ZnPg==",
        sizes: "192x192",
        type: "image/svg+xml"
      }
    ],
    apple: [
      {
        url: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgwIiBoZWlnaHQ9IjE4MCIgdmlld0JveD0iMCAwIDE4MCAxODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iOTAiIGN5PSI5MCIgcj0iODUiIGZpbGw9IiNlYzQ4OTkiLz48dGV4dCB4PSI5MCIgeT0iMTA1IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iNTUiIGZvbnQtd2VpZ2h0PSJib2xkIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjZmZmZmZmIj5CPC90ZXh0Pjwvc3ZnPg==",
        sizes: "180x180",
        type: "image/svg+xml"
      }
    ],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bubblegum",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "msapplication-TileColor": "#ec4899",
    "msapplication-tap-highlight": "no",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${chivo.variable} ${tinos.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Chivo:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Tinos:ital,wght@0,400;0,700;1,400;1,700&display=swap" 
          rel="stylesheet"
        />
        <meta name="theme-color" content="#ec4899" />
        <meta name="color-scheme" content="light" />
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </head>
      <body className={`${chivo.className} antialiased`}>
        <NextAuthProvider>
          <ExtensionErrorHandler />
          <PWARegister />
          {children}
          <PWAInstaller />
        </NextAuthProvider>
      </body>
    </html>
  );
}

