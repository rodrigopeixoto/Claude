#!/bin/bash
# Radar de Clientes — duplo clique para abrir (macOS).
# Instala o que faltar na primeira vez (Node portátil, dependências, banco embutido)
# e abre o painel no navegador. Feche esta janela ou aperte Ctrl+C para parar.
set -euo pipefail
cd "$(dirname "$0")"

NODE_VERSION="22.12.0"
RUNTIME_DIR="$PWD/.runtime"

say() { printf "\033[36m[radar]\033[0m %s\n" "$1"; }

node_ok() {
  command -v node >/dev/null 2>&1 && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ]
}

if [ -x "$RUNTIME_DIR/node/bin/node" ]; then
  export PATH="$RUNTIME_DIR/node/bin:$PATH"
elif ! node_ok; then
  case "$(uname -m)" in
    arm64) ARCH="arm64" ;;
    x86_64) ARCH="x64" ;;
    *) say "Arquitetura $(uname -m) não suportada"; exit 1 ;;
  esac
  case "$(uname -s)" in
    Darwin) OS="darwin" ;;
    Linux) OS="linux" ;;
    *) say "Sistema $(uname -s) não suportado"; exit 1 ;;
  esac
  say "Baixando Node.js $NODE_VERSION (só na primeira vez)…"
  mkdir -p "$RUNTIME_DIR"
  curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-$OS-$ARCH.tar.gz" | tar -xz -C "$RUNTIME_DIR"
  mv "$RUNTIME_DIR/node-v$NODE_VERSION-$OS-$ARCH" "$RUNTIME_DIR/node"
  export PATH="$RUNTIME_DIR/node/bin:$PATH"
fi

if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  say "Instalando dependências (só na primeira vez, 1–3 min)…"
  npm ci --no-audit --no-fund
  rm -rf .next
fi

[ -f .env ] || cp .env.example .env

exec node_modules/.bin/tsx scripts/local.ts "$@"
