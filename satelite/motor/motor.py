#!/usr/bin/env python3
"""Motor satelital NODO VAH · Gómez Palacio, Dgo.

Busca zonas urbanas que se mantienen húmedas en temporada seca (posibles fugas de agua
potable o drenaje) con Copernicus Sentinel-2 L2A (Earth Search, sin llave), descarta
escenas tras lluvia (Open-Meteo/ERA5), sigue cada zona entre corridas y escribe capas
GeoJSON para el panel «Vigilancia satelital» del visor (nodo-vah-4d/data/satelite/).

Uso:  python satelite/motor/motor.py [--hoy AAAA-MM-DD] [--sin-png]
Nunca inventa zonas: si nada pasa los umbrales, escribe una FeatureCollection vacía.
"""
import warnings; warnings.filterwarnings("ignore")
import argparse, json, math, os, re, sys, time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone

import numpy as np
import rasterio
import requests
from pyproj import Transformer
from pystac_client import Client
from rasterio.enums import Resampling
from rasterio.features import rasterize, shapes
from rasterio.warp import reproject, transform_bounds
from rasterio.windows import from_bounds
from scipy import ndimage
from shapely.geometry import LineString, Point, box, mapping, shape
from shapely.ops import transform as shp_tr, unary_union
from shapely.strtree import STRtree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import osm_cache  # noqa: E402

VERSION = "1.0.0"
AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", ".."))
SALIDA = os.path.join(RAIZ, "nodo-vah-4d", "data", "satelite")
ESTADO = os.path.join(AQUI, "estado", "seguimiento.json")
CIUDAD_JS = os.path.join(RAIZ, "nodo-vah-4d", "data", "ciudad_osm.js")

os.environ.setdefault("AWS_NO_SIGN_REQUEST", "YES")
os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("GDAL_HTTP_MAX_RETRY", "4")
os.environ.setdefault("GDAL_HTTP_RETRY_DELAY", "2")
os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".tif")

CFG = {
    "stac": "https://earth-search.aws.element84.com/v1",
    "coleccion": "sentinel-2-l2a",
    "bbox": [-103.56, 25.50, -103.42, 25.63],     # recorte urbano; se intersecta con el municipio (poniente del Nazas)
    "punto_lluvia": [25.56, -103.50],              # centro de Gómez Palacio para Open-Meteo
    "meses_secos": [11, 12, 1, 2, 3, 4, 5],        # igual que Pulso: fuera de lluvias (jun-oct)
    "ventana_dias": 365,                           # último año (igual que Pulso)
    "nubes_tile_max": 40,                          # eo:cloud_cover del tile (filtro grueso)
    "claro_aoi_min": 0.70,                         # >= 70 % de píxeles urbanos útiles (SCL 4,5,6)
    "scl_validos": [4, 5, 6],                      # igual que Pulso
    "dias_recientes": 45,                          # Pulso: «nueva» = anómala en los últimos 45 días
    "delta_ndmi_lluvia": 0.04,                     # Pulso usa +0.03 sobre NDMI sin corregir offset BOA (-1000); en NDMI físico equivale a ~+0.04
    "z_nueva": 2.5, "z_sobre_historia": 2.0,       # Pulso: z_escena > 2.5 y z_escena - z_histórico > 2
    "z_cronica": 2.0,                              # Pulso: humedad constante z > 2
    "historia_max_nueva": 0.20,                    # Pulso: < 20 % de su historia
    "lluvia_3d_max": 2.0, "lluvia_7d_max": 5.0,    # mm: escena «tras lluvia» si se rebasa
    "persistencia_min": 0.6,                       # igual que Pulso
    "ndvi_max": 0.35,                              # igual que Pulso: descarta vegetación densa
    "min_pixeles": 4,                              # píxeles de 20 m (1,600 m²)
    "buffer_mascara_m": 20,                        # parques, cultivos, agua (OSM) + 20 m
    "max_zonas": 200,
    "union_m": 60, "iou_min": 0.10, "corridas_para_retirar": 3,
}
# Modo estricto (menos zonas, más seguras): MOTOR_MODO=estricto o --modo estricto
ESTRICTO = {"z_nueva": 3.0, "z_cronica": 2.5, "persistencia_min": 0.8, "min_pixeles": 6, "claro_aoi_min": 0.85,
            "historia_max_nueva": 0.10}
FUENTE_S2 = "Copernicus Sentinel-2 L2A vía Earth Search (Element 84)"
ETIQUETA = "Zona a revisar con cámara"
WC_URL = "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N24W105_Map.tif"


_SELLOS = ("generado", "ultima_corrida")


def _sin_sellos(o):
    if isinstance(o, dict):
        return {k: _sin_sellos(v) for k, v in o.items() if k not in _SELLOS}
    if isinstance(o, list):
        return [_sin_sellos(v) for v in o]
    return o


def escribir(path, obj, **kw):
    """Escribe JSON solo si cambió algo más que la hora de generación (evita commits vacíos)."""
    if os.path.exists(path):
        try:
            with open(path, encoding="utf-8") as fh:
                if _sin_sellos(json.load(fh)) == _sin_sellos(json.loads(json.dumps(obj, ensure_ascii=False))):
                    return False
        except (ValueError, OSError):
            pass
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, **(kw or {"separators": (",", ":")}))
    return True


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


# ---------------------------------------------------------------- lluvia (Open-Meteo)
def lluvia_diaria(ini: date, fin: date):
    """mm/día en Gómez Palacio. Archivo ERA5 (Open-Meteo archive) y, para los días aún sin
    archivo, el modelo de pronóstico con past_days. Sin llave."""
    lat, lon = CFG["punto_lluvia"]
    out = {}
    r = requests.get("https://archive-api.open-meteo.com/v1/archive", timeout=60, params={
        "latitude": lat, "longitude": lon, "start_date": ini.isoformat(), "end_date": fin.isoformat(),
        "daily": "precipitation_sum", "timezone": "America/Mexico_City"})
    r.raise_for_status()
    d = r.json()["daily"]
    for t, p in zip(d["time"], d["precipitation_sum"]):
        if p is not None:
            out[t] = {"mm": round(p, 1), "origen": "archivo"}
    faltan = [t for t in (ini + timedelta(days=i) for i in range((fin - ini).days + 1)) if t.isoformat() not in out]
    if faltan and (fin - min(faltan)).days <= 90:
        r = requests.get("https://api.open-meteo.com/v1/forecast", timeout=60, params={
            "latitude": lat, "longitude": lon, "past_days": min(92, (fin - min(faltan)).days + 1),
            "forecast_days": 1, "daily": "precipitation_sum", "timezone": "America/Mexico_City"})
        if r.ok:
            d = r.json()["daily"]
            for t, p in zip(d["time"], d["precipitation_sum"]):
                if t not in out and p is not None and t <= fin.isoformat():
                    out[t] = {"mm": round(p, 1), "origen": "modelo_reciente"}
    return out


def lluvia_previa(serie, dia: date, n):
    vals = [serie.get((dia - timedelta(days=i)).isoformat(), {}).get("mm") for i in range(0, n + 1)]
    if any(v is None for v in vals):
        return None
    return round(sum(vals), 1)


# ---------------------------------------------------------------- raster
def ventana(src, bbox):
    b = transform_bounds("EPSG:4326", src.crs, *bbox)
    return from_bounds(*b, src.transform).round_offsets().round_lengths()


def leer(href, bbox, shape_=None, res=Resampling.average):
    with rasterio.open(href) as s:
        w = ventana(s, bbox)
        a = s.read(1, window=w, out_shape=shape_, resampling=res, boundless=True, fill_value=0)
        tr = s.window_transform(w)
        if shape_ is not None:
            tr = tr * tr.scale(w.width / shape_[1], w.height / shape_[0])
        return a, tr, s.crs


def offset(item):
    if item.properties.get("earthsearch:boa_offset_applied"):
        return 0.0
    try:
        return -1000.0 if float(item.properties.get("s2:processing_baseline", "0")) >= 4 else 0.0
    except ValueError:
        return 0.0


def indices(item, bbox, shp):
    """NDMI (B8A,B11, 20 m) y NDVI (B04,B08 promediados a 20 m) con máscara SCL."""
    A = item.assets
    off = offset(item)
    scl, _, _ = leer(A["scl"].href, bbox, shp, Resampling.nearest)
    malo = np.isin(scl, [0, 1, 2, 3, 7, 8, 9, 10, 11])
    nube = ndimage.binary_dilation(np.isin(scl, [3, 8, 9, 10]), iterations=2)   # orillas de nubes/sombras
    ok = np.isin(scl, CFG["scl_validos"]) & ~malo & ~nube
    b8a = leer(A["nir08"].href, bbox, shp)[0].astype("f4") + off
    b11 = leer(A["swir16"].href, bbox, shp)[0].astype("f4") + off
    b04 = leer(A["red"].href, bbox, shp)[0].astype("f4") + off
    b08 = leer(A["nir"].href, bbox, shp)[0].astype("f4") + off
    with np.errstate(divide="ignore", invalid="ignore"):
        ndmi = (b8a - b11) / (b8a + b11)
        ndvi = (b08 - b04) / (b08 + b04)
    ok &= np.isfinite(ndmi) & np.isfinite(ndvi) & (b8a > 0) & (b11 > 0)
    ndmi[~ok] = np.nan; ndvi[~ok] = np.nan
    return ndmi.astype("f4"), ndvi.astype("f4"), (scl == 6) & ok, ok


def robust_z_escena(ndmi, urb):
    v = ndmi[urb & np.isfinite(ndmi)]
    if v.size < 500:
        return None
    med = np.median(v); mad = np.median(np.abs(v - med)) * 1.4826
    return (ndmi - med) / max(mad, 0.01)


# ---------------------------------------------------------------- referencias del visor
def colectores_visor():
    """Colectores/emisor del visor (trazo REFERENCIAL de ciudad_osm.js) en lon/lat."""
    if not os.path.exists(CIUDAD_JS):
        return []
    s = open(CIUDAD_JS, encoding="utf-8").read()
    s = s[s.index("{"): s.rstrip().rstrip(";").rindex("}") + 1]
    R = json.loads(s).get("redes", {})
    # marco del visor: x = E - EO, z = -(N - NO), UTM 13N (pc_nodo/osm/paso2.py)
    t0 = Transformer.from_crs("EPSG:4326", "EPSG:32613", always_xy=True)
    Et, Nt = t0.transform(-103.462, 25.565)
    EO, NO = Et + 1564, Nt + 2104
    inv = Transformer.from_crs("EPSG:32613", "EPSG:4326", always_xy=True)

    def dec(f):
        o, x, z = [], 0, 0
        for i in range(0, len(f) - 1, 2):
            x = f[i] if i == 0 else x + f[i]; z = f[i + 1] if i == 0 else z + f[i + 1]
            o.append(inv.transform(EO + x, NO - z))
        return o
    out = [(c.get("nombre", k) + " (trazo referencial del visor)", LineString(dec(c["p"])))
           for k, c in R.get("colectores", {}).items()]
    if R.get("emisor"):
        out.append(("Emisor (trazo referencial del visor)", LineString(dec(R["emisor"]))))
    return out


# ---------------------------------------------------------------- utilidades geo
def a_utm(g):
    return shp_tr(Transformer.from_crs("EPSG:4326", "EPSG:32613", always_xy=True).transform, g)


def mas_cercano(tree, geoms, nombres, p):
    i = tree.nearest(p)
    return nombres[i], float(geoms[i].distance(p))


def iou(a, b):
    i = a.intersection(b).area
    return i / max(a.union(b).area, 1e-12)


# ---------------------------------------------------------------- principal
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--hoy", default=None)
    ap.add_argument("--sin-png", action="store_true")
    ap.add_argument("--png", default=None, help="ruta del PNG de vista previa")
    ap.add_argument("--modo", default=os.environ.get("MOTOR_MODO", "normal"), choices=["normal", "estricto"])
    args = ap.parse_args()
    if args.modo == "estricto":
        CFG.update(ESTRICTO)
    CFG["modo"] = args.modo
    hoy = date.fromisoformat(args.hoy) if args.hoy else datetime.now(timezone.utc).date()
    os.makedirs(SALIDA, exist_ok=True); os.makedirs(os.path.dirname(ESTADO), exist_ok=True)

    osm = osm_cache.cargar(log)
    mun = shape(osm["municipio"])
    aoi = mun.intersection(box(*CFG["bbox"]))
    bbox = list(aoi.bounds)
    log("AOI Gómez Palacio (municipio ∩ recorte urbano):", [round(v, 4) for v in bbox])

    # 1) escenas
    cat = Client.open(CFG["stac"])
    ini = hoy - timedelta(days=CFG["ventana_dias"])
    items = list(cat.search(collections=[CFG["coleccion"]], bbox=bbox, datetime=f"{ini}/{hoy}",
                            query={"eo:cloud_cover": {"lt": CFG["nubes_tile_max"]}}, max_items=500).items())
    from collections import Counter
    tile = Counter(i.properties.get("grid:code") for i in items).most_common(1)[0][0]
    items = sorted([i for i in items if i.properties.get("grid:code") == tile], key=lambda i: i.datetime)
    vistos, uniq = set(), []
    for it in items:                              # una por fecha
        d = it.datetime.date()
        if d not in vistos:
            vistos.add(d); uniq.append(it)
    items = uniq
    log(f"{len(items)} escenas candidatas en tile {tile}")

    serie = lluvia_diaria(min(hoy - timedelta(days=372), ini - timedelta(days=8)), hoy)

    # 2) rejilla 20 m, máscaras
    with rasterio.open(items[-1].assets["scl"].href) as s:
        w = ventana(s, bbox); shp = (int(w.height), int(w.width)); tr = s.window_transform(w); crs = s.crs
    a_crs = Transformer.from_crs("EPSG:4326", crs, always_xy=True).transform
    aoi_r = rasterize([(shp_tr(a_crs, aoi), 1)], out_shape=shp, transform=tr, dtype="uint8").astype(bool)
    wc = np.zeros(shp, "uint8")
    with rasterio.open(WC_URL) as s:
        wb = transform_bounds("EPSG:4326", s.crs, *[bbox[0] - .01, bbox[1] - .01, bbox[2] + .01, bbox[3] + .01])
        ww = from_bounds(*wb, s.transform).round_offsets().round_lengths()
        reproject(s.read(1, window=ww), wc, src_transform=s.window_transform(ww), src_crs=s.crs,
                  dst_transform=tr, dst_crs=crs, resampling=Resampling.mode)
    urbano = (wc == 50) & aoi_r
    m_utm = [shp_tr(a_crs, shape(m["g"])).buffer(CFG["buffer_mascara_m"]) for m in osm["mascara"]]
    m_utm += [shp_tr(a_crs, LineString(l["g"])).buffer(15 + CFG["buffer_mascara_m"]) for l in osm["agua_lineas"] if len(l["g"]) > 1]
    mascara_osm = rasterize([(g, 1) for g in m_utm if not g.is_empty], out_shape=shp, transform=tr, dtype="uint8").astype(bool)
    analizable = urbano & ~mascara_osm
    log(f"píxeles urbanos {urbano.sum()}, analizables (sin parques/cultivo/agua OSM) {analizable.sum()}")

    # 3) leer escenas (paralelo)
    def proc(it):
        try:
            return it, indices(it, bbox, shp)
        except Exception as e:  # escena ilegible: se registra y se omite
            return it, e
    escenas, datos = [], []
    with ThreadPoolExecutor(6) as ex:
        for it, r in ex.map(proc, items):
            d = it.datetime.date()
            rec = {"id": it.id, "fecha": d.isoformat(), "tile": tile,
                   "nubes_tile_pct": round(it.properties.get("eo:cloud_cover", 0), 1),
                   "miniatura": it.assets["thumbnail"].href if "thumbnail" in it.assets else None,
                   "color_real_cog": it.assets["visual"].href if "visual" in it.assets else None,
                   "stac": f"{CFG['stac']}/collections/{CFG['coleccion']}/items/{it.id}",
                   "lluvia_mm_3d": lluvia_previa(serie, d, 3), "lluvia_mm_7d": lluvia_previa(serie, d, 7),
                   "lluvia_mm_dia": serie.get(d.isoformat(), {}).get("mm")}
            if isinstance(r, Exception):
                rec.update(uso="omitida", motivo=f"error de lectura: {type(r).__name__}"); escenas.append(rec); continue
            ndmi, ndvi, agua, ok = r
            claro = float(ok[urbano].mean()) if urbano.any() else 0
            rec["claro_aoi_pct"] = round(100 * claro, 1)
            l3, l7 = rec["lluvia_mm_3d"], rec["lluvia_mm_7d"]
            tras_lluvia = (l3 is not None and l3 > CFG["lluvia_3d_max"]) or (l7 is not None and l7 > CFG["lluvia_7d_max"])
            if claro < CFG["claro_aoi_min"]:
                rec.update(uso="omitida", motivo="nubes/sombras sobre la ciudad")
            elif tras_lluvia:
                rec.update(uso="tras_lluvia", motivo="lluvia previa: excluida de la detección de fugas; se usa para encharcamientos")
                datos.append((rec, ndmi, ndvi, agua, ok))
            else:
                rec.update(uso="seca" if d.month in CFG["meses_secos"] else "sin_lluvia_reciente")
                datos.append((rec, ndmi, ndvi, agua, ok))
            escenas.append(rec)
    escenas.sort(key=lambda r: r["fecha"])
    # filtro de lluvia n.º 2 (Pulso): la mediana urbana del NDMI no debe subir > 0.03 sobre la mediana anual
    med_urb = {id(x[0]): float(np.nanmedian(x[1][urbano])) for x in datos}
    cand_s = [x for x in datos if x[0]["uso"] != "tras_lluvia"]
    if cand_s:
        anual = float(np.median(list(med_urb.values())))   # como Pulso: mediana de TODAS las escenas despejadas del año
        for x in cand_s:
            x[0]["ndmi_mediana_ciudad"] = round(med_urb[id(x[0])], 4)
            if med_urb[id(x[0])] > anual + CFG["delta_ndmi_lluvia"]:
                x[0].update(uso="tras_lluvia", motivo="ciudad entera más húmeda que su mediana anual (> +0.04 NDMI): probable lluvia")
    secas = sorted([x for x in datos if x[0]["uso"] != "tras_lluvia"], key=lambda x: x[0]["fecha"])
    lluv = [x for x in datos if x[0]["uso"] == "tras_lluvia"]
    log(f"escenas útiles sin lluvia {len(secas)}, tras lluvia {len(lluv)}, omitidas {sum(e['uso']=='omitida' for e in escenas)}")

    feats, enchar = [], []
    if len(secas) >= 8:
        fechas = [x[0]["fecha"] for x in secas]
        lim = (hoy - timedelta(days=CFG["dias_recientes"])).isoformat()
        jr = [j for j, f in enumerate(fechas) if f >= lim]
        for j, x in enumerate(secas):
            x[0]["rol"] = "reciente" if j in jr else "historia"
        NM = np.stack([x[1] for x in secas]); NV = np.stack([x[2] for x in secas])
        Z = np.full(NM.shape, np.nan, "f4")
        for k in range(len(secas)):            # z POR ESCENA contra la ciudad ese mismo día (clave de Pulso)
            v = NM[k][urbano & np.isfinite(NM[k])]
            if v.size >= 500:
                Z[k] = (NM[k] - np.median(v)) / max(float(np.std(v)), 0.01)
        val = np.isfinite(Z)
        ndvi_med = np.nanmedian(NV, 0)
        hist = [j for j in range(len(secas)) if j not in jr]
        zh = np.nanmedian(Z[hist] if len(hist) >= 4 else Z, 0)          # z histórico del propio píxel (sin lo reciente)
        A = val & (Z > CFG["z_nueva"]) & ((Z - zh) > CFG["z_sobre_historia"])      # anomalía nueva
        C = val & (Z > CFG["z_cronica"])                                           # humedad constante
        nv = val.sum(0)
        persA = A.sum(0) / np.maximum(nv, 1); persC = C.sum(0) / np.maximum(nv, 1)
        nh = val[hist].sum(0); histA = A[hist].sum(0) / np.maximum(nh, 1); histC = C[hist].sum(0) / np.maximum(nh, 1)
        if jr:
            vr = val[jr].sum(0); recA = A[jr].sum(0) / np.maximum(vr, 1)
        else:
            vr = np.zeros(nv.shape); recA = np.zeros(nv.shape)
        base_ok = analizable & (ndvi_med < CFG["ndvi_max"])
        m_nueva = base_ok & (vr >= 2) & (recA >= CFG["persistencia_min"]) & (histA < CFG["historia_max_nueva"])
        m_cron = base_ok & (persC >= CFG["persistencia_min"]) & ~m_nueva
        log(f"recientes ({CFG['dias_recientes']} días): {[fechas[j] for j in jr]}; píxeles nueva {m_nueva.sum()}, constante {m_cron.sum()}")
        a_wgs = Transformer.from_crs(crs, "EPSG:4326", always_xy=True).transform
        borde_m = unary_union([shp_tr(a_crs, shape(m["g"])) for m in osm["mascara"]])
        agua_m = unary_union([shp_tr(a_crs, LineString(l["g"])) for l in osm["agua_lineas"] if len(l["g"]) > 1])
        calles = [(c["n"], shp_tr(a_crs, LineString(c["g"]))) for c in osm["calles"] if len(c["g"]) > 1]
        c_tree = STRtree([g for _, g in calles]); c_geo = [g for _, g in calles]; c_nom = [n_ for n_, _ in calles]
        cols = [(nm, shp_tr(a_crs, g)) for nm, g in colectores_visor()]
        for clase, mask, FL in (("nueva", m_nueva, A), ("constante", m_cron, C)):
            lab, n = ndimage.label(mask, structure=np.ones((3, 3)))
            if not n: continue
            sizes = ndimage.sum(mask, lab, range(1, n + 1))
            keep = [k + 1 for k, s in enumerate(sizes) if s >= CFG["min_pixeles"]]
            polys = {}
            for g, v in shapes(lab.astype("int32"), mask=np.isin(lab, keep), transform=tr):
                polys.setdefault(int(v), []).append(shape(g))
            for k, gl in polys.items():
                m = lab == k; g = unary_union(gl); px = int(m.sum())
                pres = []
                for j in range(len(secas)):
                    vv = val[j][m]
                    pres.append(bool(vv.mean() >= 0.5 and FL[j][m][vv].mean() >= 0.5) if vv.mean() >= 0.5 else None)
                if not any(pres): continue
                # racha continua más reciente (se saltan escenas sin dato)
                ult = max(j for j, p in enumerate(pres) if p)
                ini_r, n_r = ult, 0
                for j in range(ult, -1, -1):
                    if pres[j] is None: continue
                    if pres[j]: ini_r, n_r = j, n_r + 1
                    else: break
                en_ultima = next((p for p in reversed(pres) if p is not None), False)
                # prueba «recién mojada»: antes de la primera detección la zona debe haber estado seca
                seca_antes = None
                if clase == "nueva":
                    previas = [j for j in range(ini_r) if val[j][m].mean() >= 0.5]
                    hum = [bool(C[j][m][val[j][m]].mean() >= 0.5) for j in previas]
                    frac = (sum(hum) / len(hum)) if hum else None
                    ult_seca = next((fechas[j] for j, h_ in zip(reversed(previas), reversed(hum)) if not h_), None)
                    seca_antes = {"escenas_previas": len(previas), "fraccion_humeda_previa": round(frac, 2) if frac is not None else None,
                                  "ultima_escena_seca": ult_seca,
                                  "z_mediana_previa": round(float(np.nanmedian(Z[previas][:, m])), 2) if previas else None}
                    if frac is None or len(previas) < 6 or frac >= CFG["historia_max_nueva"]:
                        clase_z = "constante"
                    else:
                        clase_z = "nueva"
                else:
                    clase_z = clase
                dias = (date.fromisoformat(fechas[ult]) - date.fromisoformat(fechas[ini_r])).days
                cen = g.centroid
                nom, dcal = mas_cercano(c_tree, c_geo, c_nom, cen)
                col = min(((nm, gg.distance(cen)) for nm, gg in cols), key=lambda t: t[1], default=(None, None))
                zr = float(np.nanmean(np.where(FL[jr] if jr else FL, Z[jr] if jr else Z, np.nan)[:, m])) if True else 0
                pa = float((persA if clase == "nueva" else persC)[m].mean())
                score = 100 * min(1, max(0, 0.35 * min(1, (zr - 2) / 3) + 0.30 * (float(recA[m].mean()) if clase == "nueva" else pa)
                                         + 0.15 * min(1, dias / 60) + 0.20 * min(1, px / 15)))
                feats.append(dict(clase=clase_z, seca_antes=seca_antes, geom=shp_tr(a_wgs, g.simplify(10)), cen=shp_tr(a_wgs, cen), area=px * 400, px=px,
                                  zr=zr, n=n_r, desde=fechas[ini_r], hasta=fechas[ult], dias=dias, en_reciente=bool(en_ultima),
                                  pers_anual=pa, hist=float((histA if clase == "nueva" else histC)[m].mean()),
                                  ndmi=float(np.nanmedian(NM[-1][m])) if np.isfinite(NM[-1][m]).any() else None,
                                  ndvi=float(np.nanmedian(ndvi_med[m])),
                                  calle=nom, dcal=dcal, dmas=float(g.distance(borde_m)) if not borde_m.is_empty else 9e9,
                                  dagua=float(g.distance(agua_m)) if not agua_m.is_empty else 9e9, col=col, score=score))
        log(f"zonas: nuevas {sum(f['clase']=='nueva' for f in feats)}, constantes {sum(f['clase']=='constante' for f in feats)}")
    else:
        log("escenas sin lluvia insuficientes; no se generan zonas")

    # 4) encharcamientos tras lluvia (S2, solo escenas claras): agua (SCL=6) urbana fuera de cuerpos de agua OSM
    for rec, ndmi, ndvi, agua, ok in lluv:
        a = agua & analizable
        lab, n = ndimage.label(a, structure=np.ones((3, 3)))
        if not n: continue
        sizes = ndimage.sum(a, lab, range(1, n + 1))
        keep = [k + 1 for k, s in enumerate(sizes) if s >= 3]
        a_wgs = Transformer.from_crs(crs, "EPSG:4326", always_xy=True).transform
        for g, v in shapes(lab.astype("int32"), mask=np.isin(lab, keep), transform=tr):
            gg = shape(g)
            enchar.append({"type": "Feature", "geometry": mapping(shp_tr(a_wgs, gg.simplify(10))), "properties": {
                "tipo": "encharcamiento", "fecha": rec["fecha"], "lluvia_mm_3d": rec["lluvia_mm_3d"],
                "lluvia_mm_7d": rec["lluvia_mm_7d"], "area_m2": round(gg.area),
                "fuente": f"{FUENTE_S2}, escena {rec['fecha']}; lluvia Open-Meteo (ERA5)",
                "nota": "Agua superficial detectada por Sentinel-2 (clase agua SCL) en zona urbana tras lluvia. "
                        "Solo escenas sin nubes; no ve debajo de nubes."}})

    # 5) seguimiento entre corridas
    est = json.load(open(ESTADO, encoding="utf-8")) if os.path.exists(ESTADO) else \
        {"version": 1, "ultima_escena": None, "contador": 0, "zonas": {}, "retiradas": {}}
    ultima = secas[-1][0]["fecha"] if secas else None
    nueva_pasada = ultima is not None and (est["ultima_escena"] is None or ultima > est["ultima_escena"])
    usados = set()
    for f in sorted(feats, key=lambda f: (f["clase"] != "nueva", -f["score"])):
        best, bi = None, 0
        for zid, z in est["zonas"].items():
            if zid in usados: continue
            zg = shape(z["geom"])
            v = iou(zg, f["geom"]); dist = a_utm(Point(z["cen"])).distance(a_utm(f["cen"]))
            if (v >= CFG["iou_min"] or dist <= CFG["union_m"]) and v + (1 - dist / 1000) > bi:
                best, bi = zid, v + (1 - dist / 1000)
        if best is None:
            est["contador"] += 1; best = f"GP-H{est['contador']:03d}"
            est["zonas"][best] = {"primera_deteccion": f["desde"], "corridas": 0, "alta_motor": hoy.isoformat()}
        z = est["zonas"][best]; usados.add(best)
        z["primera_deteccion"] = min(z["primera_deteccion"], f["desde"])
        if nueva_pasada:
            z["corridas"] = z.get("corridas", 0) + 1; z["sin_detectar"] = 0
        z.update(geom=mapping(f["geom"]), cen=[round(f["cen"].x, 6), round(f["cen"].y, 6)], ultima=f["hasta"])
        f["id"] = best; f["primera"] = z["primera_deteccion"]; f["corridas"] = z["corridas"]
    if nueva_pasada:
        for zid in [k for k in est["zonas"] if k not in usados]:
            est["zonas"][zid]["sin_detectar"] = est["zonas"][zid].get("sin_detectar", 0) + 1
            if est["zonas"][zid]["sin_detectar"] >= CFG["corridas_para_retirar"]:
                est["retiradas"][zid] = est["zonas"].pop(zid)
        est["ultima_escena"] = ultima

    # 6) explicación y GeoJSON
    ventana_txt = f"{secas[0][0]['fecha']}/{secas[-1][0]['fecha']}" if secas else None
    out = []
    orden = sorted(feats, key=lambda f: (f["clase"] != "nueva", -f["score"]))[:CFG["max_zonas"]]
    for f in orden:
        alta = f["px"] >= 6 and f["dias"] >= 10                       # regla de prioridad de Pulso
        cerca_riego = f["dmas"] < 40; cerca_agua = f["dagua"] < 60
        conf = "baja" if f["n"] <= 1 or cerca_riego else ("alta" if alta else "media")
        if f["clase"] == "nueva":
            sa = f["seca_antes"] or {}
            exp = (f"Humedad nueva: pasó la prueba de «recién mojada» (seca en {100 - (sa.get('fraccion_humeda_previa') or 0)*100:.0f} % "
                   f"de {sa.get('escenas_previas')} escenas previas; última escena seca {sa.get('ultima_escena_seca')}), "
                   + ("sin vegetación densa" if cerca_riego else "sin vegetación ni riego mapeado que la explique")
                   + "; posible fuga de agua potable o drenaje. Revisar con cámara CCTV.")
            d0 = date.fromisoformat(f["desde"])
            ll = [(t, v["mm"]) for t, v in serie.items() if v["mm"] >= 5 and 0 <= (d0 - date.fromisoformat(t)).days <= 14]
            if ll:
                exp += (f" Apareció dentro de las 2 semanas siguientes a una lluvia de {max(v for _, v in ll):.0f} mm "
                        f"({max(ll, key=lambda x: x[1])[0]}): si sigue húmeda en las próximas pasadas secas, gana confianza.")
            cat_txt = "nueva"
        elif f.get("seca_antes"):
            sa = f["seca_antes"]
            exp = (f"Húmeda en los últimos 45 días, pero no pasó la prueba de «recién mojada»: ya se veía húmeda en "
                   f"{(sa['fraccion_humeda_previa'] or 0)*100:.0f} % de {sa['escenas_previas']} escenas previas. Humedad recurrente: "
                   "puede ser fuga vieja, descarga, tanque, riego o lavado; revisar con SIDEAPA.")
            cat_txt = "humedad constante (posible fuga vieja, descarga, tanque o riego)"
        else:
            exp = ("Humedad constante casi todo el año sin vegetación. Puede ser fuga vieja, descarga, tanque, riego o lavado; "
                   "revisar con SIDEAPA.")
            cat_txt = "humedad constante (posible fuga vieja, descarga, tanque o riego)"
        if f["n"] <= 1:
            exp += " Vista en una sola pasada: confianza baja, conviene esperar la siguiente."
        if cerca_riego:
            exp += f" Está a {f['dmas']:.0f} m de un parque, cancha o parcela (OSM): puede ser escurrimiento de riego."
        if cerca_agua:
            exp += f" Está a {f['dagua']:.0f} m de un canal, dren o río (OSM)."
        pas = f"presente en {f['n']} pasadas desde {f['desde']}"
        if secas and f["desde"] <= secas[0][0]["fecha"]:
            pas += " (inicio de la ventana analizada; pudo estar húmeda desde antes)"
        nota = (f"{ETIQUETA}: {pas}; húmeda desde {f['desde']} ({f['dias']} días en imágenes; son los días que el satélite la ha "
                "visto, no la antigüedad de una posible fuga). Indicador satelital, no confirma fuga; también puede ser lavadero, "
                "autolavado o una llave que chorrea. Escenas tras lluvia excluidas. Confirmar con inspección de SIDEAPA.")
        out.append({"type": "Feature", "geometry": mapping(f["geom"]), "properties": {
            "id": f["id"], "tipo": "humedad", "categoria": cat_txt, "clase": f["clase"],
            "intensidad": round(f["score"]), "escala_intensidad": "0-100",
            "fecha": f"{f['desde']}/{f['hasta']}" if f["desde"] != f["hasta"] else f["hasta"],
            "fuente": f"{FUENTE_S2}, escenas {f['desde']} a {f['hasta']}; uso de suelo ESA WorldCover 2021; calles y máscaras © OpenStreetMap",
            "nota": nota, "etiqueta": ETIQUETA, "explicacion": exp, "confianza": conf,
            "prioridad": "baja" if conf == "baja" else ("alta" if alta else "media"),
            "pasadas": f["n"], "desde": f["desde"], "ultima_vista": f["hasta"], "dias_en_imagenes": f["dias"],
            "en_escena_reciente": f["en_reciente"], "prueba_recien_mojada": f["seca_antes"], "primera_deteccion": f["primera"], "corridas_motor": f["corridas"],
            "area_m2": f["area"], "pixeles": f["px"],
            "ndmi_ultima": round(f["ndmi"], 3) if f["ndmi"] is not None else None, "ndvi_mediana": round(f["ndvi"], 3),
            "z_ciudad": round(f["zr"], 2), "persistencia_anual": round(f["pers_anual"], 2), "fraccion_historia": round(f["hist"], 2),
            "calle_cercana": f["calle"], "dist_calle_m": round(f["dcal"]),
            "colector_cercano": f["col"][0], "dist_colector_m": round(f["col"][1]) if f["col"][1] is not None else None,
            "dist_riego_osm_m": round(min(f["dmas"], 9999)), "dist_canal_osm_m": round(min(f["dagua"], 9999)),
            "centro": [round(f["cen"].x, 6), round(f["cen"].y, 6)],
            "tile": tile, "escenas": ventana_txt, "origen": "motor_satelital",
            "metodo": ("nueva: z por escena vs ciudad ese día > 2.5 y > 2 sobre su z histórico, en >= 60 % de las escenas de los "
                       "últimos 45 días (mín. 2) y < 20 % de su historia; constante: z > 2 en >= 60 % de las escenas; "
                       "NDVI mediano < 0.35; >= 4 px de 20 m; sin parques/cultivo/agua OSM; escenas tras lluvia excluidas (método Pulso)")}})
        f["_p"] = out[-1]["properties"]
    meta = {"generado": datetime.now(timezone.utc).isoformat(timespec="seconds"), "motor": VERSION,
            "fuente": FUENTE_S2, "area": "Gómez Palacio, Dgo. (municipio OSM ∩ recorte urbano; sin Torreón ni Lerdo)",
            "escenas_secas": [x[0]["fecha"] for x in secas], "tile": tile,
            "nota": "Zonas candidatas a revisar con cámara; no confirman fuga. Escenas tras lluvia excluidas."}
    dump = escribir
    dump(os.path.join(SALIDA, "zonas_humedad.geojson"), {"type": "FeatureCollection", "metadata": meta, "features": out})
    dump(os.path.join(SALIDA, "encharcamientos.geojson"), {"type": "FeatureCollection", "metadata": {
        **meta, "nota": "Encharcamientos tras lluvia vistos por Sentinel-2 en escenas sin nubes. Solo óptico; "
                        "Sentinel-1 (radar) lo trabaja otro compañero."}, "features": enchar[:300]})
    escribir(os.path.join(SALIDA, "escenas.json"), {"generado": meta["generado"], "tile": tile, "criterios": {k: CFG[k] for k in (
            "nubes_tile_max", "claro_aoi_min", "lluvia_3d_max", "lluvia_7d_max", "delta_ndmi_lluvia", "dias_recientes")},
            "lluvia_definicion": "lluvia_mm_3d = día de la escena + 3 días previos; lluvia_mm_7d = día de la escena + 7 previos. "
                                 "Escena «tras_lluvia» si 3d > 2 mm o 7d > 5 mm: no se usa para fugas, solo para encharcamientos.",
            "usos": {"seca": "usada para detectar humedad anómala", "tras_lluvia": "excluida de fugas",
                     "omitida": "nubes sobre la ciudad o temporada de lluvias sin lluvia reciente"},
            "lluvia_fuente": "Open-Meteo (ERA5/ERA5-Land reanálisis; días recientes con modelo), punto 25.56,-103.50",
            "escenas": escenas}, indent=0)
    ini12 = (hoy - timedelta(days=365)).isoformat()
    dump(os.path.join(SALIDA, "lluvia_gp.json"), {
        "fuente": "Open-Meteo Historical Weather API (reanálisis ERA5/ERA5-Land, ECMWF/Copernicus); "
                  "días aún sin archivo: modelo de pronóstico Open-Meteo. Licencia CC BY 4.0. https://open-meteo.com/",
        "punto": {"lat": CFG["punto_lluvia"][0], "lon": CFG["punto_lluvia"][1], "nombre": "Gómez Palacio, Dgo."},
        "unidad": "mm/día", "generado": meta["generado"],
        "serie": [[t, v["mm"]] + ([] if v["origen"] == "archivo" else ["modelo"]) for t, v in sorted(serie.items()) if t >= ini12]})
    estado_pub = {"version_motor": VERSION, "ultima_corrida": meta["generado"], "tile": tile,
                  "escena_mas_reciente_usada": ultima,
                  "escenas_consultadas": len(escenas), "escenas_secas_usadas": len(secas), "escenas_tras_lluvia": len(lluv),
                  "zonas_humedad": len(out), "encharcamientos": len(enchar[:300]),
                  "zonas_por_confianza": {c: sum(1 for o in out if o["properties"]["confianza"] == c) for c in ("alta", "media", "baja")},
                  "zonas_retiradas_historico": len(est["retiradas"]),
                  "parametros": {k: v for k, v in CFG.items() if k not in ("stac",)}}
    escribir(os.path.join(SALIDA, "estado_motor.json"), estado_pub, indent=1)
    with open(ESTADO, "w", encoding="utf-8") as fh:
        json.dump(est, fh, ensure_ascii=False, separators=(",", ":"))
    # índice: agrega sin quitar lo de otros
    ip = os.path.join(SALIDA, "index.json")
    idx = json.load(open(ip, encoding="utf-8")) if os.path.exists(ip) else {"archivos": []}
    for a in ("zonas_humedad.geojson", "encharcamientos.geojson"):
        if a not in idx.setdefault("archivos", []):
            idx["archivos"].append(a)
    escribir(ip, idx, indent=1)
    log(f"listo: {len(out)} zonas de humedad, {len(enchar[:300])} encharcamientos, {len(secas)} escenas secas")

    if not args.sin_png and secas:
        vista_previa(secas[-1][0], bbox, out, args.png or os.path.join(AQUI, "estado", "vista_previa.png"), aoi)


def vista_previa(rec, bbox, feats, ruta, aoi):
    import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
    with rasterio.open(rec["color_real_cog"]) as s:
        w = ventana(s, bbox); f = 2
        rgb = s.read(window=w, out_shape=(3, int(w.height // f), int(w.width // f)), resampling=Resampling.average)
        tr = s.window_transform(w); tr = tr * tr.scale(f, f); crs = s.crs
    a = Transformer.from_crs("EPSG:4326", crs, always_xy=True).transform
    inv = ~tr
    fig, ax = plt.subplots(figsize=(14, 11))
    ax.imshow(np.moveaxis(rgb, 0, -1))
    def dib(g, **kw):
        for p in getattr(g, "geoms", [g]):
            xs, ys = zip(*[inv * a(x, y) for x, y in p.exterior.coords]); ax.plot(xs, ys, **kw)
    dib(aoi, color="white", lw=0.8, ls="--")
    import matplotlib.patheffects as pe
    col = {"alta": "red", "media": "orange", "baja": "yellow"}
    for ft in feats:
        p = ft["properties"]; g = shape(ft["geometry"])
        c = "cyan" if p.get("clase") == "nueva" else col[p["confianza"]]
        dib(g, color=c, lw=1.4)
        cx, cy = inv * a(*p["centro"])
        ax.plot(cx, cy, "o", ms=16, mfc="none", mec=c, mew=1.8)
        ax.text(cx + 12, cy - 6, p["id"].replace("GP-", ""), color=c, fontsize=8, fontweight="bold",
                path_effects=[pe.withStroke(linewidth=2.5, foreground="black")])
    from matplotlib.lines import Line2D
    ax.legend(handles=[Line2D([], [], marker="o", ls="", mfc="none", mec=c, mew=2, ms=10, label=l) for c, l in
                       (("cyan", "nueva (húmeda en los últimos 45 días)"), ("red", "humedad constante · confianza alta"),
                        ("orange", "humedad constante · media"), ("yellow", "baja (orilla de parque/canal o 1 pasada)"))],
              loc="lower left", fontsize=8, framealpha=0.85)
    ax.set_title(f"Motor satelital NODO VAH · Gómez Palacio (poniente del Nazas) · Sentinel-2 color real {rec['fecha']}\n"
                 f"{len(feats)} zonas a revisar con cámara. Indicador satelital: no confirma fugas.", fontsize=10)
    ax.axis("off"); fig.tight_layout(); fig.savefig(ruta, dpi=120, bbox_inches="tight"); plt.close(fig)
    log("vista previa:", ruta)


if __name__ == "__main__":
    main()
