// Relieve real (DEM Terrarium, AWS Open Data). Solo se levantan cerros y lomas; el valle queda plano bajo la ciudad.
import * as THREE from "three";
export function crearRelieve(par) {
  const R = window.RELIEVE; if (!R) return null;
  const bin = atob(R.b64); const h = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) h[i] = bin.charCodeAt(i);
  const W = (R.nx - 1) * R.paso, D = (R.nz - 1) * R.paso;
  const geo = new THREE.PlaneGeometry(W, D, R.nx - 1, R.nz - 1); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position; const col = new Float32Array(pos.count * 3); const base = new Float32Array(pos.count);
  const c0 = new THREE.Color(0x3b3426), c1 = new THREE.Color(0x8a6f4a), c2 = new THREE.Color(0xd8c8a8), c = new THREE.Color();
  for (let j = 0; j < R.nz; j++) for (let i = 0; i < R.nx; i++) { const k = j * R.nx + i; const m = h[k] * R.escala_m; base[k] = m;
    const t = Math.min(1, m / 300); c.copy(c0).lerp(c1, Math.min(1, t * 2)); if (t > .5) c.lerp(c2, (t - .5) * 2); col.set([c.r, c.g, c.b], k * 3); }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0, flatShading: false }));
  mesh.position.set(R.x0 + W / 2, 0, R.z0 + D / 2); mesh.receiveShadow = false; mesh.visible = false; par.add(mesh);
  function escala(k) { mesh.visible = k > 0; if (!k) return; for (let i = 0; i < pos.count; i++) pos.setY(i, base[i] > 0 ? base[i] * k : -3); pos.needsUpdate = true; geo.computeVertexNormals(); }
  return { mesh, escala };
}
