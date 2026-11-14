// Configuración sencilla del visor Nodo VAH 4D.
// FRANJA_SELLOS: banda institucional de la portada y de «Créditos», aprobada por el titular el 14-nov-2026.
// Es el archivo sellos/franja_sellos_sin_letras.png de la Propuesta Integral 2026, tal cual (sin textos debajo).
// Va en data/franja_sellos.js (los mismos bytes del PNG, como data URL) porque el sitio se publica solo con archivos de texto.
// Para cambiarla: regenere data/franja_sellos.js, o ponga «src» con la ruta de una imagen; para ocultarla, mostrar: false.
window.NODO_CONFIG = {
  FRANJA_SELLOS: { js: "data/franja_sellos.js", src: "", alt: "Sellos: Séptimo Ángel, Instituto de Arte y Cultura General Gregorio A. García, A.C. y RMV Capital", mostrar: true },
};
