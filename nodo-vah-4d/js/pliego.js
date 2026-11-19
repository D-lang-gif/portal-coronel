/* Ajustes del visor en respuesta al Pliego de Observaciones Técnicas (memoria v4.8).
   No inventa cifras. Nada está en «Proyecto ejecutivo validado». */
export const LACTEOS_IDS = new Set(["PL-501", "TQ-501A", "TQ-501B", "AN-501"]);
export const POZOS_RECARGA_IDS = new Set(["PI-803A", "PI-803B", "PI-803C", "PI-803D"]);

export const NIVEL = {
  ante: "Anteproyecto preventivo",
  ejec: "Proyecto ejecutivo validado",
};

export const UBICACION = {
  etiqueta: "Ubicación de referencia",
  aviso: "Ubicación de referencia — polígono georreferenciado y acreditación de propiedad pendientes. Terreno real por definir; no se inventa un predio.",
  area: "por confirmar (20,000 / 40,000 m²)",
  areaLarga: "por confirmar (el polígono de la memoria es 200 × 200 m = 40,000 m²; otra versión indica 20,000 m²; terreno real por definir)",
  memoria: "UTM 13R 654,200–654,400 E / 2,854,600–2,854,800 N (≈ 25.80° N, 103.46° W), unos 26 km al norte de la mancha urbana de Gómez Palacio. El visor no coloca el Nodo en esas coordenadas.",
  visor: "El marcador del Nodo en el mapa de la ciudad es genérico (junto al PIL): ubicación de referencia. Las coordenadas UTM de la memoria no se usaron para ubicarlo.",
};

/* Nombres de la tabla 14.2 de la v4.9 (Del visor demostrativo a herramienta de gestión) */
export const ATTR_CAMPOS = ["Estado", "Cota y profundidad", "Diámetro y material", "Norma aplicable", "Fuente del dato", "Identificador"];

export const PC = "por confirmar";

function pick(obj, keys, fb = PC) {
  for (const k of keys) if (obj[k] != null && obj[k] !== "") return obj[k];
  return fb;
}
function diametroMaterial(c) {
  if (c["Diámetro y material"]) return c["Diámetro y material"];
  const d = c.diámetro, m = c.material;
  const parts = [d, m].filter((v) => v && v !== PC);
  if (parts.length) return parts.join(" · ");
  return d || m || PC;
}

export function attrs(titulo, campos = {}, extra = {}) {
  const c = { ...campos };
  const a = {
    titulo,
    tag: NIVEL.ante,
    Estado: pick(c, ["Estado", "estado"]),
    "Cota y profundidad": pick(c, ["Cota y profundidad", "cota/profundidad", "Cota", "Profundidad"]),
    "Diámetro y material": diametroMaterial(c),
    "Norma aplicable": pick(c, ["Norma aplicable", "norma aplicable", "Norma"]),
    "Fuente del dato": pick(c, ["Fuente del dato", "fuente del dato"]),
    Identificador: pick(c, ["Identificador", "identificador", "id"], PC),
    ...extra,
  };
  return a;
}

export function fichaHTML(a, extraRows = []) {
  const skip = new Set(["titulo", "tag", "estado", "cota/profundidad", "diámetro", "material", "norma aplicable", "fuente del dato", "identificador", "id", ...ATTR_CAMPOS]);
  const filas = ATTR_CAMPOS.map((k) => [k, a[k] || PC]);
  for (const [k, v] of Object.entries(a)) {
    if (skip.has(k)) continue;
    filas.push([k, v]);
  }
  for (const row of extraRows) filas.push(row);
  const tag = a.tag || NIVEL.ante;
  return `<button class="x" onclick="this.parentNode.hidden=true">×</button>
    <p class="ficha-kicker">Fichas técnicas</p>
    <h3>${a.titulo}<span class="tag ref">${tag}</span></h3>
    <table>${filas.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}</table>`;
}

export function notaFinancieraHTML() {
  const est = "estimado · corrida de Foster";
  return `<div class="fin-agua">
    <h3>Precio mínimo take-and-pay: <b>21.67 $/m³</b> (15 años)</h3>
    <p>Cifra de cabecera del módulo de agua (<b>${est}</b>): 100 % de compra, sin IVA, tasa real 10 %. A 20 años: <b>20.56 $/m³</b>. Con un 40 % de PROAGUA (<b>no aprobado</b>): <b>17.49 $/m³</b> a 15 años. Con contratos de compra (~$21.67/m³) o apoyo PROAGUA, la operación se puede sostener. No se afirma que el módulo se pague solo.</p>
    <p>CAPEX: <b>56.34 MDP</b> sin IVA, sin planta láctea ni pozos de infiltración. Los pozos de infiltración (0.48 MDP) quedan <b>excluidos del piloto</b>.</p>
    <p>OPEX de agua, caso base: <b>7.97 MDP/año = 11.23 $/m³</b> (estimado; 709,560 m³/año al 100 % del caudal de diseño).</p>
    <p>La tarifa de <b>$7.75/m³</b> (5.5 MDP ÷ 709,560 m³) es <b>propuesta, sujeta a autorización</b>. <b>No es ingreso del caso base</b>: no cubre ni el OPEX (11.23 $/m³) y a esa tarifa el flujo de operación es negativo.</p>
  </div>
  <div class="fin-lacteo">
    <h3>Negocio lácteo privado, fuera del alcance público</h3>
    <p>CAPEX del vehículo lácteo: <b>23.61 MDP</b> sin IVA (<b>${est}</b>). Del ingreso proyectado del nodo integrado (36.5 MDP/año, Documento Maestro), <b>26.0 MDP/año</b> venían de productos lácteos. No forma parte de la infraestructura hidráulica pública ni de este módulo de agua. Sujeta a decisión del promovente.</p>
  </div>`;
}

export const FICHA_MANCHA = "Una mancha de humedad puede deberse también a lavaderos, autolavados o llaves que chorrean. No es una fuga confirmada.";

export function fichaFinancieraHTML() {
  const filas = [
    ["Precio mínimo (15 años)", "21.67 $/m³ · 100 % compra, sin IVA, tasa real 10 % · estimado · corrida de Foster"],
    ["A 20 años", "20.56 $/m³ (estimado)"],
    ["PROAGUA 40 % (no aprobado)", "17.49 $/m³ a 15 años (estimado; no es un ingreso comprometido)"],
    ["CAPEX del módulo de agua", "56.34 MDP sin IVA (estimado · corrida de Foster)"],
    ["OPEX de agua", "7.97 MDP/año = 11.23 $/m³ (estimado; 709,560 m³/año)"],
    ["Tarifa $7.75/m³", "No es ingreso del caso base. Propuesta sujeta a autorización (5.5 MDP ÷ 709,560 m³); no cubre el OPEX."],
    ["Sostén de la operación", "Con contratos de compra (~$21.67/m³) o apoyo PROAGUA, la operación se puede sostener. No se afirma que el módulo se pague solo."],
  ];
  return `<button class="x" onclick="this.parentNode.hidden=true">×</button>
    <p class="ficha-kicker">Fichas técnicas</p>
    <h3>Precio mínimo take-and-pay<span class="tag ref">${NIVEL.ante}</span></h3>
    <table>${filas.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}</table>`;
}

export function rutaValidacionHTML() {
  const pend = `<span class="pend">pendiente</span>`;
  const item = (t) => `<li>${t}${pend}</li>`;
  return `<div class="ruta-val">
    <p class="nota tiny">Aportación que suma a los proyectos ya en marcha del Municipio, de SIDEAPA, de la CAED y de Conagua. No sustituye acuerdos, concesiones ni obras oficiales. Todos los pasos siguen <b>pendientes</b>.</p>
    <details open>
      <summary>Fase 0 · Checklist previo</summary>
      <ul>
        ${item("Polígono georreferenciado y acreditación de propiedad")}
        ${item("Factibilidades SIDEAPA, CFE y uso de suelo")}
        ${item("Muestreo compuesto y aforo con laboratorio acreditado EMA")}
        ${item("Cotizaciones formales (rejas autolimpiantes, telemetría, sensores H₂S/nivel, inspección CCTV, OPEX de agua)")}
        ${item("Cartas de intención tipo take-and-pay (solo agua medida y entregada)")}
        ${item("Recarga al acuífero excluida del piloto (fase futura condicionada a estudio hidrogeológico y NOM-014-CONAGUA-2003, riesgo de arsénico)")}
      </ul>
    </details>
    <details>
      <summary>Nivel 1 · Local (Ayuntamiento y SIDEAPA)</summary>
      <ul>
        ${item("Acuerdo de Cabildo que reconozca la mesa técnica")}
        ${item("Dictamen de compatibilidad con el Plan Fluye y con las concesiones de las PTAR Norte y Oriente")}
        ${item("Puntos de medición / aforo autorizados por SIDEAPA")}
      </ul>
    </details>
    <details>
      <summary>Nivel 2 · Estatal (CAED)</summary>
      <ul>
        ${item("Mesa técnica con la CAED y SIDEAPA (Emisor Central, CAED-IPE-082-26), sin alterar programa ni techo financiero. La coordinación con la contratista, si procede, es solo a través de esa mesa")}
        ${item("Validación técnica del módulo de saneamiento e inscripción en cartera estatal")}
      </ul>
    </details>
    <details>
      <summary>Nivel 3 · Federal (CONAGUA, PROAGUA/PEAS)</summary>
      <ul>
        ${item("Trámites CONAGUA (ocupación de zona federal, obras, reúso o descarga, según corresponda)")}
        ${item("Ventanillas PROAGUA / PEAS, presentadas por Estado y Municipio")}
      </ul>
    </details>
  </div>`;
}

export function semaforoHTML(tramos) {
  const filas = (tramos || []).map((t) => {
    const id = String(t[0]).padStart(2, "0");
    const m0 = t[2], m1 = t[3], sec = t[1];
    return `<tr data-t100="${t[0] - 1}">
      <td><span class="sem-dot sem-off" title="Sin dato oficial"></span>T-${id}</td>
      <td>${sec}″</td>
      <td>${m0}–${m1} m</td>
      <td>sin dato oficial</td>
      <td>${PC}</td>
      <td>${PC}</td>
      <td>${PC}</td>
      <td>vía férrea, gasoductos, fibra — ${PC}</td>
    </tr>`;
  }).join("");
  return `<div class="semaforo">
    <h3>Semáforo de obra por tramo <small>CAED-IPE-082-26 · 100 m</small></h3>
    <p class="nota tiny">El avance de cada tramo se muestra como <b>sin dato oficial</b> mientras no haya un reporte oficial de la CAED (o de la contratista, solo a través de la mesa técnica con CAED y SIDEAPA). No se asigna un porcentaje inventado. Los campos de cierres viales, rutas alternas, registros o ductos de reserva e interferencias quedan como placeholders, todos <b>por confirmar</b>.</p>
    <div class="ley"><span><i class="sem-off"></i>Sin dato oficial</span><span><i class="sem-obra"></i>En obra (solo si hay fuente)</span><span><i class="sem-ok"></i>Terminado (solo si hay fuente)</span></div>
    <div class="tabla-wrap t100-tabla"><table class="tz2">
      <thead><tr><th>Tramo</th><th>Sección</th><th>Metros</th><th>Avance</th><th>Cierres viales</th><th>Rutas alternas</th><th>Registros / ductos de reserva</th><th>Interferencias</th></tr></thead>
      <tbody>${filas}</tbody>
    </table></div>
  </div>`;
}

export const INF_TEORICO = "teóricos — pendiente muestreo compuesto y aforo con laboratorio acreditado EMA";
export const TARIFA_NOTA = "propuesta, sujeta a autorización";
export const PRELIM_FOSTER = "estimado · corrida de Foster";
export const RECARGA_NOM = "Fase futura — condicionada a estudio hidrogeológico y NOM-014-CONAGUA-2003 (riesgo de arsénico)";
