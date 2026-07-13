import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pipeline Signal — AI go-to-market agent',
  description: 'Build ICP-matched lead lists from a prompt, track buying-intent signals, and send AI-personalized outreach.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
