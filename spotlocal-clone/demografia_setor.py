"""
Neighborhood-level (NOT per-street) demographic estimate from IBGE Censo 2022
census-sector (setor censitario) data, for the PILOT cities Recife (PE) and
Sao Paulo (SP) only. See build_census_sector_cache.py for exactly which
official IBGE files were downloaded, from which URLs, and what each column
means - this module only reads the compact cache that script produces
(data_cache/setores_demografia.json) and does the weighting described below.

WHAT THIS IS AND IS NOT
------------------------
IBGE does not publish, and has never published, per-street demographic data;
no such dataset exists. What *is* real and official:
  - the 2022 census-sector boundary polygons (a "setor censitario" is IBGE's
    smallest enumeration area, typically a few blocks / a few hundred to a
    few thousand residents), and
  - population by sex/age and mean household-head income, published per
    sector.
We also discovered (by inspecting cidades/recife.js and cidades/sao-paulo.js)
that the bundled `bairro.cod` field is *exactly* IBGE's own official areal
code for that city's bairro-equivalent division:
  - Recife: `cod` == IBGE `CD_BAIRRO` (Recife has official IBGE bairro
    boundaries in the 2022 malha).
  - Sao Paulo: `cod` == IBGE `CD_DIST` (Sao Paulo has no official IBGE bairro
    division in the 2022 malha; its finest official division is the
    "distrito", and SpotLocal's own `bairro` entries for Sao Paulo are in
    fact those 96 distritos, one-for-one, by code).
So the bairro-to-sector join below is an exact match on a real, official
IBGE code - not a guess.

THE PART THAT IS AN APPROXIMATION: no bundled street row has its own
coordinate (only the city-level `centro` is real [lon,lat]; a bairro's
`cx`/`cy` are SVG map-drawing pixel coordinates, not geographic ones - see
real_model.py's own comment on this). So a single street cannot be pinned to
one census sector. What we do instead, explicitly:
  1. Take every census sector whose code falls inside the street's bairro
     (exact official-code match, see above) - this is the sector "pool" for
     that bairro.
  2. Compute the pool's own centroid-of-centroids as a stand-in "bairro
     center" (a real geographic point, the average of real sector centroids).
  3. For a `local` (residential) street, average the demographics of the
     N_LOCAL sectors nearest that bairro center, weighted by inverse
     distance - i.e. assume a residential street sits near the heart of its
     own bairro's sector cluster. Confidence: "alta" when the bairro has
     enough sectors to make that averaging meaningful, else "media".
  4. For `corredor`/`polo`/`orla` streets - avenues, commercial hubs and
     waterfronts - these are exactly the street types most likely to run
     along a bairro's edge or cut across several sectors with very different
     profiles (a beachfront avenue bordering both upscale towers and an
     informal backstreet, for instance), so a tight nearest-sector average is
     less trustworthy for them. We widen the pool (more sectors, see
     N_WIDE), and blend it with the full-bairro average and, for `orla`
     specifically, partly with the municipio-wide average, explicitly
     lowering confidence to "media" (corredor/polo) or "baixa" (orla).
  5. If the city is not Recife or Sao Paulo, or the bairro code has no match
     in the cache, we return an "unavailable"/"not_piloted" record rather
     than guessing or crashing.

This is a genuine neighborhood-level estimate, weighted toward the right
part of the city - it is NOT a per-street fact, and the `confianca` field is
there specifically so callers don't treat it as more precise than it is.
"""
import json
import math
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CACHE_FILE = ROOT / "data_cache" / "setores_demografia.json"

PILOT_CIDADES = {"recife", "sao-paulo"}

N_LOCAL = 2    # nearest sectors averaged for a "local" (residential) street
N_WIDE = 6     # wider nearest-sector pool for corredor/polo/orla streets

AGE_LABELS = ["0-4", "5-9", "10-14", "15-19", "20-24", "25-29", "30-39", "40-49", "50-59", "60-69", "70+"]


def _haversine_km(lon1, lat1, lon2, lat2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


@lru_cache(maxsize=1)
def _load_cache():
    if not CACHE_FILE.exists():
        return {}
    try:
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[demografia_setor] WARNING: could not read {CACHE_FILE}: {e}")
        return {}


@lru_cache(maxsize=8)
def _cidade_index(cidade_slug):
    """Precompute, once per city: all sectors, grouped by code (cd_bairro
    for recife, cd_dist for sao-paulo), plus a municipio-wide list."""
    data = _load_cache()
    setores = data.get(cidade_slug) or []
    code_field = "cd_bairro" if cidade_slug == "recife" else "cd_dist"
    by_code = {}
    for s in setores:
        code = s.get(code_field)
        if not code:
            continue
        by_code.setdefault(code, []).append(s)
    return {"all": setores, "by_code": by_code, "code_field": code_field}


def _weighted_avg(setores):
    """Inverse-distance-free simple weighted average (equal weight here;
    distance weighting is applied by the caller via which sectors it passes
    in) over a non-empty list of sector dicts. Returns the blended fields,
    skipping sectors with missing renda."""
    tot_pop = sum(s["pop"] for s in setores)
    if tot_pop <= 0:
        return None
    pop_m = sum((s.get("pop_m") or 0) for s in setores)
    pop_f = sum((s.get("pop_f") or 0) for s in setores)
    faixas = {label: 0 for label in AGE_LABELS}
    for s in setores:
        for label, v in (s.get("faixas") or {}).items():
            faixas[label] = faixas.get(label, 0) + v
    rendas = [(s["pop"], s["renda_media"]) for s in setores if s.get("renda_media")]
    renda_media = (sum(p * r for p, r in rendas) / sum(p for p, r in rendas)) if rendas else None
    return {
        "pop": tot_pop,
        "pop_m": pop_m,
        "pop_f": pop_f,
        "faixas": faixas,
        "renda_media": round(renda_media, 2) if renda_media is not None else None,
        "n_setores": len(setores),
    }


def _nearest(setores, lon, lat, n):
    ranked = sorted(setores, key=lambda s: _haversine_km(lon, lat, s["lon"], s["lat"]))
    return ranked[:n]


def get_estimate(cidade_slug, bairro, ponto_tipo):
    """Returns the ctx.demografiaSetor dict, or an 'unavailable'/'not_piloted'
    stand-in. Never raises - any lookup failure degrades gracefully."""
    base_fonte = "ibge_censo2022_setor_censitario(estimativa_vizinhanca)"

    if cidade_slug not in PILOT_CIDADES:
        return {
            "disponivel": False,
            "motivo": "not_piloted",
            "fonte": base_fonte,
            "nota": f"Estimativa de setor censitario ainda nao cobre '{cidade_slug}' (piloto: Recife e Sao Paulo).",
        }

    idx = _cidade_index(cidade_slug)
    if not idx["all"]:
        return {"disponivel": False, "motivo": "unavailable", "fonte": base_fonte,
                "nota": "Cache de setores censitarios nao encontrado/vazio para esta cidade."}

    cod = (bairro or {}).get("cod") if isinstance(bairro, dict) else None
    pool = idx["by_code"].get(cod) if cod else None
    if not pool:
        return {"disponivel": False, "motivo": "unavailable", "fonte": base_fonte,
                "nota": f"Codigo de bairro/distrito '{cod}' sem setores censitarios correspondentes."}

    # Real geographic center of this bairro/distrito's own sector cluster.
    clon = sum(s["lon"] for s in pool) / len(pool)
    clat = sum(s["lat"] for s in pool) / len(pool)

    if ponto_tipo == "local":
        chosen = _nearest(pool, clon, clat, min(N_LOCAL, len(pool)))
        est = _weighted_avg(chosen)
        confianca = "alta" if len(pool) >= 3 else "media"
        nota = (f"Media dos {len(chosen)} setor(es) censitario(s) mais proximos do centro "
                f"do bairro/distrito ({len(pool)} setores no total) - rua local/residencial, "
                f"estimativa mais concentrada no proprio bairro.")
    elif ponto_tipo == "orla":
        wide = _nearest(pool, clon, clat, min(N_WIDE, len(pool)))
        est_wide = _weighted_avg(wide)
        est_bairro = _weighted_avg(pool)
        est_muni = _weighted_avg(idx["all"])
        parts = [p for p in (est_wide, est_bairro, est_muni) if p]
        est = _blend(parts) if parts else None
        confianca = "baixa"
        nota = ("Orla/orla costeira tende a atravessar setores com perfis bem diferentes "
                "(torres x comunidades, por exemplo); estimativa combina o setor mais proximo, "
                "a media do bairro inteiro e a media do municipio - confianca baixa.")
    else:  # corredor / polo
        wide = _nearest(pool, clon, clat, min(N_WIDE, len(pool)))
        est_wide = _weighted_avg(wide)
        est_bairro = _weighted_avg(pool)
        parts = [p for p in (est_wide, est_bairro) if p]
        est = _blend(parts) if parts else None
        confianca = "media"
        nota = (f"Avenida/corredor ou polo comercial cruza varios setores; estimativa combina "
                f"{len(wide)} setores proximos com a media do bairro/distrito inteiro ({len(pool)} "
                f"setores) - confianca media, nao e um numero por rua.")

    if not est:
        return {"disponivel": False, "motivo": "unavailable", "fonte": base_fonte,
                "nota": "Dados de populacao/renda ausentes nos setores correspondentes."}

    idade_media = _idade_media_aprox(est["faixas"])

    return {
        "disponivel": True,
        "pop": est["pop"],
        "popMasc": est["pop_m"],
        "popFem": est["pop_f"],
        "faixasEtarias": est["faixas"],
        "idadeMediaAprox": idade_media,
        "renda": est["renda_media"],
        "nSetoresUsados": est.get("n_setores"),
        "confianca": confianca,
        "fonte": base_fonte,
        "nota": nota,
        "granularidade": "setor_censitario_agregado_por_bairro_ou_distrito",
    }


def _blend(parts):
    """Average several already-aggregated estimate dicts together (simple
    unweighted mean of the parts, each part itself being a population-
    weighted aggregate of its own sector pool)."""
    pops = [p["pop"] for p in parts if p]
    if not pops:
        return None
    pop = sum(pops) / len(pops)
    pop_m = sum(p["pop_m"] for p in parts) / len(parts)
    pop_f = sum(p["pop_f"] for p in parts) / len(parts)
    faixas = {label: sum(p["faixas"].get(label, 0) for p in parts) / len(parts) for label in AGE_LABELS}
    rendas = [p["renda_media"] for p in parts if p.get("renda_media")]
    renda = sum(rendas) / len(rendas) if rendas else None
    return {
        "pop": round(pop),
        "pop_m": round(pop_m),
        "pop_f": round(pop_f),
        "faixas": {k: round(v) for k, v in faixas.items()},
        "renda_media": round(renda, 2) if renda is not None else None,
        "n_setores": sum(p.get("n_setores", 0) for p in parts),
    }


def _idade_media_aprox(faixas):
    """Rough mean age from banded counts, using each band's midpoint (open-
    ended 70+ band approximated at 78). This is a standard, documented
    approximation for grouped age data, not an exact mean."""
    midpoints = {"0-4": 2, "5-9": 7, "10-14": 12, "15-19": 17, "20-24": 22, "25-29": 27,
                 "30-39": 34.5, "40-49": 44.5, "50-59": 54.5, "60-69": 64.5, "70+": 78}
    tot = sum(faixas.values())
    if not tot:
        return None
    return round(sum(faixas.get(k, 0) * m for k, m in midpoints.items()) / tot, 1)
