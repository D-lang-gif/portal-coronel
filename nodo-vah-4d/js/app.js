// Nodo VAH 4D · Portal del Coronel
// Datos: data/sitio.js (modelo único de los planos PL-01…PL-06), data/presupuesto4d.js (agregados del presupuesto del 25-oct-2026)
// y data/ciudad_osm.js (ciudad real de OpenStreetMap; todas las redes de agua con trazo referencial).
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { W } from "./visor/util.js";
import { crearMateriales, M } from "./visor/materiales.js";
import { construir } from "./visor/constructores.js";
import { crearFlujos, uTiempo } from "./visor/flujos.js";
import { crearCiudad, REDES } from "./ciudad.js";

const $ = (s, r = document) => r.querySelector(s);
const D = window.NODO_DATA, PR = window.NODO_PRES;
const mdp = (v, d = 1) => (v / 1e6).toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d });
const pesos = (v) => "$" + Math.round(v).toLocaleString("es-MX");
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (t) => t * t * (3 - 2 * t);

/* ───────── Candado (mismo hash PBKDF2 del portal; no se guarda la contraseña) ───────── */
const GATE = { SALT: "f5683dd503d323855db92b852f5f1ff4", HASH: "7e5a33ce72990d7df64c18c5b9bf4dbfd945eb8111148b2deb4240f967688cf8", ITER: 120000, KEY: "portal_coronel_ok_v1", REC: "coronel_nodo4d_recordar_v1" };
async function hashPw(pw) {
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const salt = new Uint8Array(GATE.SALT.match(/.{2}/g).map((b) => parseInt(b, 16)));
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: GATE.ITER, hash: "SHA-256" }, km, 256);
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
let abierto = false;
function abrir() { sessionStorage.setItem(GATE.KEY, "1"); $("#gate").hidden = true; $("#app").hidden = false; if (!abierto) { abierto = true; iniciar(); } }
function candado() {
  if (sessionStorage.getItem(GATE.KEY) === "1" || localStorage.getItem(GATE.REC) === "1") return abrir();
  $("#gate-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#gate-err"); err.textContent = "Verificando…";
    try {
      if ((await hashPw($("#gate-pw").value)) === GATE.HASH) {
        if ($("#gate-recordar").checked) localStorage.setItem(GATE.REC, "1");
        err.textContent = ""; abrir();
      } else err.textContent = "Contraseña incorrecta.";
    } catch (_) { err.textContent = "Este navegador no puede verificar (falta WebCrypto / https)."; }
  });
}
$("#btn-salir").addEventListener("click", () => { sessionStorage.removeItem(GATE.KEY); localStorage.removeItem(GATE.REC); location.reload(); });

/* ───────── Cronograma (Documento Maestro §11) ───────── */
// Fases 0–3 = renglones 1–4 del cronograma T1–T8 (semestres); mapeo de fases según S-12 del proyecto.
// La Fase 4 (expansión) no tiene fecha ni presupuesto: se muestra después del mes 24 como reserva.
const VENT = { 0: [0, 6], 1: [6, 12], 2: [12, 18], 3: [18, 24], 4: [24, 27] };
const CRONO = ["Estudios y permisos", "Obra civil SIBRA", "Equipamiento eléctrico", "Pruebas y ramp-up", "Expansión futura"];
const MAXM = 27;
const FASE = Object.fromEntries(D.fases.map((f) => [f.n, f]));
const faseDeMes = (m) => (m <= 0 ? -1 : m <= 6 ? 0 : m <= 12 ? 1 : m <= 18 ? 2 : m <= 24 ? 3 : 4);
const COSTO_F = [0, 1, 2, 3].map((n) => PR.fases[String(n)] || 0);
const progFase = (n, m) => { const [a, b] = VENT[n]; return clamp((m - a) / (b - a)); };
const finAcum = (m) => COSTO_F.reduce((s, c, n) => s + c * progFase(n, m), 0);

/* ───────── Tablero (pantallas) ───────── */
function kpis() {
  const k = D.kpi;
  const items = [
    ["Presupuesto plan maestro", "$" + mdp(PR.subtotal) + " MDP", "sin IVA · con IVA $" + mdp(PR.total) + " MDP", "oro"],
    ["Alcance del documento", "$" + mdp(PR.doc_scope.subtotal) + " MDP", "sin IVA · CAPEX ref. doc §6: 70 (55–85)", "oro"],
    ["Duración (cronograma §11)", "24 meses", "T1–T8 · doc: 18 a 24 meses"],
    ["Caudal de diseño", k["Caudal de diseño"], "Volumen " + k["Volumen tratado"]],
    ["Energía", k["FV"], k["BESS"] + " · " + k["Subestación"]],
    ["Predio (coordenadas)", "200 × 200 m", "40,000 m² · doc dice 20,000 m² (S-01)"],
    ["Instalaciones modeladas", String(D.instalaciones.length), D.instalaciones.filter((f) => f.fuente === "doc").length + " del documento · " + D.instalaciones.filter((f) => f.fuente !== "doc").length + " supuestas"],
    ["Empleos (doc)", k["Empleos"], "Leche " + k["Leche"]],
  ];
  $("#kpis").innerHTML = items.map(([t, v, i, c]) => `<div class="kpi ${c || ""}"><small>${t}</small><b>${v}</b><i>${i}</i></div>`).join("");
}
function partidas() {
  const ent = Object.entries(PR.partidas);
  const maxv = Math.max(...ent.map(([, v]) => Math.max(v.importe, v.doc[1] * 1e6)));
  $("#partidas").innerHTML = ent.map(([k, v]) => {
    const [mn, mx, rf] = v.doc; const ds = PR.doc_scope_partidas[k] || 0;
    return `<div class="pb"><div class="pn">${k}</div><div class="pt">
      <span class="rg" style="left:${mn * 1e6 / maxv * 100}%;width:${(mx - mn) * 1e6 / maxv * 100}%"></span>
      <span class="bv" style="left:0;width:${v.importe / maxv * 100}%"></span><span class="bv d" style="left:0;width:${ds / maxv * 100}%"></span></div>
      <div class="pv"><b>${mdp(v.importe, 2)}</b> completo · <b>${mdp(ds, 2)}</b> alcance doc · rango doc ${mn}–${mx} (ref. ${rf})</div></div>`;
  }).join("");
}
function porFase() {
  const filas = [0, 1, 2, 3].map((n) => `<tr><td><span style="color:${FASE[n].color}">■</span> ${FASE[n].nombre.replace(/^Fase \d · /, "F" + n + " · ")}<br><small class="muted">${FASE[n].periodo}</small></td><td>${mdp(COSTO_F[n], 2)}</td><td>${(COSTO_F[n] / PR.subtotal * 100).toFixed(1)}%</td></tr>`).join("");
  $("#porfase").innerHTML = `<table class="tz"><tr><th>Fase</th><th>MDP</th><th>%</th></tr>${filas}<tr><td><span style="color:${FASE[4].color}">■</span> F4 · Expansión futura</td><td>—</td><td>sin presupuesto</td></tr><tr><td><b>Total sin IVA</b></td><td><b>${mdp(PR.subtotal, 2)}</b></td><td>100%</td></tr></table>`;
  const ZN = { "BLQ-A": "Bloque A · SIBRA", "BLQ-B": "Bloque B · Energía", "BLQ-C": "Bloque C · Lácteos", "BLQ-D": "Bloque D · Admin + IA", PATIO: "Patio y acceso", NORTE: "Franja Norte (sup.)", "ZONA-E": "Zona E · Pulimento/recarga", Redes: "Redes", Vialidades: "Vialidades", Predio: "Predio / urbanización", "Instr.": "Instrumentación", Global: "Ingeniería, permisos, contingencias" };
  const z = Object.entries(PR.zonas).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${ZN[k] || k}</td><td>${mdp(v, 2)}</td><td>${(v / PR.subtotal * 100).toFixed(1)}%</td></tr>`).join("");
  $("#zonas").innerHTML = `<table class="tz"><tr><th>Zona</th><th>MDP</th><th>%</th></tr>${z}</table>`;
}
function planos() {
  const P = [["PL-01", "Conjunto general 1:500"], ["PL-02", "Fases de desarrollo"], ["PL-03", "Hidráulica SIBRA + DFP/DTI"], ["PL-04", "Eléctrica + unifilar"], ["PL-05", "Vialidades + sección"], ["PL-06", "Secciones tipo"]];
  const u = "https://d-lang-gif.github.io/nodo-vah/planos.html";
  $("#planos").innerHTML = P.map(([c, n]) => `<li><a href="${u}" target="_blank" rel="noopener"><b>${c}</b>${n}</a></li>`).join("") +
    `<li><a href="https://d-lang-gif.github.io/nodo-vah/memoria.html" target="_blank" rel="noopener"><b>MT</b>Memoria técnica MT-NVAH-01</a></li>
     <li><a href="https://d-lang-gif.github.io/nodo-vah/" target="_blank" rel="noopener"><b>3D</b>Visor completo (CAD, primera persona, XLSX)</a></li>
     <li class="tiny muted" style="padding:4px 2px">Los planos (PDF/DXF) se abren en el sitio protegido Nodo VAH, que pide su propia contraseña.</li>`;
  const ct = PR.conteo_tipos;
  $("#calidad").innerHTML = `<table class="tz">${Object.entries(ct).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}<tr><td>Cotización directa de proveedor</td><td>0</td></tr><tr><td><b>Líneas de presupuesto</b></td><td><b>${PR.n_lineas}</b></td></tr></table>
   <p class="nota tiny">Precios web consultados el ${PR.fecha}. TC USD ${PR.tc.USD} (FIX DOF). Las líneas paramétricas y «sin precio verificado» requieren cotización formal; las 12 solicitudes de cotización (RFQ) están listas y no se han enviado.</p>`;
  $("#supuestos").innerHTML = D.supuestos.map((s) => `<li>${s}</li>`).join("");
}
function gantt() {
  const g = $("#gantt"); let h = "";
  for (let n = 0; n <= 4; n++) { const [a, b] = VENT[n];
    h += `<div class="fila"><div class="bar ${n === 4 ? "ref" : ""}" style="left:${a / MAXM * 100}%;width:${(b - a) / MAXM * 100}%;background:${FASE[n].color}">${n < 4 ? (n + 1) + ". " + CRONO[n] : "F4 · sin fecha"}</div></div>`; }
  g.innerHTML = h + `<div class="cursor" id="g-cursor"></div>`;
  $("#escala").innerHTML = [0, 6, 12, 18, 24].map((m) => `<span style="left:${m / MAXM * 100}%">${m === 0 ? "mes 0" : m}</span>`).join("") + `<span style="left:${25.5 / MAXM * 100}%">+</span>`;
  notaCrono();
  $("#nota-curva").textContent = "El costo de cada fase (presupuesto del 25-oct-2026) se reparte de forma lineal dentro de su semestre del cronograma. Ese reparto lineal es un supuesto de este tablero.";
}
function ganttForma(on) {
  if (!on) return gantt();
  const C = S.ciudad; const col = { colonia: "#3fd46b", avenida: "#4aa8ff", sinzanja: "#ffb547" };
  $("#gantt").innerHTML = `<div class="fila" style="height:22px">${C.tramos.map((t) => `<div class="bar" title="T-${t.i + 1}" style="left:${t.i / C.N * 100}%;width:${100 / C.N}%;background:${col[t.tipo]};border:1px solid #0b0b10;line-height:22px">${t.i + 1}</div>`).join("")}</div><div class="cursor" id="g-cursor"></div>`;
  $("#escala").innerHTML = `<span style="left:0%">jornada 1</span><span style="left:50%">${Math.round(C.N / 2)}</span><span style="left:96%">${C.N}</span>`;
}
function notaCrono() {
  $("#nota-crono").innerHTML = S?.modo === "forma"
    ? "En este modo la barra marca <b>jornadas de obra</b> sobre el colector C-1 en tramos de 150 m, de aguas abajo hacia aguas arriba. La ruta, los tramos nocturnos y los cruces son <b>referenciales</b>: el Plan Integral de Drenaje está pendiente de cargar y aún no hay cronograma de esa obra."
    : "Las ventanas de cada fase vienen del <b>cronograma real del Documento Maestro §11</b> (T1–T8, 24 meses). El orden en que aparece cada instalación dentro de su semestre es una <b>secuencia propuesta (referencial)</b> que sigue el flujo del agua del plano PL-03. La Fase 4 no tiene fecha en el documento.";
}
function gauge(cv, frac, color) {
  const c = cv.getContext("2d"), w = cv.width, h = cv.height; c.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h - 12, r = Math.min(w / 2 - 10, h - 20);
  c.lineWidth = 12; c.lineCap = "round";
  c.strokeStyle = "#23242d"; c.beginPath(); c.arc(cx, cy, r, Math.PI, 2 * Math.PI); c.stroke();
  c.strokeStyle = color; c.shadowColor = color; c.shadowBlur = 10; c.beginPath(); c.arc(cx, cy, r, Math.PI, Math.PI + Math.PI * clamp(frac)); c.stroke(); c.shadowBlur = 0;
}
function curva(m) {
  const cv = $("#curva"), c = cv.getContext("2d"), w = cv.width, h = cv.height; c.clearRect(0, 0, w, h);
  const L = 42, R = 12, T = 12, B = 26, X = (x) => L + x / 24 * (w - L - R), Y = (v) => h - B - v / PR.subtotal * (h - T - B);
  c.font = "11px ui-monospace,monospace"; c.fillStyle = "#9a937f"; c.strokeStyle = "#23242d"; c.lineWidth = 1;
  for (let v = 0; v <= 160e6; v += 40e6) { c.beginPath(); c.moveTo(L, Y(v)); c.lineTo(w - R, Y(v)); c.stroke(); c.fillText(String(v / 1e6), 6, Y(v) + 4); }
  for (let x = 0; x <= 24; x += 6) { c.beginPath(); c.moveTo(X(x), T); c.lineTo(X(x), h - B); c.stroke(); c.fillText("m" + x, X(x) - 8, h - 8); }
  for (let n = 0; n < 4; n++) { const [a, b] = VENT[n]; c.fillStyle = FASE[n].color + "22"; c.fillRect(X(a), T, X(b) - X(a), h - T - B); }
  c.strokeStyle = "#4a4b57"; c.setLineDash([4, 4]); c.beginPath(); for (let x = 0; x <= 24; x += .25) { const v = finAcum(x); x ? c.lineTo(X(x), Y(v)) : c.moveTo(X(x), Y(v)); } c.stroke(); c.setLineDash([]);
  const mm = Math.min(m, 24);
  c.strokeStyle = "#f3d27a"; c.lineWidth = 2.5; c.shadowColor = "#d4a63a"; c.shadowBlur = 8; c.beginPath();
  for (let x = 0; x <= mm + 1e-6; x += .25) { const v = finAcum(x); x ? c.lineTo(X(x), Y(v)) : c.moveTo(X(x), Y(v)); } c.stroke(); c.shadowBlur = 0;
  c.fillStyle = "#f3d27a"; c.beginPath(); c.arc(X(mm), Y(finAcum(mm)), 4, 0, 7); c.fill();
}
function tablero(m) {
  const fin = finAcum(m), frac = fin / PR.subtotal;
  gauge($("#g-fis"), frac, "#3fd46b"); gauge($("#g-fin"), frac, "#d4a63a");
  $("#g-fis-v").textContent = (frac * 100).toFixed(1) + "%"; $("#g-fin-v").textContent = "$" + mdp(fin) + " M";
  $("#av-mes").textContent = "Nodo VAH · mes " + Math.min(m, 24).toFixed(1) + " de 24";
  $("#fases-av").innerHTML = [0, 1, 2, 3].map((n) => { const p = progFase(n, m);
    return `<div class="fav"><span>F${n} · ${CRONO[n]}</span><div class="t"><i style="width:${p * 100}%;background:${FASE[n].color}"></i></div><span class="v">${Math.round(p * 100)}%</span></div>`; }).join("") +
    `<div class="fav"><span>F4 · Expansión</span><div class="t"><i style="width:${m > 24 ? 100 : 0}%;background:${FASE[4].color}"></i></div><span class="v">${m > 24 ? "ref." : "—"}</span></div>`;
  curva(m);
}

/* ───────── 3D ───────── */
let S = null;
function iniciar() {
  kpis(); partidas(); porFase(); planos(); gantt();
  try { escena(); } catch (e) { $("#cargando").textContent = "No se pudo iniciar el 3D en este navegador (WebGL)."; console.error(e); }
  ponerMes(0);
}

function escena() {
  const cont = $("#lienzo");
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .9; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  cont.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); const FONDO = new THREE.Color(0x0c1018), NOCHE = new THREE.Color(0x03050a);
  scene.background = FONDO.clone(); scene.fog = new THREE.Fog(0x0c1018, 900, 9000);
  const camera = new THREE.PerspectiveCamera(45, 1, .5, 30000);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.maxPolarAngle = Math.PI * .49; controls.minDistance = 8; controls.maxDistance = 12000;
  const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  const hemi = new THREE.HemisphereLight(0xbcd8ff, 0x3b3226, .6); scene.add(hemi);
  const sol = new THREE.DirectionalLight(0xffe9cc, 2.8); sol.position.set(-180, 200, 140); sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -150, right: 150, top: 150, bottom: -150, near: 10, far: 700 }); sol.shadow.bias = -.0005; sol.shadow.normalBias = .4; scene.add(sol);
  crearMateriales();

  // Plataforma del predio (sobre el mapa de la ciudad)
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), M.desierto); pad.rotation.x = -Math.PI / 2; pad.position.y = .02; pad.receiveShadow = true; scene.add(pad);
  const rej = new THREE.GridHelper(240, 24, 0x2b3a4a, 0x1b2430); rej.position.y = .05; rej.material.transparent = true; rej.material.opacity = .4; scene.add(rej);
  const v = D.predio.vertices.map(([, x, y]) => W(x, y, .25)); v.push(v[0].clone());
  const lind = new THREE.Line(new THREE.BufferGeometry().setFromPoints(v), new THREE.LineDashedMaterial({ color: 0xf3d27a, dashSize: 4, gapSize: 2 })); lind.computeLineDistances(); scene.add(lind);

  const items = [], pick = [];
  const add = (obj, ini, fin, fase, tipo, f) => { scene.add(obj); items.push({ obj, ini, fin, fase, tipo, f }); };
  const [a0, b0] = VENT[0];
  D.bloques.forEach((b, i) => {
    const w = b.x1 - b.x0, d = b.y1 - b.y0; const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, .5, d), M.terraplen); m.position.y = .25; m.receiveShadow = true; g.add(m);
    const borde = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, .5, d)), new THREE.LineBasicMaterial({ color: new THREE.Color(b.color) })); borde.position.y = .26; g.add(borde);
    g.position.copy(W((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2));
    const fase = b.id === "ZONA-F" ? 4 : 0; const ini = fase === 4 ? 24.2 : a0 + 2 + i * .3;
    add(g, ini, fase === 4 ? 25 : ini + 1.4, fase, "pad", b);
  });
  D.vias.forEach((r, i) => {
    const w = r.x1 - r.x0, d = r.y1 - r.y0; const m = new THREE.Mesh(new THREE.BoxGeometry(w, .3, d), M.asfalto); m.receiveShadow = true;
    m.position.copy(W((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, .32)); const ini = a0 + 3.5 + i * .3; add(m, ini, ini + 1.2, 0, "via", r);
  });
  { // cerca perimetral (doc: fase 0 «cerca y accesos»)
    const g = new THREE.Group(); const pts = D.predio.vertices.map(([, x, y]) => [x, y]); pts.push(pts[0]);
    for (let k = 0; k < 4; k++) { const [x0, y0] = pts[k], [x1, y1] = pts[k + 1]; const L = Math.hypot(x1 - x0, y1 - y0);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(L, 2.2), M.malla); m.position.copy(W((x0 + x1) / 2, (y0 + y1) / 2, 1.1)); m.rotation.y = -Math.atan2(y1 - y0, x1 - x0); g.add(m);
      for (let s = 0; s <= L; s += 6) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 2.4, 6), M.cerca); p.position.copy(W(x0 + (x1 - x0) * s / L, y0 + (y1 - y0) * s / L, 1.2)); g.add(p); } }
    add(g, a0 + 4.2, b0, 0, "cerca", null);
  }
  const porF = {}; D.instalaciones.forEach((f) => (porF[f.fase] ||= []).push(f));
  const fac = {};
  for (const [nf, lista] of Object.entries(porF)) {
    const n = +nf, [a, b] = VENT[n]; const span = b - a; const dur = n === 4 ? 1 : Math.max(1.2, span * .35);
    lista.forEach((f, i) => {
      const ini = n === 0 ? a + 4.6 + i * .4 : n === 4 ? 24.5 + i * .5 : a + (span - dur) * (lista.length > 1 ? i / (lista.length - 1) : 0);
      const g = construir(f); fac[f.id] = g; g.traverse((m) => { if (m.isMesh || m.isInstancedMesh) pick.push(m); });
      add(g, ini, Math.min(n === 4 ? MAXM : b, ini + dur), n, "inst", f);
    });
  }
  const matF = new THREE.LineBasicMaterial({ color: 0x4aa8ff, transparent: true, opacity: .28 });
  const matA = new THREE.LineBasicMaterial({ color: 0xffb547 });
  for (const it of items) {
    const box = new THREE.Box3().setFromObject(it.obj); const sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    if (sz.y < .05) sz.y = .3;
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(sz.x, sz.y, sz.z));
    it.fan = new THREE.LineSegments(geo, matF); it.fan.position.copy(c); scene.add(it.fan);
    it.and = new THREE.LineSegments(geo, matA); it.and.position.copy(c); scene.add(it.and);
  }
  const flujos = crearFlujos(scene, D);
  const etq = []; const cE = $("#etq");
  const etiqueta = (txt, p, modo, color) => { const e = document.createElement("div"); e.className = "e"; e.style.setProperty("--c", color); e.innerHTML = txt; cE.appendChild(e); etq.push({ e, p, modo }); };
  for (const b of D.bloques) etiqueta(b.nombre.replace(" (supuesto)", ""), W((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, 10), "sitio", b.color);

  S = { renderer, scene, camera, controls, items, fac, flujos, pick, etq, etiqueta, fantasma: true, modo: "obra", mes: 0, jor: 0, play: false, vel: 1, enfoque: null, hemi, sol, FONDO, NOCHE, ciudad: null, pad, rej, lind };
  vista("aerea", true);
  const ajustar = () => { const r = cont.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); };
  new ResizeObserver(ajustar).observe(cont); ajustar();
  $("#cargando").remove();
  cargarCiudad();

  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
  renderer.domElement.addEventListener("pointerdown", (e) => (down = [e.clientX, e.clientY]));
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect(); ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ptr, camera); const hit = ray.intersectObjects(pick.filter((m) => { let o = m; while (o) { if (!o.visible) return false; o = o.parent; } return true; }), false)[0];
    if (hit) ficha(hit.object.userData.fid); else $("#ficha").hidden = true;
  });

  const reloj = new THREE.Clock();
  const ciclo = () => {
    const dt = Math.min(reloj.getDelta(), .1); uTiempo.value += dt; if (S.ciudad) S.ciudad.uT.value += dt;
    if (S.play) avanzar(dt);
    for (const id in fac) { const g = fac[id].userData.giro; if (g && fac[id].visible) g.rotation.y += dt * .15; }
    if (S.enfoque) { const k = 1 - Math.exp(-dt * 3.2); camera.position.lerp(S.enfoque.pos, k); controls.target.lerp(S.enfoque.tgt, Math.min(1, k * 1.3)); if (camera.position.distanceTo(S.enfoque.pos) < 1) S.enfoque = null; }
    if (S.orient) aplicarOrientacion();
    if (S.modo === "recorrido") animTour(dt);
    if (S.pulso) { const k = .5 + .5 * Math.sin(uTiempo.value * 5); for (const m of S.pulso) m.material.emissive?.setRGB(.35 * k, .25 * k, .05 * k); }
    const dist = camera.position.distanceTo(controls.target); const nr = Math.max(.5, dist / 1500); if (Math.abs(nr - camera.near) / camera.near > .2) { camera.near = nr; camera.updateProjectionMatrix(); }
    controls.update(); renderer.render(scene, camera); etiquetas();
  };
  renderer.setAnimationLoop(ciclo); S.pausar = (on) => renderer.setAnimationLoop(on ? null : ciclo);
}
function avanzar(dt) {
  if (S.modo === "forma") { const N = S.ciudad.N; let j = S.jor + dt * .12 * S.vel; if (j >= N) { j = N; parar(); } ponerJornada(j); return; }
  let m = S.mes + dt * .8 * S.vel; if (m >= MAXM) { m = MAXM; parar(); } ponerMes(m, true);
}
function parar() { S.play = false; $("#btn-play").textContent = "▶"; }

async function cargarCiudad() {
  try {
    if (!window.CIUDAD_OSM) await new Promise((ok, no) => { const s = document.createElement("script"); s.src = "data/ciudad_osm.js"; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
    const pozos = D.instalaciones.filter((f) => /^PI-803/.test(f.id)).map((f) => [f.cx - 100, 100 - f.cy]);
    const C = crearCiudad(S.scene, window.CIUDAD_OSM, pozos); S.ciudad = C;
    for (const e of C.etiquetas) { S.etiqueta(e.t, e.p, e.cat, e.color); S.etq[S.etq.length - 1].cerca = e.cerca; }
    S.etiqueta("Nodo VAH · PTAR SIBRA<br><small>posición REFERENCIAL junto al PIL</small>", new THREE.Vector3(0, 60, 0), "ciudad", "#f3d27a");
    S.capasRed = new Set(Object.keys(REDES));
    ponerMes(S.mes);
  } catch (e) { console.error("ciudad", e); }
}

function etiquetas() {
  const r = S.renderer.domElement.getBoundingClientRect(); const lejos = S.camera.position.distanceTo(S.controls.target) > 900;
  for (const t of S.etq) {
    const enCiudad = S.modo === "ciudad" || S.modo === "forma" || S.modo === "recorrido";
    const red = S.modo === "ciudad" || S.modo === "recorrido";
    const capa = t.modo === "colonia" ? "sanitario" : t.modo;
    const show = t.modo === "sitio" ? (!enCiudad && S.modo !== "tratadora" && !lejos) : t.modo === "ciudad" ? (enCiudad || lejos) : t.modo === "nodo" ? red
      : REDES[capa] ? red && S.capasRed?.has(capa) && (S.modo !== "recorrido" || S.tourCapa === capa) : t.modo === "etapa" ? S.modo === "tratadora" : t.modo === "tour" ? S.modo === "recorrido" : false;
    if (!show || (t.cerca && S.camera.position.distanceTo(S.controls.target) > 2200)) { t.e.style.display = "none"; continue; }
    const v = t.p.clone().project(S.camera); const vis = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
    t.e.style.display = vis ? "" : "none"; if (vis) { t.e.style.left = (v.x * .5 + .5) * r.width + "px"; t.e.style.top = (-v.y * .5 + .5) * r.height + "px"; }
  }
}

function vista(n, inst) {
  const P = { aerea: [[-150, 190, 210], [0, 0, 0]], iso: [[170, 120, 170], [0, 0, 0]], planta: [[0, 330, .1], [0, 0, 0]] }[n];
  const pos = new THREE.Vector3(...P[0]), tgt = new THREE.Vector3(...P[1]);
  if (inst) { S.camera.position.copy(pos); S.controls.target.copy(tgt); } else S.enfoque = { pos, tgt };
}
document.querySelectorAll("[data-vista]").forEach((b) => b.addEventListener("click", () => { if (S) { if (["ciudad", "forma", "recorrido"].includes(S.modo)) modo("obra"); vista(b.dataset.vista); } }));
$("#btn-fantasma").addEventListener("click", (e) => { if (!S) return; S.fantasma = !S.fantasma; e.currentTarget.classList.toggle("on", S.fantasma); ponerMes(S.mes); });

function ponerMes(m, desdePlay) {
  if (S) S.mes = m;
  if (S?.modo === "forma") return;
  const sl = $("#slider"); if (!desdePlay || Math.abs(+sl.value - m) > .04) sl.value = m;
  $("#g-cursor").style.left = (m / MAXM * 100) + "%";
  const nf = faseDeMes(m);
  $("#mes-txt").textContent = m > 24 ? "Posterior al mes 24" : "Mes " + m.toFixed(1);
  $("#tri-txt").textContent = nf < 0 ? "Antes de iniciar obra" : nf === 4 ? "Fase 4 · Expansión (reserva, sin fecha)" : `T${Math.min(8, Math.floor(m / 3) + 1)} · ${CRONO[nf]}`;
  $("#led-fase").textContent = nf < 0 ? "FASE —" : "FASE " + nf;
  $("#led-mes").textContent = m > 24 ? "MES 24+" : "MES " + Math.floor(m);
  tablero(m);
  if (!S) return;
  const forzar = ["tuberias", "tratadora", "ciudad", "recorrido"].includes(S.modo) ? 24 : null;
  const mm = forzar ?? m;
  let nObra = 0, nList = 0, nInst = 0;
  for (const it of S.items) {
    const p = clamp((mm - it.ini) / (it.fin - it.ini)); const e = ease(p);
    it.obj.visible = p > 0; if (p > 0) it.obj.scale.set(1, Math.max(.02, e), 1);
    it.and.visible = p > 0 && p < 1 && it.tipo !== "via";
    it.fan.visible = S.fantasma && p <= 0 && S.modo === "obra" && (it.fase < 4 || mm > 24);
    if (p > 0 && p < 1) nObra++; if (p >= 1 && it.tipo === "inst") nList++; if (it.tipo === "inst") nInst++;
  }
  const enc = S.modo === "tuberias" ? null : S.modo === "tratadora" ? ["agua_residual", "agua_proceso", "agua_tratada"] : mm >= 18 ? Object.keys(S.flujos) : [];
  for (const k in S.flujos) S.flujos[k].grupo.visible = enc ? enc.includes(k) : (S.capasOn?.has(k) ?? true);
  const enProc = S.items.filter((it) => it.tipo === "inst" && mm > it.ini && mm < it.fin).map((it) => it.f.id);
  const tit = { obra: "OBRA 4D · NODO VAH", tuberias: "TUBERÍAS DEL NODO (proyecto completo)", tratadora: "MODO TRATADORA · SIBRA", v360: "VISTA 360°", ciudad: "CIUDAD Y REDES DE AGUA" }[S.modo];
  if (S.modo === "recorrido") return;
  $("#hud").innerHTML = S.modo === "ciudad"
    ? `<b>${tit}</b><br><span class="ok">Ciudad, Río Nazas, canales y PIL: OpenStreetMap (real).</span><br><span class="ob">Trazo de las 6 redes y posición del Nodo: referencial.</span><br>El Plan Integral de Drenaje está pendiente de cargar.`
    : `<b>${tit}</b> · ${forzar ? "mes 24 (todo construido)" : m > 24 ? "mes 24+" : "mes " + m.toFixed(1)}<br>
    <span class="ok">■ Terminadas: ${nList}/${nInst}</span> · <span class="ob">■ En obra: ${nObra}</span><br>
    ${enProc.length && !forzar ? "Trabajando: " + enProc.slice(0, 4).join(", ") + (enProc.length > 4 ? "…" : "") : mm >= 18 && !forzar ? "Redes en prueba (Fase 3)" : ""}`;
}
function ponerJornada(j) {
  S.jor = j; const C = S.ciudad; const N = C.N; const r = C.forma(j);
  $("#slider").value = j / N * MAXM; $("#g-cursor").style.left = (j / N * 100) + "%";
  $("#mes-txt").textContent = `Jornada ${Math.min(N, Math.floor(j) + 1)} de ${N}`;
  $("#tri-txt").textContent = `Tramo T-${String(r.i + 1).padStart(2, "0")} · ${Math.round(r.t.len)} m · ${r.paso}`;
  $("#led-fase").textContent = "DRENAJE"; $("#led-mes").textContent = "JORNADA " + (Math.floor(j) + 1);
  ambiente(r.noche);
  if (S.tramoCam !== r.i) { S.tramoCam = r.i; const c = new THREE.Vector3(r.t.c[0], 0, r.t.c[1]); S.enfoque = { tgt: c, pos: c.clone().add(new THREE.Vector3(-120 * r.t.dir[1] + 45, 120, 120 * r.t.dir[0] + 45)) }; }
  const hechos = r.i + (r.f >= 1 ? 1 : 0);
  $("#hud").innerHTML = `<b>FORMA DE TRABAJO · TRAMOS CORTOS</b><br>Colector C-1 (ruta referencial) · ${hechos}/${N} tramos cerrados<br>
    <span class="${r.t.tipo === "colonia" ? "ok" : "ob"}">${r.t.nota}</span><br>Paso actual: <b>${r.paso}</b>${r.noche ? "<br>🌙 Turno nocturno · torres de iluminación" : ""}`;
  const lista = $("#lista-tramos"); if (lista) lista.querySelectorAll("[data-t]").forEach((el) => { const k = +el.dataset.t; el.className = k < r.i || (k === r.i && r.f >= 1) ? "hecho" : k === r.i ? "activo" : ""; });
}
function ambiente(noche) {
  if (S.noche === noche) return; S.noche = noche;
  S.scene.background.copy(noche ? S.NOCHE : S.FONDO); S.hemi.intensity = noche ? .12 : .6; S.sol.intensity = noche ? .15 : 2.8; S.renderer.toneMappingExposure = noche ? 1.1 : .9;
}
$("#slider").addEventListener("input", (e) => {
  if (S) parar();
  if (S?.modo === "forma") return ponerJornada(+e.target.value / MAXM * S.ciudad.N);
  if (S && !["obra", "v360"].includes(S.modo)) modo("obra");
  ponerMes(+e.target.value);
});
$("#btn-play").addEventListener("click", () => {
  if (!S) return; if (!["obra", "v360", "forma"].includes(S.modo)) modo("obra");
  S.play = !S.play;
  if (S.play && S.modo === "forma" && S.jor >= S.ciudad.N) S.jor = 0;
  if (S.play && S.modo !== "forma" && S.mes >= MAXM) S.mes = 0;
  $("#btn-play").textContent = S.play ? "❚❚" : "▶";
});
$("#vel").addEventListener("change", (e) => { if (S) S.vel = +e.target.value; });

function ficha(id) {
  const f = D.instalaciones.find((x) => x.id === id); if (!f) return;
  const it = S.items.find((x) => x.f === f); const costo = PR.instalaciones[id];
  $("#ficha").innerHTML = `<button class="x" onclick="this.parentNode.hidden=true">×</button><h3>${f.id} · ${f.nombre}<span class="tag ${f.fuente === "doc" ? "doc" : "sup"}">${f.fuente === "doc" ? "DOCUMENTO" : "SUPUESTO"}</span></h3>
   <table>${Object.entries(f.datos || {}).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}
   <tr><td>Fase</td><td>${FASE[f.fase].nombre} · ${FASE[f.fase].periodo}</td></tr>
   <tr><td>Programa 4D</td><td>mes ${it.ini.toFixed(1)} → ${it.fin.toFixed(1)} <small class="muted">(secuencia referencial)</small></td></tr>
   <tr><td>Costo directo</td><td>${costo ? pesos(costo) + " sin IVA" : "Incluido en partidas globales"}</td></tr></table>`;
  $("#ficha").hidden = false;
}

/* ───────── Modos ───────── */
const ETAPAS = [
  { n: "Llegada y bombeo", c: "#a0703a", ids: ["TK-101"], txt: "Cárcamo de 5.0 × 3.0 × 3.5 m (52.5 m³) con 2 bombas trituradoras de 15 HP con VFD (una opera y otra de respaldo). Caudal de diseño 22.5 L/s (19–29). Entrada con DBO₅ de 450 mg/L y SST de 380 mg/L.", src: "doc" },
  { n: "Pretratamiento", c: "#c08a4a", ids: ["SC-102", "TK-102"], txt: "Separadores coalescentes y trampas de grasa para 35 L/s, con bafles que retienen hidrocarburos libres (doc). Estanque amortiguador de ≈408 m³ para desviar picos tóxicos (supuesto S-07).", src: "mixto" },
  { n: "Primario anaerobio (RAFA)", c: "#8f9aa5", ids: ["R-201A", "R-201B"], txt: "2 reactores UASB/RAFA de Ø8.0 × 7.0 m (351.8 m³ cada uno) con TRH de 8.6 h. Quitan hasta 65 % de la DBO₅ y producen 115 m³/día de biogás para la caldera de pasteurización.", src: "doc" },
  { n: "Biológico (lodos activados)", c: "#3f8fd8", ids: ["TK-301", "B-301"], txt: "Tanque de aeración de 620 m³ con difusores de burbuja fina (SOTR de 14.2 kg O₂/h) y 2 sopladores de lóbulos de 25 HP. Las medidas de 20 × 8 × 3.9 m son un supuesto (S-06).", src: "doc" },
  { n: "Clarificación secundaria", c: "#5fb0e0", ids: ["CL-401A", "CL-401B"], txt: "2 clarificadores de Ø11 m con puente giratorio. No vienen en el documento: se agregaron porque un sistema de lodos activados los necesita (S-05).", src: "sup" },
  { n: "Pulimento", c: "#2bb3c0", ids: ["BF-402A", "BF-402B", "HS-601"], txt: "Biofiltros percoladores de lecho fijo (doc; medidas de Ø7 × 4.5 m supuestas) y humedal subsuperficial de 1,500 m² con tezontle y Typha domingensis (doc). La meta es dejar la DBO₅ y los SST por debajo de 20 mg/L.", src: "doc" },
  { n: "Filtración y desinfección UV", c: "#2fd3e6", ids: ["FA-701"], txt: "3 trenes de filtración rápida multimedia con arena sílica y 2 reactores UV de 254 nm a 35 mJ/cm², sin cloro residual.", src: "doc" },
  { n: "Lodos", c: "#7a6a55", ids: ["AL-001"], txt: "El documento no especifica cómo se tratan los lodos. El modelo solo incluye el retorno de lodos RAS (4\"-LR-402) y un almacén de lodos deshidratados (supuesto S-15). Falta definir la purga, el espesado y la deshidratación.", src: "sup" },
  { n: "Reúso y recarga", c: "#6fbf73", ids: ["ER-801", "EB-802", "PI-803A", "PI-803B", "PI-803C", "PI-803D"], txt: "Estanque de regulación de ≈3,000 m³ y bombeo a riego ejidal (supuestos S-07). 4 pozos de infiltración inducida (doc); su número y ubicación son el supuesto S-14 y requieren estudio geohidrológico y permiso de CONAGUA.", src: "mixto" },
];
function atenuar(on, resaltar = []) {
  for (const it of S.items) {
    const key = it.f?.id; const keep = !on || resaltar.includes(key);
    it.obj.traverse((m) => {
      if (!(m.isMesh || m.isInstancedMesh) || !m.material) return;
      if (!m.userData.mo) m.userData.mo = m.material;
      if (keep) { m.material = m.userData.mo; return; }
      if (!m.userData.mt) { const arr = Array.isArray(m.userData.mo) ? m.userData.mo : [m.userData.mo]; const t = arr.map((x) => { const c = x.clone(); c.transparent = true; c.opacity = .07; c.depthWrite = false; return c; }); m.userData.mt = Array.isArray(m.userData.mo) ? t : t[0]; }
      m.material = m.userData.mt;
    });
  }
}
function pulsar(ids) {
  if (S.pulso) for (const m of S.pulso) m.material.emissive?.setRGB(0, 0, 0);
  S.pulso = [];
  for (const id of ids) S.fac[id]?.traverse((m) => { if (m.isMesh && m.material && !Array.isArray(m.material) && m.material.emissive) { if (!m.userData.pm) m.userData.pm = m.material.clone(); m.material = m.userData.pm; S.pulso.push(m); } });
}
function enfocar(ids) {
  const box = new THREE.Box3(); ids.forEach((id) => S.fac[id] && box.expandByObject(S.fac[id]));
  if (box.isEmpty()) return; const c = box.getCenter(new THREE.Vector3()); const r = Math.max(18, box.getSize(new THREE.Vector3()).length() * .9);
  S.enfoque = { tgt: c, pos: c.clone().add(new THREE.Vector3(-.7 * r, .75 * r, .9 * r)) };
}
function panelTratadora() {
  const p = $("#modo-panel"); p.hidden = false;
  p.innerHTML = `<h2>Tren de tratamiento SIBRA <small>datos de la memoria técnica y del documento; cada etapa indica qué es supuesto</small></h2>
   <div class="etapas">${ETAPAS.map((e, i) => `<button class="etapa" data-i="${i}" style="--c:${e.c}"><b>${i + 1}. ${e.n}</b><small>${e.ids.join(" · ")}</small> <span class="tag ${e.src === "doc" ? "doc" : "sup"}">${e.src === "doc" ? "DOC" : e.src === "sup" ? "SUPUESTO" : "DOC + SUP"}</span></button>`).join("")}</div>
   <div class="det" id="det-etapa"></div>
   <p class="nota tiny">El flujo animado va del agua residual (café) al agua en proceso y lodos (azul) y termina en agua tratada (cian). <button class="btn mini" id="btn-recorrido">▶ Recorrido automático</button></p>`;
  p.querySelectorAll(".etapa").forEach((b) => b.addEventListener("click", () => { clearInterval(S.recorrido); etapa(+b.dataset.i); }));
  $("#btn-recorrido").addEventListener("click", () => { let i = 0; etapa(0); clearInterval(S.recorrido); S.recorrido = setInterval(() => { if (S.modo !== "tratadora") return clearInterval(S.recorrido); i = (i + 1) % ETAPAS.length; etapa(i); }, 4500); });
}
function etapa(i) {
  const e = ETAPAS[i]; document.querySelectorAll(".etapa").forEach((b) => b.classList.toggle("on", +b.dataset.i === i));
  $("#det-etapa").innerHTML = `<b style="color:${e.c}">${i + 1}. ${e.n}</b> — ${e.txt}`;
  atenuar(true, e.ids); pulsar(e.ids); enfocar(e.ids);
  const box = new THREE.Box3(); e.ids.forEach((id) => S.fac[id] && box.expandByObject(S.fac[id]));
  if (!S.etEtapa) { S.etiqueta("", new THREE.Vector3(), "etapa", e.c); S.etEtapa = S.etq[S.etq.length - 1]; }
  S.etEtapa.e.style.setProperty("--c", e.c); S.etEtapa.e.innerHTML = `${i + 1}. ${e.n}`; S.etEtapa.p.copy(box.getCenter(new THREE.Vector3())).setY(box.max.y + 4);
}
function panelTuberias() {
  const p = $("#modo-panel"); p.hidden = false; S.capasOn ||= new Set(Object.keys(S.flujos));
  const tr = D.redes.flatMap((r) => r.tramos.map((t) => `<div><span style="color:${r.color}">■</span> ${t.tag}${t.nota ? " — " + t.nota : ""}</div>`)).join("");
  p.innerHTML = `<h2>Redes internas del Nodo VAH <small>trazo de los planos PL-03 y PL-04</small></h2>
   <div class="capas">${D.redes.map((r) => `<label style="--c:${r.color}"><input type="checkbox" data-capa="${r.capa}" ${S.capasOn.has(r.capa) ? "checked" : ""}><i></i>${r.nombre} (${r.tramos.length})</label>`).join("")}</div>
   <div class="tramos">${tr}</div>
   <p class="nota tiny">Es el trazo <b>referencial</b> del anteproyecto. Los diámetros y materiales son supuestos (S-09). Los puntos de entrega del agua residual, la acometida de CFE y la salida al canal ejidal también son supuestos (S-10) mientras no lleguen las factibilidades de SIDEAPA y CFE. La red municipal está en el modo «Ciudad y drenaje».</p>`;
  p.querySelectorAll("[data-capa]").forEach((c) => c.addEventListener("change", () => { c.checked ? S.capasOn.add(c.dataset.capa) : S.capasOn.delete(c.dataset.capa); ponerMes(S.mes); }));
}
function panelCiudad() {
  const p = $("#modo-panel"); p.hidden = false; const C = S.ciudad;
  p.innerHTML = `<h2>Ciudad y redes de agua <small>OpenStreetMap real · redes con trazo referencial</small></h2>
   <div class="capas leyenda">${Object.entries(REDES).map(([k, r]) => `<label style="--c:${r.c}" title="${r.d}"><input type="checkbox" data-red="${k}" ${S.capasRed.has(k) ? "checked" : ""}><i></i><b>${r.n}</b><small>${r.d}</small></label>`).join("")}</div>
   <div class="capas"><label><input type="checkbox" id="chk-xray" ${S.xray ? "checked" : ""}> 🩻 Rayos X (suelo transparente)</label>
   <label><input type="checkbox" id="chk-folleto" ${C.folleto.visible ? "checked" : ""}> 🗺️ Folleto histórico del PIL (pág. 13)</label>
   <button class="btn mini oro" id="btn-tour">🌊 Recorrido del agua</button></div>
   <div class="real-ref"><div><span class="tag doc">REAL · OSM</span> Calles, edificios mapeados, Río Nazas, canales (Sacramento, Tlahualilo), drenes y arroyos, vía férrea, aeropuertos, área industrial del PIL, tanques elevados, obras hidráulicas, bombeo y la PTAR existente de OSM.</div>
   <div><span class="tag sup">REFERENCIAL</span> Posición del Nodo VAH junto al PIL; trazo y diámetros de las seis redes (van por calles reales); descarga al Nazas; toma al canal; colectores pluviales; ubicación de colonias (aprox.). Manzanas = huecos entre calles OSM con alturas ilustrativas.</div></div>
   <p class="nota tiny">Datos © colaboradores de OpenStreetMap (licencia ODbL), extracto Geofabrik México del 12-nov-2026. El PIL no tiene nombre en OSM; se identificó por sus calles (Guanaceví, Topia, Canelas, Tamazula, Piedras Negras, CP 35078). Las coordenadas UTM de la memoria (E 654 200–654 400, N 2 854 600–2 854 800) caen unos 26 km al norte de Gómez Palacio, así que no se usaron para ubicar el Nodo. El folleto es un mapa de época sin escala; su ajuste sobre OSM es aproximado (error de 1–2 km). Ningún documento menciona una descarga al Río Nazas: se dibuja como opción referencial que tendría que cumplir la NOM-001-SEMARNAT-2021.</p>`;
  $("#chk-xray").addEventListener("change", (e) => { S.xray = e.target.checked; C.xray(S.xray); });
  $("#chk-folleto").addEventListener("change", (e) => { C.cargarFolleto(); C.folleto.visible = e.target.checked; });
  $("#btn-tour").addEventListener("click", () => modo("recorrido"));
  p.querySelectorAll("[data-red]").forEach((c) => c.addEventListener("change", () => { c.checked ? S.capasRed.add(c.dataset.red) : S.capasRed.delete(c.dataset.red); C.capa(c.dataset.red, c.checked); }));
}
/* ───────── Recorrido del agua ───────── */
function pasosTour() {
  const C = S.ciudad, r = C.rutas, P = C.prof, A = C.ACU; const v3 = (pts, y) => pts.map(([x, z]) => new THREE.Vector3(x, y, z));
  const caja = (ids) => { const b = new THREE.Box3(); ids.forEach((id) => S.fac[id] && b.expandByObject(S.fac[id])); return b.getCenter(new THREE.Vector3()).setY(3); };
  const ent = C.emisor[C.emisor.length - 1];
  const sibra = [new THREE.Vector3(ent[0], 2, ent[1]), ...ETAPAS.slice(0, 7).map((e) => caja(e.ids)), caja(["ER-801"])];
  const [px, pz] = C.pozosI[0] || [92, -20];
  return [
    { t: "Fuente: pozo / obra hidráulica", k: "potable", tag: "REAL + REF", pts: [new THREE.Vector3(r.pozo[0], A, r.pozo[1]), new THREE.Vector3(r.pozo[0], 0, r.pozo[1])],
      txt: "El punto es una obra hidráulica de OpenStreetMap (real). Que sea la fuente del agua que llega al PIL es referencial. El acuífero de la Comarca está sobreexplotado y tiene arsénico y fluoruros (Documento Maestro §2)." },
    { t: "Conducción al tanque elevado", k: "potable", tag: "REF", pts: v3(r.conduccion, P.potable), txt: "Línea de conducción con trazo referencial sobre calles reales, hasta un tanque elevado que sí está en OSM." },
    { t: "Red de distribución hacia el PIL", k: "potable", tag: "REF", pts: v3(r.distribucion, P.potable), txt: "Red de distribución referencial que reparte el agua potable a las naves del Parque Industrial Lagunero." },
    { t: "Uso en la industria del PIL", k: "industrial", tag: "DOC", pts: [new THREE.Vector3(r.industria[0], 0, r.industria[1]), new THREE.Vector3(r.industria[0], 25, r.industria[1]), new THREE.Vector3(r.industria[0], P.industrial, r.industria[1])],
      txt: "El agua se usa en los procesos del PIL. El Documento Maestro estima descargas del parque de 40–80 L/s (1.25–2.50 Mm³/año), que necesitan la fase 1 de SIBRA (grasas e hidrocarburos)." },
    { t: "Descarga industrial → colector → Nodo", k: "industrial", tag: "REF", pts: v3(r.descarga, P.industrial),
      txt: "Las descargas de las naves van por un colector industrial (trazo referencial) al Nodo. Ahí también llega el emisor municipal con los colectores C-1…C-5. El Plan Integral de Drenaje está pendiente de cargar." },
    { t: "Entrada de agua cruda y cárcamo TK-101", k: "sanitario", tag: "DOC + SUP", pts: [sibra[0], sibra[1]],
      txt: "El agua cruda entra por el norte del predio (punto de entrega supuesto S-10) al cárcamo TK-101: 52.5 m³, 2 bombas trituradoras de 15 HP, caudal de diseño 22.5 L/s (19–29). El Nodo piloto trata una parte de las descargas del PIL." },
    { t: "Tratamiento SIBRA en el Nodo", k: "tratada", tag: "DOC", pts: sibra.slice(1),
      txt: "Pretratamiento → RAFA anaerobio → lodos activados → clarificación (supuesto S-05) → biofiltros y humedal → filtración y UV sin cloro. El documento plantea cumplir NOM-001-SEMARNAT-2021 y NOM-002-SEMARNAT-1996." },
    { t: "Reúso industrial (agua morada)", k: "tratada", tag: "REF", pts: v3(r.reuso, P.tratada), txt: "Agua tratada de regreso a las naves del PIL. Es una propuesta con trazo referencial: el documento habla de reúso productivo y de riego." },
    { t: "Riego ejidal por el canal", k: "tratada", tag: "OSM + REF", pts: v3(r.riego, P.tratada), txt: "El documento dice que el predio colinda con canales de riego ejidal (bombeo EB-802, supuesto S-07). El Canal de Sacramento es real (OSM); la conexión es referencial." },
    { t: "Río Nazas", k: "tratada", tag: "REF", pts: v3(r.nazas, P.tratada), txt: "Los documentos no mencionan el Nazas. El cauce es real (OSM) y la descarga es solo una opción referencial: tendría que cumplir la NOM-001-SEMARNAT-2021 y tener permiso de CONAGUA." },
    { t: "Recarga al acuífero", k: "recarga", tag: "DOC + SUP", pts: [new THREE.Vector3(px, 0, pz), new THREE.Vector3(px, A, pz)],
      txt: "4 pozos de infiltración inducida (documento); su ubicación es el supuesto S-14 y requiere estudio geohidrológico y permiso de CONAGUA. Reúso y recarga del piloto: 0.60–0.90 Mm³/año, con menos extracción de pozos profundos (Documento Maestro)." },
  ];
}
function panelTour() {
  const p = $("#modo-panel"); p.hidden = false; S.tour = pasosTour();
  p.innerHTML = `<h2>Recorrido del agua <small>del pozo a la industria, al Nodo y de vuelta: reúso, riego, Nazas y acuífero</small></h2>
   <div class="etapas">${S.tour.map((e, i) => `<button class="etapa" data-i="${i}" style="--c:${REDES[e.k].c}"><b>${i + 1}. ${e.t}</b> <span class="tag ${/REF|SUP/.test(e.tag) ? "sup" : "doc"}">${e.tag}</span></button>`).join("")}</div>
   <div class="det" id="det-tour"></div>
   <p class="nota tiny"><button class="btn mini oro" id="btn-tour-play">▶ Reproducir</button> <button class="btn mini" id="btn-ciudad">⟵ Volver a Ciudad y redes</button> La gota recorre cada tramo; el color es el de la red.</p>`;
  p.querySelectorAll(".etapa").forEach((b) => b.addEventListener("click", () => { tourAuto(false); pasoTour(+b.dataset.i); }));
  $("#btn-tour-play").addEventListener("click", () => tourAuto(!S.tourAuto));
  $("#btn-ciudad").addEventListener("click", () => modo("ciudad"));
  if (!S.gota) { S.gota = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true })); S.gota.renderOrder = 20;
    S.halo = new THREE.Mesh(new THREE.SphereGeometry(1.8, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: .3 })); S.halo.renderOrder = 19; S.gota.add(S.halo); S.scene.add(S.gota); }
  S.gota.visible = true; pasoTour(0); tourAuto(true);
}
function tourAuto(on) { S.tourAuto = on; const b = $("#btn-tour-play"); if (b) b.textContent = on ? "❚❚ Pausa" : "▶ Reproducir"; }
function pasoTour(i) {
  const e = S.tour[i]; S.tourI = i; S.tourT = 0; S.tourCapa = e.k;
  document.querySelectorAll("#modo-panel .etapa").forEach((b) => b.classList.toggle("on", +b.dataset.i === i));
  $("#det-tour").innerHTML = `<b style="color:${REDES[e.k].c}">${i + 1}. ${e.t}</b> — ${e.txt}`;
  for (const k of Object.keys(REDES)) S.ciudad.capa(k, k === e.k || (k === "sanitario" && e.k === "industrial"));
  S.ciudad.resaltar(e.k);
  const c = new THREE.Color(REDES[e.k].c); S.gota.material.color.copy(c); S.halo.material.color.copy(c);
  const curva = new THREE.CurvePath(); for (let j = 0; j < e.pts.length - 1; j++) if (e.pts[j].distanceToSquared(e.pts[j + 1]) > .01) curva.add(new THREE.LineCurve3(e.pts[j], e.pts[j + 1]));
  S.tourCurva = curva; S.tourL = curva.getLength();
  const b = new THREE.Box3().setFromPoints(e.pts); const ctr = b.getCenter(new THREE.Vector3()); const r = Math.max(110, b.getSize(new THREE.Vector3()).length() * .8);
  S.gota.scale.setScalar(Math.max(2.5, r / 45));
  S.enfoque = { tgt: ctr.clone().setY(Math.max(ctr.y, -5)), pos: ctr.clone().add(new THREE.Vector3(-.45 * r, .85 * r, .75 * r)).setY(Math.max(60, .85 * r)) };
  $("#hud").innerHTML = `<b>RECORRIDO DEL AGUA · ${i + 1}/${S.tour.length}</b><br><span style="color:${REDES[e.k].c}">■</span> ${e.t}<br><span class="${/REF|SUP/.test(e.tag) ? "ob" : "ok"}">${e.tag}</span>`;
}
function animTour(dt) {
  if (!S.tourCurva || !S.tourL) return; S.tourT += dt;
  const u = Math.min(1, S.tourT / 5); S.gota.position.copy(S.tourCurva.getPointAt(ease(u)));
  if (S.tourAuto && S.tourT > 6.5) pasoTour((S.tourI + 1) % S.tour.length);
}
function panelForma() {
  const p = $("#modo-panel"); p.hidden = false; const C = S.ciudad;
  p.innerHTML = `<h2>Forma de trabajo · tramos cortos <small>metodología del Plan de Drenaje (§6 de su índice)</small></h2>
   <div class="etapas">
     <div class="etapa" style="--c:#3fd46b"><b>Colonias</b><small>Tramos de 100–200 m: se abre, se instala y se tapa el mismo día. Así no quedan zanjas abiertas de noche.</small></div>
     <div class="etapa" style="--c:#4aa8ff"><b>Avenidas</b><small>Trabajo nocturno con torres de iluminación, para no cerrar la vialidad de día.</small></div>
     <div class="etapa" style="--c:#ffb547"><b>Cruces críticos</b><small>Sin zanja: fosas de entrada y salida y perforación horizontal bajo vías, bulevares o canales.</small></div>
   </div>
   <div class="tramos" id="lista-tramos">${C.tramos.map((t) => `<div data-t="${t.i}">T-${String(t.i + 1).padStart(2, "0")} · ${Math.round(t.len)} m · ${t.tipo === "avenida" ? "🌙 avenida, nocturno" : t.tipo === "sinzanja" ? "⛏️ sin zanja" : "colonia"}</div>`).join("")}</div>
   <p class="nota tiny">Animación <b>referencial</b> del método. El colector C-1 va por calles reales de OpenStreetMap, del Nodo hacia el Centro. Los tramos nocturnos caen donde OSM marca vialidad primaria, y los tramos sin zanja donde la ruta cruza la vía férrea, un canal o una vía rápida de OSM. La ruta y los 150 m por tramo no son la ingeniería del Plan de Drenaje, que aún no se ha cargado. Pon ▶ para ver avanzar las jornadas.</p>`;
}
function panel360() {
  const p = $("#modo-panel"); p.hidden = false;
  const tieneGiro = "DeviceOrientationEvent" in window && matchMedia("(pointer:coarse)").matches;
  p.innerHTML = `<h2>Vista 360° <small>giro panorámico continuo alrededor del nodo</small></h2>
   <div class="capas"><label><input type="checkbox" id="chk-auto" checked> Giro automático</label>
   <label><input type="range" id="rng-giro" min="0.3" max="4" step="0.1" value="1.2" style="width:110px;height:auto;margin:0"> Velocidad</label>
   ${tieneGiro ? `<button class="btn mini oro" id="btn-giro">📱 Mirar moviendo el teléfono</button>` : `<span class="tiny muted">En el teléfono aparece un botón para mirar con el giroscopio.</span>`}</div>
   <p class="nota tiny">La línea de tiempo sigue activa: pon ▶ y verás la obra avanzar mientras gira la cámara.</p>`;
  $("#chk-auto").addEventListener("change", (e) => (S.controls.autoRotate = e.target.checked));
  $("#rng-giro").addEventListener("input", (e) => (S.controls.autoRotateSpeed = +e.target.value));
  $("#btn-giro")?.addEventListener("click", async () => {
    try { if (typeof DeviceOrientationEvent.requestPermission === "function") { const r = await DeviceOrientationEvent.requestPermission(); if (r !== "granted") throw 0; } } catch (_) { $("#btn-giro").textContent = "Permiso negado"; return; }
    if (S.orient) { S.orient = null; window.removeEventListener("deviceorientation", S.onOri); $("#btn-giro").classList.remove("on"); return; }
    S.onOri = (e) => { if (e.alpha == null) return; S.ori = { a: e.alpha, b: e.beta }; if (!S.ori0) S.ori0 = { ...S.ori, az: S.controls.getAzimuthalAngle() }; };
    window.addEventListener("deviceorientation", S.onOri); S.orient = true; S.ori0 = null; S.controls.autoRotate = false; $("#chk-auto").checked = false; $("#btn-giro").classList.add("on");
  });
}
function aplicarOrientacion() {
  if (!S.ori || !S.ori0) return;
  const cam = S.camera, t = S.controls.target; const r = cam.position.distanceTo(t);
  const az = S.ori0.az + THREE.MathUtils.degToRad(S.ori.a - S.ori0.a);
  const pol = clamp(THREE.MathUtils.degToRad(90 - S.ori.b) * .9, .15, Math.PI * .49);
  cam.position.set(t.x + r * Math.sin(pol) * Math.sin(az), t.y + r * Math.cos(pol), t.z + r * Math.sin(pol) * Math.cos(az)); cam.lookAt(t);
}
function modo(n) {
  if (!S) return;
  if ((n === "ciudad" || n === "forma" || n === "recorrido") && !S.ciudad) { $("#hud").innerHTML = "<b>Cargando la ciudad…</b>"; setTimeout(() => modo(n), 600); return; }
  const prev = S.modo; S.modo = n; parar();
  document.querySelectorAll(".modo").forEach((b) => b.classList.toggle("on", b.dataset.modo === n));
  clearInterval(S.recorrido); S.controls.autoRotate = false; if (S.orient) { S.orient = null; window.removeEventListener("deviceorientation", S.onOri); }
  atenuar(false); pulsar([]);
  $("#modo-panel").hidden = true; $("#ficha").hidden = true;
  if (S.ciudad) { S.ciudad.enForma(n === "forma"); S.xray ??= true; if (n === "forma") S.ciudad.xray(false, .5); else S.ciudad.xray(n === "ciudad" ? S.xray : n === "recorrido");
    if (n !== "recorrido") { for (const k of Object.keys(REDES)) S.ciudad.capa(k, S.capasRed.has(k)); S.ciudad.resaltar(null); } }
  if (S.ciudad && n === "forma") for (const k of Object.keys(REDES)) S.ciudad.capa(k, false);
  if (S.gota) S.gota.visible = n === "recorrido"; S.tourCurva = null; S.tourCapa = null;
  ambiente(false); S.tramoCam = -1;
  const lejosM = n === "ciudad" || n === "recorrido"; S.scene.fog.near = lejosM ? 9000 : 900; S.scene.fog.far = lejosM ? 30000 : 9000;
  if (n === "tuberias") { panelTuberias(); atenuar(true, []); S.enfoque = { pos: new THREE.Vector3(-60, 150, 140), tgt: new THREE.Vector3(-20, 0, -10) }; }
  if (n === "tratadora") { panelTratadora(); S.enfoque = { pos: new THREE.Vector3(-150, 95, 40), tgt: new THREE.Vector3(-30, 0, -15) }; atenuar(true, ETAPAS.flatMap((e) => e.ids)); }
  if (n === "v360") { panel360(); S.controls.autoRotate = true; S.controls.autoRotateSpeed = 1.2; S.enfoque = { pos: new THREE.Vector3(-420, 260, 420), tgt: new THREE.Vector3(0, 0, 0) }; }
  if (n === "ciudad") { panelCiudad(); S.enfoque = { pos: new THREE.Vector3(-400, 3300, 4700), tgt: new THREE.Vector3(-2200, 0, 1300) }; }
  if (n === "recorrido") panelTour();
  if (n === "forma") { panelForma(); ganttForma(true); ponerJornada(S.jor || 0); }
  if (prev === "forma" && n !== "forma") ganttForma(false);
  if (n === "obra" && prev !== "obra") vista("aerea");
  $("#sub-visor").textContent = { obra: "PL-01 Conjunto · cronograma §11", tuberias: "Redes PL-03 / PL-04 · trazo referencial", tratadora: "Tren SIBRA · PL-03 + memoria MT-NVAH-01", v360: "Órbita panorámica", ciudad: "OpenStreetMap (real) · redes referenciales", forma: "Tramos cortos · C-1 sobre calles OSM", recorrido: "Pozo → industria → Nodo → reúso / riego / Nazas / acuífero" }[n];
  notaCrono();
  if (n !== "forma") ponerMes(S.mes);
}
document.querySelectorAll(".modo").forEach((b) => b.addEventListener("click", () => modo(b.dataset.modo)));
window.NodoVAH4D = { ponerMes, ponerJornada, modo, vista, get S() { return S; } };
candado();
