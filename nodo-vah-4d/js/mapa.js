/* Mapa de vigilancia (vista inicial tras el candado).
   Puntos: motor satelital (zonas_humedad.geojson) + GP-001 fusionado con GP-H006.
   Encharcamientos: oficial Nova + prensa Crownteer. Hundimientos: 7 puntos HN (Nano / LiCSAR).
   El Nodo permanece visible. El visor 3D/4D no se elimina: se abre con «Ver Nodo VAH 3D/4D». */
import { fusionarZonas, centroideLL, esNueva } from "./zonas.js";

const DATA = "data/satelite/";
const NODO = { lat: 25.583829, lon: -103.446190, label: "Nodo VAH – Ubicación de referencia" };

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function norm(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function gm(la, lo) {
  return `<a class="gbtn maps" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${la},${lo}">Abrir en Google Maps</a>`
    + `<a class="gbtn dir" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${la},${lo}">Cómo llegar</a>`;
}
const centroide = centroideLL;
function fechasUnicas(lista) {
  return [...new Set(lista.filter(Boolean))].sort();
}
function fmtFecha(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  if (!y || !m) return iso;
  return `${d || ""} ${meses[m - 1]} ${y}`.trim();
}
async function cargar(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(url + " " + r.status);
  return r.json();
}

let map, capas, markers = {}, iniciado = false, onVisor4D = null;

export function initMapa(opts = {}) {
  if (typeof L === "undefined") { setTimeout(() => initMapa(opts), 40); return; }
  onVisor4D = opts.onVisor4D || null;
  const root = document.getElementById("vista-mapa");
  if (!root) return;
  root.hidden = false;
  if (iniciado) { map.invalidateSize(); abrirHash(); return; }
  iniciado = true;
  construir(root);
}

export function mostrarMapa() {
  const root = document.getElementById("vista-mapa");
  const app = document.getElementById("app");
  if (app) { app.hidden = true; app.classList.remove("desde-mapa"); }
  if (root) { root.hidden = false; }
  if (map) setTimeout(() => map.invalidateSize(), 80);
}

export function ocultarMapa() {
  const root = document.getElementById("vista-mapa");
  if (root) root.hidden = true;
}

function construir(root) {
  map = L.map("m", { zoomControl: false, keyboard: true, zoomAnimation: true, fadeAnimation: true, maxZoom: 19 })
    .setView([25.575, -103.495], 13);
  // Imagen: nativa hasta 19, sin pedir teselas inventadas ni estirar de más.
  const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19, maxNativeZoom: 19, attribution: "Esri · Earthstar Geographics",
  });
  // Referencia Esri (carreteras salmón y topónimos): nativa y visible solo hasta z16.
  // A z17–19 esas teselas ráster se ven gruesas y borrosas; no se estiran.
  const lab = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 16, maxNativeZoom: 16,
  });
  const lab2 = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 16, maxNativeZoom: 16,
  });
  const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, maxNativeZoom: 19, attribution: "© OpenStreetMap",
  });
  sat.addTo(map); lab.addTo(map); lab2.addTo(map);

  const F = L.layerGroup().addTo(map);
  const C = L.layerGroup().addTo(map);
  const E = L.layerGroup().addTo(map);
  const H = L.layerGroup(); // off by default
  const N = L.layerGroup().addTo(map);
  const P = L.layerGroup(); // Plan Fluye, apagada hasta la vista subterránea
  capas = { F, C, E, H, N, P, sat, lab, lab2, osm };

  document.getElementById("vm-menu-btn")?.addEventListener("click", () => {
    document.getElementById("vm-menu")?.classList.toggle("open");
  });
  document.getElementById("vm-nodo4d")?.addEventListener("click", () => onVisor4D?.());
  document.getElementById("vm-salir")?.addEventListener("click", () => {
    sessionStorage.removeItem("portal_coronel_ok_v1");
    localStorage.removeItem("coronel_nodo4d_recordar_v1");
    location.reload();
  });
  const sw = (id, layer, add) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (add) el.checked = true;
    el.addEventListener("change", (e) => { e.target.checked ? layer.addTo(map) : map.removeLayer(layer); });
  };
  sw("cF", F, true); sw("cC", C, true); sw("cE", E, true); sw("cH", H, false); sw("cN", N, true); sw("cP", P, false);
  prepararFantasma({ H, P });
  document.getElementById("cS")?.addEventListener("change", (e) => {
    if (e.target.checked) { map.removeLayer(osm); sat.addTo(map); lab.addTo(map); lab2.addTo(map); }
    else { [sat, lab, lab2].forEach((x) => map.removeLayer(x)); osm.addTo(map); }
  });

  document.getElementById("vm-zoomin")?.addEventListener("click", () => map.zoomIn());
  document.getElementById("vm-zoomout")?.addEventListener("click", () => map.zoomOut());
  const pan = (dx, dy) => map.panBy([dx, dy], { animate: true, duration: 0.35 });
  document.getElementById("vm-n")?.addEventListener("click", () => pan(0, -140));
  document.getElementById("vm-s")?.addEventListener("click", () => pan(0, 140));
  document.getElementById("vm-o")?.addEventListener("click", () => pan(-140, 0));
  document.getElementById("vm-e")?.addEventListener("click", () => pan(140, 0));

  document.getElementById("busca")?.addEventListener("change", (e) => {
    const v = e.target.value.split(/[ ,;]+/).map(Number);
    if (v.length >= 2 && !isNaN(v[0]) && !isNaN(v[1])) {
      const la = v[0], lo = v[1];
      map.flyTo([la, lo], 18, { duration: 1.05 });
      L.popup().setLatLng([la, lo]).setContent(`<b>${la}, ${lo}</b><div class="vm-coords"></div>${gm(la, lo)}`).openOn(map);
    }
  });
  let yo;
  document.getElementById("vm-yo")?.addEventListener("click", () => map.locate({ setView: true, maxZoom: 17 }));
  map.on("locationfound", (e) => {
    if (yo) map.removeLayer(yo);
    yo = L.circleMarker(e.latlng, { radius: 9, color: "#fff", weight: 2, fillColor: "#1a73e8", fillOpacity: 1 }).addTo(map);
  });

  ponerNodo(N);
  map.on("zoomend", () => { for (const rec of poligonos) rec.layer.setStyle(estiloZona(rec.nueva)); });
  Promise.all([
    cargar(DATA + "zonas_humedad.geojson").catch(() => ({ features: [] })),
    cargar(DATA + "zona_humedad_motor_fugas_gp001.geojson").catch(() => ({ features: [] })),
    cargar(DATA + "encharcamientos_oficiales_gp.geojson").catch(() => ({ features: [] })),
    cargar(DATA + "encharcamientos_prensa_gp.geojson").catch(() => ({ features: [] })),
    cargar(DATA + "el_amigo_jabonoso.geojson").catch(() => ({ features: [] })),
    cargar(DATA + "hundimientos_hn_sentinel1_2022_2026.geojson").catch(() => ({ features: [] })),
  ]).then(([zh, gp001, ofi, pre, amigo, hn]) => {
    const zonas = fusionarZonas(zh.features || [], gp001.features || []);
    pintarZonas(zonas, F, C);
    pintarEncharca(ofi.features || [], pre.features || [], amigo, E);
    pintarHundimientos(hn.features || [], H);
    pintarFluye(P);
    listaFluye();
    ajustarVista(zonas);
    listaZonas(zonas);
    listaEncharcaSin(pre.features || [], ofi.features || []);
    abrirHash();
  }).catch((e) => console.error("mapa datos", e));

  window.addEventListener("hashchange", abrirHash);
}

function ponerNodo(N) {
  const { lat, lon, label } = NODO;
  const html = `<b>${esc(label)}</b>
    <p>Marcador de referencia junto al Parque Industrial Lagunero, el mismo del visor 3D. El predio real está por definir; no se inventa un terreno. Las coordenadas UTM de la memoria (unos 26 km al norte de la mancha urbana) no se usaron para colocar este punto.</p>
    <div class="vm-coords">${lat.toFixed(6)}, ${lon.toFixed(6)}</div>
    ${gm(lat, lon)}
    <button type="button" class="gbtn nodo" id="pop-nodo4d">Ver Nodo VAH 3D/4D</button>`;
  const icon = L.divIcon({
    className: "mk-nodo",
    html: `<span class="mk-diamond"></span><span class="mk-lab">Nodo VAH</span>`,
    iconSize: [22, 22], iconAnchor: [11, 19],
  });
  const mk = L.marker([lat, lon], { icon, zIndexOffset: 1200, title: label }).bindPopup(html, { maxWidth: 340 });
  mk.on("popupopen", () => document.getElementById("pop-nodo4d")?.addEventListener("click", () => onVisor4D?.()));
  N.addLayer(mk);
  markers["NODO-VAH"] = mk;
  markers["Nodo"] = mk;
}

function estiloZona(nueva) {
  const z = map.getZoom();
  const cerca = z >= 16;
  const muyCerca = z >= 17;
  return {
    color: nueva ? "#e11d2e" : "#f59e0b",
    weight: muyCerca ? 0 : (cerca ? 1.25 : 1.75),
    opacity: muyCerca ? 0 : 0.85,
    fillColor: nueva ? "#e11d2e" : "#f59e0b",
    fillOpacity: cerca ? 0 : 0.22,
    interactive: !muyCerca,
  };
}

const poligonos = [];
function pintarZonas(zonas, F, C) {
  poligonos.length = 0;
  for (const f of zonas) {
    const p = f.properties || {};
    const [la, lo] = f._ll || centroide(f);
    const nueva = esNueva(p);
    const col = nueva ? "#e11d2e" : "#f59e0b";
    const titulo = p.id === "GP-001" ? "GP-001 · Humedad nueva" : `${p.id} · ${nueva ? "Humedad nueva" : "Humedad constante"}`;
    const fuentes = p.fuentes_fusion
      ? `<p>Fuentes: ${esc(p.fuentes_fusion)}.</p>`
      : `<p>Fuente: motor satelital automático.</p>`;
    const img = p.img ? `<img src="${p.img}" alt="Par satelital de ${esc(p.id)}">` : "";
    const html = `<b>${esc(titulo)}</b>
      <p>${esc(p.explicacion || p.nota || "Zona a revisar con cámara.")}</p>
      ${p.calle_cercana ? `<p>Calle cercana: ${esc(p.calle_cercana)}${p.dist_calle_m != null ? ` (${Math.round(p.dist_calle_m)} m)` : ""}.</p>` : ""}
      <p>Confianza ${esc(p.confianza || "—")} · intensidad ${esc(p.intensidad ?? "—")}${p.area_m2 ? ` · ≈ ${Number(p.area_m2).toLocaleString("es-MX")} m²` : ""}</p>
      ${fuentes}
      <div class="vm-coords">${(+la).toFixed(6)}, ${(+lo).toFixed(6)}</div>
      ${img}${gm(la, lo)}`;
    const icon = L.divIcon({
      className: "mk " + (nueva ? "mk-nueva" : "mk-const"),
      html: (nueva ? `<span class="mk-pulse"></span>` : "") + `<span class="mk-core"></span><span class="mk-lab">${esc(p.id)}</span>`,
      iconSize: [22, 22], iconAnchor: [11, 14],
    });
    if (f.geometry && f.geometry.type && f.geometry.type !== "Point") {
      const gj = L.geoJSON(f, { style: estiloZona(nueva), interactive: true }).bindPopup(html, { maxWidth: 340 }).addTo(nueva ? F : C);
      poligonos.push({ layer: gj, nueva });
    }
    const mk = L.marker([la, lo], { icon, zIndexOffset: nueva ? 800 : 400, title: p.id }).bindPopup(html, { maxWidth: 340 });
    (nueva ? F : C).addLayer(mk);
    markers[p.id] = mk;
    if (p.id_motor) markers[p.id_motor] = mk;
  }
}

function pintarEncharca(ofi, pre, amigo, E) {
  const mapL = new Map();
  const add = (key, patch) => {
    let Lx = mapL.get(key);
    if (!Lx) { Lx = { key, nombre: "", enc: "", lon: null, lat: null, oficial: null, prensa: [], precision: "" }; mapL.set(key, Lx); }
    if (patch.nombre && !Lx.nombre) Lx.nombre = patch.nombre;
    if (patch.enc) Lx.enc = patch.enc;
    if (patch.oficial) Lx.oficial = patch.oficial;
    if (patch.prensa) Lx.prensa.push(patch.prensa);
    if (patch.precision && !Lx.precision) Lx.precision = patch.precision;
    if (patch.lon != null && Lx.lon == null) { Lx.lon = patch.lon; Lx.lat = patch.lat; }
  };
  for (const f of ofi) {
    const p = f.properties || {};
    if (p.tipo === "hundimiento") continue; // va en capa de hundimientos / ficha ENC-15
    const g = f.geometry;
    const lon = g && g.coordinates ? g.coordinates[0] : null;
    const lat = g && g.coordinates ? g.coordinates[1] : null;
    add("enc:" + (p.id || ""), { nombre: p.nombre || p.id, enc: p.id, oficial: p, lon, lat, precision: p.precision });
  }
  for (const f of pre) {
    const p = f.properties || {};
    const enc = (p.enc_nova || "").trim();
    const g = f.geometry;
    const lon = g && g.coordinates ? g.coordinates[0] : null;
    const lat = g && g.coordinates ? g.coordinates[1] : null;
    const nombre = p.colonia || p.calle_o_cruce || p.id;
    if (enc) add("enc:" + enc, { nombre, enc, prensa: p, lon, lat, precision: p.precision_geocodificacion });
    else if (lon != null && lat != null) {
      const key = p.colonia ? "col:" + norm(p.colonia) : (p.calle_o_cruce ? "calle:" + norm(p.calle_o_cruce) : `xy:${(+lon).toFixed(4)},${(+lat).toFixed(4)}`);
      add(key, { nombre, prensa: p, lon, lat, precision: p.precision_geocodificacion });
    }
  }

  if (amigo && amigo.features) {
    for (const f of amigo.features) {
      const p = f.properties || {};
      const Lx = mapL.get("enc:ENC-01") || { prensa: [], nombre: p.nombre, enc: "ENC-01" };
      const n = fechasUnicas((Lx.prensa || []).map((x) => x.fecha_evento)).length || p.n_tormentas || 6;
      const ev = (Lx.prensa || []).map((ev) => `<li>${esc(fmtFecha(ev.fecha_evento))}${ev.url ? ` · <a target="_blank" rel="noopener" href="${esc(ev.url)}">${esc(ev.fuente || "nota")}</a>` : ""}</li>`).join("");
      const lineL = L.geoJSON(f, { style: estiloAmigo(false, "line"), className: "amigo-line" });
      const b = lineL.getBounds().getCenter();
      const html = `<b>${esc(p.nombre || "El Amigo")} · Encharcamiento recurrente – ${n} tormentas</b>
        <p>${esc(p.tramo)}. Geometría: tramo de Boulevard Jabonoso en OpenStreetMap, de Av. Nacional al Periférico / Puente Jabonoso (El Siglo, 2 oct 2026). No es un levantamiento del vaso.</p>
        ${ev ? `<ul>${ev}</ul>` : ""}
        <p>No se inventó un punto de colonia: se dibuja el tramo que nombra la prensa.</p>
        <div class="vm-coords">${b.lat.toFixed(6)}, ${b.lng.toFixed(6)}</div>
        ${gm(b.lat, b.lng)}`;
      lineL.bindPopup(html, { maxWidth: 340 }).addTo(E);
      amigoRecs.push({ layer: lineL, kind: "line" });
      const mk = L.circleMarker(b, estiloAmigo(false, "mk")).bindPopup(html, { maxWidth: 340 });
      E.addLayer(mk);
      amigoRecs.push({ layer: mk, kind: "mk" });
      markers["ENC-01"] = mk;
      markers["El-Amigo"] = mk;
    }
  }

  for (const Lx of mapL.values()) {
    if (Lx.enc === "ENC-01" && markers["ENC-01"]) continue; // ya el tramo
    if (Lx.lon == null || Lx.lat == null) continue;
    const n = fechasUnicas(Lx.prensa.map((x) => x.fecha_evento)).length;
    const coincide = !!(Lx.oficial && Lx.prensa.length);
    const et = n >= 2 ? `Encharcamiento recurrente – ${n} tormentas` : (n === 1 ? "Encharcamiento – 1 tormenta" : "Registro oficial de encharcamiento");
    const ev = Lx.prensa.slice().sort((a, b) => String(a.fecha_evento).localeCompare(String(b.fecha_evento)))
      .map((e) => `<li>${esc(fmtFecha(e.fecha_evento))}${e.url ? ` · <a target="_blank" rel="noopener" href="${esc(e.url)}">${esc(e.fuente || "nota")}</a>` : ""}${e.descripcion_textual ? `<br><i>${esc(e.descripcion_textual)}</i>` : ""}</li>`).join("");
    const html = `<b>${esc(Lx.nombre)} · ${esc(et)}</b>
      ${Lx.oficial ? `<p>${esc(Lx.oficial.fuente_oficial || "")}${Lx.oficial.nota ? `<br>${esc(Lx.oficial.nota)}` : ""}</p>` : ""}
      ${coincide ? "<p>Coinciden el registro oficial (Nova) y la hemeroteca de prensa (Crownteer).</p>" : ""}
      ${ev ? `<ul>${ev}</ul>` : ""}
      ${Lx.precision ? `<p>Precisión: ${esc(Lx.precision)}</p>` : ""}
      <div class="vm-coords">${(+Lx.lat).toFixed(6)}, ${(+Lx.lon).toFixed(6)}</div>
      ${gm(Lx.lat, Lx.lon)}`;
    const r = 5 + Math.min(7, n) * 1.3 + (coincide ? 2 : 0);
    const mk = L.circleMarker([Lx.lat, Lx.lon], {
      radius: r, color: "#fff", weight: coincide || n >= 5 ? 2 : 1,
      fillColor: coincide ? "#60a5fa" : "#2563eb", fillOpacity: 0.92,
    }).bindPopup(html, { maxWidth: 340 });
    E.addLayer(mk);
    if (Lx.enc) markers[Lx.enc] = mk;
  }
}

function pintarHundimientos(feats, H) {
  for (const f of feats) {
    if ((f.geometry || {}).type !== "Point") continue;
    const p = f.properties || {};
    const [lo, la] = f.geometry.coordinates;
    const vmax = p.velocidad_mm_anio != null ? Math.abs(p.velocidad_mm_anio) : null;
    const vz = p.velocidad_media_zona_mm_anio != null ? Math.abs(p.velocidad_media_zona_mm_anio) : null;
    const urb = p.mediana_urbana_mm_anio != null ? Math.abs(p.mediana_urbana_mm_anio) : 10.2;
    let extra = "";
    if (p.id === "HN01") {
      extra = `<p>Núcleo del oriente del centro: la zona se hunde unos ${(vz / 10).toFixed(1)} cm/año (el píxel más rápido, ${la.toFixed(3)}, ${lo.toFixed(3)}, alcanza ${(vmax / 10).toFixed(1)} cm/año). El hundimiento de Av. Francisco Villa frente a Granjas (~4.2 cm/año) queda dentro de esta zona.</p>`;
    } else if (p.id === "HN04") {
      extra = `<p>Borde hacia Lerdo / La Unión: hasta ${(vmax / 10).toFixed(1)} cm/año en el píxel más rápido.</p>`;
    }
    const html = `<b>${esc(p.id)} · Hundimiento (radar Sentinel-1)</b>
      ${extra || `<p>Velocidad de la zona ≈ ${vz != null ? (vz / 10).toFixed(1) : "—"} cm/año; píxel más rápido ${(vmax / 10).toFixed(1)} cm/año.</p>`}
      <p>La mediana urbana en el periodo es de unos ${(urb / 10).toFixed(1)} cm/año. 86 pasadas, abril 2022 a abril 2026. Fuente: COMET LiCSAR (Universidad de Leeds), Sentinel-1 / ESA Copernicus. El satélite mide el terreno, no ve el interior de los tubos.</p>
      <div class="vm-coords">${(+la).toFixed(6)}, ${(+lo).toFixed(6)}</div>
      ${gm(la, lo)}`;
    const mk = L.circleMarker([la, lo], { ...estiloHN(p, false), className: "hn-mk" }).bindPopup(html, { maxWidth: 340 });
    H.addLayer(mk);
    hnRecs.push({ layer: mk, p });
    markers[p.id] = mk;
  }
}

function ajustarVista(zonas) {
  const pts = [[NODO.lat, NODO.lon]];
  for (const f of zonas) if (f._ll) pts.push(f._ll);
  if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 13.2 });
}

function listaZonas(zonas) {
  const ul = document.getElementById("vm-zonas");
  if (!ul) return;
  ul.innerHTML = zonas.map((f) => {
    const p = f.properties || {};
    const nueva = esNueva(p);
    const top = p.id === "GP-001" ? " top" : "";
    const det = [nueva ? "Humedad nueva" : "Humedad constante", p.confianza ? `confianza ${p.confianza}` : "", p.calle_cercana || ""].filter(Boolean).join(" · ");
    return `<li><button type="button" class="${nueva ? "nueva" : ""}${top}" data-z="${esc(p.id)}"><b>${esc(p.id)}</b><small>${esc(det)}</small></button></li>`;
  }).join("");
  ul.querySelectorAll("[data-z]").forEach((b) => b.addEventListener("click", () => volar(b.dataset.z)));
}

function listaEncharcaSin(pre, ofi) {
  const box = document.getElementById("vm-enc-sin");
  if (!box) return;
  // unlocated press without enc already drawn, plus official still without geom (except ENC-01 now lined)
  const drawn = new Set(["ENC-01", "ENC-02", "ENC-03", "ENC-05", "ENC-06", "ENC-07", "ENC-08", "ENC-09", "ENC-11", "ENC-12", "ENC-14"]);
  const groups = new Map();
  const push = (nombre, rec) => {
    const k = norm(nombre) || "sin colonia";
    if (!groups.has(k)) groups.set(k, { nombre, fechas: [], n: 0 });
    const G = groups.get(k);
    if (rec.fecha_evento) G.fechas.push(rec.fecha_evento);
    G.n = Math.max(G.n, rec._n || 0);
  };
  for (const f of ofi) {
    const p = f.properties || {};
    if (p.tipo === "hundimiento") continue;
    if (drawn.has(p.id) || f.geometry) continue;
    const n = (pre.filter((x) => (x.properties || {}).enc_nova === p.id).map((x) => x.properties.fecha_evento));
    push(p.nombre || p.id, { _n: fechasUnicas(n).length, fecha_evento: "" });
    n.forEach((fe) => push(p.nombre || p.id, { fecha_evento: fe }));
  }
  for (const f of pre) {
    const p = f.properties || {};
    if (f.geometry || drawn.has(p.enc_nova)) continue;
    if (p.enc_nova) continue; // already grouped via official
    push(p.colonia || p.calle_o_cruce || p.id, p);
  }
  const arr = [...groups.values()].map((G) => ({ ...G, fechas: fechasUnicas(G.fechas), n: Math.max(G.n, fechasUnicas(G.fechas).length) }))
    .filter((G) => G.n || G.fechas.length)
    .sort((a, b) => b.n - a.n);
  box.innerHTML = arr.slice(0, 24).map((G) => `<li><b>${esc(G.nombre)}</b> · ${G.n >= 2 ? `Encharcamiento recurrente – ${G.n} tormentas` : "sin coordenada para dibujar"}</li>`).join("");
}

function volar(id) {
  const mk = markers[id];
  if (!mk) return;
  const ll = mk.getLatLng();
  map.flyTo(ll, 17, { duration: 1.1, easeLinearity: 0.22 });
  setTimeout(() => mk.openPopup(), 700);
}

function abrirHash() {
  const h = (location.hash || "").replace(/^#/, "");
  if (!h) return;
  if (markers[h] || markers[decodeURIComponent(h)]) volar(markers[h] ? h : decodeURIComponent(h));
}


const JERARQUIA = {
  atarjea: { color: "#5eead4", weight: 2, nombre: "Atarjea (20 cm)" },
  subcolector: { color: "#2dd4bf", weight: 3.5, nombre: "Subcolector (25–45 cm)" },
  colector: { color: "#22d3a8", weight: 5, nombre: "Colector (≥ 60 cm)" },
  emisor: { color: "#67e8f9", weight: 7, nombre: "Emisor (1.83 m)" },
};

let fantasmaOn = false, prevH = false, prevP = false;
const hnRecs = [], amigoRecs = [], pfRecs = [];

function estiloHN(p, ghost) {
  const vz = p.velocidad_media_zona_mm_anio != null ? Math.abs(p.velocidad_media_zona_mm_anio) : 26;
  const vmax = p.velocidad_mm_anio != null ? Math.abs(p.velocidad_mm_anio) : vz;
  const cm = (vmax || vz) / 10;
  const t = Math.max(0, Math.min(1, (cm - 2.5) / 3.2));
  if (!ghost) return { radius: 9, color: "#fff", weight: 2, fillColor: "#7c3aed", fillOpacity: 0.95, className: "hn-mk" };
  const fill = t > 0.6 ? "#f0abfc" : (t > 0.3 ? "#c4b5fd" : "#8b5cf6");
  return { radius: 8 + t * 8, color: "#f5f3ff", weight: 2, fillColor: fill, fillOpacity: 0.95, className: "hn-mk" };
}
function estiloAmigo(ghost, kind) {
  if (kind === "line") return { color: ghost ? "#38bdf8" : "#3b82f6", weight: ghost ? 6 : 5, opacity: ghost ? 0.95 : 0.9, className: "amigo-line" };
  return { radius: 9, color: "#fff", weight: 1.5, fillColor: ghost ? "#38bdf8" : "#2563eb", fillOpacity: 1 };
}
function estiloFluye(jer, ghost) {
  const J = JERARQUIA[jer] || JERARQUIA.colector;
  return { color: J.color, weight: ghost ? J.weight + 0.8 : J.weight, opacity: ghost ? 0.96 : 0.85, className: "pf-line" };
}

function prepararFantasma({ H, P }) {
  const btn = document.getElementById("vm-fantasma");
  const ley = document.getElementById("vm-fan-leyenda");
  const root = document.getElementById("vista-mapa");
  const txt = btn?.querySelector(".vm-fan-txt");
  const aplicar = (on) => {
    fantasmaOn = on;
    root?.classList.toggle("fantasma", on);
    if (btn) btn.setAttribute("aria-pressed", on ? "true" : "false");
    if (txt) txt.textContent = on ? "Vista en superficie" : "Vista subterránea";
    if (ley) ley.hidden = !on;
    const cH = document.getElementById("cH");
    const cP = document.getElementById("cP");
    if (on) {
      prevH = !!(cH && cH.checked);
      prevP = !!(cP && cP.checked);
      if (cH) cH.checked = true;
      if (cP) cP.checked = true;
      if (H && !map.hasLayer(H)) H.addTo(map);
      if (P && !map.hasLayer(P)) P.addTo(map);
    } else {
      if (cH) {
        cH.checked = prevH;
        if (prevH) { if (H && !map.hasLayer(H)) H.addTo(map); }
        else if (H) map.removeLayer(H);
      }
      if (cP) {
        cP.checked = prevP;
        if (prevP) { if (P && !map.hasLayer(P)) P.addTo(map); }
        else if (P) map.removeLayer(P);
      }
    }
    for (const rec of hnRecs) rec.layer.setStyle(estiloHN(rec.p, on));
    for (const rec of amigoRecs) rec.layer.setStyle(estiloAmigo(on, rec.kind));
    for (const rec of pfRecs) {
      const st = estiloFluye(rec.jer, on);
      if (rec.kind === "poly") rec.layer.setStyle({ ...st, fillColor: rec.fill || "#14b8a6", fillOpacity: 0.18 });
      else rec.layer.setStyle(st);
    }
  };
  btn?.addEventListener("click", () => aplicar(!fantasmaOn));
  const labs = () => document.getElementById("vista-mapa")?.classList.toggle("vm-labs", map.getZoom() >= 14);
  map.on("zoomend", labs);
  labs();
}

function midLL(line) {
  if (!line || !line.length) return null;
  const mid = line[Math.floor(line.length / 2)];
  return { lat: mid[0], lon: mid[1] };
}

function fuentesHTML(lista) {
  if (!lista || !lista.length) return "";
  return "<ul>" + lista.map((f) => {
    const tit = esc(f.titulo || "Fuente");
    const dato = f.dato ? ` — ${esc(f.dato)}` : "";
    const a = f.url ? `<a target="_blank" rel="noopener" href="${esc(f.url)}">${tit}</a>` : tit;
    return `<li>${a}${dato}</li>`;
  }).join("") + "</ul>";
}


const ETIQUETAS_FLUYE = {
  "pf-vergel": "Vergel",
  "pf-san-alberto": "San Alberto",
  "pf-jaramillo": "Jaramillo",
  "pf-arista": "Mariano Arista",
  "pf-herradura": "La Herradura",
  "pf-la-feria-ruleta": "La Feria",
  "pf-santa-rosa": "Brasil y Colombia",
  "pf-ptar-norte": "PTAR Norte",
  "pf-ptar-oriente": "PTAR Oriente",
  "pf-mercado-abastos": "Mercado de Abastos",
  "pf-casa-blanca": "Casa Blanca",
  "pf-hamburgo": "Hamburgo",
};
function etiquetaFluye(w) {
  return ETIQUETAS_FLUYE[w.id] || w.nombre;
}

function pintarFluye(P) {
  const data = (typeof window !== "undefined" && window.PLAN_FLUYE) || { obras: [], puntos: [] };
  pfRecs.length = 0;
  for (const w of data.obras || []) {
    const lines = (w.ll || []).filter((g) => g && g.length >= 2);
    if (!lines.length) continue;
    const jer = w.jerarquia || "colector";
    const estilo = estiloFluye(jer, false);
    const mid = midLL(lines[0]);
    const htmlDe = (la, lo) => `<b>${esc(w.nombre)}</b>
      <p>${esc(w.calle || "")}${w.calle ? ". " : ""}${esc(w.estado || "")}.</p>
      <p>${esc(JERARQUIA[jer]?.nombre || jer)}. ${esc(w.nota || w.geometria || "")}</p>
      ${fuentesHTML(w.fuente)}
      <div class="vm-coords">${(+la).toFixed(6)}, ${(+lo).toFixed(6)}</div>
      ${gm(la, lo)}`;
    for (const g of lines) {
      const latlngs = g.map(([la, lo]) => [la, lo]);
      const pl = L.polyline(latlngs, estilo);
      const c0 = pl.getBounds().getCenter();
      pl.bindPopup(htmlDe(c0.lat, c0.lng), { maxWidth: 360 });
      pl.on("click", (e) => { pl.setPopupContent(htmlDe(e.latlng.lat, e.latlng.lng)); });
      P.addLayer(pl);
      pfRecs.push({ layer: pl, jer, id: w.id, kind: "line" });
    }
    if (mid) {
      const mk = L.marker([mid.lat, mid.lon], {
        icon: L.divIcon({
          className: "mk-pf",
          html: `<span class="mk-core"></span><span class="mk-lab">${esc(etiquetaFluye(w))}</span>`,
          iconSize: [18, 18], iconAnchor: [9, 12],
        }),
        zIndexOffset: 500, title: w.nombre,
      }).bindPopup(htmlDe(mid.lat, mid.lon), { maxWidth: 360 });
      P.addLayer(mk);
      markers[w.id] = mk;
    }
  }
  for (const p of data.puntos || []) {
    if (p.lat == null || p.lon == null) continue;
    const html = `<b>${esc(p.nombre)}</b>
      ${p.sitio ? `<p>${esc(p.sitio)}.</p>` : ""}
      <p>${esc(p.estado || "")}</p>
      <p>${esc(p.detalle || "")}</p>
      ${fuentesHTML(p.fuente)}
      <div class="vm-coords">${(+p.lat).toFixed(6)}, ${(+p.lon).toFixed(6)}</div>
      ${gm(p.lat, p.lon)}`;
    if (p.poly && p.poly.length >= 3) {
      const ring = p.poly.map(([la, lo]) => [la, lo]);
      const pg = L.polygon(ring, {
        color: p.tipo === "ptar" ? "#67e8f9" : "#22d3a8",
        weight: 1.5, fillColor: p.tipo === "ptar" ? "#0891b2" : "#14b8a6",
        fillOpacity: 0.18, className: "pf-line",
      }).bindPopup(html, { maxWidth: 360 });
      P.addLayer(pg);
      pfRecs.push({ layer: pg, jer: "colector", id: p.id, kind: "poly", fill: p.tipo === "ptar" ? "#0891b2" : "#14b8a6" });
    }
    const cls = p.tipo === "ptar" ? "mk-ptar" : "mk-pf";
    const mk = L.marker([p.lat, p.lon], {
      icon: L.divIcon({
        className: cls,
        html: `<span class="mk-core"></span><span class="mk-lab">${esc(etiquetaFluye(p))}</span>`,
        iconSize: [20, 20], iconAnchor: [10, 14],
      }),
      zIndexOffset: p.tipo === "ptar" ? 900 : 600, title: p.nombre,
    }).bindPopup(html, { maxWidth: 360 });
    P.addLayer(mk);
    markers[p.id] = mk;
  }
}

function listaFluye() {
  const data = (typeof window !== "undefined" && window.PLAN_FLUYE) || {};
  const meta = data.meta || {};
  const cifras = meta.cifras || {};
  const box = document.getElementById("vm-fluye-cifras");
  if (box) {
    const hab = cifras.habitantes ? Number(cifras.habitantes).toLocaleString("es-MX") : "262 mil";
    box.innerHTML = [
      [`Emisor Central + San Ignacio`, `${cifras.emisor_km || 13.27} km · ${cifras.emisor_pulgadas || 72}″ y ${cifras.san_ignacio_pulgadas || 60}″ en ${cifras.material || "PRFV"} · ${cifras.emisor_diametro_m || 1.83} m de diámetro proyectado del emisor`],
      [`Inversión del emisor`, `${cifras.emisor_inversion_mdp || 570} MDP (cifra del plan firmado). ${cifras.emisor_inversion_nota || ""}`],
      [`Servicio`, `≈ ${cifras.residuales_pct || 80} % de las aguas residuales · ≈ ${hab} habitantes`],
      [`PTAR Norte`, `ampliación +${cifras.ptar_norte_modulo_lps || 250} L/s, ${cifras.ptar_norte_proyectada_lps || 750} L/s proyectados · ${cifras.ptar_norte_inversion_mdp || 500} MDP`],
      [`PTAR Oriente`, `modernización, ${cifras.ptar_oriente_proyectada_lps || 250} L/s proyectados`],
      [`Otras inversiones`, `Ramo 33 ${cifras.ramo33_mdp || 84.5} MDP · colector del Mercado de Abastos ${cifras.mercado_abastos_mdp || 11} MDP · obras complementarias ${cifras.obras_complementarias_mdp || 188} MDP (boletín 27 oct 2026)`],
      [`Jerarquía de la red`, cifras.jerarquia || "atarjea 20 cm → subcolector 25–45 cm → colector ≥ 60 cm → emisor 1.83 m"],
    ].map(([k, v]) => `<li><b>${esc(k)}.</b> ${esc(v)}</li>`).join("");
  }
  const ul = document.getElementById("vm-fluye-lista");
  if (ul) {
    const items = [];
    for (const w of data.obras || []) {
      if (!(w.ll && w.ll.length)) continue;
      items.push({ id: w.id, nombre: w.nombre, det: [w.calle, w.estado, JERARQUIA[w.jerarquia]?.nombre].filter(Boolean).join(" · ") });
    }
    for (const p of data.puntos || []) {
      items.push({ id: p.id, nombre: p.nombre, det: [p.sitio || p.tipo, p.estado].filter(Boolean).join(" · ") });
    }
    ul.innerHTML = items.map((it) => `<li><button type="button" data-z="${esc(it.id)}"><b>${esc(it.nombre)}</b><small>${esc(it.det)}</small></button></li>`).join("");
    ul.querySelectorAll("[data-z]").forEach((b) => b.addEventListener("click", () => volar(b.dataset.z)));
  }
  const sin = document.getElementById("vm-fluye-sin");
  if (sin) {
    sin.innerHTML = (data.solo_listado || []).map((x) => `<li><b>${esc(x.nombre)}</b> · ${esc(x.detalle || x.estado || "")}</li>`).join("");
  }
  const fu = document.getElementById("vm-fluye-fuentes");
  if (fu) {
    const links = (meta.fuentes || []).map((f) => f.url
      ? `<a target="_blank" rel="noopener" href="${esc(f.url)}">${esc(f.titulo)}</a>`
      : esc(f.titulo)).join(" · ");
    fu.innerHTML = `<b>Fuentes.</b> ${links || "Plan Fluye, abril 2026; boletín del Ayuntamiento, 27 oct 2026; Decreto 422; OpenStreetMap."} Geometrías de calle: © OpenStreetMap contributors (ODbL).`;
  }
}
