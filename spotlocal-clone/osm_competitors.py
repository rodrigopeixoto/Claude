"""
Real competitor-density signal sourced from OpenStreetMap, via the public
Overpass API, with on-disk caching and graceful fallback.

Why OSM and not Receita Federal
--------------------------------
The task asked us to source competitor density from Receita Federal's CNPJ
registry. We investigated the realistic public options:

  - The full Receita Federal "Dados Abertos CNPJ" dataset (sócios,
    empresas, estabelecimentos) is only published as a handful of
    multi-gigabyte CSV/zip files for bulk download - there is no public
    API to query it by CNAE + geographic radius, and downloading/indexing
    it is infeasible for this mock server.
  - Public CNPJ lookup APIs that do exist (brasilapi.com.br/api/cnpj/v1/
    {cnpj}, minhareceita.org/{cnpj}) only support single-CNPJ lookup by
    exact number. They cannot answer "how many padarias are within 300m of
    this corner" - there is no aggregate/geographic search endpoint on
    either service.

So, as the task instructs for this situation, we use the OpenStreetMap
Overpass API (https://overpass-api.de/api/interpreter) as a real-world
competitor-density proxy instead: it indexes real shop=*/amenity=* tags
with real coordinates, and supports exactly the "count features of tag X
within radius Y of point Z" query we need. This is OSM-sourced competition
data, not Receita Federal CNPJ data - it undercounts informal/unlisted
businesses and overcounts in areas OSM volunteers have mapped more
thoroughly, but it is real, live, public data rather than a fabricated
number.

Every cidades/<slug>.js bairro already ships its own real competitor count
per business type (`conc`, and per-street `din`), sourced by SpotLocal
itself from a combination of OSM and Receita Federal data per the site's
methodology - that remains the primary, finer-grained signal used in
real_model.py. The Overpass call here is a *supplementary*, live
cross-check at the neighbourhood center, not the sole source.
"""
import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CACHE_DIR = ROOT / "data_cache"
CACHE_FILE = CACHE_DIR / "overpass.json"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
TIMEOUT_S = 5

# Maps our internal business-type ids to a real OSM shop=*/amenity=* tag
# used for the Overpass query. Types with no clean 1:1 OSM tag are left
# out - for those we rely solely on the bundled per-street/per-bairro
# `conc`/`din` figures.
NEG_TO_OSM_TAG = {
    "padaria": "shop=bakery",
    "restaurante": "amenity=restaurant",
    "lanchonete": "amenity=fast_food",
    "acai": "shop=ice_cream",
    "mercadinho": "shop=convenience",
    "farmacia": "amenity=pharmacy",
    "barbearia": "shop=hairdresser",
    "pizzaria": "shop=pizza",  # not a standard tag, usually mapped to amenity=restaurant+cuisine=pizza, kept best-effort
    "roupas": "shop=clothes",
    "pet": "shop=pet",
    "academia": "leisure=fitness_centre",
    "clinica": "amenity=clinic",
}

_mem_cache = None


def _load_cache():
    global _mem_cache
    if _mem_cache is not None:
        return _mem_cache
    try:
        if CACHE_FILE.exists():
            _mem_cache = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
            return _mem_cache
    except Exception as e:
        print(f"[osm_competitors] WARNING: could not read cache: {e}")
    _mem_cache = {}
    return _mem_cache


def _save_cache(cache):
    try:
        CACHE_DIR.mkdir(exist_ok=True)
        CACHE_FILE.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")
    except Exception as e:
        print(f"[osm_competitors] WARNING: could not write cache: {e}")


def get_competitor_count(neg_id, lat, lon, radius_m=400):
    """Real count of OSM-tagged competitors of `neg_id` within `radius_m`
    metres of (lat, lon). Returns (count, fonte) where fonte is one of
    "osm_overpass_live", "osm_overpass_cache" or "unavailable" (no tag
    mapping, or the live call failed with nothing cached yet - callers
    should fall back to the bundled conc/din figures in that case).
    """
    tag = NEG_TO_OSM_TAG.get(neg_id)
    if not tag or lat is None or lon is None:
        return None, "unavailable"

    key = f"{tag}|{round(lat, 3)}|{round(lon, 3)}|{radius_m}"
    cache = _load_cache()
    if key in cache:
        return cache[key], "osm_overpass_cache"

    k, v = tag.split("=")
    query = (
        f"[out:json][timeout:10];"
        f"(node(around:{radius_m},{lat},{lon})[\"{k}\"=\"{v}\"];"
        f"way(around:{radius_m},{lat},{lon})[\"{k}\"=\"{v}\"];);"
        f"out count;"
    )
    try:
        req = urllib.request.Request(
            OVERPASS_URL,
            data=f"data={urllib.parse.quote(query)}".encode("utf-8"),
            headers={"User-Agent": "spotlocal-mock/1.0",
                     "Content-Type": "application/x-www-form-urlencoded"},
        )
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        count = int(data["elements"][0]["tags"]["total"])
        cache[key] = count
        _save_cache(cache)
        return count, "osm_overpass_live"
    except Exception as e:
        print(f"[osm_competitors] WARNING: Overpass query failed for {neg_id} @ ({lat},{lon}): {e}")
        return None, "unavailable"
