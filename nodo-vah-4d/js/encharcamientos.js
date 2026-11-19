/* Capa única «Encharcamientos»: oficial (Nova) + prensa (Crownteer).
   Se dibujan solo los lugares con coordenada. El tamaño sigue el número de
   tormentas distintas. Donde coinciden las dos fuentes, la marca es más fuerte.
   No se carga encharcamientos_prensa_lerdo. */
import * as THREE from "three";
import { attrs, fichaHTML, NIVEL, PC } from "./pliego.js";
import { ll2local } from "./satelite.js";

const DATA = "data/satelite/";
const OFICIAL = "encharcamientos_oficiales_gp.geojson";
const PRENSA = "encharcamientos_prensa_gp.geojson";

const COL = {
  oficial: 0x4f46e5,
  prensa: 0x0d9488,
  ambos: 0xf4b942,
  hundimiento: 0xea580c,
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}
function norm(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function fechasUnicas(lista) {
  return [...new Set(lista.filter(Boolean))].sort();
}
function fmtFecha(iso) {
  if (!iso) return "sin fecha de lluvia en la nota";
  const [y, m, d] = iso.split("-").map(Number);
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  if (!y || !m) return iso;
  return `${d || ""} ${meses[m - 1]} ${y}`.trim();
}
function clasesOficial(fuente) {
  const t = String(fuente || "");
  const out = [];
  if (/protecci[oó]n civil/i.test(t)) out.push("Protección Civil municipal");
  if (/tr[aá]nsito/i.test(t)) out.push("Tránsito municipal");
  if (/atlas/i.test(t)) out.push("Atlas de Riesgos");
  return out.length ? out : (t ? [t] : []);
}

function agregarLugar(map, key, patch) {
  let L = map.get(key);
  if (!L) {
    L = {
      key,
      nombre: "",
      tipo: "encharcamiento",
      enc: "",
      lon: null,
      lat: null,
      precision: "",
      ubicacion: "",
      oficial: null,
      prensa: [],
      fuentes: new Set(),
    };
    map.set(key, L);
  }
  if (patch.nombre && !L.nombre) L.nombre = patch.nombre;
  if (patch.enc) L.enc = patch.enc;
  if (patch.tipo) L.tipo = patch.tipo;
  if (patch.oficial) L.oficial = patch.oficial;
  if (patch.prensa) L.prensa.push(patch.prensa);
  if (patch.fuentes) for (const f of patch.fuentes) L.fuentes.add(f);
  if (patch.precision && !L.precision) L.precision = patch.precision;
  if (patch.ubicacion && !L.ubicacion) L.ubicacion = patch.ubicacion;
  if (patch.lon != null && L.lon == null) { L.lon = patch.lon; L.lat = patch.lat; }
}

function etiquetaLugar(L) {
  if (L.tipo === "hundimiento") return "Hundimiento de vialidad (no es encharcamiento)";
  const n = L.nTormentas;
  if (n >= 2) return `Encharcamiento recurrente – ${n} tormentas`;
  if (n === 1) return "Encharcamiento – 1 tormenta";
  return L.oficial ? "Registro oficial de encharcamiento" : "Encharcamiento";
}

function fuenteCapa(L) {
  const hasO = !!L.oficial;
  const hasP = L.prensa.length > 0;
  if (L.tipo === "hundimiento") return "hundimiento";
  if (hasO && hasP) return "ambos";
  if (hasO) return "oficial";
  return "prensa";
}

function radio(n, coincide) {
  const base = 16 + Math.min(7, Math.max(0, n)) * 7;
  return coincide ? base * 1.15 + 6 : base;
}

export async function crearEncharcamientos(ctx) {
  const { scene, etiqueta, flyTo, onFicha } = ctx;
  const group = new THREE.Group(); group.name = "encharca";
  scene.add(group);
  const pickables = [];
  const etiquetas = [];
  const lugares = [];
  const sinCoord = [];

  let ofi = { features: [] }, pre = { features: [] };
  try {
    ofi = await fetch(DATA + OFICIAL, { cache: "no-store" }).then((r) => r.ok ? r.json() : { features: [] });
  } catch (e) { console.error("encharca oficial", e); }
  try {
    pre = await fetch(DATA + PRENSA, { cache: "no-store" }).then((r) => r.ok ? r.json() : { features: [] });
  } catch (e) { console.error("encharca prensa", e); }

  const map = new Map();

  for (const f of ofi.features || []) {
    const p = f.properties || {};
    const id = p.id || "";
    const g = f.geometry;
    const lon = g && g.coordinates ? g.coordinates[0] : null;
    const lat = g && g.coordinates ? g.coordinates[1] : null;
    agregarLugar(map, "enc:" + id, {
      nombre: p.nombre || id,
      enc: id,
      tipo: p.tipo === "hundimiento" ? "hundimiento" : "encharcamiento",
      oficial: p,
      fuentes: ["oficial"],
      lon, lat,
      precision: p.precision || "",
      ubicacion: p.ubicacion || "",
    });
  }

  for (const f of pre.features || []) {
    const p = f.properties || {};
    const enc = (p.enc_nova || "").trim();
    const g = f.geometry;
    const lon = g && g.coordinates ? g.coordinates[0] : null;
    const lat = g && g.coordinates ? g.coordinates[1] : null;
    const nombre = p.colonia || p.calle_o_cruce || p.id;
    if (enc) {
      agregarLugar(map, "enc:" + enc, {
        nombre,
        enc,
        prensa: p,
        fuentes: ["prensa"],
        lon, lat,
        precision: p.precision_geocodificacion || "",
      });
    } else if (lon != null && lat != null) {
      const key = p.colonia
        ? "col:" + norm(p.colonia)
        : (p.calle_o_cruce ? "calle:" + norm(p.calle_o_cruce) : `xy:${lon.toFixed(4)},${lat.toFixed(4)}`);
      agregarLugar(map, key, {
        nombre,
        prensa: p,
        fuentes: ["prensa"],
        lon, lat,
        precision: p.precision_geocodificacion || "",
      });
    } else {
      sinCoord.push(p);
    }
  }

  for (const L of map.values()) {
    L.nTormentas = fechasUnicas(L.prensa.map((x) => x.fecha_evento)).length;
    L.fuenteCapa = fuenteCapa(L);
    L.etiqueta = etiquetaLugar(L);
    L.coincide = L.fuenteCapa === "ambos";
    if (L.lon != null && L.lat != null) lugares.push(L);
    else {
      // official or grouped place still without a point
      if (L.oficial) sinCoord.push({
        _oficial: L.oficial,
        colonia: L.nombre,
        calle_o_cruce: "",
        fecha_evento: "",
        fuente: L.oficial.fuente_oficial,
        url: (L.oficial.urls && L.oficial.urls[0]) || "",
        enc_nova: L.enc,
        _fechas: fechasUnicas(L.prensa.map((x) => x.fecha_evento)),
        _prensa: L.prensa,
        _nombre: L.nombre,
        _n: L.nTormentas,
      });
    }
  }

  lugares.sort((a, b) => b.nTormentas - a.nTormentas || (b.coincide - a.coincide));

  for (const L of lugares) {
    const [x, z] = ll2local(L.lon, L.lat);
    L.x = x; L.z = z;
    const col = COL[L.fuenteCapa] || COL.prensa;
    const r = radio(L.nTormentas, L.coincide);
    const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: L.coincide ? 0.95 : 0.82, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 18, 14), mat);
    mesh.position.set(x, r * 0.55 + 8, z);
    mesh.userData.enc = L.key;
    mesh.userData.lugar = L;
    group.add(mesh);
    pickables.push(mesh);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r * 0.7, r, 32),
      new THREE.MeshBasicMaterial({
        color: L.coincide ? 0xfff4c2 : col,
        transparent: true,
        opacity: L.coincide ? 0.9 : 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 3, z);
    group.add(ring);
    if (L.coincide || L.nTormentas >= 5) {
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(r * 1.05, r * 1.25, 32),
        new THREE.MeshBasicMaterial({ color: 0xfff7d6, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
      );
      halo.rotation.x = -Math.PI / 2;
      halo.position.set(x, 2.2, z);
      group.add(halo);
    }
    if (etiqueta) {
      const color = L.tipo === "hundimiento" ? "#fb923c" : (L.coincide || L.nTormentas >= 5 ? "#f3d27a" : "#cfe8e4");
      const e = etiqueta(L.etiqueta, new THREE.Vector3(x, r + 18, z), "encharca", color);
      if (e) { e.cerca = L.nTormentas < 5 && !L.coincide; etiquetas.push(e); }
    }
  }

  function fichaLugar(L) {
    const fechas = fechasUnicas(L.prensa.map((x) => x.fecha_evento));
    const evHTML = L.prensa.length
      ? `<ul class="enc-eventos">${L.prensa
        .slice()
        .sort((a, b) => String(a.fecha_evento).localeCompare(String(b.fecha_evento)))
        .map((ev) => {
          const link = ev.url ? `<a href="${esc(ev.url)}" target="_blank" rel="noopener">${esc(ev.fuente || "Fuente")}</a>` : esc(ev.fuente || "Fuente");
          const lugar = [ev.colonia, ev.calle_o_cruce].filter(Boolean).join(" · ");
          const cita = ev.descripcion_textual ? `<br><span class="muted">${esc(ev.descripcion_textual)}</span>` : "";
          return `<li><b>${esc(fmtFecha(ev.fecha_evento))}</b> — ${link}${lugar ? `<br>${esc(lugar)}` : ""}${cita}</li>`;
        }).join("")}</ul>`
      : "sin notas de prensa cruzadas";
    const ofiTxt = L.oficial
      ? `${esc(L.oficial.fuente_oficial || "")}${L.oficial.nota ? `<br>${esc(L.oficial.nota)}` : ""}`
      : "sin registro en la capa oficial de Nova";
    const urlsOf = (L.oficial && L.oficial.urls) ? L.oficial.urls.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">enlace oficial</a>`).join(" · ") : "";
    const extra = {
      Identificador: L.enc || (L.prensa[0] && L.prensa[0].id) || "—",
      Etiqueta: L.etiqueta,
      "Tormentas en prensa": L.nTormentas ? `${L.nTormentas} (${fechas.map(fmtFecha).join("; ")})` : "ninguna en la hemeroteca 2023-2026",
      Fuentes: L.fuenteCapa === "ambos" ? "Oficial (Nova) y prensa (Crownteer) — coinciden" : (L.fuenteCapa === "oficial" ? "Oficial (Nova: Protección Civil / Tránsito / Atlas)" : "Prensa (Crownteer, hemeroteca 2023-2026)"),
      "Fuente oficial": ofiTxt,
      "Enlaces oficiales": urlsOf || "—",
      "Eventos de prensa": evHTML,
      Precisión: esc(L.precision || (L.oficial && L.oficial.precision) || PC),
      Ubicación: esc(L.ubicacion || (L.oficial && L.oficial.ubicacion) || ""),
    };
    if (L.tipo === "hundimiento") {
      extra["Lectura en Fichas técnicas"] = "Este punto es un hundimiento de vialidad, no un encharcamiento. No hay notas de prensa cruzadas (ENC-15).";
    }
    const estado = L.tipo === "hundimiento"
      ? "hundimiento de vialidad (no es encharcamiento)"
      : (L.nTormentas >= 2 ? "encharcamiento recurrente (hemeroteca + registro institucional si hay)" : "encharcamiento reportado");
    return fichaHTML(attrs(L.nombre + " · " + L.etiqueta, {
      estado,
      "cota/profundidad": PC,
      diámetro: "no aplica",
      material: "no aplica",
      "norma aplicable": PC,
      "fuente del dato": L.fuenteCapa === "prensa" ? "Hemeroteca de prensa (Crownteer, consulta 19-nov-2026)" : "Capa oficial Nova (Protección Civil / Tránsito / Atlas) y, si hay, hemeroteca de prensa Crownteer",
    }, extra));
  }

  function abrir(L) {
    if (!L) return;
    onFicha(fichaLugar(L));
    if (flyTo && L.x != null) flyTo(L.x, L.z, { dist: 900, h: 420 });
  }

  function nearest(x, z, maxM = 250) {
    let best = null;
    for (const L of lugares) {
      const d = Math.hypot(x - L.x, z - L.z);
      if (d <= maxM && (!best || d < best.d)) best = { L, d };
    }
    return best;
  }

  function listaSinCoordHTML() {
    // group unlocated press + official-without-point
    const groups = new Map();
    const push = (nombre, rec) => {
      const k = norm(nombre) || "sin colonia ni calle";
      if (!groups.has(k)) groups.set(k, { nombre, n: 0, fechas: [], items: [], enc: rec.enc_nova || rec.enc || "" });
      const G = groups.get(k);
      if (rec.fecha_evento) G.fechas.push(rec.fecha_evento);
      if (rec._fechas) G.fechas.push(...rec._fechas);
      if (rec._n) G.n = Math.max(G.n, rec._n);
      G.items.push(rec);
      if (rec.enc_nova) G.enc = rec.enc_nova;
    };
    for (const p of sinCoord) {
      const nombre = p._nombre || p.colonia || p.calle_o_cruce || p.id || "Sin colonia ni calle";
      push(nombre, p);
    }
    const arr = [...groups.values()].map((G) => {
      G.fechas = fechasUnicas(G.fechas);
      G.n = Math.max(G.n, G.fechas.length);
      return G;
    }).sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, "es"));
    if (!arr.length) return "<p class='nota tiny'>Todos los registros de esta capa tienen coordenada o ya están dibujados.</p>";
    return `<ul class="enc-sin">${arr.map((G) => {
      const fechas = G.fechas.length ? G.fechas.map(fmtFecha).join("; ") : "sin fecha de lluvia";
      const links = G.items.filter((it) => it.url).map((it) => `<a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(fmtFecha(it.fecha_evento) || it.fuente || "fuente")}</a>`);
      const uniq = [...new Set(links)];
      const stamp = G.n >= 2 ? `Encharcamiento recurrente – ${G.n} tormentas` : (G.n === 1 ? "Encharcamiento – 1 tormenta" : "Registro oficial");
      const enc = G.enc ? ` · ${esc(G.enc)}` : "";
      return `<li class="${G.n >= 5 ? "enc-fuerte" : ""}"><b>${esc(G.nombre)}</b>${enc}<br><i>${esc(stamp)}</i><br>${esc(fechas)}${uniq.length ? `<br>${uniq.join(" · ")}` : ""}</li>`;
    }).join("")}</ul>`;
  }

  function listaHTML() {
    const nOfi = (ofi.features || []).length;
    const nPre = (pre.features || []).length;
    const nDib = lugares.filter((L) => L.tipo !== "hundimiento").length;
    const nSin = sinCoord.length;
    const top = lugares.filter((L) => L.nTormentas >= 5).map((L) => `${esc(L.nombre)} (${L.nTormentas})`).join(", ");
    return `<div class="enc-bloque">
      <h3>Encharcamientos</h3>
      <p class="nota tiny">Capa única, color por fuente: <span class="enc-ley ofi">oficial (Nova)</span>, <span class="enc-ley pre">prensa (Crownteer)</span>, <span class="enc-ley amb">coinciden — marca más fuerte</span>. El tamaño sigue el número de tormentas distintas (2023-2026). Se dibujan ${nDib} lugares con coordenada (de ${nPre} notas de prensa y ${nOfi} registros oficiales). No se carga el archivo de Lerdo.</p>
      <p class="nota tiny">Marcas más fuertes: ${top || "—"}. El Amigo acumula 6 tormentas en prensa pero no tiene coordenada OSM ni en la capa oficial: va en el listado, no en el mapa. ENC-13 (Abraham Rosales) y ENC-15 (hundimiento en Av. Francisco Villa) no tienen prensa.</p>
      <p class="nota tiny"><b>Sin coordenada, listados por colonia</b> (${nSin} registros). Pulsar una marca del mapa abre las fechas y los enlaces en Fichas técnicas.</p>
      ${listaSinCoordHTML()}
    </div>`;
  }

  return { group, pickables, lugares, sinCoord, fichaLugar, abrir, nearest, listaHTML, etiquetas };
}
