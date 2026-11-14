// Capas nuevas de la Propuesta Integral 2026 (se suman al visor; no cambian nada de lo existente).
// · Tecnología de la red: rejas de cribado, sensores de nivel, medidores de caudal, sensores de calidad y de H₂S,
//   centro de monitoreo y una SIMULACIÓN DEMOSTRATIVA de alerta por tapón.
// · Aliados que ganan: zonas industriales como beneficiarias y posibles aliadas (nunca como señaladas).
// · De lo aislado a lo colectivo: conexiones propuestas entre plantas propias, la red de nodos, el monitoreo y los ejidos.
// TODAS las posiciones son REFERENCIALES (no son levantamiento oficial). Equipos: precio «por cotizar».
import * as THREE from "three";
import { dec, enLinea } from "./ciudad.js";

export const TEC = {
  reja: { n: "Reja de cribado automática", c: "#f2c230", d: "Entrada de cada nodo y cárcamo: saca basura y sólidos" },
  nivel: { n: "Sensor de nivel (radar)", c: "#3fd46b", d: "Pozos de visita críticos de los colectores principales" },
  caudal: { n: "Medidor de caudal", c: "#4aa8ff", d: "Entrada y salida de cada subcuenca: la diferencia señala fuga u obstrucción" },
  calidad: { n: "Sensor de calidad (pH, conductividad, temperatura)", c: "#ff5fb4", d: "Salidas de los parques industriales al colector" },
  h2s: { n: "Sensor de H₂S (gas)", c: "#b8f24a", d: "Emisor y colectores largos: avisa del gas que corroe el concreto" },
  scada: { n: "Centro de monitoreo (SCADA + alertas)", c: "#f3d27a", d: "Tablero en tiempo real y aviso a la cuadrilla" },
};
const largo = (p) => { let L = 0; for (let i = 0; i < p.length - 1; i++) L += Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]); return L; };
const enF = (pts, f) => enLinea(pts, largo(pts) * f).p;

function matFlujo(uT, color, op = 1, vel = 120) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uT, uC: { value: new THREE.Color(color) }, uLen: { value: 100 }, uOp: { value: op }, uV: { value: vel } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uT; uniform vec3 uC; uniform float uLen; uniform float uOp; uniform float uV; varying vec2 vUv;
      void main(){ float s=vUv.x*uLen; float d=fract((s-uT*uV)/220.); float p=smoothstep(0.,.08,d)*(1.-smoothstep(.2,.45,d));
      gl_FragColor=vec4(uC*(.6+1.6*p),(.45+.55*p)*uOp); }`,
  });
}
function arco(uT, a, b, alto, r, color) {
  const A = new THREE.Vector3(a[0], 4, a[1]), B = new THREE.Vector3(b[0], 4, b[1]);
  const M = A.clone().lerp(B, .5); M.y = alto;
  const cur = new THREE.QuadraticBezierCurve3(A, M, B); const L = cur.getLength();
  const m = new THREE.Mesh(new THREE.TubeGeometry(cur, 64, r, 8, false), matFlujo(uT, color)); m.material.uniforms.uLen.value = L; m.renderOrder = 9; return m;
}

export function crearCapas2(scene, Cd, osm) {
  const R = osm.redes; const uT = Cd.uT;
  const raiz = new THREE.Group(); raiz.name = "capas2"; scene.add(raiz);
  const tec = new THREE.Group(), aliados = new THREE.Group(), colectivo = new THREE.Group(), sim = new THREE.Group(), zanja = new THREE.Group();
  [tec, aliados, colectivo, sim, zanja].forEach((g) => { g.visible = false; raiz.add(g); });
  const etiquetas = []; const ET = (t, p, cat, color, cerca) => etiquetas.push({ t, p, cat, color, cerca });
  const halos = []; // anillos que laten
  const mats = {}; const mat = (k) => (mats[k] ||= new THREE.MeshStandardMaterial({ color: TEC[k].c, emissive: TEC[k].c, emissiveIntensity: .7, roughness: .35, metalness: .2 }));
  const halo = (g, color, r) => { const m = new THREE.Mesh(new THREE.RingGeometry(r * .78, r, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .6, depthWrite: false, side: THREE.DoubleSide })); m.position.y = 2; m.renderOrder = 8; g.add(m); halos.push(m); return m; };
  const pon = (par, mesh, x = 0, y = 0, z = 0) => { mesh.position.set(x, y, z); par.add(mesh); return mesh; };
  const poste = (g, h, m) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, h, 8), m); p.position.y = h / 2; g.add(p); };

  function marcador(k, [x, z], etq, cerca = false) {
    const g = new THREE.Group(); g.position.set(x, 0, z); const m = mat(k); let h = 70;
    if (k === "reja") { h = 40; const fr = new THREE.Group(); fr.position.y = h;
      pon(fr, new THREE.Mesh(new THREE.BoxGeometry(46, 4, 4), m), 0, 18); pon(fr, new THREE.Mesh(new THREE.BoxGeometry(46, 4, 4), m), 0, -18);
      for (let i = -20; i <= 20; i += 6.6) pon(fr, new THREE.Mesh(new THREE.BoxGeometry(2.4, 36, 2.4), m), i); g.add(fr); }
    else if (k === "nivel") { const d = new THREE.Mesh(new THREE.CylinderGeometry(16, 10, 12, 20), m); d.position.y = h; g.add(d); const c = new THREE.Mesh(new THREE.ConeGeometry(7, 14, 16), m); c.position.y = h + 12; g.add(c); }
    else if (k === "caudal") { const t = new THREE.Mesh(new THREE.TorusGeometry(15, 4.5, 10, 28), m); t.position.y = h; g.add(t); pon(g, new THREE.Mesh(new THREE.SphereGeometry(5, 12, 10), m), 0, h); }
    else if (k === "calidad") { const o = new THREE.Mesh(new THREE.OctahedronGeometry(16), m); o.position.y = h; g.add(o); }
    else if (k === "h2s") { const t = new THREE.Mesh(new THREE.TetrahedronGeometry(17), m); t.position.y = h; t.rotation.set(.6, .3, 0); g.add(t); }
    else if (k === "scada") { h = 150; const b = new THREE.Mesh(new THREE.BoxGeometry(40, 26, 26), m); b.position.y = 13; g.add(b); const a = new THREE.Mesh(new THREE.SphereGeometry(11, 16, 12), m); a.position.y = h; g.add(a); }
    poste(g, h, m); halo(g, TEC[k].c, k === "scada" ? 90 : 55); tec.add(g);
    g.scale.setScalar(2.2);
    if (etq) ET(`${etq}<br><small>posición referencial · precio por cotizar</small>`, new THREE.Vector3(x, (h + 30) * 2.2, z), "tec", TEC[k].c, cerca);
    return g;
  }
  const colect = Object.entries(R.colectores).map(([id, c]) => ({ id, nombre: c.nombre, pts: dec(c.p) }));
  const emisor = Cd.emisor; const [ex, ez] = R.entrada;
  // Rejas: entrada del Nodo (cárcamo TK-101) y entrada de la PTAR existente (OSM) · referencial
  const ptar = osm.infra.find((i) => i.t === "ptar");
  marcador("reja", [ex - 40, ez - 60], "🧹 Reja de cribado · entrada del Nodo (cárcamo)", true);
  if (ptar) marcador("reja", [ptar.x + 120, ptar.z - 60], "🧹 Reja de cribado · entrada de PTAR");
  // Sensores de nivel en pozos de visita críticos (2 por colector) y medidores de caudal (entrada y salida de cada subcuenca)
  const nivelS = [];
  colect.forEach((c, i) => { for (const f of [.4, .72]) nivelS.push(marcador("nivel", enF(c.pts, f), i === 0 && f === .4 ? "📶 Sensor de nivel · pozo de visita crítico" : null));
    marcador("caudal", enF(c.pts, .06), null); marcador("caudal", enF(c.pts, .9), i === 1 ? "🌀 Medidor de caudal · salida de subcuenca" : null); });
  // Sensores de calidad en salidas industriales (inicio de líneas industriales del PIL) + Parque Carlos A. Herrera (aprox.)
  const indI = R.industrial.map(dec); const usados = [];
  for (const s of indI) { const p = s[0]; if (usados.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > 700)) usados.push(p); if (usados.length >= 4) break; }
  usados.forEach((p, i) => marcador("calidad", p, i === 0 ? "🧪 Sensor de calidad · salida industrial al colector" : null));
  const HERRERA = [-1066, 1155]; // ubicación aproximada (Nominatim/OSM, Periférico Ejército Mexicano, CP 35079)
  marcador("calidad", [HERRERA[0] + 160, HERRERA[1] - 120], null);
  // H₂S en el emisor
  [.25, .55, .85].forEach((f, i) => marcador("h2s", enF(emisor, f), i === 1 ? "☁️ Sensor de H₂S · emisor" : null));
  // Centro de monitoreo (referencial: tablero para SIDEAPA)
  const SCADA = [420, 380]; marcador("scada", SCADA, "🖥️ Centro de monitoreo SCADA · alertas a cuadrillas", true);

  /* ───── Aliados que ganan ───── */
  const VERDE = "#3fd46b";
  const mZ = new THREE.MeshBasicMaterial({ color: VERDE, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide });
  for (const p of osm.pil.map(dec)) { const s = new THREE.Shape(p.map(([x, z]) => new THREE.Vector2(x, -z))); const m = new THREE.Mesh(new THREE.ShapeGeometry(s), mZ); m.rotation.x = -Math.PI / 2; m.position.y = .6; m.renderOrder = 3; aliados.add(m);
    aliados.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(p.map(([x, z]) => new THREE.Vector3(x, 6, z))), new THREE.LineBasicMaterial({ color: VERDE }))); }
  { const c = new THREE.Mesh(new THREE.CircleGeometry(420, 48).rotateX(-Math.PI / 2), mZ); c.position.set(HERRERA[0], .7, HERRERA[1]); aliados.add(c);
    const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 64 }, (_, i) => new THREE.Vector3(HERRERA[0] + 420 * Math.cos(i / 64 * Math.PI * 2), 6, HERRERA[1] + 420 * Math.sin(i / 64 * Math.PI * 2)))), new THREE.LineDashedMaterial({ color: VERDE, dashSize: 30, gapSize: 18 })); l.computeLineDistances(); aliados.add(l); }
  const pilP = osm.pil.map(dec).sort((a, b) => b.length - a.length)[0];
  const PIL = pilP.reduce((s, [x, z]) => [s[0] + x / pilP.length, s[1] + z / pilP.length], [0, 0]);
  const ALIM = [-1500, -520]; // grupo de industria alimentaria (láctea y avícola): REFERENCIAL, no ubica ninguna planta en particular
  const faro = (p, color, h) => { const g = new THREE.Group(); g.position.set(p[0], 0, p[1]);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(34, 34, h, 6, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide })); col.position.y = h / 2; col.renderOrder = 8; g.add(col);
    const top = new THREE.Mesh(new THREE.OctahedronGeometry(30), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .8 })); top.position.y = h + 30; g.add(top); g.userData.top = top; halo(g, color, 120); return g; };
  const fPIL = faro(PIL, VERDE, 220), fHER = faro(HERRERA, VERDE, 180), fALI = faro(ALIM, "#7fe0c8", 150); aliados.add(fPIL, fHER, fALI);
  ET("🤝 Parque Industrial Lagunero<br><small>aliado que gana · agua tratada, menos pozo, menos riesgo de multa</small>", new THREE.Vector3(PIL[0], 300, PIL[1]), "aliados", VERDE);
  ET("🤝 Parque Industrial Carlos A. Herrera Araluce<br><small>aliado que gana · ubicación aproximada</small>", new THREE.Vector3(HERRERA[0], 250, HERRERA[1]), "aliados", VERDE);
  ET("🤝 Industria alimentaria, láctea y avícola<br><small>beneficiaria · marca REFERENCIAL, no ubica ninguna planta</small>", new THREE.Vector3(ALIM[0], 215, ALIM[1]), "aliados", "#7fe0c8");

  /* ───── De lo aislado a lo colectivo ───── */
  const NODO = [0, 0]; const riego = Cd.rutas.riego; const EJ = riego[riego.length - 1];
  for (const p of [PIL, HERRERA, ALIM]) {
    colectivo.add(arco(uT, p, NODO, 260, 9, "#ff8a3d"));            // agua pretratada → nodo
    colectivo.add(arco(uT, [NODO[0] + 40, NODO[1] + 40], p, 380, 7, "#a35bff")); // agua tratada de regreso
    colectivo.add(arco(uT, p, SCADA, 520, 3.5, "#2fd3e6"));         // monitoreo compartido
    const iso = new THREE.Mesh(new THREE.TorusGeometry(80, 6, 8, 40).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffb547, emissive: 0x553300 })); iso.position.set(p[0], 12, p[1]); colectivo.add(iso);
  }
  colectivo.add(arco(uT, NODO, EJ, 600, 11, "#a35bff"));
  ET("🔗 Planta propia: necesaria, no suficiente<br><small>se conecta a la red de nodos</small>", new THREE.Vector3(PIL[0] + 150, 140, PIL[1] + 150), "colectivo", "#ffb547");
  ET("💧 Agua tratada compartida con ejidos<br><small>conexión referencial · cumplir NOM-001 y permiso de Conagua</small>", new THREE.Vector3(EJ[0], 330, EJ[1]), "colectivo", "#a35bff");
  ET("📡 Monitoreo compartido<br><small>datos de calidad al tablero común</small>", new THREE.Vector3((SCADA[0] + PIL[0]) / 2, 470, (SCADA[1] + PIL[1]) / 2), "colectivo", "#2fd3e6");
  ET("🏦 Fondo de saneamiento<br><small>propuesta por verificar con Cabildo</small>", new THREE.Vector3(NODO[0] + 700, 200, NODO[1] - 700), "colectivo", "#f3d27a");

  /* ───── Hacerlo de una vez (zanja abierta del Emisor Central / colector San Ignacio) ─────
     Trazo REFERENCIAL: colector C-5 (Miguel de la Madrid) + emisor del visor. No es el proyecto ejecutivo de CAED/SIDEAPA. */
  const c5 = colect.find((c) => c.id === "C-5") || colect[0];
  const zt = [...c5.pts, ...emisor.slice(1)]; const LZ = largo(zt);
  { const pos = [], idx = []; let n = 0; const A = 70;
    for (let i = 0; i < zt.length - 1; i++) { const [x0, z0] = zt[i], [x1, z1] = zt[i + 1]; const l = Math.hypot(x1 - x0, z1 - z0); if (l < .1) continue;
      const nx = -(z1 - z0) / l * A / 2, nz = (x1 - x0) / l * A / 2; pos.push(x0 + nx, 1.2, z0 + nz, x0 - nx, 1.2, z0 - nz, x1 + nx, 1.2, z1 + nz, x1 - nx, 1.2, z1 - nz); idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); n += 4; }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffb547, transparent: true, opacity: .85, depthWrite: false, side: THREE.DoubleSide })); m.renderOrder = 6; zanja.add(m); }
  // ducto para fibra y cables de sensores (paralelo a la zanja)
  { const off = zt.map((p, i) => { const q = zt[Math.min(i + 1, zt.length - 1)], r0 = zt[Math.max(i - 1, 0)]; const dx = q[0] - r0[0], dz = q[1] - r0[1], l = Math.hypot(dx, dz) || 1; return [p[0] - dz / l * 24, p[1] + dx / l * 24]; });
    const path = new THREE.CurvePath(); let L = 0; for (let i = 0; i < off.length - 1; i++) { const a = new THREE.Vector3(off[i][0], 8, off[i][1]), b = new THREE.Vector3(off[i + 1][0], 8, off[i + 1][1]); if (a.distanceToSquared(b) < .01) continue; path.add(new THREE.LineCurve3(a, b)); L += a.distanceTo(b); }
    const m = new THREE.Mesh(new THREE.TubeGeometry(path, 300, 5, 6, false), matFlujo(uT, "#2fd3e6", 1, 260)); m.material.uniforms.uLen.value = L; m.renderOrder = 9; zanja.add(m); }
  const ZC = { pozo: "#d9dde0", h2s: TEC.h2s.c, nivel: TEC.nivel.c, caudal: TEC.caudal.c, grasa: "#ff8a3d" };
  const zm = (k) => new THREE.MeshStandardMaterial({ color: ZC[k], emissive: ZC[k], emissiveIntensity: .55, roughness: .4 });
  const zMat = Object.fromEntries(Object.keys(ZC).map((k) => [k, zm(k)]));
  let kz = 0;
  for (let d = 150; d < LZ - 100; d += 420, kz++) { const [x, z] = enLinea(zt, d).p; const g = new THREE.Group(); g.position.set(x, 0, z);
    pon(g, new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 18, 20), zMat.pozo), 0, 9); // pozo de visita amplio (CCTV robot)
    if (kz % 2 === 0) { pon(g, new THREE.Mesh(new THREE.TetrahedronGeometry(16), zMat.h2s), 0, 52); pon(g, new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 40, 6), zMat.h2s), 0, 30); }
    else { pon(g, new THREE.Mesh(new THREE.CylinderGeometry(15, 9, 10, 16), zMat.nivel), 0, 52); pon(g, new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 40, 6), zMat.nivel), 0, 30); }
    g.scale.setScalar(1.8); zanja.add(g); }
  for (const f of [.03, .97]) { const [x, z] = enLinea(zt, LZ * f).p; const g = new THREE.Group(); g.position.set(x, 0, z);
    pon(g, new THREE.Mesh(new THREE.TorusGeometry(20, 6, 10, 28), zMat.caudal), 0, 60); pon(g, new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 60, 6), zMat.caudal), 0, 30); g.scale.setScalar(1.8); zanja.add(g); }
  // puntos de control de grasas y sólidos aguas arriba (inicio de subcolectores que llegan a la zona)
  const grasas = []; for (const s0 of osm.redes.subs.map(dec)) { const p0 = s0[0]; const dmin = Math.min(...zt.map((q) => Math.hypot(q[0] - p0[0], q[1] - p0[1])));
    if (dmin > 250 && dmin < 1400 && grasas.every((q) => Math.hypot(q[0] - p0[0], q[1] - p0[1]) > 600)) grasas.push(p0); if (grasas.length >= 6) break; }
  for (const [x, z] of grasas) { const g = new THREE.Group(); g.position.set(x, 0, z); pon(g, new THREE.Mesh(new THREE.BoxGeometry(30, 22, 30), zMat.grasa), 0, 11); pon(g, new THREE.Mesh(new THREE.ConeGeometry(12, 20, 4), zMat.grasa), 0, 34); g.scale.setScalar(1.8); zanja.add(g); }
  const zEt = (t, f, y, c) => { const [x, z] = enLinea(zt, LZ * f).p; ET(t, new THREE.Vector3(x, y, z), "zanja", c); };
  zEt("🚧 Zanja abierta · Emisor Central y colector San Ignacio<br><small>trazo REFERENCIAL del visor, no es el proyecto de CAED/SIDEAPA</small>", .5, 230, "#ffb547");
  zEt("🔌 Ducto para fibra óptica y cables de sensores<br><small>por cotizar</small>", .3, 150, "#2fd3e6");
  zEt("🕳️ Pozos de visita amplios para robot CCTV<br><small>con sensores de H₂S y de nivel · por cotizar</small>", .72, 190, "#d9dde0");
  zEt("🌀 Medidor de caudal<br><small>entrada y salida del tramo · por cotizar</small>", .97, 170, TEC.caudal.c);
  if (grasas.length) ET("🧴 Control de grasas y sólidos aguas arriba<br><small>trampas y cribado en origen · por cotizar</small>", new THREE.Vector3(grasas[0][0], 120, grasas[0][1]), "zanja", "#ff8a3d");

  /* ───── Simulación demostrativa de alerta (colector C-2) ───── */
  const c2 = colect.find((c) => c.id === "C-2") || colect[0]; const L2 = largo(c2.pts);
  const pS = enLinea(c2.pts, L2 * .55).p, pT = enLinea(c2.pts, L2 * .62).p, pQ = enLinea(c2.pts, L2 * .75).p;
  const ruta = []; { const d0 = L2 * .62; let d = L2; while (d > d0) { ruta.push(enLinea(c2.pts, d).p); d -= 25; } ruta.push(pT); }
  const Lr = largo(ruta);
  const mAgua = new THREE.MeshStandardMaterial({ color: 0x3c8cff, emissive: 0x0a2a55, transparent: true, opacity: .85 });
  const col = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 1, 20), mAgua); col.position.set(pS[0], 0, pS[1]); sim.add(col);
  const tapon = new THREE.Mesh(new THREE.DodecahedronGeometry(26), new THREE.MeshStandardMaterial({ color: 0x6b4a2a, emissive: 0x2a1405 })); tapon.position.set(pT[0], 26, pT[1]); sim.add(tapon);
  const alerta = new THREE.Mesh(new THREE.RingGeometry(60, 80, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff4d3d, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide })); alerta.position.set(pS[0], 3, pS[1]); sim.add(alerta);
  const camion = new THREE.Group(); pon(camion, new THREE.Mesh(new THREE.BoxGeometry(46, 22, 22), new THREE.MeshStandardMaterial({ color: 0xff8a1a, emissive: 0x552200 })), 0, 14);
  const luz = new THREE.Mesh(new THREE.SphereGeometry(7, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff3020 })); luz.position.y = 32; camion.add(luz); sim.add(camion);
  const etS = { t: "", p: new THREE.Vector3(pS[0], 170, pS[1]), cat: "sim", color: "#ff4d3d" }; etiquetas.push(etS);
  const etT = { t: "Tapón (ejemplo)<br><small>simulación demostrativa</small>", p: new THREE.Vector3(pT[0], 90, pT[1]), cat: "sim", color: "#c08a4a" }; etiquetas.push(etT);
  const etC = { t: "🚚 Cuadrilla de desazolve", p: new THREE.Vector3(), cat: "sim", color: "#ff8a1a" }; etiquetas.push(etC);
  const etQ = { t: "", p: new THREE.Vector3(pQ[0], 130, pQ[1]), cat: "sim", color: "#4aa8ff" }; etiquetas.push(etQ);
  const SIM_T = 18; let t = 0;
  const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
  function paso(dt) {
    t = (t + dt) % SIM_T;
    let nivel, caudal, fase, k;
    if (t < 4) { k = t / 4; nivel = lerp(30, 88, k); caudal = 100; fase = "1 · Sube el nivel en el pozo de visita sin que llueva"; }
    else if (t < 6.5) { nivel = 88; caudal = lerp(100, 35, (t - 4) / 2.5); fase = "2 · El sistema compara con el caudal aguas abajo: baja"; }
    else if (t < 8.5) { nivel = 90; caudal = 35; fase = "3 · Tapón detectado: alerta a la cuadrilla con la ubicación"; }
    else if (t < 14) { nivel = 90; caudal = 35; fase = "4 · La cuadrilla va en camino"; }
    else { k = (t - 14) / 3; nivel = lerp(90, 30, k); caudal = lerp(35, 100, k); fase = t < 17 ? "5 · Desazolve antes de que brote agua negra en la calle" : "✔ Resuelto · queda en la bitácora digital"; }
    const hN = nivel * 1.6; col.scale.y = hN; col.position.y = hN / 2; mAgua.color.setHex(nivel > 70 ? 0x8a6a45 : 0x3c8cff);
    tapon.visible = t < 15.5; alerta.visible = t >= 6.5 && t < 14; alerta.material.opacity = .45 + .45 * Math.sin(t * 9);
    const u = t < 8.5 ? 0 : t < 14 ? (t - 8.5) / 5.5 : 1; const q = enLinea(ruta, Lr * u).p; camion.position.set(q[0], 0, q[1]); camion.visible = t >= 8.5; luz.visible = Math.sin(t * 14) > 0;
    etC.p.set(q[0], 70, q[1]); etC.oculta = t < 8.5; etT.oculta = !tapon.visible;
    etS.t = `📶 Sensor de nivel · ${Math.round(nivel)} %<br><small>SIMULACIÓN DEMOSTRATIVA</small>`; etS.color = nivel > 70 ? "#ff4d3d" : "#3fd46b";
    etQ.t = `🌀 Caudal aguas abajo · ${Math.round(caudal)} %<br><small>SIMULACIÓN DEMOSTRATIVA</small>`;
    return { t, nivel, caudal, fase, alerta: t >= 6.5 && t < 14 };
  }
  function iniciarSim() { t = 0; sim.visible = true; }
  function pararSim() { sim.visible = false; }
  function tick(dt, tt) { const k = .35 + .3 * Math.sin(tt * 3); for (const h of halos) h.material.opacity = k; for (const f of [fPIL, fHER, fALI]) f.userData.top.rotation.y += dt; }
  return { raiz, tec, aliados, colectivo, zanja, sim, etiquetas, paso, iniciarSim, pararSim, tick, foco: { zanja: enLinea(zt, LZ * .5).p, sim: pS, pil: PIL, herrera: HERRERA, scada: SCADA } };
}
