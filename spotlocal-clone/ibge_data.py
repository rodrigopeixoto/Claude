"""
Real IBGE population data, with on-disk caching and graceful network fallback.

Why this module exists
-----------------------
mock_api_server.py needs a real (not made-up) population figure per capital
to scale demand. Every `cidades/<slug>.js` file already ships a `pop` field
(population) and `renda` field (average household income) for its capital,
which SpotLocal itself sources from IBGE/Receita Federal per the site's own
"sobre" page. Rather than re-inventing those numbers, this module:

  1. Uses the bundled per-city `pop`/`renda` as the baseline real value
     (seeded once, with no network call needed, into
     data_cache/ibge_seed.json - see the one-off extraction that produced
     it).
  2. Opportunistically refreshes the population figure from IBGE's own
     public SIDRA aggregate API (table 6579 - "População residente
     estimada", a real published IBGE aggregate, municipality level),
     caching whatever it gets to data_cache/ibge.json so we never hit the
     network more than once per city.
  3. If the live IBGE call fails for any reason (offline, rate-limited,
     TLS/cert problems on the egress path, API shape changes, etc.) we log
     a warning and fall back to the last cached value, or to the bundled
     seed value, labeled accordingly. We never crash the server over this.

Endpoints used (public, no key required):
  - https://servicodados.ibge.gov.br/api/v1/localidades/municipios
      (list of municipalities -> resolve "<capital>, <UF>" to an IBGE
      municipality id once, cached)
  - https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/-1/
      variaveis/9324?localidades=N6[<municipio_id>]
      (SIDRA aggregate 6579 = Estimativas de população; variable 9324 =
      população residente estimada, most recent period)
"""
import json
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CACHE_DIR = ROOT / "data_cache"
CACHE_FILE = CACHE_DIR / "ibge.json"
SEED_FILE = CACHE_DIR / "ibge_seed.json"
MUNICIPIOS_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios"
SIDRA_POP_URL = (
    "https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/-1/"
    "variaveis/9324?localidades=N6[{municipio_id}]"
)
TIMEOUT_S = 4

_mem_cache = None  # loaded once per process


def _load_json(path):
    try:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[ibge_data] WARNING: could not read {path}: {e}")
    return {}


def _save_json(path, obj):
    try:
        CACHE_DIR.mkdir(exist_ok=True)
        path.write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")
    except Exception as e:
        print(f"[ibge_data] WARNING: could not write {path}: {e}")


def _http_get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "spotlocal-mock/1.0"})
    with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _cache():
    global _mem_cache
    if _mem_cache is None:
        _mem_cache = _load_json(CACHE_FILE)
    return _mem_cache


def _find_municipio_id(nome, uf):
    """Resolve a capital name + UF to its IBGE municipality id, via the
    public localidades API, caching the whole municipality list so this
    network call happens at most once ever on a given machine."""
    cache = _cache()
    key = "municipios_by_uf_nome"
    table = cache.get(key)
    if table is None:
        try:
            data = _http_get_json(MUNICIPIOS_URL)
            table = {}
            for m in data:
                try:
                    uf_sigla = m["microrregiao"]["mesorregiao"]["UF"]["sigla"]
                except Exception:
                    try:
                        uf_sigla = m["regiao-imediata"]["regiao-intermediaria"]["UF"]["sigla"]
                    except Exception:
                        continue
                table[f"{m['nome'].lower()}|{uf_sigla.lower()}"] = m["id"]
            cache[key] = table
            _save_json(CACHE_FILE, cache)
        except Exception as e:
            print(f"[ibge_data] WARNING: could not fetch municipios list: {e}")
            table = cache.get(key) or {}
    return table.get(f"{nome.lower()}|{uf.lower()}")


def get_population(cidade_slug, nome, uf, fallback_pop):
    """Return the best available real population figure for a capital.

    Tries, in order: fresh IBGE SIDRA fetch -> last cached IBGE value ->
    the population figure bundled in cidades/<slug>.js (`fallback_pop`,
    itself IBGE/Receita-derived per the site's own sourcing). Never raises;
    always returns a number plus a `fonte` tag describing where it came
    from, so callers/logs can see when live data wasn't used.
    """
    cache = _cache()
    entry = cache.get(cidade_slug) or {}

    try:
        municipio_id = _find_municipio_id(nome, uf)
        if municipio_id:
            data = _http_get_json(SIDRA_POP_URL.format(municipio_id=municipio_id))
            # Shape: [{"resultados":[{"series":[{"serie":{"<periodo>":"<valor>"}}]}]}]
            serie = data[0]["resultados"][0]["series"][0]["serie"]
            valor = list(serie.values())[-1]
            pop = int(str(valor).replace(".", "").replace(",", "."))
            entry = {"pop": pop, "fonte": "ibge_sidra_6579_live"}
            cache[cidade_slug] = entry
            _save_json(CACHE_FILE, cache)
            return pop, "ibge_sidra_6579_live"
    except Exception as e:
        print(f"[ibge_data] WARNING: live IBGE population fetch failed for {cidade_slug}: {e}")

    if entry.get("pop"):
        return entry["pop"], entry.get("fonte", "ibge_cache")

    seed = _load_json(SEED_FILE).get(cidade_slug)
    if seed and seed.get("pop"):
        return seed["pop"], "bundled_seed(cidades_js)"

    return fallback_pop, "fallback_default"
