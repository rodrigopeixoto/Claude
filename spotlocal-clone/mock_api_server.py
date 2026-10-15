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

import real_model
from real_model import NEGOCIOS, PONTOS, TIPO_NOME  # re-exported for any external imports

ROOT = Path(__file__).resolve().parent
PORT = 8080


def rng(seed_text):
    """Deterministic-ish small RNG seeded from a string. Only used now by
    fake_sens()/fake_agente() for the parts that still have no real public
    data source wired up (synthetic chat chatter, sensitivity-sweep
    scaling) - the core revenue/profit numbers below come from
    real_model.gerar_resultado(), not from this RNG."""
    h = abs(hash(str(seed_text))) % (10 ** 6)
    r = random.Random(h)
    return r


def fake_resultado(params, variant="an"):
    """Real-data-driven scenario calculation. See real_model.py for the
    IBGE population, OSM competitor-density and bundled street/bairro
    traffic data that drives this, and for every assumption/multiplier
    used in the formula (documented inline there)."""
    return real_model.gerar_resultado(params, variant)


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
