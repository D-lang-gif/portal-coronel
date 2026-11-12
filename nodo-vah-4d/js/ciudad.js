// Ciudad 3D (folleto histórico del PIL, pág. 13) + red de drenaje REFERENCIAL + forma de trabajo por tramos cortos.
// Todo lo que se dibuja aquí es ilustrativo: el Plan Integral de Drenaje aún no se ha cargado.
import * as THREE from "three";

const uT = { value: 0 };
function matFlujo(color, op = 1) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uT, uC: { value: new THREE.Color(color) }, uLen: { value: 100 }, uOp: { value: op } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uT; uniform vec3 uC; uniform float uLen; uniform float uOp; varying vec2 vUv;
      void main(){ float s=vUv.x*uLen; float d=fract((s-uT*40.)/90.); float p=smoothstep(0.,.1,d)*(1.-smoothstep(.25,.5,d));
      gl_FragColor=vec4(uC*(.6+1.6*p), (.55+.45*p)*uOp); }`,
  });
}
const PM = (geo, mat, x, y, z, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.z = rz; return m; };
const V = (p, y = 0) => new THREE.Vector3(p[0], y, p[1]);
function tubo(pts, y, r, color, op) {
  const path = new THREE.CurvePath(); let L = 0;
  for (let i = 0; i < pts.length - 1; i++) { const a = V(pts[i], y), b = V(pts[i + 1], y); path.add(new THREE.LineCurve3(a, b)); L += a.distanceTo(b); }
  const m = new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(4, Math.ceil(L / 25)), r, 10, false), matFlujo(color, op));
  m.material.uniforms.uLen.value = L; m.renderOrder = 4; m.userData.L = L; return m;
}
function largo(pts) { let L = 0; for (let i = 0; i < pts.length - 1; i++) L += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); return L; }
function enLinea(pts, d) { // punto y dirección a distancia d sobre la polilínea
  for (let i = 0; i < pts.length - 1; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[i + 1]; const l = Math.hypot(x1 - x0, z1 - z0);
    if (d <= l || i === pts.length - 2) { const t = Math.min(1, d / l); return { p: [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t], dir: [(x1 - x0) / l, (z1 - z0) / l] }; } d -= l; }
}

export function crearCiudad(scene, C) {
  const g = new THREE.Group(); g.name = "ciudad"; scene.add(g);
  const { ancho_m: AW, alto_m: AH, origen_uv: [u0, v0] } = C.meta;
  // Suelo con el mapa histórico (versión nocturna)
  const tex = new THREE.TextureLoader().load(C.textura); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const sueloMat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: .3, roughness: 1, color: 0x8899aa, transparent: true, opacity: 1 });
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(AW, AH), sueloMat); suelo.rotation.x = -Math.PI / 2;
  suelo.position.set((.5 - u0) * AW, -.6, (.5 - v0) * AH); suelo.receiveShadow = true; g.add(suelo);

  // Manzanas (huecos entre calles del mapa) e industria del PIL
  const caja = new THREE.BoxGeometry(1, 1, 1); caja.translate(0, .5, 0);
  const ven = (() => { const c = document.createElement("canvas"); c.width = 64; c.height = 64; const x = c.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, 64, 64);
    for (let yy = 6; yy < 60; yy += 14) for (let xx = 4; xx < 60; xx += 12) { x.fillStyle = Math.random() > .45 ? "#ffcf87" : "#1d2a3a"; x.fillRect(xx, yy, 7, 7); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const mB = new THREE.MeshStandardMaterial({ envMapIntensity: .25, color: 0xffffff, roughness: .8, metalness: .15, emissive: 0xffffff, emissiveMap: ven, emissiveIntensity: .55, transparent: true, opacity: 1 });
  const B = new THREE.InstancedMesh(caja, mB, C.B.length); const o = new THREE.Object3D(); const col = new THREE.Color();
  // se libera una franja de 35 m sobre los colectores (la calle por donde va la tubería)
  const segs = Object.values(C.colectores).flatMap((c) => c.pts.slice(0, -1).map((p, i) => [p, c.pts[i + 1]]));
  const dSeg = (x, z) => Math.min(...segs.map(([[ax, az], [bx, bz]]) => { const dx = bx - ax, dz = bz - az; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - ax - dx * t, z - az - dz * t); }));
  C.B.forEach(([x, z, w, d, h], i) => { o.position.set(x, 0, z); o.scale.set(w, h, d); if (dSeg(x, z) < 35) o.scale.set(0, 0, 0); o.updateMatrix(); B.setMatrixAt(i, o.matrix);
    const k = Math.min(1, h / 30); B.setColorAt(i, col.setHSL(.6 - k * .04, .14 + k * .15, .13 + k * .12)); });
  B.receiveShadow = true; g.add(B);
  const mI = new THREE.MeshStandardMaterial({ color: 0x6e5a48, roughness: .6, metalness: .4, emissive: 0x2a1006, transparent: true, opacity: 1 });
  const I = new THREE.InstancedMesh(caja, mI, C.I.length);
  C.I.forEach(([x, z, w, d, h], i) => { o.position.set(x, 0, z); o.scale.set(w, h, d); o.rotation.y = -.35; o.updateMatrix(); I.setMatrixAt(i, o.matrix); });
  o.rotation.y = 0; g.add(I);

  // Red de drenaje REFERENCIAL: colectores, subcolectores, descargas y pozos de visita (diámetros exagerados para lectura)
  const red = new THREE.Group(); red.name = "drenaje"; g.add(red);
  const capas = { colectores: new THREE.Group(), subcolectores: new THREE.Group(), descargas: new THREE.Group(), pozos: new THREE.Group() };
  Object.values(capas).forEach((c) => red.add(c));
  const tubC = {};
  for (const [id, c] of Object.entries(C.colectores)) { const t = tubo(c.pts, -5, 3.2, 0xff8a3d); tubC[id] = t; capas.colectores.add(t); }
  const subs = []; let s = 0;
  for (const [id, c] of Object.entries(C.colectores)) {
    const L = largo(c.pts);
    for (let d = 300; d < L - 150; d += 420) { const { p, dir } = enLinea(c.pts, d); const lado = (s++ % 2 ? 1 : -1); const n = [-dir[1] * lado, dir[0] * lado];
      const len = 320 + ((s * 137) % 330); const q = [p[0] + n[0] * len, p[1] + n[1] * len];
      subs.push([q, p]); capas.subcolectores.add(tubo([q, p], -3, 1.6, 0xf3d27a, .95)); }
  }
  // descargas domiciliarias (instanciadas)
  const nd = subs.reduce((a, [q, p]) => a + Math.floor(Math.hypot(p[0] - q[0], p[1] - q[1]) / 30) * 2, 0);
  const geoD = new THREE.CylinderGeometry(.5, .5, 1, 6); geoD.rotateZ(Math.PI / 2);
  const D = new THREE.InstancedMesh(geoD, new THREE.MeshBasicMaterial({ color: 0x2fd3e6, transparent: true, opacity: .9 }), nd); let k = 0;
  for (const [q, p] of subs) { const L = Math.hypot(p[0] - q[0], p[1] - q[1]); const dir = [(p[0] - q[0]) / L, (p[1] - q[1]) / L]; const ang = Math.atan2(-dir[1], dir[0]);
    for (let d = 15; d < L; d += 30) for (const lado of [-1, 1]) { const x = q[0] + dir[0] * d - dir[1] * lado * 9, z = q[1] + dir[1] * d + dir[0] * lado * 9;
      o.position.set(x, -2, z); o.rotation.set(0, ang + Math.PI / 2, -.12 * lado); o.scale.set(18, 1, 1); o.updateMatrix(); if (k < nd) D.setMatrixAt(k++, o.matrix); } }
  D.count = k; capas.descargas.add(D); o.rotation.set(0, 0, 0);
  // pozos de visita cada 100 m sobre colectores
  const pz = []; for (const c of Object.values(C.colectores)) { const L = largo(c.pts); for (let d = 0; d < L; d += 100) pz.push(enLinea(c.pts, d).p); }
  const P = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.1, 1.1, 5.2, 10), new THREE.MeshStandardMaterial({ color: 0x9aa3ab, emissive: 0x332211 }), pz.length);
  pz.forEach(([x, z], i) => { o.position.set(x, -2.4, z); o.scale.set(1, 1, 1); o.updateMatrix(); P.setMatrixAt(i, o.matrix); }); capas.pozos.add(P);

  const etiquetas = C.etiquetas.map((e) => ({ t: e.t, p: new THREE.Vector3(e.p[0], 90, e.p[1]) }));
  for (const [id, c] of Object.entries(C.colectores)) { const m = c.pts[Math.floor(c.pts.length / 2)]; etiquetas.push({ t: c.nombre + " (referencial)", p: new THREE.Vector3(m[0], 40, m[1]), red: true }); }

  function xray(on, nivel) {
    sueloMat.opacity = nivel ?? (on ? .45 : 1); sueloMat.depthWrite = !on && nivel == null;
    mB.opacity = on ? .2 : 1; mB.depthWrite = !on; mI.opacity = on ? .12 : 1; mI.depthWrite = !on;
    red.visible = true; red.traverse((m) => { if (m.material?.uniforms) m.material.uniforms.uOp.value = on ? 1 : .35; });
  }
  xray(false);

  /* ───── Forma de trabajo por tramos cortos sobre C-1 (de aguas abajo hacia aguas arriba) ───── */
  const ruta = [...C.colectores["C-1"].pts].reverse();
  const Lr = largo(ruta); const TR = 150; const N = Math.ceil(Lr / TR);
  const pAv = [C.colectores["C-1"].pts[1], C.colectores["C-1"].pts[2]]; // avenida céntrica (referencial)
  const cruces = [[(.315 - u0) * AW, (.495 - v0) * AH, "Cruce con vía férrea"], [(.272 - u0) * AW, (.32 - v0) * AH, "Cruce de bulevar"]];
  const tramos = [];
  for (let i = 0; i < N; i++) {
    const d0 = i * TR, d1 = Math.min(Lr, d0 + TR); const a = enLinea(ruta, d0), b = enLinea(ruta, d1); const m = enLinea(ruta, (d0 + d1) / 2);
    let tipo = "colonia", nota = "Colonia: tramo corto, se abre, se instala y se tapa el mismo día";
    const cr = cruces.find(([x, z]) => Math.hypot(m.p[0] - x, m.p[1] - z) < 160);
    const zAv = [Math.min(pAv[0][1], pAv[1][1]), Math.max(pAv[0][1], pAv[1][1])];
    if (cr) { tipo = "sinzanja"; nota = cr[2] + ": perforación sin zanja (referencial)"; }
    else if (m.p[1] >= zAv[0] && m.p[1] <= zAv[1]) { tipo = "avenida"; nota = "Avenida: trabajo nocturno para no cerrar el tráfico de día"; }
    tramos.push({ i, a: a.p, b: b.p, dir: m.dir, c: m.p, len: d1 - d0, tipo, nota });
  }
  const obra = new THREE.Group(); obra.visible = false; g.add(obra);
  const mat = {
    zanja: new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 1, transparent: true, opacity: .6, depthWrite: false, emissive: 0x1a0c04 }),
    borde: new THREE.LineBasicMaterial({ color: 0xffb547 }),
    tierra: new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 1 }),
    tubo: new THREE.MeshStandardMaterial({ color: 0xd9dde0, metalness: .3, roughness: .4, emissive: 0x112233 }),
    hecho: new THREE.MeshStandardMaterial({ color: 0xff8a3d, emissive: 0x552200 }),
    parche: new THREE.MeshStandardMaterial({ color: 0x3fd46b, emissive: 0x1d6b33, transparent: true, opacity: .8 }),
    amarillo: new THREE.MeshStandardMaterial({ color: 0xf2c230, metalness: .3, roughness: .5 }),
    gris: new THREE.MeshStandardMaterial({ color: 0x3b4450, metalness: .5, roughness: .5 }),
    cono: new THREE.MeshStandardMaterial({ color: 0xff6a1a, emissive: 0x401000 }),
  };
  // piezas reutilizables
  const zanja = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat.zanja); obra.add(zanja);
  const zBorde = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), mat.borde); obra.add(zBorde);
  const monton = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat.tierra); obra.add(monton);
  const tuboN = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16).rotateZ(Math.PI / 2), mat.tubo); obra.add(tuboN);
  const parche = new THREE.Mesh(new THREE.BoxGeometry(1, .2, 1), mat.parche); obra.add(parche);
  const fosas = [0, 1].map(() => { const f = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 5), mat.zanja); obra.add(f); return f; });
  // excavadora
  const exc = new THREE.Group(); exc.add(PM(new THREE.BoxGeometry(5, 1.2, 3.4), mat.gris, 0, .6, 0));
  exc.add(PM(new THREE.BoxGeometry(3.6, 2.6, 3), mat.amarillo, -.4, 2.5, 0));
  const brazo = new THREE.Group(); brazo.position.set(1.2, 3.2, 0);
  brazo.add(PM(new THREE.BoxGeometry(6, .6, .6), mat.amarillo, 3, 0, 0));
  const ante = new THREE.Group(); ante.position.set(6, 0, 0); ante.add(PM(new THREE.BoxGeometry(.5, 4, .5), mat.amarillo, 0, -2, 0));
  ante.add(PM(new THREE.BoxGeometry(1.4, 1, 1.2), mat.gris, 0, -4.2, 0)); brazo.add(ante); exc.add(brazo); obra.add(exc);
  // perforadora (sin zanja)
  const perf = new THREE.Group(); perf.add(PM(new THREE.BoxGeometry(7, 2, 2.6), mat.amarillo, 0, 1, 0));
  perf.add(PM(new THREE.BoxGeometry(6, .5, .5), mat.gris, 1, 2.6, 0, -.3)); obra.add(perf);
  // conos y torres de luz
  const conos = new THREE.InstancedMesh(new THREE.ConeGeometry(.35, 1, 8), mat.cono, 60); obra.add(conos);
  const torres = [0, 1].map(() => { const t = new THREE.Group(); t.add(PM(new THREE.CylinderGeometry(.15, .2, 9, 6), mat.gris, 0, 4.5, 0));
    const fo = new THREE.Mesh(new THREE.BoxGeometry(1.6, .8, .4), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2cc, emissiveIntensity: 2 })); fo.position.y = 9; t.add(fo);
    const l = new THREE.PointLight(0xfff0d0, 0, 120, 1.4); l.position.y = 9; t.add(l); t.userData.l = l; obra.add(t); return t; });
  // tramos terminados
  const hechos = new THREE.Group(); obra.add(hechos); let nHechos = -1;
  const hechoSeg = tramos.map((t) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, t.len, 12).rotateZ(Math.PI / 2), mat.hecho); m.position.set(t.c[0], -4, t.c[1]); m.rotation.y = Math.atan2(-t.dir[1], t.dir[0]); m.visible = false; hechos.add(m); return m; });

  function colocar(obj, t, s, lado = 0, y = 0) { // s: 0..1 a lo largo del tramo
    obj.position.set(t.a[0] + (t.b[0] - t.a[0]) * s - t.dir[1] * lado, y, t.a[1] + (t.b[1] - t.a[1]) * s + t.dir[0] * lado);
    obj.rotation.y = Math.atan2(-t.dir[1], t.dir[0]);
  }
  function caja3(obj, t, s0, s1, ancho, y0, y1, lado = 0) {
    const L = t.len * Math.max(.001, s1 - s0); colocar(obj, t, (s0 + s1) / 2, lado, (y0 + y1) / 2); obj.scale.set(L, Math.max(.01, y1 - y0), ancho);
  }
  // j: jornada continua (0..N). Devuelve estado para el HUD.
  function forma(j) {
    const i = Math.min(N - 1, Math.floor(j)); const f = j >= N ? 1 : j - i; const t = tramos[i];
    if (nHechos !== i) { hechoSeg.forEach((m, k) => (m.visible = k < i)); nHechos = i; }
    hechoSeg[i].visible = f >= 1;
    tubC["C-1"].visible = false;
    const sz = t.tipo === "sinzanja"; let paso;
    [zanja, zBorde, monton, exc].forEach((o) => (o.visible = !sz)); [perf, ...fosas].forEach((o) => (o.visible = sz));
    if (!sz) {
      const ab = Math.min(1, f / .3), fill = Math.max(0, (f - .65) / .35);
      caja3(zanja, t, 0, ab, 3, -4.6 + fill * 4.0, -.45); zBorde.position.copy(zanja.position); zBorde.rotation.copy(zanja.rotation); zBorde.scale.copy(zanja.scale);
      zanja.visible = zBorde.visible = fill < 1;
      caja3(monton, t, 0, ab, 2.6, 0, 1.6 * (1 - fill), 4.2); monton.visible = fill < 1;
      colocar(exc, t, Math.min(.98, f < .3 ? ab : f < .65 ? .5 + (f - .3) : 1 - fill), -4.5); brazo.rotation.z = -.35 + .25 * Math.sin(j * 40);
      paso = f < .3 ? "1 · Abrir zanja" : f < .65 ? "2 · Instalar tubería" : f < 1 ? "3 · Tapar y reponer pavimento" : "Tramo cerrado el mismo día";
    } else {
      colocar(fosas[0], t, 0, 0, -2.4); colocar(fosas[1], t, 1, 0, -2.4); colocar(perf, t, -.02, 0, 0);
      paso = f < .1 ? "1 · Fosas de entrada y salida" : f < .9 ? "2 · Perforación y empuje sin zanja" : "3 · Conexión y cierre de fosas";
    }
    const tl = sz ? Math.min(1, Math.max(0, (f - .1) / .8)) : Math.min(1, Math.max(0, (f - .3) / .35));
    caja3(tuboN, t, 0, tl, 1, -4, -4); tuboN.scale.y = 1; tuboN.scale.z = 1; tuboN.visible = tl > 0 && f < 1;
    caja3(parche, t, 0, 1, 3.4, .12, .32); parche.visible = !sz && f >= .65; parche.material.opacity = f >= 1 ? .35 : .85;
    // conos
    let k = 0; if (f < 1) for (let s = 0; s <= 1.0001; s += .05) for (const lado of [-2.6, 2.6]) { colocar(o, t, s, lado, .5); o.scale.set(1, 1, 1); o.updateMatrix(); conos.setMatrixAt(k++, o.matrix); }
    conos.count = k; conos.instanceMatrix.needsUpdate = true;
    const noche = t.tipo === "avenida" && f < 1;
    torres.forEach((tw, n) => { colocar(tw, t, n ? .85 : .15, 6); tw.visible = noche; tw.userData.l.intensity = noche ? 3000 : 0; });
    return { i, N, t, f, paso, noche };
  }
  function enForma(on) { obra.visible = on; tubC["C-1"].visible = !on; if (!on) { hechoSeg.forEach((m) => (m.visible = false)); nHechos = -1; } }
  return { grupo: g, red, capas, xray, forma, enForma, tramos, N, etiquetas, uT, AW, AH };
}
