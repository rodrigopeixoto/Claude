#!/usr/bin/env python3
"""
Mock backend for the SpotLocal frontend clone, for local UI testing.

Serves the static site AND fakes the real backend ("o cérebro"):
  - All dynamic calculations (street analysis, map heatmap points, simulator
    scenarios, sensitivity, agent chat) go through a SINGLE batched JSON
    endpoint: POST /api/v1  with body {"v":1,"q":[[op, params], ...]}
    returning {"r":[{"ok":true,"v":<value>}, ...]}  (see remote.js).
  - Ops seen in the frontend: "an" (calcular/full analysis), "q" (calcRapido,
    used in bulk by mapa.js), "calc"/"sens" (simulador.js), "ag" (agentes.js).

Only Python stdlib is used. Run: python3 mock_api_server.py [port]
"""
import json
import random
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent
PORT = 8080

NEGOCIOS = {
    "padaria": {"ticket": 14, "cmv": 50},
    "lanchonete": {"ticket": 22, "cmv": 45},
    "restaurante": {"ticket": 36, "cmv": 38},
    "acai": {"ticket": 24, "cmv": 42},
    "mercadinho": {"ticket": 38, "cmv": 68},
    "farmacia": {"ticket": 60, "cmv": 67},
    "barbearia": {"ticket": 40, "cmv": 25},
    "pizzaria": {"ticket": 55, "cmv": 35},
    "roupas": {"ticket": 110, "cmv": 50},
    "pet": {"ticket": 85, "cmv": 45},
    "academia": {"ticket": 10, "cmv": 4},
    "estudio": {"ticket": 45, "cmv": 30},
    "oficina": {"ticket": 700, "cmv": 45},
    "restnoite": {"ticket": 70, "cmv": 38},
    "clinica": {"ticket": 200, "cmv": 55},
    "nicho": {"ticket": 50, "cmv": 45},
    "escola": {"ticket": 30, "cmv": 45},
    "cursinho": {"ticket": 22, "cmv": 40},
    "suplemento": {"ticket": 140, "cmv": 60},
}

BAIRROS = [
    {"id": "centro", "nome": "Centro", "faixa": "media"},
    {"id": "boa-viagem", "nome": "Boa Viagem", "faixa": "alta"},
    {"id": "casa-amarela", "nome": "Casa Amarela", "faixa": "media"},
    {"id": "ibura", "nome": "Ibura", "faixa": "popular"},
]

PONTOS = ["local", "corredor", "polo", "orla"]
TIPO_NOME = {
    "local": "Rua interna",
    "corredor": "Avenida / corredor",
    "polo": "Polo comercial",
    "orla": "Orla",
}


def rng(seed_text):
    """Deterministic-ish small RNG seeded from a string, so repeat calls
    with the same input are stable (nice for UI testing)."""
    h = abs(hash(str(seed_text))) % (10 ** 6)
    r = random.Random(h)
    return r


def fake_cenario(neg_id, bairro, ponto, mult=1.0, seed="x"):
    r = rng(f"{neg_id}|{bairro}|{ponto}|{seed}|{mult}")
    base = NEGOCIOS.get(neg_id, {"ticket": 30, "cmv": 40})
    ticket = base["ticket"] * (0.9 + 0.2 * r.random())
    cli_dia = max(5, round(r.uniform(20, 140) * mult))
    dias = 26
    fat_salao = round(cli_dia * ticket * dias, 2)
    fat_delivery = round(fat_salao * 0.15, 2) if r.random() > 0.4 else 0
    fat = round(fat_salao + fat_delivery, 2)
    cmv_pct = base["cmv"] / 100.0
    custos_fixos = round(fat * r.uniform(0.25, 0.4), 2)
    lucro = round(fat * (1 - cmv_pct) - custos_fixos, 2)
    return {
        "fat": fat,
        "fatSalao": fat_salao,
        "cliDia": cli_dia,
        "dias": dias,
        "lucro": lucro,
    }


def fake_resultado(params, variant="an"):
    inp = (params or {}).get("I") or {}
    cidade = (params or {}).get("c") or "recife"
    neg_id = (inp.get("neg") or {}).get("id") if isinstance(inp.get("neg"), dict) else inp.get("neg") or "padaria"
    bairro_id = (inp.get("bairro") or {}).get("id") if isinstance(inp.get("bairro"), dict) else inp.get("bairro") or "centro"
    ponto_tipo = inp.get("ponto") or "local"
    if ponto_tipo not in TIPO_NOME:
        ponto_tipo = "local"

    bairro = next((b for b in BAIRROS if b["id"] == bairro_id), BAIRROS[0])
    r = rng(f"{cidade}|{neg_id}|{bairro_id}|{ponto_tipo}")

    prov = fake_cenario(neg_id, bairro_id, ponto_tipo, mult=1.0, seed="prov")
    pess = fake_cenario(neg_id, bairro_id, ponto_tipo, mult=0.75, seed="pess")
    otim = fake_cenario(neg_id, bairro_id, ponto_tipo, mult=1.3, seed="otim")

    cen = [pess, prov, otim]

    aluguel = round(r.uniform(1500, 6000), 2)
    base = NEGOCIOS.get(neg_id, {"ticket": 30, "cmv": 40})

    delivery_on = r.random() > 0.5
    delivery = {
        "ligado": delivery_on,
        "fatMes": round(prov["fat"] * 0.18, 2) if delivery_on else 0,
        "pedidosDia": round(r.uniform(5, 40), 1) if delivery_on else 0,
        "custoPct": round(r.uniform(12, 25), 1),
        "densRaio": round(r.uniform(0.5, 3), 2),
        "densRef": round(r.uniform(0.5, 3), 2),
        "entrega": round(r.uniform(5, 15), 2),
        "entregador": round(r.uniform(1200, 2200), 2),
        "fixoMes": round(r.uniform(200, 800), 2),
        "funcProducao": round(r.uniform(0.5, 2), 1),
        "outros": round(r.uniform(100, 500), 2),
        "raioKm": round(r.uniform(1, 5), 1),
    }

    result = {
        "N": {"id": neg_id, "nome": neg_id.capitalize(), "area": round(r.uniform(25, 150))},
        "B": {
            "id": bairro["id"],
            "nome": bairro["nome"],
            "faixa": bairro["faixa"],
            "concRaw": round(r.uniform(1, 20)),
        },
        "Pt": {
            "nome": TIPO_NOME[ponto_tipo],
            "tipo": ponto_tipo,
            "veic": round(r.uniform(500, 15000)),
            "ped": round(r.uniform(300, 8000)),
            "curva": [round(r.uniform(0.5, 1.5), 2) for _ in range(12)],
        },
        "ctx": {"inp": inp},
        "prov": prov,
        "pess": pess,
        "otim": otim,
        "cen": cen,
        "cliEqDia": round(prov["cliDia"] * r.uniform(0.9, 1.1), 1),
        "limites": {
            "aluguelMax": round(aluguel * 1.4, 2),
            "ticketMin": round(base["ticket"] * 0.8, 2),
            "clientesEq": round(prov["cliDia"] * 0.9, 1),
        },
        "delivery": delivery,
        "ext": {
            "dec": round(r.uniform(-0.1, 0.1), 3),
            "dlvOn": delivery_on,
            "tk": round(base["ticket"] * r.uniform(0.9, 1.3), 2),
            "proj": [round(prov["lucro"] * (0.7 + 0.03 * m), 2) for m in range(13)],
            "saz": [round(r.uniform(0.8, 1.2), 3) for _ in range(12)],
        },
    }
    return result


def fake_sens(params):
    base = fake_resultado(params, variant="sens")
    s = (params or {}).get("s") or {}
    out = {}
    for k, v in s.items():
        try:
            vals = [float(x) for x in v] if isinstance(v, list) else [float(v)]
        except Exception:
            vals = [0]
        out[k] = [round(base["prov"]["lucro"] * (0.8 + 0.1 * i), 2) for i in range(len(vals) or 1)]
    base["sens"] = out
    return base


def fake_agente(params):
    r = rng(json.dumps(params, sort_keys=True))
    falas = ["Oi, tudo bem?", "Quanto custa?", "Vim conhecer", "Volto amanhã"]
    eventos = []
    for h in range(8, 20):
        eventos.append({
            "hora": h,
            "clientes": round(r.uniform(0, 12)),
            "fala": r.choice(falas),
        })
    return {
        "seed": (params or {}).get("seed"),
        "eventos": eventos,
        "resumo": fake_resultado(params, variant="ag"),
    }


def handle_op(op, p):
    try:
        if op == "an":
            return {"ok": True, "v": fake_resultado(p, "an")}
        if op == "q":
            # p = {c, L:[input, ...]} -> batch of quick calcs
            lista = (p or {}).get("L") or []
            vals = [fake_resultado({"c": p.get("c"), "I": item}, "q") for item in lista]
            return {"ok": True, "v": vals}
        if op == "calc":
            return {"ok": True, "v": fake_resultado(p, "calc")}
        if op == "sens":
            return {"ok": True, "v": fake_sens(p)}
        if op == "ag":
            return {"ok": True, "v": fake_agente(p)}
        return {"ok": True, "v": fake_resultado(p, op)}
    except Exception as e:
        return {"ok": False, "e": str(e)}


MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".txt": "text/plain; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print("[mock]", fmt % args)

    def _send_json(self, obj, status=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "*")
        self.end_headers()

    def do_POST(self):
        path = unquote(self.path.split("?")[0])
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b""
        try:
            data = json.loads(raw.decode("utf-8")) if raw else {}
        except Exception:
            data = {}

        if path == "/api/v1":
            queries = data.get("q") or []
            results = []
            for item in queries:
                if isinstance(item, list) and len(item) >= 2:
                    op, p = item[0], item[1]
                else:
                    op, p = "an", {}
                results.append(handle_op(op, p))
            self._send_json({"r": results})
            return

        if path.startswith("/api/"):
            # generic fallback for any other /api/<thing> POST calls
            self._send_json({"ok": True, "v": {}})
            return

        self._send_json({"erro": "não encontrado"}, status=404)

    def do_GET(self):
        path = unquote(self.path.split("?")[0])
        if path.startswith("/api/"):
            self._send_json({"ok": True, "v": {}})
            return
        if path == "/":
            path = "/index.html"
        fs_path = (ROOT / path.lstrip("/")).resolve()
        if ROOT not in fs_path.parents and fs_path != ROOT:
            self.send_error(403)
            return
        if not fs_path.exists() or not fs_path.is_file():
            self.send_error(404)
            return
        ext = fs_path.suffix.lower()
        content_type = MIME.get(ext, "application/octet-stream")
        data = fs_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main():
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"Mock SpotLocal server running at http://localhost:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
