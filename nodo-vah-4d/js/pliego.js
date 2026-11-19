/* Ajustes del visor en respuesta al Pliego de Observaciones Técnicas (memoria v4.8).
   No inventa cifras. Nada está en «Proyecto ejecutivo validado». */
export const LACTEOS_IDS = new Set(["PL-501", "TQ-501A", "TQ-501B", "AN-501"]);
export const POZOS_RECARGA_IDS = new Set(["PI-803A", "PI-803B", "PI-803C", "PI-803D"]);

export const NIVEL = {
  ante: "Anteproyecto referencial",
  ejec: "Proyecto ejecutivo validado",
};

export const UBICACION = {
  etiqueta: "Ubicación referencial, terreno real por definir",
  aviso: "Ubicación referencial — polígono georreferenciado y acreditación de propiedad pendientes. Terreno real por definir; no se inventa un predio.",
  area: "por confirmar (20,000 / 40,000 m²)",
  areaLarga: "por confirmar (el polígono de la memoria es 200 × 200 m = 40,000 m²; otra versión indica 20,000 m²; terreno real por definir)",
  memoria: "UTM 13R 654,200–654,400 E / 2,854,600–2,854,800 N (≈ 25.80° N, 103.46° W), unos 26 km al norte de la mancha urbana de Gómez Palacio. El visor no coloca el Nodo en esas coordenadas.",
  visor: "El marcador del Nodo en el mapa de la ciudad es genérico y referencial (junto al PIL). Las coordenadas UTM de la memoria no se usaron para ubicarlo.",
};

export const ATTR_CAMPOS = ["estado", "cota/profundidad", "diámetro", "material", "norma aplicable", "fuente del dato"];

export const PC = "por confirmar";

export function attrs(titulo, campos = {}, extra = {}) {
  const a = { titulo, tag: NIVEL.ante, estado: PC, "cota/profundidad": PC, diámetro: PC, material: PC, "norma aplicable": PC, "fuente del dato": PC, ...campos, ...extra };
  return a;
}

export function fichaHTML(a, extraRows = []) {
  const filas = ATTR_CAMPOS.map((k) => [k, a[k] || PC]);
  for (const [k, v] of Object.entries(a)) {
    if (k === "titulo" || k === "tag" || ATTR_CAMPOS.includes(k)) continue;
    filas.push([k, v]);
  }
  for (const row of extraRows) filas.push(row);
  const tag = a.tag || NIVEL.ante;
  return `<button class="x" onclick="this.parentNode.hidden=true">×</button>
    <h3>${a.titulo}<span class="tag ref">${tag}</span></h3>
    <table>${filas.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}</table>`;
}

export function notaFinancieraHTML() {
  return `<div class="fin-agua">
    <h3>Módulo de agua (independiente)</h3>
    <p>Núcleo de agua (tratamiento SIBRA + automatización): <b>22.09 MDP</b> sin IVA (presupuesto real, 25-oct-2026; v4.8). El piloto de alcance del documento suma 80.52 MDP sin IVA e incluye la planta láctea, que se separa abajo.</p>
    <p>Ingreso del módulo de agua, corrida formal: <b>por calcular (corrida 15–20 años pendiente)</b>.</p>
    <p>Tarifa de <b>$7.70/m³</b>: <b>hipotética — sujeta a cartas de intención tipo take-and-pay (solo agua medida y entregada)</b>. El documento estima, como hipótesis y no como tarifa vigente, unos 5.5 MDP/año de saneamiento.</p>
  </div>
  <div class="fin-lacteo">
    <h3>Negocio lácteo privado, fuera del alcance público</h3>
    <p>Planta de proteína (lácteos): CAPEX <b>18.60 MDP</b>. Del ingreso proyectado del nodo integrado (36.5 MDP/año, Documento Ejecutivo Maestro), <b>26.0 MDP/año</b> vienen de productos lácteos. No forma parte de la infraestructura hidráulica pública ni de este módulo de agua.</p>
  </div>`;
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
        ${item("Mesa técnica con la CAED y, en su caso, la contratista del Emisor Central (CAED-IPE-082-26), sin alterar programa ni techo financiero")}
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
    <p class="nota tiny">El avance de cada tramo se muestra como <b>sin dato oficial</b> mientras no haya un reporte de la CAED o de la contratista. No se asigna un porcentaje inventado. Los campos de cierres viales, rutas alternas, registros o ductos de reserva e interferencias quedan como placeholders, todos <b>por confirmar</b>.</p>
    <div class="ley"><span><i class="sem-off"></i>Sin dato oficial</span><span><i class="sem-obra"></i>En obra (solo si hay fuente)</span><span><i class="sem-ok"></i>Terminado (solo si hay fuente)</span></div>
    <div class="tabla-wrap t100-tabla"><table class="tz2">
      <thead><tr><th>Tramo</th><th>Sección</th><th>Metros</th><th>Avance</th><th>Cierres viales</th><th>Rutas alternas</th><th>Registros / ductos de reserva</th><th>Interferencias</th></tr></thead>
      <tbody>${filas}</tbody>
    </table></div>
  </div>`;
}

export const INF_TEORICO = "teóricos — pendiente muestreo compuesto y aforo con laboratorio acreditado EMA";
export const TARIFA_NOTA = "hipotética — sujeta a cartas de intención tipo take-and-pay (solo agua medida y entregada)";
export const RECARGA_NOM = "Fase futura — condicionada a estudio hidrogeológico y NOM-014-CONAGUA-2003 (riesgo de arsénico)";
