import { PERIODS, type StockWithBenchmark } from "@/lib/stocks";
import { Change } from "./Signals";
import { Sparkline } from "./Sparkline";

export function StockPanel({ stock }: { stock: StockWithBenchmark | null }) {
  if (!stock) return null;
  const year = stock.history.filter((q) => q.date.getTime() >= stock.asOf.getTime() - 365 * 86_400_000);
  return (
    <section className="card p-5" id="bolsa">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-ink-2">Ações na bolsa · {stock.ticker}</h2>
          <p className="text-xs text-ink-3">
            Último fechamento {stock.last.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} {stock.currency} em {stock.asOf.toLocaleDateString("pt-BR", { timeZone: "UTC" })}. Fonte: Yahoo Finance.
          </p>
        </div>
        <Sparkline points={year.map((q) => q.close)} width={220} height={44} min={Math.min(...year.map((q) => q.close))} max={Math.max(...year.map((q) => q.close))} label="Cotação em 12 meses" />
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-ink-3">
            <tr>
              <th className="py-1 text-left font-normal"></th>
              {PERIODS.map((p) => <th key={p} className="py-1 text-right font-normal">{p === 365 ? "12 meses" : `${p} dias`}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-line">
              <td className="py-1.5 font-medium">{stock.ticker}</td>
              {PERIODS.map((p) => <td key={p} className="py-1.5 text-right font-medium"><Change value={stock.returns[p]} /></td>)}
            </tr>
            {stock.benchmark && (
              <>
                <tr className="border-t border-line">
                  <td className="py-1.5 text-ink-2">{stock.benchmark.name}</td>
                  {PERIODS.map((p) => <td key={p} className="py-1.5 text-right text-ink-2"><Change value={stock.benchmark!.returns[p]} /></td>)}
                </tr>
                <tr className="border-t border-line">
                  <td className="py-1.5 text-ink-2">Diferença (empresa − índice)</td>
                  {PERIODS.map((p) => <td key={p} className="py-1.5 text-right"><Change value={stock.excess[p]} /></td>)}
                </tr>
              </>
            )}
          </tbody>
        </table>
        {stock.benchmark && (
          <p className="mt-2 text-xs text-ink-3">
            A diferença mostra o que o movimento do mercado não explica. Uma queda grande com diferença perto de zero é efeito de mercado (ex.: o pregão de 26/10/2026, após a eleição); diferença muito negativa aponta algo específico da empresa.
          </p>
        )}
      </div>
    </section>
  );
}
