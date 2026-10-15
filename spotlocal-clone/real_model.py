"""
Revenue/profit model driven by REAL data instead of random.random().

This replaces the old fake_cenario()/fake_resultado() (random fakery) with a
calculation built from three real inputs, combined by a documented, openly
approximate formula (SpotLocal's actual proprietary formula is not public,
so every multiplier below is a stated assumption, not a secret constant):

  1. Real per-street / per-bairro data already bundled in cidades/<cidade>.js
     - this is the production site's own real OSM-derived street geometry,
       vehicle/pedestrian traffic counts, and competitor counts per
       business type (`conc`, `din`), downloaded from spotlocal.com.br
       itself. We parse and reuse it directly instead of inventing it.
  2. Real IBGE population for the city (ibge_data.py), used to scale
     citywide demand relative to the national dataset.
  3. Real OSM Overpass competitor density (osm_competitors.py), used as a
     supplementary live cross-check on competitor density where an OSM tag
     mapping exists for the business type.

Output JSON shape is kept IDENTICAL to the previous fake implementation
(same top-level keys: N, B, Pt, ctx, prov, pess, otim, cen, cliEqDia,
limites, delivery, ext) so the frontend needs no changes.
"""
import json
import re
from functools import lru_cache
from pathlib import Path

import demografia_setor
import ibge_data
import osm_competitors
import sazonalidade

ROOT = Path(__file__).resolve().parent
CIDADES_DIR = ROOT / "cidades"

# ---------------------------------------------------------------------------
# Static business-type assumptions (same role as the old NEGOCIOS dict: no
# public per-CNAE price/cost index exists, so ticket medio / CMV% here are
# stated, documented assumptions, unchanged from the original mock).
# ---------------------------------------------------------------------------
NEGOCIOS = {
    "padaria": {"ticket": 14, "cmv": 50, "area_m2": 70, "capture": 0.014},
    "lanchonete": {"ticket": 22, "cmv": 45, "area_m2": 60, "capture": 0.012},
    "restaurante": {"ticket": 36, "cmv": 38, "area_m2": 110, "capture": 0.006},
    "acai": {"ticket": 24, "cmv": 42, "area_m2": 35, "capture": 0.010},
    "mercadinho": {"ticket": 38, "cmv": 68, "area_m2": 90, "capture": 0.015},
    "farmacia": {"ticket": 60, "cmv": 67, "area_m2": 80, "capture": 0.008},
    "barbearia": {"ticket": 40, "cmv": 25, "area_m2": 45, "capture": 0.004},
    "pizzaria": {"ticket": 55, "cmv": 35, "area_m2": 90, "capture": 0.004},
    "roupas": {"ticket": 110, "cmv": 50, "area_m2": 70, "capture": 0.003},
    "pet": {"ticket": 85, "cmv": 45, "area_m2": 60, "capture": 0.003},
    "academia": {"ticket": 10, "cmv": 4, "area_m2": 180, "capture": 0.002},
    "estudio": {"ticket": 45, "cmv": 30, "area_m2": 60, "capture": 0.002},
    "oficina": {"ticket": 700, "cmv": 45, "area_m2": 150, "capture": 0.0006},
    "restnoite": {"ticket": 70, "cmv": 38, "area_m2": 120, "capture": 0.003},
    "clinica": {"ticket": 200, "cmv": 55, "area_m2": 70, "capture": 0.0015},
    "nicho": {"ticket": 50, "cmv": 45, "area_m2": 60, "capture": 0.003},
    "escola": {"ticket": 30, "cmv": 45, "area_m2": 150, "capture": 0.001},
    "cursinho": {"ticket": 22, "cmv": 40, "area_m2": 90, "capture": 0.002},
    "suplemento": {"ticket": 140, "cmv": 60, "area_m2": 50, "capture": 0.002},
}

PONTOS = ["local", "corredor", "polo", "orla"]
TIPO_NOME = {
    "local": "Rua interna",
    "corredor": "Avenida / corredor",
    "polo": "Polo comercial",
    "orla": "Orla",
}
# Real mapping discovered by inspecting cidades/*.js: each street row's 2nd
# field is an integer type code whose distribution (~87% / ~12% / ~5% /
# ~0.1% of streets per city) lines up with local/corredor/polo/orla in that
# order, so we use it directly instead of guessing from traffic percentile.
TIPO_CODE = {"local": 0, "corredor": 1, "polo": 2, "orla": 3}

DIAS_MES = 26


def _clamp(x, lo, hi):
    return max(lo, min(hi, x))


@lru_cache(maxsize=32)
def _load_cidade(slug):
    path = CIDADES_DIR / f"{slug}.js"
    if not path.exists():
        return None
    src = path.read_text(encoding="utf-8")
    m = re.match(r"^\s*PC_CIDADE\((.*)\);?\s*$", src, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except Exception as e:
        print(f"[real_model] WARNING: could not parse {path}: {e}")
        return None


def _pick_bairro(cidade, bairro_id):
    bairros = cidade.get("bairros") or []
    if not bairros:
        return None
    for b in bairros:
        if b.get("id") == bairro_id:
            return b
    # Fallback: a bairro near the middle of the income distribution, a
    # reasonable "typical" stand-in rather than an arbitrary pick.
    by_renda = sorted(bairros, key=lambda b: b.get("renda") or 0)
    return by_renda[len(by_renda) // 2]


def _pick_street(bairro, ponto_tipo):
    ruas = bairro.get("r") or []
    if not ruas:
        return None
    code = TIPO_CODE.get(ponto_tipo, 0)
    candidatos = [row for row in ruas if len(row) > 1 and row[1] == code]
    if not candidatos:
        candidatos = ruas
    # Among same-type streets, take the median by vehicle traffic (index 2)
    # as a representative "typical" street of that type, rather than an
    # extreme outlier.
    candidatos = sorted(candidatos, key=lambda row: row[2] if len(row) > 2 else 0)
    return candidatos[len(candidatos) // 2]


def _scenario(neg, ticket, cli_dia_base, mult, delivery_on):
    cli_dia = max(5, round(cli_dia_base * mult))
    fat_salao = round(cli_dia * ticket * DIAS_MES, 2)
    fat_delivery = round(fat_salao * 0.15, 2) if delivery_on else 0
    fat = round(fat_salao + fat_delivery, 2)
    cmv_pct = neg["cmv"] / 100.0
    custos_fixos = round(fat * 0.32, 2)  # documented flat assumption (rent handled separately)
    lucro = round(fat * (1 - cmv_pct) - custos_fixos, 2)
    return {
        "fat": fat,
        "fatSalao": fat_salao,
        "cliDia": cli_dia,
        "dias": DIAS_MES,
        "lucro": lucro,
    }


def gerar_resultado(params, variant="an"):
    inp = (params or {}).get("I") or {}
    cidade_slug = (params or {}).get("c") or "recife"
    neg_id = (inp.get("neg") or {}).get("id") if isinstance(inp.get("neg"), dict) else inp.get("neg") or "padaria"
    bairro_id = (inp.get("bairro") or {}).get("id") if isinstance(inp.get("bairro"), dict) else inp.get("bairro") or "centro"
    ponto_tipo = inp.get("ponto") or "local"
    if ponto_tipo not in TIPO_NOME:
        ponto_tipo = "local"
    neg = NEGOCIOS.get(neg_id) or NEGOCIOS["padaria"]

    cidade = _load_cidade(cidade_slug) or _load_cidade("recife")
    bairro = _pick_bairro(cidade, bairro_id) if cidade else None

    # --- Real signal 1: IBGE population (city-level demand scale) --------
    pop_ibge, pop_fonte = (
        ibge_data.get_population(cidade_slug, cidade.get("nome", cidade_slug), cidade.get("uf", ""), cidade.get("pop", 1_000_000))
        if cidade else (1_000_000, "fallback_default")
    )

    # --- Real signal 2: per-street / per-bairro traffic + competitors ----
    if bairro:
        rua = _pick_street(bairro, ponto_tipo)
        renda_bairro = bairro.get("renda") or cidade.get("renda") or 2000
        renda_cidade = cidade.get("renda") or renda_bairro
        conc_keys = list((bairro.get("conc") or {}).keys())
        conc_bairro = (bairro.get("conc") or {}).get(neg_id, 0)
        din_idx = conc_keys.index(neg_id) if neg_id in conc_keys else None
        conc_rua = rua[6][din_idx] if (rua and len(rua) > 6 and din_idx is not None and din_idx < len(rua[6])) else conc_bairro
        veic = rua[2] if rua and len(rua) > 2 else 2000
        ped = rua[3] if rua and len(rua) > 3 else 1000
        m2_preco = bairro.get("m2") or cidade.get("m2") or 50.0
        area_bairro = bairro.get("area") or 1.0
        # NB: bairro["centro"] is a boolean flag in cidades/*.js (not
        # coordinates) - only the city-level "centro" field is a real
        # [lon, lat] pair, so that's what we use for the Overpass query.
        bairro_centro = cidade.get("centro")
    else:
        renda_bairro = renda_cidade = 2000
        conc_bairro = conc_rua = 5
        veic, ped = 2000, 1000
        m2_preco = 50.0
        area_bairro = 1.0
        bairro_centro = cidade.get("centro") if cidade else None

    # --- Real signal 3: OSM Overpass live competitor cross-check --------
    osm_count, osm_fonte = (None, "unavailable")
    if bairro_centro and len(bairro_centro) == 2:
        lon, lat = bairro_centro[0], bairro_centro[1]
        osm_count, osm_fonte = osm_competitors.get_competitor_count(neg_id, lat, lon)

    # Blend street-level (finest-grained, real, from SpotLocal's own data)
    # and OSM live (real, coarser radius) competitor signals when both are
    # available; otherwise use whichever real figure we have.
    if osm_count is not None:
        concorrentes = (conc_rua + osm_count) / 2.0
    else:
        concorrentes = conc_rua

    # --- Derived, documented formula (no RNG) ----------------------------
    renda_fator = _clamp(renda_bairro / renda_cidade, 0.6, 1.6) if renda_cidade else 1.0
    ticket = round(neg["ticket"] * renda_fator, 2)

    ped_dia = ped  # bundled `ped` is already a daily pedestrian-flow figure
    concorrencia_penalidade = 1.0 / (1.0 + 0.06 * concorrentes)
    pop_fator = _clamp((pop_ibge or 1_000_000) / 1_000_000.0, 0.5, 2.5) ** 0.15
    cli_dia_base = max(5, round(ped_dia * neg["capture"] * concorrencia_penalidade * pop_fator))

    delivery_on = neg_id not in ("barbearia", "academia", "oficina", "clinica", "estudio", "escola", "cursinho")

    prov = _scenario(neg, ticket, cli_dia_base, 1.0, delivery_on)
    pess = _scenario(neg, ticket, cli_dia_base, 0.75, delivery_on)
    otim = _scenario(neg, ticket, cli_dia_base, 1.3, delivery_on)
    cen = [pess, prov, otim]

    aluguel = round(m2_preco * neg["area_m2"] * 0.55, 2)  # 0.55: commercial-vs-residential rent ratio assumption

    delivery = {
        "ligado": delivery_on,
        "fatMes": round(prov["fat"] * 0.18, 2) if delivery_on else 0,
        "pedidosDia": round(prov["cliDia"] * 0.3, 1) if delivery_on else 0,
        "custoPct": 18.0,
        "densRaio": round(concorrentes / max(area_bairro, 0.1), 2),
        "densRef": round(conc_bairro / max(area_bairro, 0.1), 2),
        "entrega": 7.5,
        "entregador": 1600.0,
        "fixoMes": 400.0,
        "funcProducao": 1.0,
        "outros": 250.0,
        "raioKm": 2.0,
    }

    proj_slope = (cidade.get("proj") or [0, 0, 0, 0])[1] if cidade else 0
    dec = round(_clamp(proj_slope / 100.0, -0.1, 0.1), 3)

    # --- Real signal 4: seasonality (Google Trends + holidays, INMET where applicable) ---
    saz_idx, saz_fonte = sazonalidade.get_seasonal_index(cidade.get("uf", "") if cidade else "", neg_id)

    # --- Real signal 5: neighborhood-level (NOT per-street) IBGE Censo 2022
    # census-sector demographics - population by sex/age and household-head
    # income. Pilot: Recife and Sao Paulo only; any other city gracefully
    # reports unavailable/not_piloted (see demografia_setor.py). Never raises.
    try:
        demografia_setor_ctx = demografia_setor.get_estimate(cidade_slug, bairro, ponto_tipo)
    except Exception as e:
        print(f"[real_model] WARNING: demografia_setor lookup failed: {e}")
        demografia_setor_ctx = {"disponivel": False, "motivo": "unavailable",
                                 "fonte": "ibge_censo2022_setor_censitario(estimativa_vizinhanca)"}

    result = {
        "N": {"id": neg_id, "nome": neg_id.capitalize(), "area": neg["area_m2"]},
        "B": {
            "id": bairro.get("id") if bairro else bairro_id,
            "nome": bairro.get("nome") if bairro else bairro_id,
            "faixa": max((bairro.get("faixa") or {}).items(), key=lambda kv: kv[1])[0] if bairro and bairro.get("faixa") else "media",
            "concRaw": conc_bairro,
        },
        "Pt": {
            "nome": TIPO_NOME[ponto_tipo],
            "tipo": ponto_tipo,
            "veic": veic,
            "ped": ped,
            "curva": [round(0.7 + 0.3 * ((i % 6) / 5.0), 2) for i in range(12)],
        },
        "ctx": {
            "inp": inp,
            "fontes": {
                "populacao": pop_fonte,
                "concorrencia_osm": osm_fonte,
                "traffic_e_concorrencia_local": "cidades_js(spotlocal_osm_receita)",
                "sazonalidade": saz_fonte,
            },
            "demografiaSetor": demografia_setor_ctx,
        },
        "prov": prov,
        "pess": pess,
        "otim": otim,
        "cen": cen,
        "cliEqDia": round(prov["cliDia"] * 1.0, 1),
        "limites": {
            "aluguelMax": round(aluguel * 1.4, 2),
            "ticketMin": round(neg["ticket"] * 0.8, 2),
            "clientesEq": round(prov["cliDia"] * 0.9, 1),
        },
        "delivery": delivery,
        "ext": {
            "dec": dec,
            "dlvOn": delivery_on,
            "tk": ticket,
            "proj": [round(prov["lucro"] * (1 + dec * m / 2.0), 2) for m in range(13)],
            "saz": saz_idx,  # real: Google Trends (+ holiday calendar, + INMET where applicable) - see sazonalidade.py
        },
    }
    return result
