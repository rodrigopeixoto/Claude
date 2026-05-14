'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const nav = [
    { href: '/app/dashboard', label: 'Dashboard' },
    { href: '/app/meetings/new', label: 'Nova Reunião' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-indigo-600">Meet Scheduler</Link>
        <nav className="flex gap-6">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'text-sm font-medium transition',
                pathname === item.href
                  ? 'text-indigo-600'
                  : 'text-gray-600 hover:text-indigo-600',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">{children}</main>
    </div>
  );
}
