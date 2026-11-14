// Nodo VAH 4D · capa «Agua tratada y áreas verdes» (propuesta).
// OSM (real): puentes, parques y centrales de CFE. REFERENCIAL: derivaciones, línea Lerdo–Jabonoso (esquemática), pasos aéreos propuestos.
import * as THREE from "three";

const largo = (p) => { let L = 0; for (let i = 0; i < p.length - 1; i++) L += Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]); return L; };
function flujo(uT, color, vel = 140, op = 1) {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT, uC: { value: new THREE.Color(color) }, uLen: { value: 100 }, uV: { value: vel }, uO: { value: op } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uT; uniform vec3 uC; uniform float uLen; uniform float uV; uniform float uO; varying vec2 vUv; void main(){ float s=vUv.x*uLen; float d=fract((s-uT*uV)/260.); float p=smoothstep(0.,.08,d)*(1.-smoothstep(.2,.45,d)); gl_FragColor=vec4(uC*(.6+1.6*p),(.5+.5*p)*uO); }` });
}
function tubo(pts, y, r, mat) {
  const c = new THREE.CurvePath(); for (let k = 0; k < pts.length - 1; k++) { const a = new THREE.Vector3(pts[k][0], y, pts[k][1]), b = new THREE.Vector3(pts[k + 1][0], y, pts[k + 1][1]); if (a.distanceToSquared(b) > .01) c.add(new THREE.LineCurve3(a, b)); }
  if (!c.curves.length) return null; const m = new THREE.Mesh(new THREE.TubeGeometry(c, Math.max(16, pts.length * 8), r, 8, false), mat); if (mat.uniforms) mat.uniforms.uLen.value = c.getLength(); m.renderOrder = 9; return m;
}
const dSeg = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz); };
const dLin = (p, L) => { let m = 1e12; for (let i = 0; i < L.length - 1; i++) m = Math.min(m, dSeg(p, L[i], L[i + 1])); return m; };

export function crearAguaTratada(par, uT, morada) {
  const g = new THREE.Group(); g.visible = false; par.add(g); const etiquetas = []; const ET = (t, p, color, cerca) => etiquetas.push({ t, p, cat: "agua", color, cerca });
  const A = window.AGUA_TRATADA; if (!A) return { g, etiquetas, foco: [0, 0] };
  // 1) línea existente PTAR Lerdo → CFE Jabonoso (esquemática)
  const J = A.jabonoso; const mJ = tubo(J, 12, 10, flujo(uT, "#c58bff", 120, .85)); mJ && g.add(mJ);
  const pj = J[1]; ET("Línea existente 16″ · PTAR Lerdo → CFE Jabonoso<br><small>11.2 km, hasta 100 L/s (SAPAL, 2013) · trazo esquemático · infraestructura existente, por inspeccionar; capacidad disponible por confirmar con SAPAL/CFE</small>", new THREE.Vector3(pj[0], 120, pj[1]), "#c58bff");
  ET("PTAR Lerdo<br><small>ubicación por confirmar</small>", new THREE.Vector3(J[0][0], 90, J[0][1]), "#c58bff", true);
  // 2) centrales de CFE (OSM)
  const mCFE = new THREE.MeshStandardMaterial({ color: 0xffe14a, emissive: 0x554800 });
  for (const [n, x, z] of A.cfe) { const c = new THREE.Mesh(new THREE.CylinderGeometry(40, 60, 150, 20), mCFE); c.position.set(x, 75, z); g.add(c); }
  // 3) derivaciones propuestas a parques (riego con NOM-003) y puntos verdes
  const mDer = flujo(uT, "#3fd46b", 110), mVerde = new THREE.MeshStandardMaterial({ color: 0x3fd46b, emissive: 0x0f4a1a });
  const ramales = [];
  for (const [tipo, n, x, z] of A.destinos) {
    const r = [[0, 0], [x * .5, 0], [x * .5, z], [x, z]]; ramales.push(r); const m = tubo(r, 9, 6, mDer); m && g.add(m);
    const arbol = new THREE.Group(); arbol.position.set(x, 0, z);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(5, 6, 40, 8), new THREE.MeshStandardMaterial({ color: 0x6b4a2a })); tr.position.y = 20; arbol.add(tr);
    const co = new THREE.Mesh(new THREE.SphereGeometry(34, 14, 10), mVerde); co.position.y = 62; co.scale.y = .7; arbol.add(co); arbol.scale.setScalar(1.5); g.add(arbol);
    ET(`🌳 ${n}<br><small>riego con agua tratada (NOM-003) · árboles nativos · propuesta</small>`, new THREE.Vector3(x, 150, z), "#3fd46b", true);
  }
  ET("Derivaciones propuestas a parques y camellones<br><small>trazo referencial · primero áreas verdes (NOM-003-SEMARNAT-1997), luego ejidos (NOM-001-SEMARNAT-2021)</small>", new THREE.Vector3(A.destinos[0][2] * .5, 110, A.destinos[0][3] * .5 - 200), "#3fd46b");
  // 4) pasos aéreos propuestos: puentes OSM cerca de la línea morada, la línea existente o las derivaciones
  const lineas = [morada || [], J, ...ramales].filter((l) => l.length > 1);
  const cand = A.puentes.filter(([n, x, z]) => lineas.some((l) => dLin([x, z], l) < 110));
  const usados = []; const mP = new THREE.MeshStandardMaterial({ color: 0xff9f1c, emissive: 0x552b00 });
  for (const [n, x, z] of cand) { if (usados.some(([a, b]) => Math.hypot(a - x, b - z) < 350) || usados.length >= 14) continue; usados.push([x, z, n]);
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(30), mP); m.position.set(x, 60, z); g.add(m);
    const an = new THREE.Mesh(new THREE.TorusGeometry(46, 5, 6, 24), mP); an.rotation.x = Math.PI / 2; an.position.set(x, 8, z); g.add(an);
    ET(`🌉 Paso aéreo propuesto${n ? " · " + n : ""}<br><small>puente OSM · solo agua tratada a presión · permiso del dueño del puente</small>`, new THREE.Vector3(x, 110, z), "#ff9f1c", true); }
  return { g, etiquetas, foco: [-1200, -600], pasos: usados.length };
}
