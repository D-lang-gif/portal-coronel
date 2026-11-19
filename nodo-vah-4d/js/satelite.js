/* Vigilancia satelital: escenas Sentinel-2 (Element84 Earth Search, sin clave) y zonas GeoJSON. */
import * as THREE from "three";
import { attrs, fichaHTML, NIVEL, PC, FICHA_MANCHA } from "./pliego.js";

const STAC = "https://earth-search.aws.element84.com/v1/search";
const BBOX = [-103.53, 25.54, -103.43, 25.62]; // Gómez Palacio urbana
const EO = 656057.6147513353, NO = 2830510.733487401;
const DATA = "data/satelite/";

function ll2utm(lat, lon, zone = 13) {
  const a = 6378137.0, f = 1 / 298.257223563, e2 = f * (2 - f), k0 = 0.9996;
  const lon0 = (zone * 6 - 183) * Math.PI / 180, φ = lat * Math.PI / 180, λ = lon * Math.PI / 180;
  const ep2 = e2 / (1 - e2), N = a / Math.sqrt(1 - e2 * Math.sin(φ) ** 2), T = Math.tan(φ) ** 2, C = ep2 * Math.cos(φ) ** 2, A = Math.cos(φ) * (λ - lon0);
  const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * φ
    - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * φ)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * φ)
    - (35 * e2 ** 3 / 3072) * Math.sin(6 * φ));
  const E = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000;
  const Nn = k0 * (M + N * Math.tan(φ) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720));
  return [E, Nn];
}
export function ll2local(lon, lat) {
  const [e, n] = ll2utm(lat, lon);
  return [e - EO, -(n - NO)];
}
function centroide(geom) {
  const cs = [];
  (function walk(c) {
    if (typeof c[0] === "number") cs.push(c);
    else for (const x of c) walk(x);
  })(geom.coordinates);
  const lon = cs.reduce((s, p) => s + p[0], 0) / cs.length;
  const lat = cs.reduce((s, p) => s + p[1], 0) / cs.length;
  return { lon, lat, ...(() => { const [x, z] = ll2local(lon, lat); return { x, z }; })() };
}

export function initSatelite(ctx) {
  const { scene, flyTo, nearest, onFicha, setSubsuelo, modoCiudad } = ctx;
  const root = document.getElementById("sat-panel");
  if (!root) return { pickables: [], zonas: () => [] };
  const gZonas = new THREE.Group(); gZonas.name = "sat-zonas"; scene.add(gZonas);
  const gDrape = new THREE.Group(); gDrape.name = "sat-drape"; scene.add(gDrape);
  const pickables = [];
  let zonas = [];
  let marker = null;

  root.innerHTML = `
    <h3>Zonas para revisar primero (satelital)</h3>
    <p class="nota tiny">Manchas de humedad en temporada seca (Sentinel-2). Cada una es una <b>zona a revisar con cámara</b>; no se afirma que sea una fuga. Fuentes en Fichas técnicas.</p>
    <div id="sat-zonas" class="sat-lista"><p class="nota">Sin datos cargados</p></div>
    <div class="sat-acciones"><button type="button" class="btn mini" id="sat-export-geo">Exportar zonas (GeoJSON)</button>
      <button type="button" class="btn mini" id="sat-export-csv">Exportar zonas (CSV)</button></div>
    <div id="sat-foto" class="sat-foto" hidden></div>
    <h3>Escenas de Sentinel-2</h3>
    <p class="nota tiny">Consulta pública a Element84 Earth Search (colección <code>sentinel-2-l2a</code>), sin clave, sobre el recuadro de Gómez Palacio. Nubosidad baja primero.</p>
    <div class="sat-acciones"><button type="button" class="btn mini oro" id="sat-buscar">Buscar escenas recientes</button></div>
    <div id="sat-escenas" class="sat-escenas"></div>`;

  $("#sat-buscar").addEventListener("click", buscarEscenas);
  $("#sat-export-geo").addEventListener("click", () => exportar("geojson"));
  $("#sat-export-csv").addEventListener("click", () => exportar("csv"));

  cargarZonas();

  async function cargarZonas() {
    const box = document.getElementById("sat-zonas");
    try {
      const idx = await fetch(DATA + "index.json", { cache: "no-store" }).then((r) => r.ok ? r.json() : { archivos: [] });
      const files = idx.archivos || [];
      const all = [];
      for (const name of files) {
        const url = DATA + name;
        const gj = await fetch(url, { cache: "no-store" }).then((r) => r.ok ? r.json() : null);
        if (!gj || !gj.features) continue;
        for (const f of gj.features) all.push({ f, archivo: name });
      }
      zonas = all;
      pintarZonas();
    } catch (e) {
      box.innerHTML = `<p class="nota">Sin datos cargados</p><p class="nota tiny">${e.message}</p>`;
    }
  }

  function pintarZonas() {
    const box = document.getElementById("sat-zonas");
    while (gZonas.children.length) gZonas.remove(gZonas.children[0]);
    pickables.length = 0;
    if (!zonas.length) { box.innerHTML = `<p class="nota">Sin datos cargados</p>`; return; }
    box.innerHTML = zonas.map(({ f, archivo }, i) => {
      const p = f.properties || {};
      const et = p.etiqueta || (p.tipo === "humedad" ? "Zona a revisar con cámara" : (p.id || "Zona"));
      const cloud = p.tipo === "humedad" ? "hum" : "hun";
      return `<button type="button" class="sat-item ${cloud}" data-zi="${i}">
        <b>${p.id || "—"}</b> · ${et}
        <small>${p.fecha || ""} · ${p.tipo || ""} · ${archivo}</small>
      </button>`;
    }).join("");
    box.querySelectorAll("[data-zi]").forEach((b) => b.addEventListener("click", () => abrirZona(+b.dataset.zi)));
    for (let i = 0; i < zonas.length; i++) {
      const { f } = zonas[i];
      const c = centroide(f.geometry);
      const col = (f.properties?.tipo === "hundimiento") ? 0xf59e0b : 0x38bdf8;
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(22, 16, 12),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .85, depthWrite: false }),
      );
      m.position.set(c.x, 28, c.z);
      m.userData.zi = i;
      m.userData.sat = true;
      gZonas.add(m);
      pickables.push(m);
      const anillo = new THREE.Mesh(
        new THREE.RingGeometry(28, 40, 24),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .45, side: THREE.DoubleSide, depthWrite: false }),
      );
      anillo.rotation.x = -Math.PI / 2;
      anillo.position.set(c.x, 4, c.z);
      gZonas.add(anillo);
    }
  }

  function abrirZona(i) {
    const rec = zonas[i]; if (!rec) return;
    const p = rec.f.properties || {};
    const c = centroide(rec.f.geometry);
    if (typeof modoCiudad === "function") modoCiudad();
    if (typeof setSubsuelo === "function") setSubsuelo(true);
    if (typeof flyTo === "function") flyTo(c.x, c.z, { subte: true });
    if (marker) scene.remove(marker);
    marker = new THREE.Mesh(
      new THREE.ConeGeometry(18, 50, 8),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
    );
    marker.position.set(c.x, 55, c.z);
    marker.rotation.x = Math.PI;
    scene.add(marker);

    const et = p.etiqueta || "Zona a revisar con cámara";
    const near = typeof nearest === "function" ? nearest(c.x, c.z) : {};
    const extra = {
      Etiqueta: et,
      Intensidad: p.intensidad ?? PC,
      Fecha: p.fecha || PC,
      Fuente: p.fuente || PC,
      Nota: p.nota || PC,
      "Lectura en Fichas técnicas": p.tipo === "humedad" ? FICHA_MANCHA : (p.nota || PC),
      "Área (m²)": p.area_m2 ?? PC,
      Persistencia: p.persist ?? PC,
      NDMI: p.ndmi ?? PC,
      NDVI: p.ndvi ?? PC,
      Archivo: rec.archivo,
    };
    if (near.calle) extra["Calle más cercana"] = near.calle;
    if (near.red) extra["Tubería / red más cercana"] = near.red;
    if (near.fluye) extra["Obra Plan Fluye más cercana"] = near.fluye;
    if (typeof onFicha === "function") {
      onFicha(fichaHTML(attrs(`${p.id || ""} · ${et}`, {
        Estado: "proyectado para revisión (no es una fuga confirmada)",
        "Cota y profundidad": PC,
        "Diámetro y material": "no aplica",
        "Norma aplicable": PC,
        "Fuente del dato": p.fuente || PC,
        Identificador: p.id || PC,
      }, extra)));
    }
    const foto = document.getElementById("sat-foto");
    if (p.foto) {
      const src = (window.SAT_FOTOS && (window.SAT_FOTOS[p.id] || window.SAT_FOTOS[p.foto])) || (DATA + p.foto.replace(/^\.\//, ""));
      foto.hidden = false;
      foto.innerHTML = `<p class="nota tiny">Par de evidencia: color real y humedad (NDMI). ${et}.</p><img src="${src}" alt="Color real y humedad de la zona ${p.id || ""}">`;
      foto.scrollIntoView({ block: "nearest" });
    } else { foto.hidden = true; foto.innerHTML = ""; }
  }

  async function buscarEscenas() {
    const box = document.getElementById("sat-escenas");
    box.textContent = "Consultando Earth Search…";
    try {
      const body = {
        collections: ["sentinel-2-l2a"],
        bbox: BBOX,
        limit: 10,
        sortby: [{ field: "properties.datetime", direction: "desc" }],
        query: { "eo:cloud_cover": { lt: 30 } },
      };
      const r = await fetch(STAC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error("Earth Search respondió " + r.status);
      const d = await r.json();
      const feats = d.features || [];
      if (!feats.length) { box.innerHTML = `<p class="nota">No hay escenas recientes con esa nubosidad.</p>`; return; }
      box.innerHTML = feats.map((it, i) => {
        const dt = (it.properties?.datetime || "").slice(0, 10);
        const cc = it.properties?.["eo:cloud_cover"];
        const cloud = cc == null ? "—" : (Math.round(cc * 100) / 100) + " %";
        const thumb = it.assets?.thumbnail?.href || it.assets?.preview?.href || "";
        const visual = it.assets?.visual?.href || "";
        return `<article class="sat-escena" data-si="${i}">
          ${thumb ? `<img src="${thumb}" alt="Miniatura Sentinel-2 del ${dt}" crossorigin="anonymous">` : ""}
          <div><b>${dt}</b><span>Nubosidad ${cloud}</span>
            <div class="sat-acciones">
              ${visual ? `<a class="btn mini" href="${visual}" target="_blank" rel="noopener">Descargar color real (COG)</a>` : ""}
              ${thumb ? `<a class="btn mini" href="${thumb}" target="_blank" rel="noopener">Miniatura JPEG</a>` : ""}
              <button type="button" class="btn mini oro" data-drape="${i}">Tender sobre el terreno</button>
            </div>
          </div>
        </article>`;
      }).join("");
      box._items = feats;
      box.querySelectorAll("[data-drape]").forEach((b) => b.addEventListener("click", () => tender(feats[+b.dataset.drape])));
    } catch (e) {
      box.innerHTML = `<p class="nota">No se pudieron consultar las escenas (${e.message}).</p>`;
    }
  }

  function tender(item) {
    const thumb = item.assets?.thumbnail?.href;
    const bbox = item.bbox;
    if (!thumb || !bbox) return;
    const [x0, z0] = ll2local(bbox[0], bbox[3]);
    const [x1, z1] = ll2local(bbox[2], bbox[1]);
    const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(thumb, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      while (gDrape.children.length) gDrape.remove(gDrape.children[0]);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: .72, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set((x0 + x1) / 2, 2.5, (z0 + z1) / 2);
      mesh.renderOrder = 2;
      gDrape.add(mesh);
      if (typeof modoCiudad === "function") modoCiudad();
    }, undefined, () => {
      const box = document.getElementById("sat-escenas");
      const n = document.createElement("p");
      n.className = "nota tiny";
      n.textContent = "No se pudo tender la miniatura (CORS o red). Puede descargarse el color real (COG) o la JPEG.";
      box.appendChild(n);
    });
  }

  function exportar(kind) {
    if (!zonas.length) return;
    const fc = { type: "FeatureCollection", features: zonas.map(({ f }) => f) };
    let blob, name;
    if (kind === "csv") {
      const cols = ["id", "tipo", "etiqueta", "intensidad", "fecha", "fuente", "nota", "lon", "lat", "area_m2", "persist", "ndmi", "ndvi"];
      const lines = [cols.join(",")];
      for (const { f } of zonas) {
        const c = centroide(f.geometry);
        const p = f.properties || {};
        const row = cols.map((k) => {
          const v = k === "lon" ? c.lon : k === "lat" ? c.lat : (p[k] ?? "");
          return `"${String(v).replace(/"/g, '""')}"`;
        });
        lines.push(row.join(","));
      }
      blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
      name = "zonas_satelitales_sideapa.csv";
    } else {
      blob = new Blob([JSON.stringify(fc, null, 2)], { type: "application/geo+json" });
      name = "zonas_satelitales_sideapa.geojson";
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return {
    pickables,
    zonas: () => zonas,
    abrirZona,
    grupo: gZonas,
    drape: gDrape,
  };
}

function $(s) { return document.querySelector(s); }
