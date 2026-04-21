import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Voice to Us',
  description: 'Record a voice message and send it to Telegram',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
