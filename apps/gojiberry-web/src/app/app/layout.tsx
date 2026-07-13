'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { setAuthToken } from '@/lib/api';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      router.replace('/login');
      return;
    }
    setReady(true);
  }, [router]);

  const nav = [
    { href: '/app/dashboard', label: 'Dashboard' },
    { href: '/app/icp/new', label: 'Novo ICP' },
    { href: '/app/leads', label: 'Leads' },
    { href: '/app/campaigns', label: 'Campanhas' },
  ];

  function logout() {
    setAuthToken(null);
    router.replace('/login');
  }

  if (!ready) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-brand-ink">Pipeline Signal</Link>
        <nav className="flex items-center gap-6">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'text-sm font-medium transition',
                pathname === item.href ? 'text-brand-dark' : 'text-gray-600 hover:text-brand-dark',
              )}
            >
              {item.label}
            </Link>
          ))}
          <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-700">
            Sair
          </button>
        </nav>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">{children}</main>
    </div>
  );
}
