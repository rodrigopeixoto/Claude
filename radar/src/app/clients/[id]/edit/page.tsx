import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteClient, updateClient } from "@/app/actions";
import { ClientForm } from "@/components/ClientForm";
import { SubmitButton } from "@/components/SubmitButton";
import { prisma } from "@/lib/db";

export default async function EditClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) notFound();
  return (
    <div className="space-y-4">
      <Link href={`/clients/${id}`} className="text-sm text-ink-2 hover:text-ink">← {client.name}</Link>
      <h1 className="text-2xl font-semibold">Editar cliente</h1>
      <ClientForm action={updateClient.bind(null, id)} client={client} />
      <form action={deleteClient.bind(null, id)} className="max-w-2xl">
        <SubmitButton className="btn btn-danger" pendingText="Excluindo…" confirm={`Excluir ${client.name} e todas as menções coletadas? Não dá para desfazer.`}>
          Excluir cliente
        </SubmitButton>
      </form>
    </div>
  );
}
