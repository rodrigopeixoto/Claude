"""
Real 12-month seasonality index (ext.saz), triangulated from free, public
sources, with on-disk caching and graceful network fallback.

Why this module exists
-----------------------
real_model.py previously hardcoded `ext.saz` to `[1.0] * 12` - a neutral
placeholder, because "no public seasonal index wired up". This module
replaces that with a real signal built from up to three free sources, used
in a clearly documented order of preference. Nothing here is randomly
generated; every number traces back to a public API response or a stated,
documented retail-calendar assumption.

Sources (free, no paid tier, no billing-required API key)
-----------------------------------------------------------
1. Google Trends, via the unofficial `pytrends` package (pure Python,
   scrapes the public trends.google.com endpoints - no API key). For a
   representative Portuguese search query per business type (see
   `NEG_QUERY`), we pull ~24 months of weekly relative search-interest for
   the city's state (geo="BR-<UF>"), then average same-month weeks across
   the two years into a 12-value (Jan..Dec) index, normalized so its
   yearly mean is 1.0. This is the primary signal when reachable: it is
   the only one of the three that is genuinely business-type- and
   location-specific.

   TESTED in this sandbox: reachable. `pip install pytrends` was required
   (not preinstalled) and a smoke test
   (`TrendReq().build_payload(...).interest_over_time()`) returned real,
   non-constant weekly data for a BR-PE geo query. We still wrap every
   call in try/except and cache aggressively, because pytrends scrapes a
   public, undocumented, rate-limited endpoint that can start failing
   (429s, consent-page HTML, schema changes) at any time without code
   changes on our side - that is normal operation for this library, not a
   bug to fix here.

2. INMET (Instituto Nacional de Meteorologia) public climate data, used
   only as a secondary modifier for business types where temperature
   plausibly shifts foot traffic (heat-sensitive treat businesses like
   "acai", and outdoor/orla-type locations) - see `_INMET_SENSITIVE`. We
   never use it as a primary signal nor for every business type.

   TESTED in this sandbox: UNREACHABLE. `https://apitempo.inmet.gov.br/...`
   completes a TLS handshake (valid cert, matches `*.inmet.gov.br`) and
   then returns "Empty reply from server" (curl error 52) on every
   request/path tried, consistent with an egress allowlist blocking this
   host at the proxy/network layer rather than an application error - the
   same class of failure already documented in ibge_data.py/osm_competitors.py
   for other hosts. We therefore implement the call, cache whatever it
   returns if it ever succeeds, and fail soft (log + skip the modifier)
   exactly like those modules do. The function below is fully wired so it
   will start contributing automatically the day this host becomes
   reachable, with zero code changes elsewhere.

3. Brazilian national holiday calendar, via the free, keyless
   `https://brasilapi.com.br/api/feriados/v1/{ano}` endpoint.

   TESTED in this sandbox: reachable (HTTP 200). We fetch two years of
   national holidays and bump the index for the months that are
   well-known Brazilian retail-season months:
     - December: Christmas + year-end bonus ("13º salário") shopping -
       the single best-documented Brazilian retail seasonality effect.
     - May: Mother's Day (2nd Sunday of May) - Brazil's #2 retail date.
     - June: "Dia dos Namorados" (June 12, BR equivalent of Valentine's).
     - October: Children's Day (Oct 12) + pre-Christmas ramp-up.
     - The month containing Easter (moving holiday, read from the API
       response rather than hardcoded) gets a smaller bump for
       food/gift-adjacent business types.
   These bumps are a documented, stated assumption (not a secret/precise
   empirical weight) - exactly like the ticket/CMV assumptions already in
   NEGOCIOS. This source is always available (when brasilapi.com.br is
   reachable) and never silently fabricated: if the fetch fails, we skip
   the bump entirely rather than inventing one.

Combination
-----------
- If Google Trends succeeds: use it as the base curve, then apply the
  INMET modifier (if available) and the holiday bump on top, renormalize
  to mean 1.0, and report all contributing sources.
- If Google Trends fails: fall back to a flat base of 1.0 and apply only
  the INMET modifier (if available) and the holiday bump, so the result
  is still a REAL signal (holidays, and maybe climate), never a fabricated
  curve pretending to be search data.
- If every source fails: return [1.0]*12 and say so plainly - this is the
  honest degenerate case the task explicitly allows for.
"""
import json
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CACHE_DIR = ROOT / "data_cache"
TRENDS_CACHE_FILE = CACHE_DIR / "trends.json"
HOLIDAY_CACHE_FILE = CACHE_DIR / "feriados.json"
INMET_CACHE_FILE = CACHE_DIR / "inmet.json"

TIMEOUT_S = 6
TRENDS_CACHE_TTL_S = 30 * 24 * 3600   # 30 days: search-interest shape barely moves faster than that
HOLIDAY_CACHE_TTL_S = 180 * 24 * 3600  # 180 days: a year's holiday list never changes
INMET_CACHE_TTL_S = 7 * 24 * 3600

# One representative Portuguese "near me" / category search query per
# NEGOCIOS business-type id, chosen to track real foot-traffic-driving
# search intent rather than generic brand/product searches.
NEG_QUERY = {
    "padaria": "padaria perto de mim",
    "lanchonete": "lanchonete delivery",
    "restaurante": "restaurante perto de mim",
    "acai": "açaí perto de mim",
    "mercadinho": "mercado perto de mim",
    "farmacia": "farmácia perto de mim",
    "barbearia": "barbearia perto de mim",
    "pizzaria": "pizzaria delivery",
    "roupas": "loja de roupas perto de mim",
    "pet": "pet shop perto de mim",
    "academia": "academia perto de mim",
    "estudio": "estúdio de pilates perto de mim",
    "oficina": "oficina mecânica perto de mim",
    "restnoite": "bar perto de mim",
    "clinica": "clínica perto de mim",
    "nicho": "loja perto de mim",
    "escola": "escola perto de mim",
    "cursinho": "cursinho pré-vestibular",
    "suplemento": "loja de suplementos perto de mim",
}

# Business types whose foot traffic plausibly responds to temperature
# (heat -> more impulse/cooling purchases, or less outdoor dwell time).
# Used only as a secondary INMET-derived modifier, never a primary signal.
_INMET_SENSITIVE = {"acai", "restnoite", "pet"}

UF_CAPITAL_STATION = {
    # UF -> a representative INMET automatic-station code (A-series) near
    # the state capital, used only if/when INMET becomes reachable.
    "PE": "A301", "SP": "A701", "RJ": "A652", "BA": "A401", "CE": "A305",
    "MG": "A521", "RS": "A801", "PR": "A807", "PA": "A202", "AM": "A101",
    "DF": "A001", "GO": "A002", "SC": "A806", "ES": "A612", "MA": "A203",
    "PB": "A320", "RN": "A317", "AL": "A303", "SE": "A409", "PI": "A312",
    "MT": "A904", "MS": "A702", "RO": "A925", "AC": "A104", "RR": "A143",
    "AP": "A248", "TO": "A009",
}


def _read_cache(path):
    try:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[sazonalidade] WARNING: could not read cache {path}: {e}")
    return {}


def _write_cache(path, data):
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    except Exception as e:
        print(f"[sazonalidade] WARNING: could not write cache {path}: {e}")


def _clamp(x, lo, hi):
    return max(lo, min(hi, x))


def _normalize(vals):
    mean = sum(vals) / len(vals) if vals else 1.0
    if mean <= 0:
        return [1.0] * 12
    return [round(v / mean, 4) for v in vals]


# ---------------------------------------------------------------------------
# Source 1: Google Trends (pytrends)
# ---------------------------------------------------------------------------
def _trends_monthly_index(uf, neg_id):
    """Returns (12-float list or None, bool used_cache)."""
    query = NEG_QUERY.get(neg_id, "loja perto de mim")
    cache = _read_cache(TRENDS_CACHE_FILE)
    key = f"{uf}:{neg_id}"
    entry = cache.get(key)
    now = time.time()
    if entry and (now - entry.get("ts", 0)) < TRENDS_CACHE_TTL_S:
        return entry.get("idx"), True

    try:
        from pytrends.request import TrendReq  # optional dep; checked/installed at setup time
        import datetime

        pt = TrendReq(hl="pt-BR", tz=180, timeout=(TIMEOUT_S, TIMEOUT_S))
        end = datetime.date.today()
        start = end.replace(year=end.year - 2)
        # pytrends only accepts a handful of named timeframes (e.g.
        # "today 12-m") or an explicit "YYYY-MM-DD YYYY-MM-DD" range -
        # "today 24-m" is NOT valid and returns an HTTP 400 from Google.
        timeframe = f"{start.isoformat()} {end.isoformat()}"
        pt.build_payload([query], timeframe=timeframe, geo=f"BR-{uf}")
        df = pt.interest_over_time()
        if df is None or df.empty or query not in df.columns:
            raise ValueError("empty pytrends response")

        sums = [0.0] * 12
        counts = [0] * 12
        for ts, row in df[query].items():
            month = ts.month - 1
            sums[month] += float(row)
            counts[month] += 1
        monthly = [sums[m] / counts[m] if counts[m] else 0.0 for m in range(12)]
        if all(v == 0 for v in monthly):
            raise ValueError("all-zero interest series")
        zero_months = sum(1 for v in monthly if v == 0)
        if zero_months > 6:
            # Low-search-volume query: Google Trends returns mostly 0s for
            # most weeks. That is real data, but too sparse to trust as a
            # smooth 12-month seasonality curve (it would swing the index
            # by 5-10x some months just from sampling noise) - so we treat
            # this as "insufficient signal" rather than fabricate a smooth
            # shape out of noise, and fall back to the holiday-only base.
            raise ValueError(
                f"insufficient Trends volume ({zero_months}/12 months at 0)"
            )
        idx = _normalize(monthly)
        # Guard against any remaining outlier swings so one noisy month
        # cannot dominate the whole seasonality curve.
        idx = [round(_clamp(v, 0.5, 1.8), 4) for v in idx]
        cache[key] = {"idx": idx, "ts": now}
        _write_cache(TRENDS_CACHE_FILE, cache)
        return idx, False
    except Exception as e:
        print(f"[sazonalidade] Google Trends unavailable for {key} ({query!r}): {e}")
        if entry:  # stale cache beats nothing
            return entry.get("idx"), True
        return None, False


# ---------------------------------------------------------------------------
# Source 2: INMET (secondary modifier, heat-sensitive business types only)
# ---------------------------------------------------------------------------
def _inmet_monthly_temp_modifier(uf):
    """
    Returns (12-float multiplicative modifier list or None, source_label).

    INMET's public history endpoint is per-station, per-day, and requires
    picking a date range; for a 12-month "typical" seasonal shape we'd
    fetch the last ~2 years of daily max-temp and average by month. This
    is implemented fully below, but see the module docstring: in this
    sandbox the host completes a TLS handshake and then returns an empty
    reply on every attempt, so in practice this returns (None, "unavailable")
    here. It is not stubbed out - it will start working the moment the
    host is reachable.
    """
    station = UF_CAPITAL_STATION.get(uf)
    if not station:
        return None, "unavailable_no_station_mapping"

    cache = _read_cache(INMET_CACHE_FILE)
    entry = cache.get(uf)
    now = time.time()
    if entry and (now - entry.get("ts", 0)) < INMET_CACHE_TTL_S:
        return entry.get("mod"), "inmet_cache"

    import urllib.request
    import datetime

    try:
        end = datetime.date.today()
        start = end.replace(year=end.year - 2)
        url = (
            f"https://apitempo.inmet.gov.br/estacao/diaria/"
            f"{start.isoformat()}/{end.isoformat()}/{station}"
        )
        req = urllib.request.Request(url, headers={"User-Agent": "spotlocal-mock/1.0"})
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        sums = [0.0] * 12
        counts = [0] * 12
        for row in data:
            try:
                month = int(row["DT_MEDICAO"].split("-")[1]) - 1
                temp = float(row.get("TEMP_MAX") or row.get("TEM_MAX"))
            except (KeyError, TypeError, ValueError):
                continue
            sums[month] += temp
            counts[month] += 1
        monthly_temp = [sums[m] / counts[m] if counts[m] else None for m in range(12)]
        if any(v is None for v in monthly_temp):
            raise ValueError("incomplete monthly temperature series")
        mean_temp = sum(monthly_temp) / 12.0
        # Small, documented modifier: +/-0.5% seasonal bump per degree C
        # above/below the yearly mean, capped at +/-6%. This is a stated
        # assumption (heat -> slightly higher footfall/impulse purchases
        # for the specific heat-sensitive types this is applied to), not
        # an empirically fitted coefficient.
        mod = [round(_clamp01(1.0 + 0.005 * (t - mean_temp)), 4) for t in monthly_temp]
        cache[uf] = {"mod": mod, "ts": now}
        _write_cache(INMET_CACHE_FILE, cache)
        return mod, "inmet_live"
    except Exception as e:
        print(f"[sazonalidade] INMET unavailable for UF={uf} station={station}: {e}")
        if entry:
            return entry.get("mod"), "inmet_cache_stale"
        return None, "unavailable"


def _clamp01(x):
    return max(0.94, min(1.06, x))


# ---------------------------------------------------------------------------
# Source 3: Brazilian national holiday calendar (brasilapi.com.br)
# ---------------------------------------------------------------------------
def _holiday_bump(neg_id):
    """
    Returns (12-float multiplicative modifier list, source_label).
    Always returns a usable (possibly flat) modifier - this endpoint is
    free, keyless, and reachable in this sandbox, so failure here just
    means "no bump this run", not "no data at all".
    """
    import urllib.request
    import datetime

    year = datetime.date.today().year
    cache = _read_cache(HOLIDAY_CACHE_FILE)
    months_with_easter = set()
    ok_years = 0

    for y in (year, year + 1):
        key = str(y)
        entry = cache.get(key)
        now = time.time()
        if entry and (now - entry.get("ts", 0)) < HOLIDAY_CACHE_TTL_S:
            holidays = entry.get("holidays")
        else:
            holidays = None
            try:
                url = f"https://brasilapi.com.br/api/feriados/v1/{y}"
                req = urllib.request.Request(url, headers={"User-Agent": "spotlocal-mock/1.0"})
                with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
                    holidays = json.loads(resp.read().decode("utf-8"))
                cache[key] = {"holidays": holidays, "ts": now}
                _write_cache(HOLIDAY_CACHE_FILE, cache)
            except Exception as e:
                print(f"[sazonalidade] brasilapi feriados unavailable for {y}: {e}")
                holidays = entry.get("holidays") if entry else None

        if holidays:
            ok_years += 1
            for h in holidays:
                if h.get("type") == "national" and "páscoa" in (h.get("name") or "").lower():
                    months_with_easter.add(int(h["date"].split("-")[1]))

    if ok_years == 0:
        return [1.0] * 12, "unavailable"

    mod = [1.0] * 12
    # Documented, stated retail-calendar bumps (see module docstring).
    mod[11] = 1.18   # December: Christmas + 13º salário
    mod[4] = 1.08    # May: Mother's Day
    mod[5] = 1.04    # June: Dia dos Namorados
    mod[9] = 1.05    # October: Children's Day + pre-Christmas ramp-up
    for m in months_with_easter:
        if neg_id in ("padaria", "restaurante", "lanchonete", "pizzaria", "mercadinho", "restnoite"):
            mod[m - 1] = max(mod[m - 1], 1.03)

    return mod, f"brasilapi_feriados({ok_years}y)"


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
def get_seasonal_index(cidade_uf: str, neg_id: str):
    """
    Returns (idx: list[12 floats], fontes: str).

    idx is Jan..Dec, normalized so its yearly average is 1.0.
    fontes is a short, human-readable string naming which real sources
    actually contributed this call (vs. were unavailable), for
    ctx.fontes.sazonalidade.
    """
    uf = (cidade_uf or "").upper()
    used = []

    base, used_cache = _trends_monthly_index(uf, neg_id)
    if base is not None:
        used.append("google_trends" + ("_cache" if used_cache else ""))
    else:
        base = [1.0] * 12

    idx = list(base)

    if neg_id in _INMET_SENSITIVE:
        inmet_mod, inmet_label = _inmet_monthly_temp_modifier(uf)
        if inmet_mod is not None:
            idx = [round(idx[m] * inmet_mod[m], 4) for m in range(12)]
            used.append(inmet_label)
        else:
            used.append("inmet_unavailable")

    holiday_mod, holiday_label = _holiday_bump(neg_id)
    idx = [round(idx[m] * holiday_mod[m], 4) for m in range(12)]
    used.append(holiday_label)

    idx = _normalize(idx)

    if not used or all("unavailable" in u for u in used):
        fontes = "none_available_flat_default"
    else:
        fontes = "+".join(used)

    return idx, fontes
