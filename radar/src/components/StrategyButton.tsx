"use client";

import { useActionState } from "react";
import { generateStrategyAction, type StrategyState } from "@/app/actions";
import { SubmitButton } from "./SubmitButton";

export function StrategyButton({ clientId, hasReport }: { clientId: string; hasReport: boolean }) {
  const [state, action] = useActionState<StrategyState, FormData>(generateStrategyAction.bind(null, clientId), {});
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <SubmitButton className="btn" pendingText="Analisando… (até 1 min)">
        {hasReport ? "Gerar nova leitura" : "Gerar leitura estratégica"}
      </SubmitButton>
      {state.error && <p className="max-w-sm text-right text-xs" style={{ color: "var(--critical)" }}>{state.error}</p>}
    </form>
  );
}
