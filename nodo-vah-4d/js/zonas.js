/* Zonas a revisar: solo el motor automático (zonas_humedad.geojson), con GP-001 fusionado a GP-H006. */
export const RANK = { alta: 3, media: 2, baja: 1 };

export function centroideLL(f) {
  const p = f.properties || {};
  if (p.lat != null && p.lon != null) return [+p.lat, +p.lon];
  const c = p.centro;
  if (Array.isArray(c) && c.length >= 2) {
    const a = +c[0], b = +c[1];
    if (Math.abs(a) > 40 && Math.abs(b) < 40) return [b, a];
    return [a, b];
  }
  const pts = [];
  (function walk(x) {
    if (!x) return;
    if (typeof x[0] === "number") pts.push(x);
    else for (const y of x) walk(y);
  })(f.geometry && f.geometry.coordinates);
  if (!pts.length) return [0, 0];
  const lon = pts.reduce((s, q) => s + q[0], 0) / pts.length;
  const lat = pts.reduce((s, q) => s + q[1], 0) / pts.length;
  return [lat, lon];
}

export function distM(a, b) {
  const R = 6371000, p1 = a[0] * Math.PI / 180, p2 = b[0] * Math.PI / 180;
  const dp = p2 - p1, dl = (b[1] - a[1]) * Math.PI / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function esNueva(p) {
  return (p.clase === "nueva" || p.categoria === "nueva");
}

/** engine: features de zonas_humedad.geojson; pulso: features de zona_humedad_motor_fugas_gp001.geojson */
export function fusionarZonas(engine, pulso) {
  const gp = (pulso || []).find((f) => (f.properties || {}).id === "GP-001");
  const list = [];
  let merged = false;
  for (const f of engine || []) {
    const p = { ...(f.properties || {}) };
    if (p.id && /^SH-/i.test(p.id)) continue;
    const ll = centroideLL({ ...f, properties: p });
    if (gp && p.id === "GP-H006") {
      const gll = centroideLL(gp);
      if (distM(ll, gll) < 40) {
        const pg = gp.properties || {};
        p.id_motor = "GP-H006";
        p.id_pulso = "GP-001";
        p.id = "GP-001";
        p.fuentes_fusion = "Motor satelital (GP-H006) y motor de humedad Pulso (GP-001)";
        p.explicacion_pulso = pg.explicacion || "";
        p.foto = pg.foto;
        p.img = (typeof window !== "undefined" && window.SAT_FOTOS && window.SAT_FOTOS["GP-001"]) || pg.img;
        p.clase = p.clase || "nueva";
        p.categoria = p.categoria || "nueva";
        merged = true;
      }
    }
    list.push({ ...f, properties: p, _ll: ll });
  }
  if (gp && !merged) {
    const pg = { ...(gp.properties || {}) };
    pg.clase = "nueva";
    pg.categoria = "nueva";
    pg.img = (typeof window !== "undefined" && window.SAT_FOTOS && window.SAT_FOTOS["GP-001"]) || pg.img;
    list.push({ ...gp, properties: pg, _ll: centroideLL(gp) });
  }
  const nuevas = list.filter((f) => esNueva(f.properties));
  const constan = list.filter((f) => !nuevas.includes(f));
  const ordenN = (a, b) => {
    if (a.properties.id === "GP-001") return -1;
    if (b.properties.id === "GP-001") return 1;
    return (RANK[b.properties.confianza] || 0) - (RANK[a.properties.confianza] || 0)
      || (b.properties.intensidad || 0) - (a.properties.intensidad || 0);
  };
  const ordenC = (a, b) => (RANK[b.properties.confianza] || 0) - (RANK[a.properties.confianza] || 0)
    || (b.properties.intensidad || 0) - (a.properties.intensidad || 0)
    || String(a.properties.id).localeCompare(String(b.properties.id));
  return [...nuevas.sort(ordenN), ...constan.sort(ordenC)];
}
