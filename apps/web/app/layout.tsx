import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Virtual Photobooth — Real-Time Multiplayer Photobooth',
  description:
    'Take photos together in real time even when you are miles apart. P2P WebRTC video, synchronized captures, and shared virtual environments.',
  keywords: ['photobooth', 'multiplayer photobooth', 'webrtc', 'virtual photobooth', 'realtime camera'],
  authors: [{ name: 'Virtual Photobooth' }],
  openGraph: {
    title: 'Virtual Photobooth — Pose Together From Anywhere',
    description: 'A playful digital photobooth for friends across the globe with synchronized captures.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#080c14',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#080c14] text-slate-100 min-h-screen antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
