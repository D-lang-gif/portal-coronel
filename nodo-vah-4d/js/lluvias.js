// Nodo VAH 4D · capa «Lluvias y campo» (propuesta).
// REAL (OSM): trazo del Canal de Sacramento. REFERENCIAL: línea morada por el bordo, parcelas, vasos de retención y lluvia animada.
import * as THREE from "three";
import { dec, enLinea } from "./ciudad.js";

const largo = (p) => { let L = 0; for (let i = 0; i < p.length - 1; i++) L += Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]); return L; };
function tubo(pts, y, r, mat) {
  const c = new THREE.CurvePath(); for (let k = 0; k < pts.length - 1; k++) { const a = new THREE.Vector3(pts[k][0], y, pts[k][1]), b = new THREE.Vector3(pts[k + 1][0], y, pts[k + 1][1]); if (a.distanceToSquared(b) > .01) c.add(new THREE.LineCurve3(a, b)); }
  if (!c.curves.length) return null; const m = new THREE.Mesh(new THREE.TubeGeometry(c, Math.min(900, Math.max(16, pts.length * 3)), r, 8, false), mat); if (mat.uniforms) mat.uniforms.uLen.value = c.getLength(); m.renderOrder = 9; return m;
}
function flujo(uT, color, vel = 140) {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT, uC: { value: new THREE.Color(color) }, uLen: { value: 100 }, uV: { value: vel } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uT; uniform vec3 uC; uniform float uLen; uniform float uV; varying vec2 vUv; void main(){ float s=vUv.x*uLen; float d=fract((s-uT*uV)/260.); float p=smoothstep(0.,.08,d)*(1.-smoothstep(.2,.45,d)); gl_FragColor=vec4(uC*(.6+1.6*p),.5+.5*p); }` });
}
const offset = (pts, off) => pts.map((p, i) => { const q = pts[Math.min(i + 1, pts.length - 1)], r = pts[Math.max(i - 1, 0)]; const dx = q[0] - r[0], dz = q[1] - r[1], l = Math.hypot(dx, dz) || 1; return [p[0] - dz / l * off, p[1] + dx / l * off]; });

export function crearLluvias(par, Cd, osm, uT) {
  const g = new THREE.Group(); g.visible = false; par.add(g); const etiquetas = []; const ET = (t, p, color, cerca) => etiquetas.push({ t, p, cat: "lluvias", color, cerca });
  const can = (osm.canales || []).filter((c) => c.t === "canal" && /sacramento/i.test(c.n || "")).map((c) => dec(c.p)).sort((a, b) => largo(b) - largo(a));
  const riego = Cd.rutas?.riego || [[0, 0], [-600, 300]]; const EJ = riego[riego.length - 1];
  let foco = EJ, moradaPts = null;
  if (can.length) {
    const mC = new THREE.MeshBasicMaterial({ color: 0x3fd4c4, transparent: true, opacity: .35, depthWrite: false });
    for (const c of can.slice(0, 6)) { const m = tubo(c, 2, 26, mC); m && g.add(m); }
    const C = can[0]; let iN = 0, dN = 1e12; C.forEach((p, i) => { const d = Math.hypot(p[0] - EJ[0], p[1] - EJ[1]); if (d < dN) { dN = d; iN = i; } });
    // sentido: tomar el lado más largo del canal a partir de la toma, hasta ~3.2 km
    const a = C.slice(iN), b = C.slice(0, iN + 1).reverse(); const lado = largo(a) >= largo(b) ? a : b;
    const sub = []; let acc = 0; sub.push(lado[0]); for (let i = 1; i < lado.length && acc < 3200; i++) { acc += Math.hypot(lado[i][0] - lado[i - 1][0], lado[i][1] - lado[i - 1][1]); sub.push(lado[i]); }
    const bordo = offset(sub, 45); const morada = [...riego, ...bordo]; moradaPts = morada;
    const mm = tubo(morada, 10, 11, flujo(uT, "#a35bff")); mm && g.add(mm);
    const Lb = largo(bordo); const pm = enLinea(bordo, Lb * .45).p;
    ET("🟣 Línea morada · agua tratada del Nodo<br><small>por el bordo / derecho de vía, no dentro del canal · trazo referencial · permisos por gestionar</small>", new THREE.Vector3(pm[0], 90, pm[1]), "#a35bff");
    const mP = new THREE.MeshBasicMaterial({ color: 0x5fbf4a, transparent: true, opacity: .45, depthWrite: false, side: THREE.DoubleSide });
    for (let k = 0; k < 4; k++) { const { p, dir } = enLinea(bordo, Lb * (.55 + k * .14)); const pl = new THREE.Mesh(new THREE.PlaneGeometry(320, 220).rotateX(-Math.PI / 2), mP);
      pl.position.set(p[0] - dir[1] * 260, 1.5, p[1] + dir[0] * 260); pl.rotation.y = Math.atan2(-dir[1], dir[0]); g.add(pl); }
    const pe = enLinea(bordo, Lb * .76); ET("🌾 Parcelas ejidales<br><small>ubicación referencial</small>", new THREE.Vector3(pe.p[0] - pe.dir[1] * 260, 60, pe.p[1] + pe.dir[0] * 260), "#5fbf4a", true);
    const pc = enLinea(C, largo(C) * .2).p; ET("Canal de Sacramento · trazo OSM<br><small>rehabilitación Conagua km 0+000–13+440: tramos no ubicados en el visor</small>", new THREE.Vector3(pc[0], 60, pc[1]), "#3fd4c4");
    // vasos de retención pluvial en la orilla de la ciudad, del lado opuesto a las parcelas (referencial)
    const mV = new THREE.MeshStandardMaterial({ color: 0x2f7bff, emissive: 0x0a2a66, transparent: true, opacity: .75 }), mR = new THREE.MeshBasicMaterial({ color: 0xd9dde0 });
    for (let k = 0; k < 3; k++) { const { p, dir } = enLinea(bordo, Lb * (.25 + k * .3)); const x = p[0] + dir[1] * 340, z = p[1] - dir[0] * 340;
      const v = new THREE.Mesh(new THREE.CylinderGeometry(110, 90, 10, 32), mV); v.position.set(x, 5, z); g.add(v);
      const rj = new THREE.Mesh(new THREE.TorusGeometry(112, 5, 6, 32), mR); rj.rotation.x = Math.PI / 2; rj.position.set(x, 12, z); g.add(rj);
      if (k === 1) ET("🔵 Vaso de retención / captación pluvial<br><small>con rejas · ubicación referencial · sin infiltración en el piloto · recarga = fase futura (NOM-014-CONAGUA-2003, riesgo de arsénico)</small>", new THREE.Vector3(x, 80, z), "#2f7bff"); }
    foco = enLinea(bordo, Lb * .5).p;
  }
  // lluvia animada (ilustrativa)
  const N = 2200, pos = new Float32Array(N * 3); const R = 2600;
  for (let i = 0; i < N; i++) { pos[i * 3] = foco[0] + (Math.random() - .5) * R * 2; pos[i * 3 + 1] = Math.random() * 900; pos[i * 3 + 2] = foco[1] + (Math.random() - .5) * R * 2; }
  const gp = new THREE.BufferGeometry(); gp.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const lluvia = new THREE.Points(gp, new THREE.PointsMaterial({ color: 0x9fd0ff, size: 6, transparent: true, opacity: .55, depthWrite: false })); g.add(lluvia);
  function tick(dt) { if (!g.visible) return; const a = gp.attributes.position.array; for (let i = 1; i < a.length; i += 3) { a[i] -= dt * 420; if (a[i] < 0) a[i] += 900; } gp.attributes.position.needsUpdate = true; }
  return { g, etiquetas, tick, foco, morada: moradaPts };
}
