// Ciudad real (OpenStreetMap) + todas las redes de agua + forma de trabajo por tramos cortos.
// REAL (OSM, © OpenStreetMap contributors, ODbL): calles, edificios mapeados, Río Nazas, canales, drenes, vía férrea, aeropuertos,
//   área industrial del PIL y obras hidráulicas (tanques, obras de toma, bombeo, PTAR existente).
// REFERENCIAL: posición del Nodo VAH, trazo de todas las redes (van sobre calles reales), descarga al Nazas, toma a riego, pluvial.
import * as THREE from "three";

const uT = { value: 0 };
function matFlujo(color, op = 1, vel = 40) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uT, uC: { value: new THREE.Color(color) }, uLen: { value: 100 }, uOp: { value: op }, uV: { value: vel }, uRes: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uT; uniform vec3 uC; uniform float uLen; uniform float uOp; uniform float uV; uniform float uRes; varying vec2 vUv;
      void main(){ float s=vUv.x*uLen; float d=fract((s-uT*uV)/90.); float p=smoothstep(0.,.1,d)*(1.-smoothstep(.25,.5,d));
      vec3 c=uC*(.55+1.7*p)+uRes*vec3(.35); gl_FragColor=vec4(c, (.5+.5*p)*uOp); }`,
  });
}
const PM = (geo, mat, x, y, z, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.z = rz; return m; };
const V = (p, y = 0) => new THREE.Vector3(p[0], y, p[1]);
// decodifica polilíneas delta [x0,z0,dx,dz,...]
export function dec(f) { const o = []; let x = 0, z = 0; for (let i = 0; i < f.length; i += 2) { x = i ? x + f[i] : f[i]; z = i ? z + f[i + 1] : f[i + 1]; o.push([x, z]); } return o; }
function tubo(pts, y, r, color, op = 1, vel = 40) {
  const path = new THREE.CurvePath(); let L = 0;
  for (let i = 0; i < pts.length - 1; i++) { const a = V(pts[i], y), b = V(pts[i + 1], y); if (a.distanceToSquared(b) < .01) continue; path.add(new THREE.LineCurve3(a, b)); L += a.distanceTo(b); }
  if (!path.curves.length) return new THREE.Group();
  const m = new THREE.Mesh(new THREE.TubeGeometry(path, Math.min(400, Math.max(4, Math.ceil(L / 30))), r, 8, false), matFlujo(color, op, vel));
  m.material.uniforms.uLen.value = L; m.renderOrder = 4; m.userData.L = L; return m;
}
function vtubo(x, z, y0, y1, r, color, vel = 15) {
  const L = Math.abs(y1 - y0); const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(x, y0, z), new THREE.Vector3(x, y1, z)), 6, r, 10, false), matFlujo(color, 1, vel));
  m.material.uniforms.uLen.value = L; m.renderOrder = 4; return m;
}
function largo(pts) { let L = 0; for (let i = 0; i < pts.length - 1; i++) L += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); return L; }
export function enLinea(pts, d) {
  for (let i = 0; i < pts.length - 1; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[i + 1]; const l = Math.hypot(x1 - x0, z1 - z0) || 1e-6;
    if (d <= l || i === pts.length - 2) { const t = Math.max(0, Math.min(1, d / l)); return { p: [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t], dir: [(x1 - x0) / l, (z1 - z0) / l], i }; } d -= l; }
  return { p: pts[0], dir: [1, 0], i: 0 };
}
// cintas planas (calles, cauce) en un solo BufferGeometry
function cintas(lineas, ancho, y) {
  const pos = []; const idx = []; let n = 0;
  for (const pts of lineas) for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1]; const l = Math.hypot(x1 - x0, z1 - z0); if (l < .1) continue;
    const nx = -(z1 - z0) / l * ancho / 2, nz = (x1 - x0) / l * ancho / 2;
    pos.push(x0 + nx, y, z0 + nz, x0 - nx, y, z0 - nz, x1 + nx, y, z1 + nz, x1 - nx, y, z1 - nz);
    idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); n += 4;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function lineas(lista, y) { const pos = []; for (const pts of lista) for (let i = 0; i < pts.length - 1; i++) pos.push(pts[i][0], y, pts[i][1], pts[i + 1][0], y, pts[i + 1][1]);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); return g; }
const hash = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };

export const REDES = {
  potable: { n: "Agua potable", c: "#3c8cff", d: "Pozo / fuente → tanque → red de distribución" },
  sanitario: { n: "Drenaje sanitario", c: "#ff8a3d", d: "Descargas → subcolectores → colectores → emisor" },
  industrial: { n: "Drenaje industrial PIL", c: "#e0457b", d: "Descargas de las naves del PIL → Nodo / PTAR" },
  pluvial: { n: "Pluvial", c: "#7fe0c8", d: "Drenes y arroyos OSM + colectores pluviales al Nazas" },
  tratada: { n: "Agua tratada · reúso", c: "#a35bff", d: "PTAR → industria, riego ejidal y Nazas" },
  recarga: { n: "Recarga al acuífero", c: "#36d6ff", d: "4 pozos de infiltración inducida (doc) → acuífero" },
};

export function crearCiudad(scene, C, sitio) {
  const g = new THREE.Group(); g.name = "ciudad"; scene.add(g);
  const { X0, X1, Z0, Z1 } = C.meta; const AW = X1 - X0, AH = Z1 - Z0;
  const etiquetas = []; const ET = (t, x, z, y, cat, color, cerca) => etiquetas.push({ t, p: new THREE.Vector3(x, y, z), cat, color, cerca });
  const libre = (x, z, r = 135) => Math.abs(x) < r && Math.abs(z) < r; // predio del Nodo

  // Suelo
  const sueloMat = new THREE.MeshStandardMaterial({ color: 0x141a22, roughness: 1, transparent: true, opacity: 1 });
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(AW + 4000, AH + 4000), sueloMat); suelo.rotation.x = -Math.PI / 2; suelo.position.set((X0 + X1) / 2, -.7, (Z0 + Z1) / 2); g.add(suelo);
  // Folleto histórico (capa conmutable, ajuste aproximado)
  const F = C.meta.folleto; const folleto = new THREE.Group(); folleto.visible = false; g.add(folleto); let folletoCargado = false;
  async function cargarFolleto() {
    if (folletoCargado) return; folletoCargado = true;
    if (!window.FOLLETO_PIL_P13) await new Promise((ok, no) => { const sc = document.createElement("script"); sc.src = F.img; sc.onload = ok; sc.onerror = no; document.head.appendChild(sc); });
    const tex = new THREE.TextureLoader().load(window.FOLLETO_PIL_P13); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const [u0, v0] = F.origen_uv; const T = ([x, z]) => [F.R[0][0] * x + F.R[0][1] * z + F.t[0], F.R[1][0] * x + F.R[1][1] * z + F.t[1]];
    const esq = [[-u0 * F.ancho, -v0 * F.alto], [(1 - u0) * F.ancho, -v0 * F.alto], [-u0 * F.ancho, (1 - v0) * F.alto], [(1 - u0) * F.ancho, (1 - v0) * F.alto]].map(T);
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(esq.flatMap(([x, z]) => [x, 2, z]), 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2)); geo.setIndex([0, 2, 1, 1, 2, 3]);
    const fm = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: .82, depthWrite: false, side: THREE.DoubleSide, fog: false })); fm.renderOrder = 3; folleto.add(fm);
  }

  // Calles OSM
  const vias = C.vias.map((ls) => ls.map(dec));
  const colV = [0xc9b48a, 0x8f8a80, 0x4d5560, 0x343b44], anV = [16, 11, 7, 5];
  const matsV = colV.map((c, i) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: i < 2 ? .95 : .85, depthWrite: true }));
  const calles = new THREE.Group(); g.add(calles);
  vias.forEach((ls, i) => { const m = new THREE.Mesh(cintas(ls.filter((p) => !p.every(([x, z]) => libre(x, z))), anV[i], .04 + i * -.01), matsV[i]); m.renderOrder = 1; calles.add(m); });
  // Manzanas derivadas
  const caja = new THREE.BoxGeometry(1, 1, 1); caja.translate(0, .5, 0);
  const ven = (() => { const c = document.createElement("canvas"); c.width = 64; c.height = 64; const x = c.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, 64, 64);
    for (let yy = 6; yy < 60; yy += 14) for (let xx = 4; xx < 60; xx += 12) { x.fillStyle = Math.random() > .5 ? "#ffcf87" : "#1d2a3a"; x.fillRect(xx, yy, 7, 7); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const mB = new THREE.MeshStandardMaterial({ envMapIntensity: .25, color: 0xffffff, roughness: .85, metalness: .1, emissive: 0xffffff, emissiveMap: ven, emissiveIntensity: .35, transparent: true, opacity: 1 });
  const man = C.man.filter(([x, z]) => !libre(x, z, 160));
  const BM = new THREE.InstancedMesh(caja, mB, man.length); const o = new THREE.Object3D(); const col = new THREE.Color();
  man.forEach(([x, z, w, d, a], i) => { const h = 3 + hash(x, z) * 5 + (hash(z, x) > .93 ? 6 : 0); o.position.set(x, 0, z); o.rotation.set(0, -a * Math.PI / 180, 0); o.scale.set(w, h, d); o.updateMatrix(); BM.setMatrixAt(i, o.matrix);
    const k = Math.min(1, h / 14); BM.setColorAt(i, col.setHSL(.6 - k * .05, .12 + k * .1, .16 + k * .1)); });
  o.rotation.set(0, 0, 0); g.add(BM);
  // Edificios OSM (huella real, altura de building:levels o ilustrativa)
  const mE = new THREE.MeshStandardMaterial({ color: 0xb9c4cf, roughness: .7, metalness: .15, emissive: 0x1a2430, transparent: true, opacity: 1, side: THREE.DoubleSide });
  {
    const pos = [], idx = []; let n = 0;
    for (const e of C.edif) { const h0 = e[0]; const pts = dec(e.slice(1)); if (pts.length < 3 || libre(pts[0][0], pts[0][1])) continue;
      const h = h0 || 4 + hash(pts[0][0], pts[0][1]) * 5;
      const sh = pts.map(([x, z]) => new THREE.Vector2(x, z)); const tri = THREE.ShapeUtils.triangulateShape(sh, []);
      const base = n; for (const [x, z] of pts) { pos.push(x, h, z); n++; } for (const t of tri) idx.push(base + t[0], base + t[2], base + t[1]);
      for (let i = 0; i < pts.length; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length];
        pos.push(x0, 0, z0, x1, 0, z1, x0, h, z0, x1, h, z1); idx.push(n, n + 1, n + 2, n + 1, n + 3, n + 2, n, n + 2, n + 1, n + 1, n + 2, n + 3); n += 4; } }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, mE));
  }
  // PIL (área industrial OSM)
  const pil = C.pil.map(dec); const mPil = new THREE.MeshBasicMaterial({ color: 0xd4a63a, transparent: true, opacity: .1, depthWrite: false, side: THREE.DoubleSide });
  for (const p of pil) { const s = new THREE.Shape(p.map(([x, z]) => new THREE.Vector2(x, -z))); const m = new THREE.Mesh(new THREE.ShapeGeometry(s), mPil); m.rotation.x = -Math.PI / 2; m.position.y = .2; g.add(m);
    const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(p.map(([x, z]) => new THREE.Vector3(x, 1.5, z))), new THREE.LineBasicMaterial({ color: 0xf3d27a })); g.add(l); }
  const pc = pil.flat().reduce((a, [x, z], _, A) => [a[0] + x / A.length, a[1] + z / A.length], [0, 0]);
  ET("Parque Industrial Lagunero<br><small>área industrial OSM (real)</small>", pc[0], pc[1], 120, "ciudad", "#f3d27a");
  for (const l of C.lugares) if (["city", "town"].includes(l[1])) ET(l[0], l[2], l[3], 260, "ciudad", "#4aa8ff");
  for (const [n, x, z] of C.colonias) ET("Col. " + n + "<br><small>ubicación aprox. (OSM)</small>", x, z, 70, "colonia", "#ff8a3d");

  // Río Nazas (OSM) — cauce + flujo hacia aguas abajo
  const nazas = C.nazas.map(dec);
  const mCauce = new THREE.MeshStandardMaterial({ color: 0x3b4a52, roughness: 1, emissive: 0x0a2233, transparent: true, opacity: .95 });
  g.add(new THREE.Mesh(cintas(nazas, 70, .08), mCauce));
  const rio = new THREE.Group(); g.add(rio); nazas.forEach((p) => rio.add(tubo(p, .6, 9, 0x2f8dff, .9, 60)));
  { const L = nazas.map((p) => [p, largo(p)]).sort((a, b) => b[1] - a[1])[0][0]; const m = enLinea(L, largo(L) * .42).p; ET("Río Nazas<br><small>trazo OSM (real)</small>", m[0], m[1], 60, "ciudad", "#2f8dff"); }
  // Canales, drenes y arroyos (OSM)
  const canales = C.canales.map((c) => ({ ...c, pts: dec(c.p) }));
  const gCan = new THREE.Group(); g.add(gCan);
  for (const c of canales) { if (c.t === "canal") gCan.add(tubo(c.pts, .5, 5, 0x3fd4c4, .9, 25)); }
  const nomC = {}; for (const c of canales) if (c.n && c.t === "canal" && !nomC[c.n]) { nomC[c.n] = 1; const L = largo(c.pts); if (L > 600) { const m = enLinea(c.pts, L / 2).p; ET(c.n + "<br><small>canal OSM</small>", m[0], m[1], 40, "ciudad", "#3fd4c4"); } }
  // Vía férrea y aeropuertos
  const mRail = new THREE.LineDashedMaterial({ color: 0x9aa3ab, dashSize: 14, gapSize: 8 });
  const rail = new THREE.LineSegments(lineas(C.rail.map(dec), 1.2), mRail); rail.computeLineDistances(); g.add(rail);
  for (const a of C.aero) if (a.t === "runway") g.add(new THREE.Mesh(cintas([dec(a.p)], 45, .1), new THREE.MeshBasicMaterial({ color: 0x5a5f66 })));
  for (const a of C.aero) if (a.t === "aerodrome" && a.n) { const p = dec(a.p); const m = p.reduce((s, [x, z]) => [s[0] + x / p.length, s[1] + z / p.length], [0, 0]); ET("✈ " + a.n.replace("Aeropuerto Internacional De ", "Aeropuerto "), m[0], m[1], 80, "ciudad", "#9aa3ab"); }

  /* ───────────── Redes de agua ───────────── */
  const R = C.redes; const red = new THREE.Group(); red.name = "redes"; g.add(red);
  const capas = Object.fromEntries(Object.keys(REDES).map((k) => { const x = new THREE.Group(); x.name = k; red.add(x); return [k, x]; }));
  const hex = (k) => new THREE.Color(REDES[k].c).getHex();
  const marca = (k, x, z, h, r = 6, forma = "pin") => { const gg = new THREE.Group(); const c = hex(k);
    const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .6, roughness: .4 });
    if (forma === "tanque") { gg.add(PM(new THREE.CylinderGeometry(.8, .8, h, 8), m, 0, h / 2, 0)); gg.add(PM(new THREE.CylinderGeometry(r, r * .7, r * 1.2, 16), m, 0, h + r * .6, 0)); }
    else if (forma === "pozo") { gg.add(PM(new THREE.CylinderGeometry(r, r, 3, 12), m, 0, 1.5, 0)); gg.add(PM(new THREE.BoxGeometry(r * 1.6, 5, r * 1.6), m, 0, 5.5, 0)); }
    else { gg.add(PM(new THREE.CylinderGeometry(.6, .6, h, 6), m, 0, h / 2, 0)); gg.add(PM(new THREE.SphereGeometry(r, 16, 12), m, 0, h, 0)); }
    gg.position.set(x, 0, z); return gg; };
  const prof = { potable: -9, sanitario: -24, industrial: -17, pluvial: -13, tratada: -6, recarga: -8 }; // diámetros y profundidades exagerados para lectura
  const ACU = -45; // acuífero esquemático
  // 1) agua potable
  const fuentes = C.infra.filter((i) => i.t === "obra_hidraulica"); const tanques = C.infra.filter((i) => /tanque/.test(i.t));
  for (const p of R.potable) capas.potable.add(tubo(dec(p.p), prof.potable, p.nivel === "conduccion" ? 7 : 4, 0x3c8cff, 1, p.nivel === "conduccion" ? 45 : 30));
  for (const f of fuentes) { capas.potable.add(marca("potable", f.x, f.z, 0, 5, "pozo")); capas.potable.add(vtubo(f.x, f.z, ACU, 0, 4, 0x3c8cff, 12));
  }
  ET("Obra hidráulica / pozo<br><small>punto OSM (real) · función de fuente: referencial</small>", R.tour.pozo[0], R.tour.pozo[1], 45, "potable", REDES.potable.c);
  for (const t of tanques) { capas.potable.add(marca("potable", t.x, t.z, 22, 6, "tanque")); }
  ET("Tanque elevado<br><small>OSM (real)</small>", R.tanquePIL[0], R.tanquePIL[1], 50, "potable", REDES.potable.c);
  // 2) drenaje sanitario
  const colect = Object.entries(R.colectores).map(([id, c]) => ({ id, nombre: c.nombre, pts: dec(c.p), c: c.c }));
  const tubC = {};
  for (const c of colect) { const t = tubo(c.pts, prof.sanitario, 9, 0xff8a3d); tubC[c.id] = t; capas.sanitario.add(t); }
  const emisor = dec(R.emisor); capas.sanitario.add(tubo(emisor, prof.sanitario - 2, 12, 0xff5a1f, 1, 55));
  { const m = enLinea(emisor, largo(emisor) * .5).p; ET("Emisor a la PTAR", m[0], m[1], 40, "sanitario", "#ff5a1f"); }
  const subs = R.subs.map(dec); for (const s of subs) capas.sanitario.add(tubo(s, prof.sanitario + 8, 4, 0xf3d27a, .95, 30));
  { // descargas domiciliarias instanciadas a lo largo de los subcolectores
    const geoD = new THREE.CylinderGeometry(.45, .45, 1, 6); geoD.rotateZ(Math.PI / 2); const lst = [];
    for (const s of subs) { const L = largo(s); for (let d = 15; d < L; d += 30) { const { p, dir } = enLinea(s, d); lst.push([p, dir]); } }
    const D = new THREE.InstancedMesh(geoD, new THREE.MeshBasicMaterial({ color: 0xd8b26a, transparent: true, opacity: .9 }), lst.length * 2); let k = 0;
    for (const [p, dir] of lst) for (const lado of [-1, 1]) { const ang = Math.atan2(-dir[1], dir[0]);
      o.position.set(p[0] - dir[1] * lado * 9, -8, p[1] + dir[0] * lado * 9); o.rotation.set(0, ang + Math.PI / 2, -.5 * lado); o.scale.set(18, 2.5, 2.5); o.updateMatrix(); D.setMatrixAt(k++, o.matrix); }
    o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); capas.sanitario.add(D);
    const pz = []; for (const c of colect) { const L = largo(c.pts); for (let d = 0; d < L; d += 100) pz.push(enLinea(c.pts, d).p); }
    const P = new THREE.InstancedMesh(new THREE.CylinderGeometry(2, 2, 24, 8), new THREE.MeshStandardMaterial({ color: 0x9aa3ab, emissive: 0x332211 }), pz.length);
    pz.forEach(([x, z], i) => { o.position.set(x, -12, z); o.updateMatrix(); P.setMatrixAt(i, o.matrix); }); capas.sanitario.add(P);
  }
  // 3) drenaje industrial del PIL
  const ind = R.industrial.map(dec); for (const s of ind) capas.industrial.add(tubo(s, prof.industrial, 6, 0xe0457b, 1, 35));
  { const s = ind[R.tour.k]; ET("Colector industrial PIL → Nodo", s[0][0], s[0][1], 40, "industrial", REDES.industrial.c); }
  // 4) pluvial: drenes/arroyos OSM + colectores pluviales referenciales al Nazas
  for (const c of canales) if (c.t !== "canal") capas.pluvial.add(tubo(c.pts, .4, 4, 0x7fe0c8, .9, 20));
  for (const p of R.pluvial) capas.pluvial.add(tubo(dec(p), prof.pluvial, 7, 0x7fe0c8, 1, 30));
  { const p = dec(R.pluvial[0]); const m = p[p.length - 1]; ET("Desfogue pluvial al Nazas<br><small>referencial</small>", m[0], m[1], 35, "pluvial", REDES.pluvial.c); }
  // 5) agua tratada / reúso (morado)
  for (const s of R.reuso_ind) capas.tratada.add(tubo(dec(s), prof.tratada, 5, 0xa35bff, 1, 35));
  const riego = dec(R.riego); capas.tratada.add(tubo(riego, prof.tratada, 6, 0xa35bff, 1, 35));
  const nzD = dec(R.nazas_desc); capas.tratada.add(tubo(nzD, prof.tratada, 6, 0xc58bff, 1, 35));
  { const m = riego[riego.length - 1]; ET("Toma a riego ejidal · " + R.riego_canal + "<br><small>conexión referencial</small>", m[0], m[1], 45, "tratada", REDES.tratada.c);
    const q = nzD[nzD.length - 1]; ET("Descarga al Nazas<br><small>REFERENCIAL · cumplir NOM-001-SEMARNAT-2021</small>", q[0], q[1], 45, "tratada", "#c58bff", true);
    const s = dec(R.reuso_ind[0]); const r = s[Math.floor(s.length * .7)]; ET("Reúso industrial (agua tratada)", r[0], r[1], 45, "tratada", REDES.tratada.c); }
  // 6) recarga al acuífero: pozos PI-803 del predio (doc) + capa de acuífero esquemática
  const pozosI = (sitio || []).map(([x, z]) => [x, z]);
  for (const [x, z] of pozosI) { capas.recarga.add(vtubo(x, z, 0, ACU, 1.5, 0x36d6ff, 12)); }
  const acu = new THREE.Mesh(new THREE.BoxGeometry(3600, 6, 3600), new THREE.MeshStandardMaterial({ color: 0x1d5f8a, emissive: 0x0b2c44, transparent: true, opacity: .14, depthWrite: false }));
  acu.position.set(-1000, ACU - 3, 1200); capas.recarga.add(acu);
  ET("Recarga · 4 pozos de infiltración<br><small>número: documento · ubicación: supuesto S-14</small>", 95, -20, 30, "recarga", REDES.recarga.c, true);
  ET("Acuífero (esquemático)", -1000, 1200, ACU, "recarga", REDES.recarga.c);
  // Infraestructura OSM restante (PTAR existente, bombeo)
  for (const i of C.infra) { if (i.t === "ptar") { red.add(marca("sanitario", i.x, i.z, 30, 8)); ET("PTAR existente<br><small>OSM man_made=wastewater_plant (real)</small>", i.x, i.z, 50, "sanitario", "#ff5a1f"); }
    if (i.t === "bombeo") { red.add(marca("potable", i.x, i.z, 18, 5)); ET("Estación de bombeo (OSM)", i.x, i.z, 30, "potable", REDES.potable.c); } }
  // Entradas y salidas del Nodo
  const [ex, ez] = R.entrada, [sx, sz] = R.salida;
  ET("⬇ Entrada de agua cruda → cárcamo TK-101", ex, ez, 28, "nodo", "#ff8a3d", true); ET("⬆ Salida de agua tratada", sx, sz, 28, "nodo", "#a35bff", true);

  function xray(on, nivel) {
    sueloMat.opacity = nivel ?? (on ? .35 : 1); sueloMat.depthWrite = !on && nivel == null;
    for (const m of [mB, mE]) { m.opacity = on ? .16 : 1; m.depthWrite = !on; }
    matsV.forEach((m, i) => (m.opacity = on ? .45 : i < 2 ? .95 : .85)); mCauce.opacity = on ? .5 : .95;
    red.traverse((m) => { if (m.material?.uniforms) m.material.uniforms.uOp.value = on ? 1 : .4; });
  }
  xray(false);
  function capa(k, on) { capas[k].visible = on; }
  function resaltar(k) { red.traverse((m) => { if (m.material?.uniforms) m.material.uniforms.uRes.value = 0; }); if (k) capas[k]?.traverse((m) => { if (m.material?.uniforms) m.material.uniforms.uRes.value = .25; }); }

  /* ───── Forma de trabajo por tramos cortos sobre C-1 (desde el Nodo hacia aguas arriba) ───── */
  const c1 = colect.find((c) => c.id === "C-1");
  const ruta = [...c1.pts].reverse(); const clsR = [...c1.c].reverse();
  const Lr = largo(ruta); const TR = 150; const N = Math.min(30, Math.ceil(Lr / TR));
  const cruces = R.cruces;
  const tramos = [];
  for (let i = 0; i < N; i++) {
    const d0 = i * TR, d1 = Math.min(Lr, d0 + TR); const a = enLinea(ruta, d0), b = enLinea(ruta, d1); const m = enLinea(ruta, (d0 + d1) / 2);
    let tipo = "colonia", nota = "Calle de colonia: tramo corto, se abre, se instala y se tapa el mismo día";
    const cr = cruces.find(([x, z]) => Math.hypot(m.p[0] - x, m.p[1] - z) < 95);
    if (cr) { tipo = "sinzanja"; nota = cr[2] + " (cruce real OSM): perforación sin zanja"; }
    else if (clsR[m.i] === 0) { tipo = "avenida"; nota = "Vialidad primaria (OSM): trabajo nocturno para no cerrar el tráfico de día"; }
    tramos.push({ i, a: a.p, b: b.p, dir: m.dir, c: m.p, len: d1 - d0, tipo, nota });
  }
  const obra = new THREE.Group(); obra.visible = false; g.add(obra);
  const mat = {
    zanja: new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 1, emissive: 0x1a0d05, side: THREE.BackSide, depthTest: false }),
    borde: new THREE.LineBasicMaterial({ color: 0xffb547 }),
    tierra: new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 1 }),
    tubo: new THREE.MeshStandardMaterial({ color: 0xd9dde0, metalness: .3, roughness: .4, emissive: 0x112233 }),
    hecho: new THREE.MeshStandardMaterial({ color: 0xff8a3d, emissive: 0x552200 }),
    parche: new THREE.MeshStandardMaterial({ color: 0x3fd46b, emissive: 0x1d6b33, transparent: true, opacity: .8 }),
    amarillo: new THREE.MeshStandardMaterial({ color: 0xf2c230, metalness: .3, roughness: .5 }),
    gris: new THREE.MeshStandardMaterial({ color: 0x3b4450, metalness: .5, roughness: .5 }),
    cono: new THREE.MeshStandardMaterial({ color: 0xff6a1a, emissive: 0x401000 }),
  };
  // zanja: caja abierta vista por dentro (BackSide) para que se lea como hueco
  const zanja = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat.zanja); obra.add(zanja);
  const zBorde = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), mat.borde); obra.add(zBorde);
  const monton = new THREE.Mesh(new THREE.CylinderGeometry(.5, 1, 1, 4, 1).rotateY(Math.PI / 4), mat.tierra); obra.add(monton);
  const tuboN = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16).rotateZ(Math.PI / 2), mat.tubo); obra.add(tuboN);
  const parche = new THREE.Mesh(new THREE.BoxGeometry(1, .2, 1), mat.parche); obra.add(parche);
  const fosas = [0, 1].map(() => { const f = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 5), mat.zanja); obra.add(f); return f; });
  const exc = new THREE.Group(); exc.add(PM(new THREE.BoxGeometry(5, 1.2, 3.4), mat.gris, 0, .6, 0));
  exc.add(PM(new THREE.BoxGeometry(3.6, 2.6, 3), mat.amarillo, -.4, 2.5, 0));
  const brazo = new THREE.Group(); brazo.position.set(1.2, 3.2, 0);
  brazo.add(PM(new THREE.BoxGeometry(6, .6, .6), mat.amarillo, 3, 0, 0));
  const ante = new THREE.Group(); ante.position.set(6, 0, 0); ante.add(PM(new THREE.BoxGeometry(.5, 4, .5), mat.amarillo, 0, -2, 0));
  ante.add(PM(new THREE.BoxGeometry(1.4, 1, 1.2), mat.gris, 0, -4.2, 0)); brazo.add(ante); exc.add(brazo); obra.add(exc);
  const perf = new THREE.Group(); perf.add(PM(new THREE.BoxGeometry(7, 2, 2.6), mat.amarillo, 0, 1, 0));
  perf.add(PM(new THREE.BoxGeometry(6, .5, .5), mat.gris, 1, 2.6, 0, -.3)); obra.add(perf);
  const conos = new THREE.InstancedMesh(new THREE.ConeGeometry(.35, 1, 8), mat.cono, 60); obra.add(conos);
  const torres = [0, 1].map(() => { const t = new THREE.Group(); t.add(PM(new THREE.CylinderGeometry(.15, .2, 9, 6), mat.gris, 0, 4.5, 0));
    const fo = new THREE.Mesh(new THREE.BoxGeometry(1.6, .8, .4), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2cc, emissiveIntensity: 2 })); fo.position.y = 9; t.add(fo);
    const l = new THREE.PointLight(0xfff0d0, 0, 120, 1.4); l.position.y = 9; t.add(l); t.userData.l = l; obra.add(t); return t; });
  const hechos = new THREE.Group(); obra.add(hechos); let nHechos = -1;
  const hechoSeg = tramos.map((t) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, t.len, 12).rotateZ(Math.PI / 2), mat.hecho); m.position.set(t.c[0], -4, t.c[1]); m.rotation.y = Math.atan2(-t.dir[1], t.dir[0]); m.visible = false; hechos.add(m); return m; });
  obra.traverse((m) => { m.renderOrder = 7; if (m.material && !m.isLight) m.material.transparent = true; }); // pasa después de las calles (transparentes) zanja.renderOrder = 5; fosas.forEach((f) => (f.renderOrder = 5));
  function colocar(obj, t, s, lado = 0, y = 0) {
    obj.position.set(t.a[0] + (t.b[0] - t.a[0]) * s - t.dir[1] * lado, y, t.a[1] + (t.b[1] - t.a[1]) * s + t.dir[0] * lado);
    obj.rotation.y = Math.atan2(-t.dir[1], t.dir[0]);
  }
  function caja3(obj, t, s0, s1, ancho, y0, y1, lado = 0) {
    const L = t.len * Math.max(.001, s1 - s0); colocar(obj, t, (s0 + s1) / 2, lado, (y0 + y1) / 2); obj.scale.set(L, Math.max(.01, y1 - y0), ancho);
  }
  function forma(j) {
    const i = Math.min(N - 1, Math.floor(j)); const f = j >= N ? 1 : j - i; const t = tramos[i];
    if (nHechos !== i) { hechoSeg.forEach((m, k) => (m.visible = k < i)); nHechos = i; }
    hechoSeg[i].visible = f >= 1; tubC["C-1"].visible = false;
    const sz = t.tipo === "sinzanja"; let paso;
    [zanja, zBorde, monton, exc].forEach((x) => (x.visible = !sz)); [perf, ...fosas].forEach((x) => (x.visible = sz));
    if (!sz) {
      const ab = Math.min(1, f / .3), fill = Math.max(0, (f - .65) / .35);
      caja3(zanja, t, 0, ab, 3, -4.6, -.1 - fill * 4.4); zanja.visible = fill < 1;
      caja3(zBorde, t, 0, ab, 3, .25, .25); zBorde.scale.y = 1; zBorde.visible = fill < 1;
      caja3(monton, t, 0, ab, 3.2, 0, 2.2 * (1 - fill), 4.6); monton.visible = fill < 1;
      colocar(exc, t, Math.min(.98, f < .3 ? ab : f < .65 ? .5 + (f - .3) : 1 - fill), -4.8); brazo.rotation.z = -.35 + .25 * Math.sin(j * 40);
      paso = f < .3 ? "1 · Abrir zanja" : f < .65 ? "2 · Instalar tubería" : f < 1 ? "3 · Tapar y reponer pavimento" : "Tramo cerrado el mismo día";
    } else {
      colocar(fosas[0], t, 0, 0, -2.4); colocar(fosas[1], t, 1, 0, -2.4); colocar(perf, t, -.02, 0, 0);
      paso = f < .1 ? "1 · Fosas de entrada y salida" : f < .9 ? "2 · Perforación y empuje sin zanja" : "3 · Conexión y cierre de fosas";
    }
    const tl = sz ? Math.min(1, Math.max(0, (f - .1) / .8)) : Math.min(1, Math.max(0, (f - .3) / .35));
    caja3(tuboN, t, 0, tl, 1, -4, -4); tuboN.scale.y = 1; tuboN.scale.z = 1; tuboN.visible = tl > 0 && f < 1;
    caja3(parche, t, 0, 1, 3.4, .12, .32); parche.visible = !sz && f >= .65; parche.material.opacity = f >= 1 ? .35 : .85;
    let k = 0; if (f < 1) for (let s = 0; s <= 1.0001; s += .05) for (const lado of [-2.8, 2.8]) { colocar(o, t, s, lado, .5); o.scale.set(1, 1, 1); o.updateMatrix(); conos.setMatrixAt(k++, o.matrix); }
    conos.count = k; conos.instanceMatrix.needsUpdate = true;
    const noche = t.tipo === "avenida" && f < 1;
    torres.forEach((tw, n) => { colocar(tw, t, n ? .85 : .15, 6.5); tw.visible = noche; tw.userData.l.intensity = noche ? 3000 : 0; });
    return { i, N, t, f, paso, noche };
  }
  function enForma(on) { obra.visible = on; tubC["C-1"].visible = !on; if (!on) { hechoSeg.forEach((m) => (m.visible = false)); nHechos = -1; } }

  /* ───── Recorrido del agua: trayectorias por etapa ───── */
  const T = R.tour;
  const rutas = {
    conduccion: dec(T.conduccion), distribucion: dec(T.distribucion), descarga: dec(T.descarga),
    reuso: dec(R.reuso_ind[0]), riego, nazas: nzD, pozo: T.pozo, tanque: T.tanque, industria: T.industria, colector: c1.pts,
  };
  return { grupo: g, red, capas, capa, resaltar, xray, forma, enForma, tramos, N, etiquetas, uT, folleto, cargarFolleto, rutas, prof, ACU, pozosI, emisor };
}
