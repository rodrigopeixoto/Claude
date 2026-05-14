import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Meet Scheduler',
  description: 'Schedule meetings across Google Calendar and Microsoft Outlook',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
