import { createClient } from "@/app/actions";
import { ClientForm } from "@/components/ClientForm";

export default function NewClient() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Novo cliente</h1>
      <ClientForm action={createClient} />
    </div>
  );
}
