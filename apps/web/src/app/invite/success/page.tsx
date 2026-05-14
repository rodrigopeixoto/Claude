export default function InviteSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 max-w-md w-full text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Calendário conectado!</h1>
        <p className="text-gray-500">
          Sua disponibilidade foi compartilhada de forma anônima. O organizador encontrará o melhor
          horário para todos e você receberá uma confirmação por email.
        </p>
        <p className="text-sm text-gray-400 mt-6">
          Você pode fechar esta janela.
        </p>
      </div>
    </div>
  );
}
