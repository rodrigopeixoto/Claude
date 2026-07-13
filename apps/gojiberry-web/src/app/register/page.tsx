'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi, setAuthToken } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.register(email, name, password, companyName);
      setAuthToken(data.token);
      router.push('/app/dashboard');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Falha ao criar conta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white p-8 rounded-xl border border-gray-200">
        <Link href="/" className="text-lg font-bold text-brand-ink">Pipeline Signal</Link>
        <h1 className="text-xl font-semibold mt-4 mb-6">Criar conta</h1>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">Empresa (opcional)</label>
        <input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 text-sm"
        />

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
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-6 text-sm"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand text-white rounded-lg py-2.5 font-semibold hover:bg-brand-dark transition disabled:opacity-50"
        >
          {loading ? 'Criando...' : 'Criar conta'}
        </button>

        <p className="text-sm text-gray-500 mt-4 text-center">
          Já tem conta?{' '}
          <Link href="/login" className="text-brand-dark font-medium">Entrar</Link>
        </p>
      </form>
    </main>
  );
}
