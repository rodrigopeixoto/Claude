"""
One-off / re-runnable offline build script: turns the raw IBGE Censo 2022
sector-level files cached under data_cache/ into a compact per-sector JSON
(data_cache/setores_demografia.json) that demografia_setor.py loads at
runtime. This script is NOT imported by the running server - it is a build
step the owner (or a future session) re-runs whenever the raw downloads are
refreshed.

PILOT SCOPE: Recife (PE, CD_MUN=2611606) and Sao Paulo (SP, CD_MUN=3550308)
only, per the task. Extending to other capitals means downloading that
state's sector gpkg too and adding its CD_MUN here.

Sources (real, official IBGE, downloaded 2026-10-15 - re-download from these
same URLs to refresh; the IBGE geoftp/ftp directory layout has changed before
and may change again, so re-check the listing if a URL 404s):

  1. Census-sector boundary geometry (2022 malha de setores censitarios),
     GeoPackage, per state (only PE and SP fetched, not the whole country):
       https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/
       malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022/
       setores/gpkg/UF/PE/PE_setores_CD2022.gpkg   (~42 MB)
       .../UF/SP/SP_setores_CD2022.gpkg            (~170 MB - whole SP state;
       large because Sao Paulo state has ~95k sectors, but still a single
       file download, not per-municipio; we only use the ~19k sectors that
       fall in CD_MUN=3550308 out of it)

  2. Censo 2022 sector-level aggregate tables ("Agregados por Setores
     Censitarios"), whole-Brazil CSVs (no per-state cut is published, so we
     downloaded the Brazil-wide file and filtered locally to our two
     municipios' CD_SETOR prefixes):
       https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/
       Agregados_por_Setores_Censitarios/Agregados_por_Setor_csv/
       Agregados_por_setores_demografia_BR.zip   (pop by sex/age, ~22 MB)
       dicionario_de_dados_agregados_por_setores_censitarios_20260520.xlsx
       (column dictionary - "Dicionario nao PCT" sheet, V01006-V01041)

       https://ftp.ibge.gov.br/Censos/Censo_Demografico_2022/
       Agregados_por_Setores_Censitarios_Rendimento_do_Responsavel/
       Agregados_por_setores_renda_responsavel_BR_20260508_csv.zip
       (household-head income, ~9 MB)
       dicionario_de_dados_renda_responsavel_20260508.xlsx
       (V06002 = moradores, V06004 = mean nominal income, V06006 = median)

Variables used from the demografia table (V01xxx, per the dictionary above):
  V01006 = total moradores (population) in the sector
  V01007 / V01008 = male / female population
  V01031..V01041 = population by 11 age bands (0-4 ... 70+), both sexes
Variables used from the renda_responsavel table:
  V06004 = mean nominal monthly income of household heads with income (R$)
  V06002 = moradores in occupied private households (income-table population,
           used only as an income-data-availability check, not as the
           population figure - V01006 above is used for population)

IMPORTANT, HONEST CAVEATS (read before trusting a number from this cache):
  - This is SECTOR-level (setor censitario) census data, not per-street.
    IBGE does not publish, and has never published, per-street demographic
    counts; no such dataset exists publicly. A "setor censitario" is IBGE's
    smallest enumeration area, typically a few blocks (a few hundred to a
    few thousand residents).
  - A handful (<1%) of sectors have null/zero income or population values
    where IBGE itself suppressed or could not estimate the figure (common in
    low-occupancy, non-residential or rural sectors); these are skipped when
    computing an aggregate rather than treated as zero.
  - Centroid = shapely true polygon centroid of the official 2022 sector
    polygon (area centroid, not a vertex average). This is the real
    geographic center of the sector, which is a legitimate sector-level
    position, but it is NOT a per-street coordinate - see demografia_setor.py
    for how (and how imperfectly) this gets attached to a street's estimate.
"""
import json
import re
import sqlite3
import zipfile
from pathlib import Path

from shapely import wkb as swkb

ROOT = Path(__file__).resolve().parent
CACHE_DIR = ROOT / "data_cache"
OUT_FILE = CACHE_DIR / "setores_demografia.json"

# slug -> (CD_MUN, state gpkg filename)
PILOT_CIDADES = {
    "recife": ("2611606", "PE_setores_CD2022.gpkg"),
    "sao-paulo": ("3550308", "SP_setores_CD2022.gpkg"),
}

AGE_BAND_COLS = [  # (csv column name, label)
    ("V01031", "0-4"), ("V01032", "5-9"), ("V01033", "10-14"), ("V01034", "15-19"),
    ("V01035", "20-24"), ("V01036", "25-29"), ("V01037", "30-39"), ("V01038", "40-49"),
    ("V01039", "50-59"), ("V01040", "60-69"), ("V01041", "70+"),
]


def _parse_gpkg_geom(blob):
    """Strip the GeoPackage geometry header (magic+version+flags+srs_id+
    optional envelope) and return the standard WKB payload underneath."""
    if blob is None or blob[0:2] != b"GP":
        return None
    flags = blob[3]
    env_indicator = (flags >> 1) & 0x07
    env_bytes = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}.get(env_indicator, 0)
    header_len = 8 + env_bytes
    try:
        return swkb.loads(blob[header_len:])
    except Exception:
        return None


def _load_demografia_csv():
    """Load the Brazil-wide demografia CSV once, keyed by CD_setor, keeping
    only the columns we need (population, sex, age bands). Returns dict."""
    zpath = CACHE_DIR / "setores_demografia_BR.zip"
    out = {}
    with zipfile.ZipFile(zpath) as z:
        name = [n for n in z.namelist() if n.lower().endswith(".csv")][0]
        with z.open(name) as f:
            header = f.readline().decode("utf-8").strip().strip("﻿")
            cols = [c.strip('"') for c in header.split(";")]
            idx = {c: i for i, c in enumerate(cols)}
            want = {"V01006", "V01007", "V01008"} | {c for c, _ in AGE_BAND_COLS}
            for raw in f:
                line = raw.decode("utf-8", "replace").rstrip("\r\n")
                if not line:
                    continue
                parts = line.split(";")
                cd_setor = parts[0].strip('"')
                rec = {}
                for col in want:
                    i = idx.get(col)
                    if i is None or i >= len(parts):
                        continue
                    v = parts[i].strip('"')
                    try:
                        rec[col] = int(float(v.replace(",", ".")))
                    except Exception:
                        rec[col] = None
                out[cd_setor] = rec
    return out


def _load_renda_csv():
    zpath = CACHE_DIR / "setores_renda_BR.zip"
    out = {}
    with zipfile.ZipFile(zpath) as z:
        name = [n for n in z.namelist() if n.lower().endswith(".csv")][0]
        with z.open(name) as f:
            header = f.readline().decode("utf-8").strip().strip("﻿")
            cols = [c.strip('"') for c in header.split(";")]
            idx = {c: i for i, c in enumerate(cols)}
            for raw in f:
                line = raw.decode("utf-8", "replace").rstrip("\r\n")
                if not line:
                    continue
                parts = line.split(";")
                cd_setor = parts[0].strip('"')
                try:
                    i6004 = idx.get("V06004")
                    renda = parts[i6004].strip('"') if i6004 is not None and i6004 < len(parts) else ""
                    renda_val = float(renda.replace(",", ".")) if renda not in ("", "X", "NULL") else None
                except Exception:
                    renda_val = None
                out[cd_setor] = renda_val
    return out


def main():
    print("[build_census_sector_cache] loading Brazil-wide demografia/renda CSVs ...")
    demo = _load_demografia_csv()
    renda = _load_renda_csv()
    print(f"  demografia rows: {len(demo)}, renda rows: {len(renda)}")

    all_setores = {}  # cidade_slug -> list of sector dicts
    for slug, (cd_mun, gpkg_name) in PILOT_CIDADES.items():
        gpkg_path = CACHE_DIR / gpkg_name
        table = gpkg_name.replace(".gpkg", "")
        print(f"[build_census_sector_cache] {slug}: reading {gpkg_name} ...")
        con = sqlite3.connect(str(gpkg_path))
        cur = con.cursor()
        rows = cur.execute(
            f'SELECT CD_SETOR, geom, AREA_KM2, CD_BAIRRO, NM_BAIRRO, CD_DIST, NM_DIST '
            f'FROM "{table}" WHERE CD_MUN=?',
            (cd_mun,),
        ).fetchall()
        con.close()
        print(f"  {len(rows)} sectors in {slug}")

        setores = []
        skipped_geom = skipped_demo = 0
        for cd_setor, geom_blob, area_km2, cd_bairro, nm_bairro, cd_dist, nm_dist in rows:
            geom = _parse_gpkg_geom(geom_blob)
            if geom is None:
                skipped_geom += 1
                continue
            c = geom.centroid
            d = demo.get(cd_setor)
            if not d or not d.get("V01006"):
                skipped_demo += 1
                continue
            faixas = {}
            for col, label in AGE_BAND_COLS:
                v = d.get(col)
                if v is not None:
                    faixas[label] = v
            setores.append({
                "cd_setor": cd_setor,
                "lon": round(c.x, 6),
                "lat": round(c.y, 6),
                "area_km2": area_km2,
                "cd_bairro": cd_bairro,
                "nm_bairro": nm_bairro,
                "cd_dist": cd_dist,
                "nm_dist": nm_dist,
                "pop": d.get("V01006"),
                "pop_m": d.get("V01007"),
                "pop_f": d.get("V01008"),
                "faixas": faixas,
                "renda_media": renda.get(cd_setor),
            })
        print(f"  kept {len(setores)} sectors (skipped {skipped_geom} no-geom, {skipped_demo} no-demografia)")
        all_setores[slug] = setores

    CACHE_DIR.mkdir(exist_ok=True)
    OUT_FILE.write_text(json.dumps(all_setores, ensure_ascii=False), encoding="utf-8")
    print(f"[build_census_sector_cache] wrote {OUT_FILE} ({OUT_FILE.stat().st_size/1e6:.1f} MB)")


if __name__ == "__main__":
    main()
