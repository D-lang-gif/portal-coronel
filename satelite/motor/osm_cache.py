"""Cache OSM para el motor satelital (máscaras de riego/agua, calles, límite municipal).

Se usa el archivo `cache/osm_gp.json` ya incluido en el repositorio. Si tiene más de
`MAX_EDAD_DIAS` días, se intenta refrescar con Overpass (con reintentos); si Overpass
falla, se sigue con el cache existente. Nunca se inventan datos.
"""
import json, os, time
from datetime import datetime, timezone
import requests

AQUI = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(AQUI, "cache", "osm_gp.json")
MAX_EDAD_DIAS = 120
BBOX = (-103.58, 25.48, -103.40, 25.64)  # W,S,E,N
SERVIDORES = ["https://overpass-api.de/api/interpreter",
              "https://overpass.kumi.systems/api/interpreter"]
UA = {"User-Agent": "nodo-vah-motor-satelital/1.0 (github.com/D-lang-gif/portal-coronel)"}
MASK_LU = "farmland|grass|meadow|orchard|vineyard|village_green|recreation_ground|reservoir|basin|plant_nursery|allotments|greenfield"
MASK_LE = "park|garden|pitch|golf_course|stadium|sports_centre|playground|nature_reserve"


def _q():
    s, w, n, e = BBOX[1], BBOX[0], BBOX[3], BBOX[2]
    b = f"({s},{w},{n},{e})"
    return f"""[out:json][timeout:180];
(
 way[landuse~"^({MASK_LU})$"]{b}; relation[landuse~"^({MASK_LU})$"]{b};
 way[leisure~"^({MASK_LE})$"]{b}; relation[leisure~"^({MASK_LE})$"]{b};
 way[natural~"^(water|wetland)$"]{b}; relation[natural~"^(water|wetland)$"]{b};
 way[waterway]{b};
 way[highway][name]{b};
 relation[boundary=administrative][admin_level=6][name~"^Gómez Palacio"]{b};
);
out geom;"""


def _anillos(rel):
    """Polígonos simples a partir de miembros 'outer' de una relación (out geom)."""
    from shapely.geometry import LineString, mapping
    from shapely.ops import polygonize, unary_union
    lines = [LineString([(p["lon"], p["lat"]) for p in m["geometry"]])
             for m in rel.get("members", []) if m.get("role") == "outer" and m.get("geometry")]
    polys = list(polygonize(unary_union(lines)))
    return mapping(unary_union(polys)) if polys else None


def _recortar(out):
    """Deja solo lo que toca el municipio de Gómez Palacio (poniente del Nazas) y simplifica."""
    from shapely.geometry import shape, box, mapping, LineString
    M = shape(out["municipio"]).intersection(box(*BBOX).buffer(0.02))
    out["municipio"] = mapping(M)
    Mb = M.buffer(0.005)
    out["mascara"] = [m for m in out["mascara"] if shape(m["g"]).intersects(Mb)]
    out["agua_lineas"] = [m for m in out["agua_lineas"] if LineString(m["g"]).intersects(Mb)]
    out["calles"] = [{"n": c["n"], "h": c["h"], "g": [list(p) for p in LineString(c["g"]).simplify(0.00003).coords]}
                     for c in out["calles"] if c["h"] not in ("footway", "path", "cycleway", "steps", "pedestrian", "track", "service")
                     and LineString(c["g"]).intersects(Mb)]


def refrescar_overpass():
    from shapely.geometry import Polygon, mapping
    data = None
    for intento in range(4):
        for url in SERVIDORES:
            try:
                r = requests.post(url, data={"data": _q()}, headers=UA, timeout=240)
                if r.ok and r.text.lstrip().startswith("{"):
                    data = r.json(); break
            except requests.RequestException:
                pass
        if data: break
        time.sleep(30 * 2 ** intento)
    if not data:
        return False
    out = {"mascara": [], "agua_lineas": [], "calles": [], "municipio": None}
    for el in data["elements"]:
        t = el.get("tags", {})
        if el["type"] == "relation":
            g = _anillos(el)
            if not g: continue
            if t.get("boundary") == "administrative":
                out["municipio"] = g; continue
        else:
            pts = [[round(p["lon"], 6), round(p["lat"], 6)] for p in el.get("geometry", [])]
            if len(pts) < 2: continue
            if "waterway" in t:
                out["agua_lineas"].append({"t": t["waterway"], "n": t.get("name", ""), "g": pts}); continue
            if "highway" in t:
                out["calles"].append({"n": t["name"], "h": t["highway"], "g": pts}); continue
            if len(pts) < 4 or pts[0] != pts[-1]: continue
            g = mapping(Polygon(pts))
        tag = ("landuse=" + t["landuse"]) if "landuse" in t else ("leisure=" + t["leisure"]) if "leisure" in t else ("natural=" + t.get("natural", "water"))
        out["mascara"].append({"t": tag, "g": g})
    if not out["municipio"] or len(out["calles"]) < 100:
        return False  # respuesta incompleta: se conserva el cache anterior
    _recortar(out)
    out["fuente"] = "© OpenStreetMap contributors (ODbL), Overpass API " + datetime.now(timezone.utc).date().isoformat()
    out["bbox"] = list(BBOX)
    out["fecha"] = datetime.now(timezone.utc).date().isoformat()
    with open(CACHE, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    return True


def cargar(log=print):
    edad = None
    if os.path.exists(CACHE):
        with open(CACHE, encoding="utf-8") as f:
            fecha = json.load(f).get("fecha")
        if fecha:
            edad = (datetime.now(timezone.utc).date() - datetime.fromisoformat(fecha).date()).days
    if edad is None or (edad > MAX_EDAD_DIAS and os.environ.get("MOTOR_REFRESCAR_OSM", "1") == "1"):
        log("OSM: refrescando cache con Overpass…")
        log("OSM: cache actualizado" if refrescar_overpass() else "OSM: Overpass no respondió; se usa el cache existente")
    with open(CACHE, encoding="utf-8") as f:
        return json.load(f)
