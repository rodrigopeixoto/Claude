"use server";

import type { SourceType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { refreshHealth } from "@/lib/health/compute";
import { SOURCE_TEMPLATES } from "@/lib/sourceTemplates";
import { generateStrategy } from "@/lib/strategy";
import { collectNow } from "@/worker/cycle";

function list(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function clientData(form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  const keywords = list(form.get("keywords"));
  if (!name) throw new Error("Nome obrigatório");
  if (keywords.length === 0) throw new Error("Informe ao menos uma palavra-chave");
  return {
    name,
    description: String(form.get("description") ?? "").trim() || null,
    keywords,
    excludeTerms: list(form.get("excludeTerms")),
  };
}

export async function createClient(form: FormData) {
  const data = clientData(form);
  const defaults = form.get("defaultSources") === "on";
  const client = await prisma.client.create({
    data: {
      ...data,
      sources: defaults
        ? {
            create: (["GOOGLE_NEWS", "GDELT"] as const).map((type) => ({
              type,
              name: SOURCE_TEMPLATES[type].label,
              intervalMinutes: SOURCE_TEMPLATES[type].intervalMinutes,
              config: SOURCE_TEMPLATES[type].config as object,
            })),
          }
        : undefined,
    },
  });
  revalidatePath("/");
  redirect(`/clients/${client.id}/sources`);
}

export async function updateClient(id: string, form: FormData) {
  await prisma.client.update({ where: { id }, data: clientData(form) });
  revalidatePath("/");
  redirect(`/clients/${id}`);
}

export async function deleteClient(id: string) {
  await prisma.client.delete({ where: { id } });
  revalidatePath("/");
  redirect("/");
}

export type SourceFormState = { error?: string; ok?: boolean };

export async function saveSource(_prev: SourceFormState, form: FormData): Promise<SourceFormState> {
  const id = String(form.get("id") ?? "") || null;
  const clientId = String(form.get("clientId"));
  const type = String(form.get("type")) as SourceType;
  if (!(type in SOURCE_TEMPLATES)) return { error: "Tipo inválido" };
  let config: unknown;
  try {
    config = JSON.parse(String(form.get("config") || "{}"));
  } catch {
    return { error: "Configuração não é um JSON válido" };
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) return { error: "Configuração deve ser um objeto JSON" };
  const interval = Number(form.get("intervalMinutes"));
  const data = {
    type,
    name: String(form.get("name") ?? "").trim() || SOURCE_TEMPLATES[type].label,
    intervalMinutes: Number.isFinite(interval) && interval >= 15 ? Math.round(interval) : 15,
    config: config as object,
    enabled: form.get("enabled") === "on",
  };
  if (id) await prisma.source.update({ where: { id }, data });
  else await prisma.source.create({ data: { ...data, clientId } });
  revalidatePath(`/clients/${clientId}/sources`);
  revalidatePath("/sources");
  return { ok: true };
}

export async function toggleSource(id: string) {
  const s = await prisma.source.findUniqueOrThrow({ where: { id } });
  await prisma.source.update({ where: { id }, data: { enabled: !s.enabled } });
  revalidatePath(`/clients/${s.clientId}/sources`);
  revalidatePath("/sources");
}

export async function deleteSource(id: string) {
  const s = await prisma.source.delete({ where: { id } });
  revalidatePath(`/clients/${s.clientId}/sources`);
  revalidatePath("/sources");
}

export async function runSourceNow(id: string) {
  const result = await collectNow(id);
  const s = await prisma.source.findUniqueOrThrow({ where: { id }, select: { clientId: true } });
  revalidatePath(`/clients/${s.clientId}`, "layout");
  revalidatePath("/sources");
  revalidatePath("/");
  return result;
}

export async function acknowledgeAlert(id: string) {
  const a = await prisma.alert.update({ where: { id }, data: { acknowledged: true } });
  revalidatePath("/alerts");
  revalidatePath(`/clients/${a.clientId}`);
  revalidatePath("/");
}

export async function acknowledgeAll() {
  await prisma.alert.updateMany({ where: { acknowledged: false }, data: { acknowledged: true } });
  revalidatePath("/", "layout");
}

/** Human feedback: hide an off-topic mention (homonym, spam) from metrics, or bring it back. */
export async function toggleRelevant(mentionId: string) {
  const m = await prisma.mention.findUniqueOrThrow({ where: { id: mentionId } });
  await prisma.mention.update({ where: { id: mentionId }, data: { relevant: !m.relevant } });
  await refreshHealth([m.clientId]);
  revalidatePath(`/clients/${m.clientId}`);
  revalidatePath("/");
}

export type StrategyState = { error?: string; ok?: boolean };

export async function generateStrategyAction(clientId: string, _prev: StrategyState): Promise<StrategyState> {
  try {
    await generateStrategy(clientId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/");
  return { ok: true };
}
