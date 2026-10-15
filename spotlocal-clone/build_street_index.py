#!/usr/bin/env python3
"""
Build a pre-computed, batch street-ranking index for the "search streets by
circulation + residential density" product mode (distinct from the existing
single-street/single-business analysis in real_model.py).

WHY A SEPARATE BATCH STEP
---------------------------
real_model.gerar_resultado() is built to answer one query at a time ("this
street, this business type") and is fast enough for that. Ranking needs the
opposite shape: EVERY street in a city, sorted/filterable instantly in the
browser. Re-running the per-query model for every street on every page view
would be slow and pointless (the inputs that matter for ranking - traffic
and residential density - don't depend on a business type at all). So this
script walks every bairro/street once, offline, and writes a small static
JSON file per city that the frontend just fetches and sorts client-side.

Re-run this script whenever cidades/*.js or data_cache/setores_demografia.json
changes; it is not invoked by the running server.

INPUTS (all real, already used elsewhere in this project - nothing new is
invented here):
  - cidades/<cidade>.js: real OSM-derived street rows (name, type code,
    veic/ped counts) and bairro-level renda, same file real_model.py reads.
  - demografia_setor.get_estimate(): real IBGE Censo 2022 census-sector
    estimate (pop, renda), but ONLY available for the two pilot cities
    Recife and Sao Paulo (see demografia_setor.py docstring for why).
  - ibge_data.get_population(): real IBGE city population, used as the
    density fallback signal for the other 25 capitals, where we have no
    neighborhood-level data at all - see "DENSITY FOR NON-PILOT CITIES"
    below.

THE SCORE FORMULA IS NOT SPOTLOCAL'S
--------------------------------------
SpotLocal does not publish (and, as far as this reverse-engineering effort
has found, does not even have) a "best street to invest near" ranking
product - this is a NEW metric designed for this feature, not a recovered
one. It is intentionally simple and documented in full here instead of
hidden behind a black-box constant:

    score = 0.6 * normalized(circulacao)  +  0.4 * normalized(densidade)

  - circulacao = veic + ped (real per-street daily vehicle + pedestrian
    counts, index 2 and 3 of each street row).
  - densidade = residential population signal (see below for how it's
    sourced per city).
  - "normalized(x)" = min-max scaling of x to [0, 1] *within that city's own
    street list* (so cities of very different absolute scale - Sao Paulo vs.
    Boa Vista - are each internally comparable; this index is not meant to
    rank across cities).
  - The 0.6 / 0.4 weighting favors circulation slightly over density
    because circulation is the more directly-measured real signal here
    (actual OSM-derived counts) while density is, for most cities, only a
    city-level estimate spread uniformly - see confianca below.

DENSITY FOR NON-PILOT CITIES
------------------------------
For Recife and Sao Paulo we reuse demografia_setor.get_estimate(), the same
real neighborhood-level (census-sector) estimate real_model.py already uses
for its pilot demografiaSetor context - confianca "alta"/"media"/"baixa" as
that module computes it (varies per bairro/street type).

For every other capital, no neighborhood-level demographic breakdown exists
in this project (IBGE does not publish per-street or even per-bairro data
nationally; see demografia_setor.py). We fall back to a SINGLE city-level
density number - população do município IBGE / área construída aproximada
não existe, então usamos uma proxy simples e honesta: pop IBGE da cidade
dividida pelo número de ruas mapeadas na cidade (cidade["bairros"] soma de
"r"), como um indicador relativo de "pessoas por rua" na cidade como um
todo. É o MESMO número para toda rua dessa cidade (não varia por bairro),
e é rotulado confianca="baixa", fonte="ibge_cidade_nivel_cidade" para deixar
claro que não é um dado de bairro.
"""
import json
import re
import sys
from pathlib import Path

import demografia_setor
import ibge_data
import real_model

ROOT = Path(__file__).resolve().parent
CIDADES_DIR = ROOT / "cidades"
OUT_DIR = ROOT / "data_cache"

PILOT_CIDADES = {"recife", "sao-paulo"}
TIPO_CODE_TO_NOME = {v: k for k, v in real_model.TIPO_CODE.items()}

W_CIRC = 0.6
W_DENS = 0.4


def _load_cidade(slug):
    path = CIDADES_DIR / f"{slug}.js"
    src = path.read_text(encoding="utf-8")
    m = re.match(r"^\s*PC_CIDADE\((.*)\);?\s*$", src, flags=re.S)
    return json.loads(m.group(1))


def _minmax_norm(values):
    lo, hi = min(values), max(values)
    span = hi - lo
    if span <= 0:
        return [0.5 for _ in values]
    return [(v - lo) / span for v in values]


def _city_level_density(cidade):
    """Fallback density signal for the 25 non-pilot capitals: real IBGE city
    population divided by the number of real mapped streets in this same
    file, as a 'people per mapped street' proxy. Same number for every
    street in the city - see module docstring."""
    pop, pop_fonte = ibge_data.get_population(
        cidade.get("id", ""), cidade.get("nome", ""), cidade.get("uf", ""), cidade.get("pop", 1_000_000)
    )
    n_ruas = sum(len(b.get("r") or []) for b in (cidade.get("bairros") or []))
    n_ruas = max(n_ruas, 1)
    return pop / n_ruas, pop, pop_fonte


def build_for_cidade(slug):
    cidade = _load_cidade(slug)
    cidade["id"] = cidade.get("id") or slug
    is_pilot = slug in PILOT_CIDADES

    densidade_cidade_fallback, pop_cidade, pop_fonte = _city_level_density(cidade)

    rows = []
    demografia_cache = {}  # (bairro_id, ponto_tipo) -> dict, avoids recompute per street

    for bairro in cidade.get("bairros") or []:
        bairro_id = bairro.get("id")
        bairro_nome = bairro.get("nome")
        renda_bairro = bairro.get("renda") or cidade.get("renda")

        for row in bairro.get("r") or []:
            if not row or len(row) < 4:
                continue
            nome = row[0]
            tipo_code = row[1] if len(row) > 1 else 0
            tipo = TIPO_CODE_TO_NOME.get(tipo_code, "local")
            veic = row[2] if len(row) > 2 else 0
            ped = row[3] if len(row) > 3 else 0
            circulacao = (veic or 0) + (ped or 0)

            if is_pilot:
                key = (bairro_id, tipo)
                if key not in demografia_cache:
                    demografia_cache[key] = demografia_setor.get_estimate(slug, bairro, tipo)
                dem = demografia_cache[key]
                if dem.get("disponivel"):
                    densidade = dem["pop"]
                    renda = dem.get("renda") or renda_bairro
                    confianca = dem.get("confianca", "media")
                    fonte_densidade = dem.get("fonte", "ibge_censo2022_setor_censitario")
                else:
                    # Pilot city but this bairro/tipo had no sector match -
                    # degrade to the same city-level fallback as non-pilot.
                    densidade = densidade_cidade_fallback
                    renda = renda_bairro
                    confianca = "baixa"
                    fonte_densidade = "ibge_cidade_nivel_cidade(fallback_sem_setor)"
            else:
                densidade = densidade_cidade_fallback
                renda = renda_bairro
                confianca = "baixa"
                fonte_densidade = "ibge_cidade_nivel_cidade"

            rows.append({
                "nome": nome,
                "bairro": bairro_nome,
                "tipo": tipo,
                "circulacao": round(circulacao),
                "densidade": round(densidade) if densidade is not None else None,
                "renda": round(renda) if renda else None,
                "confianca": confianca,
            })

    if rows:
        circ_norm = _minmax_norm([r["circulacao"] for r in rows])
        dens_vals = [r["densidade"] if r["densidade"] is not None else 0 for r in rows]
        dens_norm = _minmax_norm(dens_vals)
        for r, cn, dn in zip(rows, circ_norm, dens_norm):
            r["score"] = round((W_CIRC * cn + W_DENS * dn) * 100, 1)

    rows.sort(key=lambda r: r.get("score", 0), reverse=True)

    return {
        "cidade": slug,
        "nome": cidade.get("nome", slug),
        "uf": cidade.get("uf", ""),
        "pilotoDemografiaSetor": is_pilot,
        "popCidade": round(pop_cidade),
        "popFonte": pop_fonte,
        "nRuas": len(rows),
        "scoreFormula": "score = 0.6*normalizado(circulacao) + 0.4*normalizado(densidade), min-max por cidade - metrica nova deste app, nao do SpotLocal real.",
        "fonteDensidadeNota": (
            "Recife e Sao Paulo: densidade real por bairro/tipo de rua via setor censitario IBGE 2022 "
            "(confianca varia por rua, ver campo 'confianca'). Demais 25 capitais: sem dado de bairro - "
            "densidade e uma estimativa unica por cidade (pop. IBGE da cidade / numero de ruas mapeadas), "
            "confianca 'baixa' em toda rua."
        ) if is_pilot else (
            "Sem dado de bairro para esta cidade (fora do piloto IBGE setor censitario): densidade e uma "
            "estimativa unica por cidade (pop. IBGE / numero de ruas mapeadas), mesma para toda rua, "
            "confianca 'baixa'."
        ),
        "ruas": rows,
    }


def main():
    cidades = sys.argv[1:] or sorted(p.stem for p in CIDADES_DIR.glob("*.js"))
    OUT_DIR.mkdir(exist_ok=True)
    for slug in cidades:
        print(f"[build_street_index] {slug} ...")
        idx = build_for_cidade(slug)
        out_path = OUT_DIR / f"street_index_{slug}.json"
        out_path.write_text(json.dumps(idx, ensure_ascii=False), encoding="utf-8")
        print(f"  -> {out_path} ({idx['nRuas']} ruas, piloto={idx['pilotoDemografiaSetor']})")


if __name__ == "__main__":
    main()
