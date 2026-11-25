/* Modo planeación de colectores — anteproyecto (no sustituye topografía ni plano oficial). */
const BANNER = "Anteproyecto de planeación — requiere topografía de campo y plano oficial de SIDEAPA/CAED";
const CUBRIMIENTO = 0.90; // m sobre la clave, tráfico vehicular (MAPAS / Obras accesorias)
const H_PROFUNDA = 5.0;   // m a plantilla: aviso de constructibilidad
const H_CARCAMO = 6.0;    // m: se sugiere cárcamo si la gravedad obliga a ir más hondo
const Y_REL = 0.75;
const VMIN = 0.30;
const DEFLEXION_POZO = 5; // grados: cambio de dirección que exige pozo (MAPAS: todos los cambios)
const Q_DEFECTO = 24;     // L/s, centro del rango piloto 19–29
const N_DEFECTO = { pvc: 0.009, pead: 0.010, concreto: 0.013 };

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function fmt1(x, d = 1) { return Number.isFinite(x) ? Number(x).toFixed(d) : "—"; }
function fmt2(x) { return fmt1(x, 2); }
function mil(x) { return Number.isFinite(x) ? (x * 1000).toFixed(2) : "—"; } // a ‰

/** Distancia geodésica WGS84 (Vincenty inversa, elipsoide). */
export function distanciaGeodesica(a, b) {
  const aR = 6378137, f = 1 / 298.257223563, bR = aR * (1 - f);
  const φ1 = (a.lat * Math.PI) / 180, φ2 = (b.lat * Math.PI) / 180;
  const L = ((b.lon - a.lon) * Math.PI) / 180;
  const tanU1 = (1 - f) * Math.tan(φ1), cosU1 = 1 / Math.sqrt(1 + tanU1 * tanU1), sinU1 = tanU1 * cosU1;
  const tanU2 = (1 - f) * Math.tan(φ2), cosU2 = 1 / Math.sqrt(1 + tanU2 * tanU2), sinU2 = tanU2 * cosU2;
  let λ = L, λp, iter = 0, sinλ, cosλ, sinσ, cosσ, σ, sinα, cos2α, cos2σm, C;
  do {
    sinλ = Math.sin(λ); cosλ = Math.cos(λ);
    const t1 = cosU2 * sinλ, t2 = cosU1 * sinU2 - sinU1 * cosU2 * cosλ;
    sinσ = Math.sqrt(t1 * t1 + t2 * t2);
    if (sinσ === 0) return 0;
    cosσ = sinU1 * sinU2 + cosU1 * cosU2 * cosλ;
    σ = Math.atan2(sinσ, cosσ);
    sinα = (cosU1 * cosU2 * sinλ) / sinσ;
    cos2α = 1 - sinα * sinα;
    cos2σm = cos2α !== 0 ? cosσ - (2 * sinU1 * sinU2) / cos2α : 0;
    C = (f / 16) * cos2α * (2 + f * (4 - 3 * cos2α));
    λp = λ;
    λ = L + (1 - C) * f * sinα * (σ + C * sinσ * (cos2σm + C * cosσ * (-1 + 2 * cos2σm * cos2σm)));
  } while (Math.abs(λ - λp) > 1e-12 && ++iter < 100);
  if (iter >= 100) {
    const R = 6378137, p1 = φ1, p2 = φ2, dλ = L;
    const h = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dλ / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  const u2 = (cos2α * (aR * aR - bR * bR)) / (bR * bR);
  const A = 1 + (u2 / 16384) * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)));
  const B = (u2 / 1024) * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));
  const dσ = B * sinσ * (cos2σm + (B / 4) * (cosσ * (-1 + 2 * cos2σm * cos2σm) -
    (B / 6) * cos2σm * (-3 + 4 * sinσ * sinσ) * (-3 + 4 * cos2σm * cos2σm)));
  return bR * A * (σ - dσ);
}

export function rumboDeg(a, b) {
  const φ1 = (a.lat * Math.PI) / 180, φ2 = (b.lat * Math.PI) / 180;
  const dλ = ((b.lon - a.lon) * Math.PI) / 180;
  const y = Math.sin(dλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  return (Math.atan2(y, x) * 180) / Math.PI;
}
function deflexion(p0, p1, p2) {
  let d = Math.abs(rumboDeg(p1, p2) - rumboDeg(p0, p1));
  while (d > 180) d = 360 - d;
  return d;
}

export function seccionCircular(D, y) {
  const yb = clamp(y, 1e-6, D);
  const arg = clamp(1 - (2 * yb) / D, -1, 1);
  const theta = 2 * Math.acos(arg);
  const A = (D * D / 8) * (theta - Math.sin(theta));
  const P = (D / 2) * theta;
  return { theta, A, P, R: A / Math.max(P, 1e-12), y: yb };
}

export function manning(D, n, S, yRel = Y_REL) {
  const { A, R } = seccionCircular(D, yRel * D);
  const Q = (1 / n) * A * Math.pow(R, 2 / 3) * Math.sqrt(Math.max(S, 0));
  return { Q, V: A > 0 ? Q / A : 0, A, R };
}

export function pendientePara(D, n, Q, yRel = Y_REL) {
  const { A, R } = seccionCircular(D, yRel * D);
  const k = (1 / n) * A * Math.pow(R, 2 / 3);
  const S = k > 0 ? (Q / k) ** 2 : Infinity;
  return { S, V: A > 0 ? Q / A : 0, A, R };
}

export function tiranteDe(D, n, S, Q) {
  if (!(D > 0) || !(n > 0) || !(S > 0) || !(Q > 0)) return { y: 0, yRel: 0, V: 0, A: 0, ok: false };
  const Qlleno = manning(D, n, S, 0.999).Q;
  if (Q > Qlleno * 1.001) return { y: D, yRel: 1, V: manning(D, n, S, 0.999).V, A: manning(D, n, S, 0.999).A, ok: false, saturado: true };
  let lo = 1e-5, hi = D - 1e-6, mid = D * 0.5;
  for (let i = 0; i < 40; i++) {
    mid = (lo + hi) / 2;
    const q = manning(D, n, S, mid / D).Q;
    if (q < Q) lo = mid; else hi = mid;
  }
  const y = (lo + hi) / 2;
  const h = manning(D, n, S, y / D);
  return { y, yRel: y / D, V: h.V, A: h.A, ok: true };
}

export function vmaxDe(material, D) {
  if (material === "concreto") return D <= 0.45 ? 3.0 : 3.5;
  return 5.0;
}
export function catalogoD(material) {
  if (material === "concreto") return [0.20, 0.25, 0.30, 0.38, 0.45, 0.61, 0.76, 0.91, 1.07, 1.22];
  return [0.20, 0.25, 0.315, 0.40, 0.45, 0.50, 0.63, 0.80, 1.00];
}
export function sepPozos(D) {
  if (D <= 0.61) return 125;
  if (D <= 1.22) return 150;
  return 175;
}

export function elegirDiametro({ Q, n, material, Snat }) {
  const avisos = [];
  let elegido = null;
  for (const D of catalogoD(material)) {
    const vmax = vmaxDe(material, D);
    const sMin = pendientePara(D, n, VMIN * seccionCircular(D, Y_REL * D).A, Y_REL).S;
    const sMax = pendientePara(D, n, vmax * seccionCircular(D, Y_REL * D).A, Y_REL).S;
    let S, razon;
    if (Number.isFinite(Snat) && Snat > 0) {
      if (Snat < sMin) { S = sMin; razon = "se aplica la pendiente mínima para mantener 0.30 m/s a ~75 % de tirante"; }
      else if (Snat > sMax) { S = sMax; razon = "la pendiente natural supera la máxima por velocidad; se propone la máxima y, si hace falta, pozos de caída"; }
      else { S = Snat; razon = "se sigue la pendiente natural del terreno, dentro de los límites de velocidad"; }
    } else {
      S = sMin;
      razon = "el terreno no baja en el sentido del trazo; se propone la pendiente mínima (revisar sentido o cárcamo)";
    }
    const cap = manning(D, n, S, Y_REL);
    const fill = tiranteDe(D, n, S, Q);
    const vOk = fill.ok && fill.V >= VMIN - 0.005 && fill.V <= vmax + 0.005;
    const capOk = cap.Q + 1e-8 >= Q && (!fill.saturado) && fill.yRel <= Y_REL + 0.02;
    if (capOk && vOk) {
      elegido = { D, n, material, S, sMin, sMax, Snat, razon, Qcap75: cap.Q, V75: cap.V, fill, vmax, cubrimiento: CUBRIMIENTO };
      break;
    }
  }
  if (!elegido) {
    const D = catalogoD(material).slice(-1)[0];
    const vmax = vmaxDe(material, D);
    const sMin = pendientePara(D, n, VMIN * seccionCircular(D, Y_REL * D).A, Y_REL).S;
    const S = Number.isFinite(Snat) && Snat > 0 ? clamp(Snat, sMin, pendientePara(D, n, vmax * seccionCircular(D, Y_REL * D).A, Y_REL).S) : sMin;
    const cap = manning(D, n, S, Y_REL);
    const fill = tiranteDe(D, n, S, Q);
    elegido = { D, n, material, S, sMin, sMax: pendientePara(D, n, vmax * seccionCircular(D, Y_REL * D).A, Y_REL).S, Snat, razon: "no hay diámetro comercial que cumpla a la vez capacidad a 75 % y el rango de velocidad; se muestra el mayor del catálogo", Qcap75: cap.Q, V75: cap.V, fill, vmax, cubrimiento: CUBRIMIENTO, insuficiente: true };
    avisos.push({ tipo: "capacidad", txt: "Ningún diámetro comercial del catálogo lleva el gasto de diseño a ~75 % de tirante con velocidad en rango. Revise el gasto, el material o considere un cárcamo / otro trazo." });
  }
  return { ...elegido, avisos };
}

function interpolar(p, q, t) {
  return { lat: p.lat + (q.lat - p.lat) * t, lon: p.lon + (q.lon - p.lon) * t };
}

export function densificarRuta(pts, paso = 30, maxN = 80) {
  if (pts.length === 0) return [];
  if (pts.length === 1) return [{ ...pts[0], s: 0, vertice: 0 }];
  const lens = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const L = Math.max(distanciaGeodesica(pts[i], pts[i + 1]), 0);
    lens.push(L); total += L;
  }
  const step = Math.max(paso, total / Math.max(1, maxN - pts.length));
  const out = [];
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) out.push({ lat: pts[0].lat, lon: pts[0].lon, s: 0, vertice: 0 });
    else {
      const L = lens[i - 1];
      const n = L > step ? Math.max(1, Math.round(L / step)) : 1;
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const p = interpolar(pts[i - 1], pts[i], t);
        const s = acc + L * t;
        out.push({ lat: p.lat, lon: p.lon, s, vertice: k === n ? i : null });
      }
      acc += L;
    }
  }
  return out;
}

export function perfilPlantilla(muestras, vertices, diseno) {
  const D = diseno.D, cub = diseno.cubrimiento, Sobj = diseno.S;
  const zT = (p) => p.z;
  // Profundidad de plantilla inicial: cubrimiento sobre la clave + diámetro
  const zP = new Array(muestras.length);
  zP[0] = zT(muestras[0]) - cub - D;
  for (let i = 1; i < muestras.length; i++) {
    const ds = muestras[i].s - muestras[i - 1].s;
    const sNat = ds > 0 ? (zT(muestras[i - 1]) - zT(muestras[i])) / ds : 0;
    let S = Sobj;
    if (sNat > diseno.sMax) S = diseno.sMax;
    else if (sNat >= diseno.sMin) S = sNat;
    else S = diseno.sMin; // contrapendiente o más tendido que el mínimo
    zP[i] = zP[i - 1] - S * ds;
  }
  // Si en algún punto el cubrimiento queda por debajo del mínimo, se ahonda el arranque
  let extra = 0;
  for (let i = 0; i < muestras.length; i++) {
    const zpNeed = zT(muestras[i]) - cub - D;
    const deficit = zP[i] - zpNeed; // >0 plantilla demasiado alta (poco cubrimiento)
    if (deficit > extra) extra = deficit;
  }
  if (extra > 0.005) for (let i = 0; i < zP.length; i++) zP[i] -= extra;
  const pts = muestras.map((p, i) => {
    const plantilla = zP[i];
    const clave = plantilla + D;
    const prof = p.z - plantilla;
    const cubr = p.z - clave;
    return { ...p, plantilla, clave, prof, cubr };
  });
  return { pts, extraArranque: extra, caidaPlantilla: zP[0] - zP[zP.length - 1], caidaNatural: muestras[0].z - muestras[muestras.length - 1].z };
}

export function colocarPozos(vertices, perfilPts, D) {
  const maxSep = sepPozos(D);
  const pozos = [];
  const add = (s, lat, lon, z, plantilla, motivo) => {
    if (pozos.some((p) => Math.abs(p.s - s) < 8)) {
      const prev = pozos.reduce((a, p) => Math.abs(p.s - s) < Math.abs(a.s - s) ? p : a);
      if (!prev.motivo.includes(motivo)) prev.motivo += "; " + motivo;
      return;
    }
    pozos.push({ s, lat, lon, z, plantilla, prof: z - plantilla, motivo });
  };
  const vpos = [];
  let acc = 0;
  vpos.push({ i: 0, s: 0, ...vertices[0] });
  for (let i = 1; i < vertices.length; i++) {
    acc += distanciaGeodesica(vertices[i - 1], vertices[i]);
    vpos.push({ i, s: acc, ...vertices[i] });
  }
  const zAt = (s, campo) => {
    const arr = perfilPts;
    if (s <= arr[0].s) return arr[0][campo];
    if (s >= arr[arr.length - 1].s) return arr[arr.length - 1][campo];
    for (let i = 1; i < arr.length; i++) {
      if (s <= arr[i].s) {
        const t = (s - arr[i - 1].s) / Math.max(1e-6, arr[i].s - arr[i - 1].s);
        return arr[i - 1][campo] + t * (arr[i][campo] - arr[i - 1][campo]);
      }
    }
    return arr[arr.length - 1][campo];
  };
  add(0, vertices[0].lat, vertices[0].lon, vertices[0].z, zAt(0, "plantilla"), "pozo de cabecera");
  for (let i = 1; i < vpos.length - 1; i++) {
    const defl = deflexion(vpos[i - 1], vpos[i], vpos[i + 1]);
    if (defl >= DEFLEXION_POZO) add(vpos[i].s, vpos[i].lat, vpos[i].lon, vpos[i].z, zAt(vpos[i].s, "plantilla"), `cambio de dirección (${defl.toFixed(0)}°)`);
  }
  add(vpos[vpos.length - 1].s, vertices[vertices.length - 1].lat, vertices[vertices.length - 1].lon, vertices[vertices.length - 1].z, zAt(vpos[vpos.length - 1].s, "plantilla"), "pozo terminal");
  pozos.sort((a, b) => a.s - b.s);
  const extra = [];
  for (let i = 0; i < pozos.length - 1; i++) {
    const hueco = pozos[i + 1].s - pozos[i].s;
    if (hueco > maxSep + 0.5) {
      const n = Math.ceil(hueco / maxSep);
      const paso = hueco / n;
      for (let k = 1; k < n; k++) {
        const s = pozos[i].s + paso * k;
        // interpolar lat/lon sobre la polilínea de vértices
        let p = vpos[vpos.length - 1];
        for (let j = 1; j < vpos.length; j++) {
          if (s <= vpos[j].s) {
            const t = (s - vpos[j - 1].s) / Math.max(1e-6, vpos[j].s - vpos[j - 1].s);
            p = interpolar(vpos[j - 1], vpos[j], t);
            break;
          }
        }
        extra.push({ s, lat: p.lat, lon: p.lon, z: zAt(s, "z"), plantilla: zAt(s, "plantilla"), prof: zAt(s, "z") - zAt(s, "plantilla"), motivo: `separación máxima ${maxSep} m (MAPAS, Ø ${(D * 1000).toFixed(0)} mm)` });
      }
    }
  }
  const todos = pozos.concat(extra).sort((a, b) => a.s - b.s);
  todos.forEach((p, i) => { p.id = "PV-" + String(i + 1).padStart(2, "0"); });
  return { pozos: todos, sepMax: maxSep };
}

export function avisosMotor({ vertices, perfil, diseno, Q, aux }) {
  const out = [];
  const pts = perfil.pts;
  const L = pts[pts.length - 1].s;
  const caidaNat = perfil.caidaNatural;
  if (caidaNat < -0.05) {
    out.push({ tipo: "contrapendiente", txt: `Contrapendiente natural: el terreno sube ${fmt1(-caidaNat, 2)} m en el sentido del trazo (${fmt1(L, 0)} m). Se mantuvo pendiente de plantilla hacia aguas abajo, lo que ahonda la zanja. Considere invertir el sentido o un cárcamo de bombeo.` });
  }
  let minCub = Infinity, maxProf = -Infinity, iMin = 0, iMax = 0;
  for (let i = 0; i < pts.length; i++) {
    if (pts[i].cubr < minCub) { minCub = pts[i].cubr; iMin = i; }
    if (pts[i].prof > maxProf) { maxProf = pts[i].prof; iMax = i; }
  }
  if (minCub < CUBRIMIENTO - 0.02) {
    out.push({ tipo: "somera", txt: `Tramo demasiado somero: cubrimiento mínimo calculado ${fmt2(minCub)} m (se pide ${CUBRIMIENTO.toFixed(2)} m sobre la clave, con tráfico). Estación ${fmt1(pts[iMin].s, 0)} m.` });
  }
  if (maxProf > H_PROFUNDA) {
    out.push({ tipo: "profunda", txt: `Zanja profunda: ${fmt2(maxProf)} m a plantilla en la estación ${fmt1(pts[iMax].s, 0)} m. El MAPAS no fija un único máximo; a partir de ~5–6 m la excavación se complica y conviene revisar constructibilidad o un cárcamo.` });
  }
  const fill = diseno.fill || {};
  if (fill.V < VMIN - 0.01) out.push({ tipo: "velocidad", txt: `Velocidad calculada ${fmt2(fill.V)} m/s, por debajo del mínimo de 0.30 m/s (MAPAS, Tabla 2.9).` });
  if (fill.V > diseno.vmax + 0.01) out.push({ tipo: "velocidad", txt: `Velocidad calculada ${fmt2(fill.V)} m/s, por encima del máximo de ${fmt1(diseno.vmax, 1)} m/s para ${diseno.material === "concreto" ? "concreto" : "plásticos (PVC/PEAD)"}.` });
  if (diseno.insuficiente) out.push({ tipo: "capacidad", txt: "El diámetro propuesto no garantiza el gasto de diseño a ~75 % de tirante en el rango de velocidad." });
  if (diseno.Snat > diseno.sMax + 1e-6) {
    const caidaSuelta = (diseno.Snat - diseno.sMax) * L;
    out.push({ tipo: "caida", txt: `El terreno baja más de prisa que la pendiente máxima. Quedan ≈ ${fmt2(caidaSuelta)} m de desnivel por absorber en pozos de caída (caída libre ≤ 0.60 m por pozo según práctica MAPAS; si es mayor, estructura de caída).` });
  }
  const gravInviable = maxProf > H_CARCAMO || (caidaNat < -0.05 && maxProf > H_PROFUNDA);
  if (gravInviable) {
    out.push({ tipo: "carcamo", txt: "La conducción por gravedad no es razonable con este trazo y el DEM disponible. Se sugiere un cárcamo de bombeo (anteproyecto) y un recálculo con topografía de campo." });
  }
  if (aux) {
    if (aux.coincidente || (aux.dist != null && aux.dist < 20)) {
      out.push({ tipo: "conexion", txt: `La ruta propuesta termina junto a «${aux.nombre}» (${fmt1(aux.dist, 0)} m). No se añade un enlace auxiliar adicional. Sigue siendo un punto de referencia, no un tubo existente.` });
    } else {
      out.push({ tipo: "conexion", txt: `Conexión auxiliar propuesta al punto de referencia más cercano: ${aux.nombre} a ${fmt1(aux.dist, 0)} m en geodésica (categoría: referencia / no es un tubo existente).` });
      if (aux.gravedad === false) {
        out.push({ tipo: "carcamo", txt: `El terreno en «${aux.nombre}» no permite, con este DEM, una llegada a gravedad desde la plantilla final (el punto de referencia queda más alto o sin cubrimiento). Se propone cárcamo de bombeo para esa conexión auxiliar.` });
      }
    }
    if (aux.ptar && aux.ptar.id !== aux.id) {
      out.push({ tipo: "conexion", txt: `La PTAR de referencia más cercana es ${aux.ptar.nombre}, a ${fmt1(aux.ptar.dist, 0)} m.` });
    }
  }
  return { avisos: out, gravInviable, minCub, maxProf };
}

export function conexionAuxiliar(fin, refs) {
  if (!fin || !refs || !refs.length) return null;
  const scored = refs.filter((r) => r.lat != null && r.lon != null).map((r) => ({
    ...r, dist: distanciaGeodesica(fin, { lat: +r.lat, lon: +r.lon }),
  })).sort((a, b) => a.dist - b.dist);
  if (!scored.length) return null;
  const near = scored[0];
  const ptar = scored.find((r) => /ptar/i.test(r.tipo || "") || /ptar/i.test(r.nombre || ""));
  return { ...near, ptar: ptar && ptar.id !== near.id ? ptar : (ptar || null) };
}

export function evaluarAuxGravedad(aux, zPlantillaFin, D) {
  if (!aux) return aux;
  if (aux.dist != null && aux.dist < 20) {
    return { ...aux, coincidente: true, gravedad: true, zLlegada: zPlantillaFin };
  }
  if (aux.z == null || !Number.isFinite(zPlantillaFin)) return { ...aux, gravedad: null };
  const plantillaLlegada = aux.z - CUBRIMIENTO - D;
  // Llegada a gravedad si, con el cubrimiento mínimo, la plantilla en el punto de referencia queda por debajo de la plantilla de llegada.
  const ok = plantillaLlegada <= zPlantillaFin - 0.05;
  return { ...aux, gravedad: ok, zLlegada: plantillaLlegada };
}

export async function consultarDEM(locs) {
  const puntos = locs.map((p) => ({ lat: +p.lat, lon: +p.lon }));
  const intentar = async (fn) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    try { return await fn(ctrl.signal); }
    finally { clearTimeout(t); }
  };
  // 1) Open-Elevation (SRTM, CORS). 2) Open-Meteo (Copernicus GLO-90, CORS). 3) OpenTopoData SRTM30 (puede fallar por CORS en el navegador).
  const fuentes = [
    {
      id: "open-elevation-srtm",
      etiqueta: "Open-Elevation, modelo SRTM (~30 m de malla). Incertidumbre vertical típica ≈ ±5–10 m (en zonas urbanas o laderas puede ser mayor).",
      run: async (signal) => {
        const z = [];
        for (let i = 0; i < puntos.length; i += 80) {
          const chunk = puntos.slice(i, i + 80);
          const r = await fetch("https://api.open-elevation.com/api/v1/lookup", {
            method: "POST", signal, headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ locations: chunk.map((p) => ({ latitude: p.lat, longitude: p.lon })) }),
          });
          if (!r.ok) throw new Error("open-elevation " + r.status);
          const j = await r.json();
          const arr = j.results || [];
          if (arr.length !== chunk.length) throw new Error("open-elevation incompleto");
          for (const row of arr) {
            if (row.elevation == null || !Number.isFinite(+row.elevation)) throw new Error("open-elevation nulo");
            z.push(+row.elevation);
          }
        }
        return z;
      },
    },
    {
      id: "open-meteo-glo90",
      etiqueta: "Open-Meteo, Copernicus DEM GLO-90 (2021, malla de 90 m). Incertidumbre vertical típica ≈ ±5–10 m. Se usa solo si falla la fuente de 30 m.",
      run: async (signal) => {
        const z = [];
        for (let i = 0; i < puntos.length; i += 100) {
          const chunk = puntos.slice(i, i + 100);
          const url = "https://api.open-meteo.com/v1/elevation?latitude=" +
            chunk.map((p) => p.lat).join(",") + "&longitude=" + chunk.map((p) => p.lon).join(",");
          const r = await fetch(url, { signal });
          if (!r.ok) throw new Error("open-meteo " + r.status);
          const j = await r.json();
          const arr = j.elevation || [];
          if (arr.length !== chunk.length || arr.some((v) => v == null || !Number.isFinite(+v))) throw new Error("open-meteo incompleto");
          for (const v of arr) z.push(+v);
        }
        return z;
      },
    },
    {
      id: "opentopodata-srtm30m",
      etiqueta: "OpenTopoData, SRTM 30 m. Incertidumbre vertical típica ≈ ±5–10 m.",
      run: async (signal) => {
        const z = [];
        for (let i = 0; i < puntos.length; i += 100) {
          const chunk = puntos.slice(i, i + 100);
          const url = "https://api.opentopodata.org/v1/srtm30m?locations=" +
            chunk.map((p) => p.lat + "," + p.lon).join("|") + "&interpolation=bilinear";
          const r = await fetch(url, { signal });
          if (!r.ok) throw new Error("opentopodata " + r.status);
          const j = await r.json();
          const arr = j.results || [];
          if (arr.length !== chunk.length) throw new Error("opentopodata incompleto");
          for (const row of arr) {
            if (row.elevation == null || !Number.isFinite(+row.elevation)) throw new Error("opentopodata nulo");
            z.push(+row.elevation);
          }
        }
        return z;
      },
    },
  ];
  let ultimo = null;
  for (const f of fuentes) {
    try {
      const z = await intentar(f.run);
      return { z, fuente: f };
    } catch (err) {
      ultimo = err;
    }
  }
  throw ultimo || new Error("DEM no disponible");
}

export function armarEstudio({ vertices, muestras, fuenteDEM, Q, n, material }) {
  const L = vertices.slice(1).reduce((s, p, i) => s + distanciaGeodesica(vertices[i], p), 0);
  const Snat = L > 0 ? (vertices[0].z - vertices[vertices.length - 1].z) / L : 0;
  const diseno = elegirDiametro({ Q, n, material, Snat });
  const perfil = perfilPlantilla(muestras, vertices, diseno);
  // pasar z de plantilla a vértices
  const verts = vertices.map((v, i) => {
    const hit = perfil.pts.find((p) => p.vertice === i) || perfil.pts[0];
    return { ...v, plantilla: hit.plantilla, prof: hit.prof, cubr: hit.cubr, s: hit.s };
  });
  // tramos entre vértices
  const tramos = [];
  for (let i = 0; i < verts.length - 1; i++) {
    const a = verts[i], b = verts[i + 1];
    const len = distanciaGeodesica(a, b);
    const sNat = len > 0 ? (a.z - b.z) / len : 0;
    const sProp = len > 0 ? (a.plantilla - b.plantilla) / len : 0;
    tramos.push({
      i: i + 1, from: i + 1, to: i + 2, L: len,
      z0: a.z, z1: b.z, p0: a.plantilla, p1: b.plantilla,
      sNat, sProp, prof0: a.prof, prof1: b.prof,
      contrapendiente: sNat < -0.0005,
    });
  }
  const { pozos, sepMax } = colocarPozos(verts, perfil.pts, diseno.D);
  return { L, Snat, diseno, perfil, vertices: verts, tramos, pozos, sepMax, Q, n, material, fuenteDEM, banner: BANNER, cubrimiento: CUBRIMIENTO };
}

function iconoVertice(n) {
  return L.divIcon({
    className: "mk-plan cat-c",
    html: `<span class="mk-core"></span><span class="mk-lab">${n}</span>`,
    iconSize: [22, 22], iconAnchor: [11, 14],
  });
}
function iconoPozo(id) {
  return L.divIcon({
    className: "mk-pozo cat-c",
    html: `<span class="mk-core"></span><span class="mk-lab">${id}</span>`,
    iconSize: [18, 18], iconAnchor: [9, 10],
  });
}

export function initPlaneacion({ map, getReferencias, helpers }) {
  const esc = helpers.esc;
  const coordBlock = helpers.coordBlock;
  const btn = document.getElementById("vm-plan-btn");
  const panel = document.getElementById("vm-plan");
  const root = document.getElementById("vista-mapa");
  if (!map || !btn || !panel) return;

  const layer = L.layerGroup().addTo(map);
  let activo = false;
  let vertices = []; // {lat,lon,z?,mk}
  let estudio = null;
  let auxLayer = null;
  let demTimer = 0;
  let skipClick = false;

  const qEl = () => document.getElementById("vm-plan-q");
  const nEl = () => document.getElementById("vm-plan-n");
  const matEl = () => document.getElementById("vm-plan-mat");

  function params() {
    const material = (matEl()?.value || "pead");
    let n = parseFloat(nEl()?.value);
    if (!Number.isFinite(n) || n <= 0) n = N_DEFECTO[material] || 0.010;
    let Ql = parseFloat(qEl()?.value);
    if (!Number.isFinite(Ql) || Ql <= 0) Ql = Q_DEFECTO;
    return { material, n, Q: Ql / 1000 };
  }

  function setActivo(on) {
    activo = on;
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    const txt = btn.querySelector(".vm-plan-txt");
    if (txt) txt.textContent = on ? "Cerrar planeación" : "Modo planeación";
    root?.classList.toggle("planeacion", on);
    if (on) {
      panel.hidden = false;
      root?.classList.remove("plan-plegado");
      map.doubleClickZoom.disable();
      map.getContainer().style.cursor = "crosshair";
    } else {
      panel.hidden = true;
      map.doubleClickZoom.enable();
      map.getContainer().style.cursor = "";
    }
  }

  function popupVertice(i, p) {
    const ztxt = Number.isFinite(p.z) ? `<p>Terreno (DEM): ${fmt1(p.z, 1)} m</p>` : "";
    const ptxt = Number.isFinite(p.plantilla) ? `<p>Plantilla propuesta: ${fmt2(p.plantilla)} m · profundidad ${fmt2(p.prof)} m</p>` : "";
    return `<b>Vértice ${i + 1} · ruta propuesta</b>
      <p class="vm-cat cat-c">Referencia pendiente de plano oficial</p>
      <p class="vm-plan-banner">${esc(BANNER)}</p>
      ${ztxt}${ptxt}
      ${coordBlock(p.lat, p.lon)}
      <button type="button" class="gbtn dir" data-plan-del="${i}">Quitar este vértice</button>`;
  }

  function redibujarLinea() {
    layer.eachLayer((ly) => { if (ly._planKind === "line" || ly._planKind === "pozo" || ly._planKind === "aux") layer.removeLayer(ly); });
    if (vertices.length >= 2) {
      const pl = L.polyline(vertices.map((v) => [v.lat, v.lon]), {
        color: "#d4a63a", weight: 4, opacity: 0.95, dashArray: "8 6", className: "cat-c plan-line",
      });
      pl._planKind = "line";
      pl.bindPopup(`<b>Ruta propuesta de colector</b><p class="vm-cat cat-c">Referencia pendiente de plano oficial</p><p class="vm-plan-banner">${esc(BANNER)}</p>`);
      layer.addLayer(pl);
    }
    if (estudio) {
      for (const pv of estudio.pozos || []) {
        const mk = L.marker([pv.lat, pv.lon], { icon: iconoPozo(pv.id), zIndexOffset: 650, title: pv.id, keyboard: false });
        mk._planKind = "pozo";
        mk.bindPopup(`<b>${esc(pv.id)} · pozo de visita propuesto</b>
          <p class="vm-cat cat-c">Referencia pendiente de plano oficial</p>
          <p>${esc(pv.motivo)}.</p>
          <p>Estación ${fmt1(pv.s, 1)} m · terreno ${fmt1(pv.z, 1)} m · plantilla ${fmt2(pv.plantilla)} m · profundidad ${fmt2(pv.prof)} m.</p>
          <p class="vm-plan-banner">${esc(BANNER)}</p>
          ${coordBlock(pv.lat, pv.lon)}`);
        mk.on("mousedown", () => { skipClick = true; });
        layer.addLayer(mk);
      }
      if (estudio.aux && !(estudio.aux.coincidente || (estudio.aux.dist != null && estudio.aux.dist < 20))) {
        const ax = estudio.aux;
        const ln = L.polyline([[vertices[vertices.length - 1].lat, vertices[vertices.length - 1].lon], [ax.lat, ax.lon]], {
          color: "#a8a29e", weight: 2.5, opacity: 0.9, dashArray: "3 6", className: "cat-c plan-aux",
        });
        ln._planKind = "aux";
        ln.bindPopup(`<b>Conexión auxiliar propuesta</b>
          <p class="vm-cat cat-c">Referencia pendiente de plano oficial</p>
          <p>Hacia ${esc(ax.nombre)} · ${fmt1(ax.dist, 0)} m (geodésica). No es un tubo existente.</p>
          <p class="vm-plan-banner">${esc(BANNER)}</p>`);
        layer.addLayer(ln);
        auxLayer = ln;
      }
    }
  }

  function refrescarMarcadores() {
    vertices.forEach((v, i) => {
      if (!v.mk) return;
      v.mk.setIcon(iconoVertice(i + 1));
      v.mk.setPopupContent(popupVertice(i, v));
    });
  }

  function agregar(lat, lon) {
    const i = vertices.length;
    const v = { lat, lon };
    const mk = L.marker([lat, lon], { icon: iconoVertice(i + 1), draggable: true, autoPan: true, zIndexOffset: 1100, title: "Vértice " + (i + 1) });
    mk._planKind = "vert";
    mk.bindPopup(popupVertice(i, v), { maxWidth: 360 });
    mk.on("mousedown", () => { skipClick = true; });
    mk.on("dragstart", () => { skipClick = true; });
    mk.on("dragend", () => {
      const ll = mk.getLatLng();
      const ix = vertices.findIndex((x) => x.mk === mk);
      if (ix >= 0) { vertices[ix].lat = ll.lat; vertices[ix].lon = ll.lng; vertices[ix].z = undefined; }
      programarCalculo();
    });
    mk.on("popupopen", () => {
      const ix = vertices.findIndex((x) => x.mk === mk);
      const b = document.querySelector("[data-plan-del]");
      b?.addEventListener("click", () => { if (ix >= 0) quitar(ix); });
    });
    v.mk = mk;
    layer.addLayer(mk);
    vertices.push(v);
    redibujarLinea();
    programarCalculo();
    pintarLista();
  }

  function quitar(i) {
    const v = vertices[i];
    if (v?.mk) layer.removeLayer(v.mk);
    vertices.splice(i, 1);
    refrescarMarcadores();
    redibujarLinea();
    programarCalculo();
    pintarLista();
  }

  function deshacer() { if (vertices.length) quitar(vertices.length - 1); }
  function borrar() {
    for (const v of vertices) if (v.mk) layer.removeLayer(v.mk);
    vertices = [];
    estudio = null;
    redibujarLinea();
    pintarResultado(null, "Trace al menos dos puntos, de aguas arriba hacia aguas abajo.");
    pintarLista();
  }
  function invertir() {
    vertices.reverse();
    refrescarMarcadores();
    redibujarLinea();
    programarCalculo();
  }

  function programarCalculo() {
    pintarLista();
    redibujarLinea();
    clearTimeout(demTimer);
    if (vertices.length < 2) {
      estudio = null;
      pintarResultado(null, "Trace al menos dos puntos, de aguas arriba hacia aguas abajo.");
      return;
    }
    pintarResultado(null, "Consultando el modelo de elevación…");
    demTimer = setTimeout(() => calcular().catch((e) => {
      console.error("planeacion DEM", e);
      pintarResultado(null, "No se pudo leer un DEM público en este momento. La longitud geodésica sí está disponible; intente de nuevo para cotas y pendientes.");
      const L = vertices.slice(1).reduce((s, p, i) => s + distanciaGeodesica(vertices[i], p), 0);
      document.getElementById("vm-plan-long") && (document.getElementById("vm-plan-long").textContent = fmt1(L, 1) + " m");
    }), 450);
  }

  async function calcular() {
    const { Q, n, material } = params();
    const muestras0 = densificarRuta(vertices, 30, 80);
    const dem = await consultarDEM(muestras0);
    const muestras = muestras0.map((p, i) => ({ ...p, z: dem.z[i] }));
    vertices.forEach((v, i) => {
      const hit = muestras.find((p) => p.vertice === i);
      if (hit) v.z = hit.z;
    });
    const est = armarEstudio({ vertices: vertices.map((v) => ({ lat: v.lat, lon: v.lon, z: v.z })), muestras, fuenteDEM: dem.fuente, Q, n, material });
    // conexión auxiliar
    const fin = est.vertices[est.vertices.length - 1];
    const refs = (typeof getReferencias === "function" ? getReferencias() : []) || [];
    let aux = conexionAuxiliar(fin, refs);
    if (aux) {
      try {
        const dz = await consultarDEM([{ lat: aux.lat, lon: aux.lon }]);
        aux.z = dz.z[0];
        if (dz.fuente && !est.fuenteDEM) est.fuenteDEM = dz.fuente;
      } catch (err) { /* cota del enlace opcional */ }
      aux = evaluarAuxGravedad(aux, fin.plantilla, est.diseno.D);
    }
    est.aux = aux;
    const mot = avisosMotor({ vertices: est.vertices, perfil: est.perfil, diseno: est.diseno, Q, aux });
    est.motor = mot;
    estudio = est;
    vertices.forEach((v, i) => {
      v.z = est.vertices[i].z;
      v.plantilla = est.vertices[i].plantilla;
      v.prof = est.vertices[i].prof;
      v.cubr = est.vertices[i].cubr;
    });
    refrescarMarcadores();
    redibujarLinea();
    pintarResultado(est, null);
  }

  function pintarLista() {
    const ul = document.getElementById("vm-plan-verts");
    if (!ul) return;
    if (!vertices.length) { ul.innerHTML = "<li>Todavía no hay puntos.</li>"; return; }
    ul.innerHTML = vertices.map((v, i) =>
      `<li>V${i + 1}${i === 0 ? " (arriba)" : (i === vertices.length - 1 ? " (abajo)" : "")}: ${(+v.lat).toFixed(6)}, ${(+v.lon).toFixed(6)}${Number.isFinite(v.z) ? ` · ${fmt1(v.z, 1)} m` : ""}</li>`
    ).join("");
  }

  function pintarResultado(est, msg) {
    const box = document.getElementById("vm-plan-cuerpo");
    if (!box) return;
    if (msg && !est) {
      box.innerHTML = `<p class="vm-plan-msg">${esc(msg)}</p>`;
      dibujarPerfil(null);
      return;
    }
    if (!est) return;
    const d = est.diseno, mot = est.motor || { avisos: [] };
    const Dmm = Math.round(d.D * 1000);
    const avisosHTML = mot.avisos.length
      ? `<ul class="vm-plan-avisos">${mot.avisos.map((a) => `<li data-tipo="${esc(a.tipo)}">${esc(a.txt)}</li>`).join("")}</ul>`
      : `<p class="vm-plan-ok">El motor no marcó contrapendiente, zanja fuera de rango ni velocidad fuera de rango con este DEM. Sigue siendo un anteproyecto.</p>`;
    const tr = est.tramos.map((t) => `<tr>
      <td>${t.i}</td><td>${fmt1(t.L, 1)}</td>
      <td>${fmt1(t.z0, 1)} → ${fmt1(t.z1, 1)}</td>
      <td>${mil(t.sNat)}</td><td>${mil(t.sProp)}</td>
      <td>${fmt2(t.prof0)} → ${fmt2(t.prof1)}</td>
      <td>${t.contrapendiente ? "contrapendiente" : "—"}</td>
    </tr>`).join("");
    const pv = est.pozos.map((p) => `<tr><td>${esc(p.id)}</td><td>${fmt1(p.s, 1)}</td><td>${fmt1(p.z, 1)}</td><td>${fmt2(p.plantilla)}</td><td>${fmt2(p.prof)}</td><td>${esc(p.motivo)}</td></tr>`).join("");
    box.innerHTML = `
      <p class="vm-plan-fuente">${esc(est.fuenteDEM?.etiqueta || "")}</p>
      <dl class="vm-plan-kpis">
        <div><dt>Longitud geodésica</dt><dd id="vm-plan-long">${fmt1(est.L, 1)} m</dd></div>
        <div><dt>Pendiente natural</dt><dd>${mil(est.Snat)} ‰</dd></div>
        <div><dt>Pendiente propuesta media</dt><dd>${mil(est.L > 0 ? est.perfil.caidaPlantilla / est.L : d.S)} ‰</dd></div>
        <div><dt>Diámetro propuesto</dt><dd>${Dmm} mm · n = ${d.n}</dd></div>
        <div><dt>Capacidad a 75 % de tirante</dt><dd>${fmt1(d.Qcap75 * 1000, 1)} L/s</dd></div>
        <div><dt>Tirante / velocidad</dt><dd>${fmt1((d.fill?.yRel || 0) * 100, 0)} % · ${fmt2(d.fill?.V)} m/s</dd></div>
        <div><dt>Caída natural / de plantilla</dt><dd>${fmt2(est.perfil.caidaNatural)} m · ${fmt2(est.perfil.caidaPlantilla)} m</dd></div>
        <div><dt>Cubrimiento / prof. máx.</dt><dd>${fmt2(Math.min(...est.perfil.pts.map((p) => p.cubr)))} m · ${fmt2(Math.max(...est.perfil.pts.map((p) => p.prof)))} m</dd></div>
      </dl>
      <p class="vm-plan-nota">${esc(d.razon)}.</p>
      <h4>Motor de sugerencias</h4>
      ${avisosHTML}
      ${est.aux ? (est.aux.coincidente || est.aux.dist < 20
        ? `<p class="vm-plan-aux">La ruta termina junto a <b>${esc(est.aux.nombre)}</b> (${fmt1(est.aux.dist, 0)} m). No se traza un enlace auxiliar adicional.</p>`
        : `<p class="vm-plan-aux">Conexión auxiliar propuesta: <b>${esc(est.aux.nombre)}</b> a ${fmt1(est.aux.dist, 0)} m. ${est.aux.gravedad === false ? "Llegada a gravedad no viable con este DEM: se sugiere cárcamo." : (est.aux.gravedad === true ? "La cota del DEM admitiría, en principio, una llegada a gravedad (hay que confirmarlo en campo)." : "")}</p>`) : ""}
      <h4>Tramos</h4>
      <div class="vm-plan-tabla-wrap"><table class="vm-plan-tabla">
        <thead><tr><th>#</th><th>L (m)</th><th>Terreno (m)</th><th>S nat (‰)</th><th>S prop (‰)</th><th>Prof. plantilla (m)</th><th>Aviso</th></tr></thead>
        <tbody>${tr}</tbody>
      </table></div>
      <h4>Pozos de visita propuestos</h4>
      <p class="vm-plan-nota">Según MAPAS (Obras accesorias): en cabecera, cambios de dirección y cada ${est.sepMax} m como máximo para Ø ${Dmm} mm (125 m si Ø 20–61 cm; 150 m si Ø 76–122 cm). Cubrimiento de ${CUBRIMIENTO.toFixed(2)} m sobre la clave (tráfico).</p>
      <div class="vm-plan-tabla-wrap"><table class="vm-plan-tabla">
        <thead><tr><th>Pozo</th><th>Estación (m)</th><th>Terreno</th><th>Plantilla</th><th>Prof. (m)</th><th>Motivo</th></tr></thead>
        <tbody>${pv}</tbody>
      </table></div>
      <p class="vm-plan-banner">${esc(BANNER)}</p>`;
    dibujarPerfil(est);
  }

  function dibujarPerfil(est) {
    const c = document.getElementById("vm-plan-perfil");
    if (!c) return;
    const ctx = c.getContext("2d");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth || 320, h = c.clientHeight || 160;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#12141a";
    ctx.fillRect(0, 0, w, h);
    if (!est) {
      ctx.fillStyle = "#9a937f";
      ctx.font = "12px IBM Plex Sans, system-ui, sans-serif";
      ctx.fillText("El perfil aparecerá al trazar la ruta.", 12, h / 2);
      return;
    }
    const pts = est.perfil.pts;
    const pad = { l: 46, r: 12, t: 16, b: 28 };
    const L = pts[pts.length - 1].s || 1;
    let zmin = Infinity, zmax = -Infinity;
    for (const p of pts) {
      zmin = Math.min(zmin, p.plantilla, p.z - 10);
      zmax = Math.max(zmax, p.z + 10);
    }
    if (zmax - zmin < 4) { zmax += 2; zmin -= 2; }
    const X = (s) => pad.l + (s / L) * (w - pad.l - pad.r);
    const Y = (z) => pad.t + (1 - (z - zmin) / (zmax - zmin)) * (h - pad.t - pad.b);
    // banda de incertidumbre ±8 m
    ctx.beginPath();
    pts.forEach((p, i) => { const x = X(p.s), y = Y(p.z + 8); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(X(pts[i].s), Y(pts[i].z - 8));
    ctx.closePath();
    ctx.fillStyle = "rgba(212,166,58,.10)";
    ctx.fill();
    // terreno
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(X(p.s), Y(p.z)) : ctx.moveTo(X(p.s), Y(p.z)));
    ctx.strokeStyle = "#a8a29e"; ctx.lineWidth = 2; ctx.setLineDash([]); ctx.stroke();
    // plantilla
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(X(p.s), Y(p.plantilla)) : ctx.moveTo(X(p.s), Y(p.plantilla)));
    ctx.strokeStyle = "#d4a63a"; ctx.lineWidth = 2.25; ctx.setLineDash([6, 4]); ctx.stroke();
    ctx.setLineDash([]);
    // pozos
    ctx.fillStyle = "#f3d27a";
    ctx.font = "650 9px IBM Plex Sans, system-ui, sans-serif";
    for (const pv of est.pozos) {
      const x = X(pv.s);
      ctx.strokeStyle = "rgba(243,210,122,.55)";
      ctx.beginPath(); ctx.moveTo(x, Y(pv.z)); ctx.lineTo(x, Y(pv.plantilla)); ctx.stroke();
      ctx.fillText(pv.id, x + 2, Y(pv.z) - 4);
    }
    ctx.fillStyle = "#9a937f";
    ctx.font = "11px IBM Plex Sans, system-ui, sans-serif";
    ctx.fillText("0 m", X(0) - 4, h - 8);
    ctx.fillText(fmt1(L, 0) + " m", X(L) - 28, h - 8);
    ctx.fillText(fmt1(zmax, 0) + " m", 4, pad.t + 4);
    ctx.fillText(fmt1(zmin, 0) + " m", 4, h - pad.b);
    ctx.fillStyle = "#cfc8b6";
    ctx.fillText("Terreno (DEM)", pad.l + 8, 12);
    ctx.fillStyle = "#d4a63a";
    ctx.fillText("Plantilla propuesta", pad.l + 110, 12);
  }

  function descargar(nombre, text, mime) {
    const blob = new Blob([text], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }
  function fechaArchivo() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  }
  function exportCSV() {
    if (!estudio) return;
    const e = estudio, d = e.diseno;
    const lines = [
      BANNER,
      `Fuente DEM,${(e.fuenteDEM?.etiqueta || "").replace(/,/g, ";")}`,
      `Gasto de diseño (L/s),${(e.Q * 1000).toFixed(2)}`,
      `Material,${e.material},n,${e.n}`,
      `Diámetro propuesto (mm),${Math.round(d.D * 1000)}`,
      `Pendiente natural (1),${e.Snat}`,
      `Pendiente propuesta (1),${d.S}`,
      `Longitud geodésica (m),${e.L}`,
      `Caída natural (m),${e.perfil.caidaNatural}`,
      `Caída de plantilla (m),${e.perfil.caidaPlantilla}`,
      `Cubrimiento mínimo adoptado (m),${CUBRIMIENTO}`,
      "",
      "Tramo,De,A,Longitud_m,Z_terreno_ini,Z_terreno_fin,S_natural,S_propuesta,Plantilla_ini,Plantilla_fin,Prof_ini_m,Prof_fin_m,Contrapendiente",
      ...e.tramos.map((t) => [t.i, t.from, t.to, t.L, t.z0, t.z1, t.sNat, t.sProp, t.p0, t.p1, t.prof0, t.prof1, t.contrapendiente ? "sí" : "no"].join(",")),
      "",
      "Pozo,Estacion_m,Lat,Lon,Terreno_m,Plantilla_m,Profundidad_m,Motivo",
      ...e.pozos.map((p) => [p.id, p.s, p.lat, p.lon, p.z, p.plantilla, p.prof, `"${p.motivo.replace(/"/g, "'")}"`].join(",")),
      "",
      "Avisos del motor",
      ...(e.motor?.avisos || []).map((a) => `${a.tipo},"${a.txt.replace(/"/g, "'")}"`),
      e.aux ? `conexion_auxiliar,${e.aux.nombre},${e.aux.dist},${e.aux.lat},${e.aux.lon},${e.aux.gravedad}` : "",
    ];
    descargar(`anteproyecto-colector-nodo-vah-${fechaArchivo()}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
  }
  function exportGeoJSON() {
    if (!estudio) return;
    const e = estudio, d = e.diseno;
    const feats = [
      {
        type: "Feature",
        properties: {
          clase: "ruta_propuesta",
          categoria: "referencias_pendientes_de_plano_oficial",
          banner: BANNER,
          longitud_m: e.L,
          gasto_lps: e.Q * 1000,
          material: e.material,
          n: e.n,
          diametro_mm: Math.round(d.D * 1000),
          pendiente_natural: e.Snat,
          pendiente_propuesta: d.S,
          caida_natural_m: e.perfil.caidaNatural,
          caida_plantilla_m: e.perfil.caidaPlantilla,
          fuente_dem: e.fuenteDEM?.etiqueta || "",
          aviso: "No representa tubería existente.",
        },
        geometry: { type: "LineString", coordinates: e.vertices.map((v) => [v.lon, v.lat, v.plantilla]) },
      },
      ...e.pozos.map((p) => ({
        type: "Feature",
        properties: { clase: "pozo_propuesto", id: p.id, motivo: p.motivo, estacion_m: p.s, terreno_m: p.z, plantilla_m: p.plantilla, profundidad_m: p.prof, banner: BANNER },
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      })),
    ];
    if (e.aux) {
      const fin = e.vertices[e.vertices.length - 1];
      feats.push({
        type: "Feature",
        properties: { clase: "conexion_auxiliar_propuesta", hacia: e.aux.nombre, distancia_m: e.aux.dist, gravedad: e.aux.gravedad, banner: BANNER, aviso: "No es un tubo existente." },
        geometry: { type: "LineString", coordinates: [[fin.lon, fin.lat], [e.aux.lon, e.aux.lat]] },
      });
    }
    const gj = { type: "FeatureCollection", name: "anteproyecto-colector-nodo-vah", crs: { type: "name", properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" } }, properties: { banner: BANNER }, features: feats };
    descargar(`anteproyecto-colector-nodo-vah-${fechaArchivo()}.geojson`, JSON.stringify(gj, null, 2), "application/geo+json");
  }

  map.on("click", (e) => {
    if (!activo) return;
    if (skipClick) { skipClick = false; return; }
    const t = e.originalEvent?.target;
    if (t && t.closest && t.closest(".leaflet-marker-icon, .leaflet-popup, #vm-plan, button, a, input, select, textarea, #vm-menu, #vm-filtros, #vm-leyenda")) return;
    agregar(e.latlng.lat, e.latlng.lng);
  });

  btn.addEventListener("click", () => {
    if (activo && panel.hidden) { panel.hidden = false; root?.classList.remove("plan-plegado"); return; }
    setActivo(!activo);
  });
  document.getElementById("vm-plan-cerrar")?.addEventListener("click", () => { panel.hidden = true; /* no sale del modo, solo pliega */ root?.classList.add("plan-plegado"); });
  document.getElementById("vm-plan-abrir")?.addEventListener("click", () => { panel.hidden = !activo ? true : false; root?.classList.remove("plan-plegado"); if (!activo) setActivo(true); });
  document.getElementById("vm-plan-undo")?.addEventListener("click", deshacer);
  document.getElementById("vm-plan-clear")?.addEventListener("click", borrar);
  document.getElementById("vm-plan-inv")?.addEventListener("click", invertir);
  document.getElementById("vm-plan-csv")?.addEventListener("click", exportCSV);
  document.getElementById("vm-plan-geo")?.addEventListener("click", exportGeoJSON);
  matEl()?.addEventListener("change", () => {
    const m = matEl().value;
    if (N_DEFECTO[m] && nEl()) nEl().value = N_DEFECTO[m];
    programarCalculo();
  });
  qEl()?.addEventListener("change", programarCalculo);
  nEl()?.addEventListener("change", programarCalculo);
  document.addEventListener("keydown", (ev) => {
    if (!activo) return;
    const tag = (ev.target && ev.target.tagName) || "";
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (ev.key === "Backspace") { ev.preventDefault(); deshacer(); }
    if (ev.key === "Escape") setActivo(false);
  });
  window.addEventListener("resize", () => { if (estudio) dibujarPerfil(estudio); });

  // Si se pliega el panel en modo activo, el botón de planeación sigue encendido.
  setActivo(false);
  pintarLista();
  pintarResultado(null, "Active el modo y toque el mapa para empezar el trazo propuesto.");
}
