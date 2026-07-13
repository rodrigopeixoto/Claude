'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi, setAuthToken } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.login(email, password);
      setAuthToken(data.token);
      router.push('/app/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Falha ao entrar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white p-8 rounded-xl border border-gray-200">
        <Link href="/" className="text-lg font-bold text-brand-ink">Pipeline Signal</Link>
        <h1 className="text-xl font-semibold mt-4 mb-6">Entrar</h1>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-6 text-sm"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand text-white rounded-lg py-2.5 font-semibold hover:bg-brand-dark transition disabled:opacity-50"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="text-sm text-gray-500 mt-4 text-center">
          Não tem conta?{' '}
          <Link href="/register" className="text-brand-dark font-medium">Criar conta</Link>
        </p>
      </form>
    </main>
  );
}
