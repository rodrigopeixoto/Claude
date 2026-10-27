import { loadEnv } from "@/lib/loadEnv";
import { prisma } from "@/lib/db";
import { SOURCE_TEMPLATES } from "@/lib/sourceTemplates";

loadEnv();

// Example client so the dashboard has something to show. Safe to re-run.
async function main() {
  const existing = await prisma.client.findFirst({ where: { name: "Nubank (exemplo)" } });
  if (existing) {
    console.log("Cliente de exemplo já existe:", existing.id);
    return;
  }
  const client = await prisma.client.create({
    data: {
      name: "Nubank (exemplo)",
      description: "Banco digital brasileiro",
      keywords: ["Nubank", "Nu Holdings"],
      excludeTerms: ["vaga", "vagas"],
      sources: {
        create: [
          { type: "GOOGLE_NEWS", name: "Google News", intervalMinutes: 60, config: { query: "" } },
          { type: "GDELT", name: "GDELT", intervalMinutes: 180, config: SOURCE_TEMPLATES.GDELT.config as object },
          { type: "APP_STORE", name: "App Store BR", intervalMinutes: 360, config: { appId: "814456780", country: "br", pages: 2 } },
          { type: "PLAY_STORE", name: "Google Play BR", intervalMinutes: 360, config: { appId: "com.nu.production", lang: "pt", country: "br", num: 150 } },
        ],
      },
    },
  });
  console.log("Cliente de exemplo criado:", client.id);
}

main().finally(() => prisma.$disconnect());
