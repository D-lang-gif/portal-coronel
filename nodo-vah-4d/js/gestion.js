/* Plan Fluye (solo geometría con fuente) y capa «Dónde no perforar». */
import * as THREE from "three";
import { attrs, fichaHTML, NIVEL, PC } from "./pliego.js";

const VERDE = 0x22c55e;
const ROJO = 0xc23b2e;

function tubo(pts, y, r, color, op = .85) {
  if (!pts || pts.length < 2) return null;
  const c = new THREE.CurvePath();
  for (let i = 0; i < pts.length - 1; i++) {
    const a = new THREE.Vector3(pts[i][0], y, pts[i][1]);
    const b = new THREE.Vector3(pts[i + 1][0], y, pts[i + 1][1]);
    if (a.distanceToSquared(b) > .01) c.add(new THREE.LineCurve3(a, b));
  }
  if (!c.curves.length) return null;
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide });
  const m = new THREE.Mesh(new THREE.TubeGeometry(c, Math.min(600, pts.length * 4 + 8), r, 8, false), mat);
  m.renderOrder = 10;
  return m;
}

function largo(pts) {
  let L = 0;
  for (let i = 0; i < pts.length - 1; i++) L += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  return L;
}
function mid(pts) {
  const L = largo(pts); if (L <= 0) return pts[0];
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const s = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    if (acc + s >= L / 2) {
      const t = s ? (L / 2 - acc) / s : 0;
      return [pts[i][0] + t * (pts[i + 1][0] - pts[i][0]), pts[i][1] + t * (pts[i + 1][1] - pts[i][1])];
    }
    acc += s;
  }
  return pts[pts.length - 1];
}
function distLinea(p, pts) {
  let best = Infinity, q = pts[0];
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1];
    const vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * vx + (p[1] - az) * vz) / L2));
    const x = ax + t * vx, z = az + t * vz;
    const d = Math.hypot(p[0] - x, p[1] - z);
    if (d < best) { best = d; q = [x, z]; }
  }
  return { d: best, q };
}

export function crearGestion(scene, ciudad, c2) {
  const fluyeG = new THREE.Group(); fluyeG.name = "fluye";
  const noPerfG = new THREE.Group(); noPerfG.name = "noperforar";
  scene.add(fluyeG); scene.add(noPerfG);
  const pickables = [];
  const obras = [];

  const data = window.PLAN_FLUYE || { obras: [] };
  const zanjaPts = (c2 && c2.foco && c2.foco.zanja && ciudad) ? null : null;
  // zanja path: c2 may expose T100 or we read from ciudad emisor — passed later via attachZanja
  function addObra(w, geoms) {
    const lines = (geoms || w.geom || []).filter((g) => g && g.length >= 2);
    if (!lines.length) return;
    const grp = new THREE.Group();
    for (const g of lines) {
      const m = tubo(g, 10, 3.2, VERDE, .9);
      if (!m) continue;
      m.userData.obra = w;
      grp.add(m);
      pickables.push(m);
    }
    const c = mid(lines[0]);
    const L = lines.reduce((s, g) => s + largo(g), 0);
    fluyeG.add(grp);
    obras.push({ w, lines, c, L });
  }

  for (const w of data.obras || []) {
    if (w.usar_zanja_visor) continue;
    addObra(w, w.geom);
  }

  function attachZanja(pts) {
    const w = (data.obras || []).find((o) => o.usar_zanja_visor);
    if (!w || !pts || pts.length < 2) return;
    addObra(w, [pts]);
  }

  /* Dónde no perforar: solo geometría fuente (vía férrea OSM, emisor/zanja del visor, línea Agua Saludable). Sin gas ni fibra inventados. */
  const C = window.CIUDAD_OSM;
  function dec(f) {
    const o = []; let x = 0, z = 0;
    for (let i = 0; i < f.length; i += 2) { x = i ? x + f[i] : f[i]; z = i ? z + f[i + 1] : f[i + 1]; o.push([x, z]); }
    return o;
  }
  function banda(pts, radio, ficha) {
    const m = tubo(pts, 6, radio, ROJO, .38);
    if (!m) return;
    m.userData.attr = ficha;
    noPerfG.add(m);
    pickables.push(m);
  }
  const fichaRail = attrs("Dónde no perforar · vía férrea", {
    Estado: "existente (OSM)",
    "Cota y profundidad": PC,
    "Diámetro y material": "franja indicativa de 15 m; no es un derecho de vía oficial",
    "Norma aplicable": PC,
    "Fuente del dato": "OpenStreetMap, extracto Geofabrik México 12-nov-2026 (capa rail)",
    Identificador: "NOP-RAIL",
  }, { nota: "Solo se dibuja la vía con geometría OSM. No se inventan gasoductos ni ductos de fibra." });
  if (C?.rail) for (const r of C.rail) banda(dec(r), 15, fichaRail);

  const ASL = [[-9700, 7700], [-4170, 6960], [-5454, 5205], [-5553, 4164], [-5654, 3780]];
  banda(ASL, 18, attrs("Dónde no perforar · línea Agua Saludable", {
    Estado: "en operación / trazo de diseño preliminar en el visor",
    "Cota y profundidad": PC,
    "Diámetro y material": "franja indicativa de 18 m",
    "Norma aplicable": PC,
    "Fuente del dato": "Trazo ya cargado en el visor (El Siglo, 2024: baja del cerro El Huarache por el bulevar Villa de las Flores)",
    Identificador: "NOP-ASL",
  }));

  function attachEmisor(pts) {
    if (!pts || pts.length < 2) return;
    banda(pts, 18, attrs("Dónde no perforar · corredor del Emisor Central / San Ignacio", {
      Estado: "en obra (contrato CAED-IPE-082-26)",
      "Cota y profundidad": PC,
      "Diámetro y material": "franja indicativa de 18 m sobre el trazo de la 1.ª etapa",
      "Norma aplicable": PC,
      "Fuente del dato": "Geometría ya cargada en el visor (contrato CAED-IPE-082-26). Diseño preliminar, no es el proyecto ejecutivo.",
      Identificador: "NOP-EMISOR",
    }));
  }

  function nearestFluye(x, z, maxM = 1000) {
    let best = null;
    for (const o of obras) {
      for (const g of o.lines) {
        const r = distLinea([x, z], g);
        if (r.d <= maxM && (!best || r.d < best.d)) best = { d: r.d, q: r.q, w: o.w, L: o.L };
      }
    }
    return best;
  }

  function fichaObra(w) {
    const fuentes = (w.fuente || []).map((f) => `${f.titulo}: ${f.dato}`).join(" ");
    return fichaHTML(attrs(w.nombre, {
      Estado: w.estado,
      "Cota y profundidad": PC,
      "Diámetro y material": PC,
      "Norma aplicable": PC,
      "Fuente del dato": fuentes || PC,
      Identificador: w.id,
    }, { Calle: w.calle, "Geometría": w.geometria, Nota: w.nota, tag: NIVEL.ante }));
  }

  return { fluye: fluyeG, noperforar: noPerfG, pickables, obras, attachZanja, attachEmisor, nearestFluye, fichaObra, data };
}
