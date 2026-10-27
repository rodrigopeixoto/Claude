/**
 * One-command local runner: embedded Postgres + dashboard + worker.
 * Started by Radar.command (macOS) or `npm run local`. Ctrl+C stops everything.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { loadEnv } from "../src/lib/loadEnv";

const ROOT = path.resolve(import.meta.dirname, "..");
process.chdir(ROOT);
loadEnv();

const BIN = path.join(ROOT, "node_modules", ".bin");
const children: ChildProcess[] = [];
let pg: EmbeddedPostgres | null = null;

function log(msg: string) {
  console.log(`\x1b[36m[radar]\x1b[0m ${msg}`);
}

function run(cmd: string, args: string[]) {
  const r = spawnSync(path.join(BIN, cmd), args, { stdio: "inherit", env: process.env });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} falhou`);
}

function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer().once("error", () => resolve(false));
    srv.listen(port, () => srv.close(() => resolve(true)));
  });
}

async function firstFreePort(start: number) {
  for (let p = start; p < start + 20; p++) if (await portFree(p)) return p;
  throw new Error(`Nenhuma porta livre entre ${start} e ${start + 19}`);
}

async function startDatabase() {
  if (process.env.DATABASE_URL) {
    log("Usando DATABASE_URL do .env");
    return;
  }
  const dataDir = path.join(ROOT, "data", "pg");
  const port = await firstFreePort(54329);
  const pgLog: string[] = [];
  pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "radar",
    password: "radar",
    port,
    persistent: true,
    // Builtin UTF-8 locale (Postgres 17) behaves the same on every machine, whatever locales the OS has.
    initdbFlags: ["--encoding=UTF8", "--locale=C", "--locale-provider=builtin", "--builtin-locale=C.UTF-8", "--lc-messages=C"],
    onLog: (m) => void pgLog.push(String(m)),
    onError: (m) => void pgLog.push(String(m)),
  });
  try {
    if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
      log("Criando banco local (só na primeira vez)…");
      await pg.initialise();
    }
    await pg.start();
  } catch (err) {
    console.error(pgLog.slice(-20).join("\n"));
    throw err;
  }
  try {
    await pg.createDatabase("radar");
  } catch {
    // already exists
  }
  process.env.DATABASE_URL = `postgresql://radar:radar@localhost:${port}/radar`;
  log(`Banco local rodando na porta ${port} (dados em ./data/pg)`);
}

function startChild(name: string, cmd: string, args: string[], env: NodeJS.ProcessEnv) {
  const child = spawn(path.join(BIN, cmd), args, { env, stdio: ["ignore", "pipe", "pipe"] });
  const prefix = `\x1b[90m[${name}]\x1b[0m `;
  const pipe = (stream: NodeJS.ReadableStream, out: NodeJS.WriteStream) =>
    stream.on("data", (d: Buffer) => out.write(d.toString().replace(/^(?=.)/gm, prefix)));
  pipe(child.stdout!, process.stdout);
  pipe(child.stderr!, process.stderr);
  child.on("exit", (code) => {
    if (!shuttingDown) {
      log(`${name} parou (código ${code}); encerrando`);
      shutdown(1);
    }
  });
  children.push(child);
}

async function waitForHttp(url: string, timeoutMs = 60_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

let shuttingDown = false;
async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log("Encerrando…");
  for (const c of children) c.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 1500));
  if (pg) await pg.stop().catch(() => {});
  process.exit(code);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
// Closing the Terminal window on macOS sends SIGHUP.
process.on("SIGHUP", () => shutdown(0));

async function main() {
  await startDatabase();

  log("Atualizando estrutura do banco…");
  run("prisma", ["db", "push", "--skip-generate"]);
  // First run only: load the client list from prisma/clientes.json.
  run("tsx", ["prisma/seed.ts"]);

  if (!existsSync(path.join(ROOT, ".next", "BUILD_ID")) || process.argv.includes("--rebuild")) {
    log("Preparando o painel (só na primeira vez, ~1 min)…");
    run("next", ["build"]);
  }

  const port = await firstFreePort(Number(process.env.PORT) || 3000);
  const env = { ...process.env, NODE_ENV: "production" as const, PORT: String(port) };
  startChild("painel", "next", ["start", "-p", String(port)], env);
  startChild("worker", "tsx", ["src/worker/index.ts"], env);

  const url = `http://localhost:${port}`;
  if (await waitForHttp(url)) {
    log(`Pronto: ${url}`);
    log("Deixe esta janela aberta enquanto usa o Radar. Para parar: Ctrl+C ou feche a janela.");
    if (process.platform === "darwin") spawn("open", [url], { stdio: "ignore", detached: true }).unref();
  } else {
    log(`O painel demorou para responder; tente abrir ${url} manualmente.`);
  }
}

main().catch(async (err) => {
  console.error(err);
  await shutdown(1);
});
