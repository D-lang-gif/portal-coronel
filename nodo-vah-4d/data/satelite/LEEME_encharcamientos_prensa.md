# Hemeroteca de encharcamientos en Gómez Palacio (prensa, 2023-2026)

Capa de **prensa**, no oficial. Cada punto es un lugar **nombrado en una nota** durante un evento de lluvia, con fecha, cita corta, medio y URL. Sirve para el visor del NODO VAH y para mostrar, con fuentes, que hay puntos que se encharcan una y otra vez.

La capa oficial (Atlas de Riesgos, Protección Civil, CENAPRED) la arma **Nova/003** en `encharcamientos_oficiales_gp.geojson` (ENC-01 a ENC-15), en esta misma carpeta y en `Aportes_Pliego/lluvia/`. Cuando un punto de prensa coincide con uno de esos 15 (misma calle, puente o colonia), el campo `enc_nova` trae el número de Nova. Si no hay coincidencia, queda vacío. No se copió el Atlas ni se inventaron polígonos.

Consulta de fuentes: **19 de noviembre de 2026** (zona America/Mexico_City).

## Archivos

- `encharcamientos_prensa_gp.csv` y `encharcamientos_prensa_gp.geojson` — Gómez Palacio.
- `encharcamientos_prensa_lerdo.csv` y `encharcamientos_prensa_lerdo.geojson` — un solo punto de Lerdo que salió en la misma nota del 11-12 de noviembre de 2023. No se hizo hemeroteca de Torreón ni de Lerdo.
- Esta nota: `LEEME_encharcamientos_prensa.md`.

Hay copias idénticas en `Aportes_Pliego/satelite/` y `Aportes_Pliego/lluvia/`.

## Conteos

- **10 eventos de lluvia** con fecha (julio 2023 a octubre 2026), más **1 reporte** de inundación en Urbi Villas (9 de septiembre de 2025) cuya nota no precisa el día de la lluvia.
- **93 puntos** en Gómez Palacio (un renglón por lugar y por evento; si varias notas cubren el mismo sitio en el mismo evento, se dejó la cita más precisa).
- **45 puntos** con coordenada; **48** sin ella (`geometry: null` en el GeoJSON).
- **47 puntos** cruzados con la capa de Nova (`enc_nova`). No hubo coincidencia de prensa para ENC-13 (Abraham Rosales) ni para ENC-15 (Av. Francisco Villa frente a Granjas 1, que además es un hundimiento).
- **16 URLs** de cuatro medios: El Siglo de Torreón (57 puntos), Periódico El Centauro del Norte (23), Contexto de Durango (11) y Hola MX (2).

## Eventos (lluvia reportada en la nota)

Las milimetradas salen de pluviómetros o estimaciones de Protección Civil, SIDEAPA o Bomberos, citadas por la prensa. No se encontró un boletín de estación CONAGUA/SMN para estos eventos. El 27 de septiembre de 2025, El Siglo de Torreón citó a Protección Civil: «la Comisión Nacional del Agua no cuenta con medición en esta parte de la región Laguna».

| Fecha del evento | Lluvia reportada | Qué se usó en el campo `lluvia_mm_si_hay` |
|---|---|---|
| 2023-07-03 (lunes noche) | 18 mm en el pluviómetro de Bomberos, Blvd. Ejército Mexicano | 18 |
| 2023-10-29 (tromba, noche del domingo) | 30 mm en poco más de dos horas | 30 |
| 2023-11-11 (sábado noche al domingo 12) | 48.5 mm (22:00 a 12:30) | 48.5 |
| 2024-08-31 (sábado 19:00 al domingo 1 sep 07:00) | 52.4 mm | 52.4 |
| 2025-09-06 (sábado desde las 22:20) | 30 a 35 mm, **estimado** por Protección Civil | 30-35 (estimado PC) |
| 2025-09-09 | Urbi Villas: inundación de calles y aguas negras; la nota no da mm ni fecha de lluvia | (vacío) |
| 2025-09-26 (viernes noche) | Hasta 25 mm en 15-20 min en El Campanario y El Vergel; 15 mm en el resto del norte | 25 o 15, según el sector |
| 2026-04-04 (sábado 20:20, granizada) | 15 mm | 15 |
| 2026-06-14 (domingo noche al lunes 15) | Solo un pronóstico de que «no supere los 10 o 15 mm»; no hay medición | (vacío) |
| 2026-10-02 (viernes ~03:00; contingencia del 29 sep al 4 oct) | 35 mm en la mancha urbana y 60 mm en la Sierra del Sarnoso (saldo municipal del 5 oct) | 35 en zona urbana; «60 (Sierra del Sarnoso)» en ejidos (es la lluvia en la sierra que provocó el escurrimiento, no un pluviómetro en el ejido) |
| 2026-10-16 (viernes) | 12 mm en la mancha urbana; 18 mm en el medio rural (al mediodía) | 12 o 18 |

## Puntos que se repiten (el argumento más fuerte)

Un mismo lugar que aparece en **varios eventos** no es un accidente de una sola tromba. Estos son los que tienen dos o más fechas distintas en esta hemeroteca:

**Siete eventos, si se toma junto el fraccionamiento y el puente (sistema Hamburgo):** 29 oct 2023, 11 nov 2023, 6 sep 2025, 26 sep 2025, 4 abr 2026, 2 oct 2026 y 16 oct 2026. El 2 de octubre de 2026, en el cruce del bulevar Arboledas con la avenida Sta. María Rosa, un vecino dijo a El Siglo: «toda la colonia está anegada y es agua de lluvia y drenaje». El 16 de octubre volvió a haber afectaciones por la falla de una bomba pluvial, con solo 12 mm.

| Lugar | Eventos | Fechas |
|---|---|---|
| El Amigo | 6 | 2023-10-29, 2023-11-11, 2025-09-06, 2025-09-26, 2026-04-04, 2026-10-02 |
| Torremolinos (también escrito Torre Molinos / Torres Molinos) | 6 | 2023-10-29, 2023-11-11, 2024-08-31, 2025-09-06, 2026-10-02, 2026-10-16 |
| Puente Hamburgo (Blvd. Ejército Mexicano) | 5 | 2023-10-29, 2023-11-11, 2025-09-06, 2025-09-26, 2026-04-04 |
| Felipe Ángeles | 5 | 2023-10-29, 2024-08-31, 2025-09-06, 2026-04-04, 2026-10-02 |
| Carlos Herrera (incluye el «sector del pluvial») | 4 | 2023-10-29, 2024-08-31, 2026-04-04, 2026-10-02 |
| Fidel Velázquez (Chapala) | 3 | 2023-10-29, 2024-08-31, 2026-10-02 |
| Nuevo Castillo | 3 | 2023-07-03, 2023-11-11, 2024-08-31 |
| Puente Centenario (Blvd. Ejército Mexicano) | 3 | 2023-07-03, 2023-10-29, 2023-11-11 |
| Puente Jabonoso (Blvd. Ejército Mexicano) | 3 | 2023-07-03, 2023-11-11, 2026-04-04 |
| Rebollo Acosta (colonia o Mercado de Abastos) | 3 | 2023-11-11, 2026-04-04, 2026-10-02 |
| Rinconadas / Rinconada Hamburgo (solo la colonia) | 3 | 2025-09-26, 2026-10-02, 2026-10-16 |
| Paso a desnivel 11-40 | 2 | 2026-04-04, 2026-10-02 (en ambos, por falla de energía en el cárcamo) |
| Paso a desnivel Urrea | 2 | 2023-10-29, 2026-10-02 (también por corte de energía) |
| El Campanario | 2 | 2025-09-26, 2026-10-02 |
| Rinconada Bugambilias | 2 | 2023-11-11 (destape de alcantarillas), 2026-10-16 (agua a la altura de los cordones) |
| San Ángel, Hortensias, Nuevo Los Álamos | 2 cada uno | ver el CSV |
| Avenida Morelos (cuando la nota no precisa el tramo) | 2 | 2025-09-06, 2026-04-04; en 2023 y 2026 también hay tramos nombrados en Nuevo Los Álamos, La Herradura, Nuevo Refugio y El Refugio |

## Cruce con la capa de Nova (`enc_nova`)

Se asignó el ENC solo cuando la nota nombra la misma colonia, el mismo puente o el mismo tramo de calle. No se forzó, por ejemplo, «Francisco Villa y Escobedo» (4 abr 2026) a ENC-15 («Av. Francisco Villa frente a Granjas 1»). Tampoco se asignó ENC-08 a «Avenida Morelos» cuando la nota no dice El Refugio ni Nuevo Refugio.

| ENC de Nova | Lugar oficial | Puntos de prensa |
|---|---|---|
| ENC-01 | El Amigo (El Amigo Britingham) | 7 (incluye el cierre de Blvd. Jabonoso en El Amigo, 2 oct 2026) |
| ENC-02 | Hamburgo / Rinconada Hamburgo / Puente Hamburgo | 8 |
| ENC-03 | Rinconada Bugambilias | 2 |
| ENC-04 | Residencial El Campanario | 2 |
| ENC-05 | Cerradas Marbella y Jaén | 2 (un solo evento, 26 sep 2025) |
| ENC-06 | Felipe Ángeles | 5 |
| ENC-07 | Torremolinos | 6 |
| ENC-08 | Av. Morelos (El Refugio / Nuevo Refugio) | 3 (2 oct 2026) |
| ENC-09 | Paso a desnivel Urrea | 2 |
| ENC-10 | Paso a desnivel 11-40 | 2 |
| ENC-11 | Av. Madero (Sarabia a Japón) | 1 |
| ENC-12 | Carlos Herrera | 4 |
| ENC-13 | Abraham Rosales | 0 en esta hemeroteca |
| ENC-14 | Rebollo Acosta | 3 |
| ENC-15 | Av. Francisco Villa frente a Granjas 1 | 0 (y no es encharcamiento) |

## Método

1. Se buscaron y se abrieron notas de 2023 a 2026 en El Siglo de Torreón, El Centauro del Norte, Contexto de Durango, Hola MX, El Sol de la Laguna y Zócalo. Las de Milenio sobre estos eventos devolvieron 403 y no se usaron como fuente primaria.
2. Solo entró un punto si la nota **nombra el lugar** y describe encharcamiento, anegación, inundación, acumulación de agua, desagüe con motobombas, o un cierre vial por agua en ese evento. La cita en `descripcion_textual` es corta y textual (o un recorte fiel con `[...]`).
3. La `fecha_evento` es el día de la lluvia, no el de la nota. En contingencias de varios días (29 sep-4 oct 2026) se usó el día pico (2 de octubre).
4. No se inventaron los «24 puntos de encharcamiento crítico» del saldo municipal del 5 de octubre de 2026: solo se registraron los que la prensa **nombró**.
5. Geocodificación con Nominatim/OSM (una consulta por segundo, 19 nov 2026). Se aceptó un resultado solo si cae en el municipio y el nombre OSM corresponde al lugar. Precisión:
   - `exacta` — un edificio o infraestructura identificable (Central de Abastos).
   - `cruce` — intersección o tramo de calle nombrado (por ejemplo, Blvd. Arboledas junto a Sta. María Rosa; Calle Mariano Urrea, que no es el desnivel mismo).
   - `colonia_centroide` — plaza, parque o localidad OSM del mismo nombre, **no** el polígono de la colonia.
6. Si no hubo un objeto OSM claro, o el nombre era ambiguo (varias calles Hortensias, varios San Ángel, «11-40» que devolvía el centro de la ciudad), las coordenadas se dejaron vacías. No se interpolaron cruces.

## Límites y huecos (para que no parezca fantasía)

- **No es un censo oficial.** Es hemeroteca. Lo que no salió en la prensa de estos medios no está. La capa de Nova y el Atlas cubren el lado institucional.
- **Atlas de Riesgos (solo mención):** el Atlas de Riesgos Naturales de Gómez Palacio 2014 (SEDATU/SIGEMA, contrato PMGP-DJ-63-2014, PDF en rmgir.proyectomesoamerica.org) ya señalaba inundaciones recurrentes en El Amigo Britingham, Rinconada Bugambilias y Hamburgo / Rinconada Hamburgo. La actualización de 2025, según Milenio, apunta como vulnerables Carlos Herrera, Abraham Rosales, El Amigo y Rebollo Acosta. Nova documenta que el 19 nov 2026 el servicio de polígonos «Peligro por Inundación» del servidor Mesoamericano respondió error 500.
- El saldo del 5 de octubre de 2026 habla de **24 puntos críticos, 8 vialidades y 2 desniveles** en la zona urbana; aquí solo están los que se nombraron.
- **1-2 de julio de 2025:** Hola MX reportó 6.9 mm y «algunas áreas con encharcamientos» sin nombrar colonias. Una nota de Milenio del mismo día (bloqueada, 403) parece citar El Amigo y Felipe Ángeles; **no se incluyeron** porque no se pudo verificar la página.
- No se metieron notas que dicen que **se evitó** el encharcamiento (por ejemplo, el Puente Centenario tras la obra de 2024, o los desniveles que «funcionaron» en varios eventos).
- En el 11-12 nov 2023, Rinconada Bugambilias e Hijos de Campesinos entran como «destape de alcantarillas para el desazolve», no como inundación confirmada. El 2 oct 2026, los cierres de Morelos, Jabonoso y Madero se citan como «cierres viales preventivos». El hundimiento del Blvd. Miguel Alemán (El Campestre) se etiquetó como hundimiento, no como encharcamiento.
- «Pastor Roauix» en El Siglo se registró como colonia **Pastor Rouaix**, conservando la grafía de la nota en la cita.
- No se incluyó la inundación del ejido El Vergel por canal de riego (denuncia a CONAGUA, 2024): no es encharcamiento pluvial de este registro.
- Coordinadas que se corrigieron a propósito: el ejido Poanas no es la «Calle Ejido Poanas» del área urbana; se usó la localidad OSM al norte (25.771, -103.607). Numancia y Cuatro de Diciembre no recibieron la coordenada del camino que los une, porque no es el asentamiento.

## Fuentes (URLs usadas)

1. https://periodicoelcentaurodelnorte.com.mx/atiende-ayuntamiento-a-la-brevedad-reportes-de-encharcamientos/
2. https://contextodedurango.com.mx/reporta-proteccion-civil-de-gomez-palacio-afectaciones-menores-por-tromba/
3. https://www.elsiglodetorreon.com.mx/noticia/2023/atiende-ayuntamiento-de-gomez-palacio-contingencia-por-lluvias-y-emite-recomendaciones.html
4. https://www.elsiglodetorreon.com.mx/noticia/2023/lluvia-causa-afectaciones-en-vialidades-y-colonias-de-gomez-palacio-y-lerdo.html
5. https://www.elsiglodetorreon.com.mx/noticia/2024/por-lluvia-se-cae-techo-de-vivienda-en-ejido-jimenez-y-tres-pozos-dejan-de-funcionar.html
6. https://hola.mx/gomez-palacio/atienden-en-gomez-palacio-afectaciones-por-lluvias-3240
7. https://periodicoelcentaurodelnorte.com.mx/gobierno-de-gomez-palacio-activa-plan-de-contingencia-por-lluvias-no-se-registran-afectaciones-mayores/
8. https://www.elsiglodetorreon.com.mx/noticia/2025/acude-personal-de-sideapa-a-urbi-villas-en-gomez-palacio.html
9. https://www.elsiglodetorreon.com.mx/noticia/2025/en-cuestion-de-minutos-lluvia-alcanzo-hasta-los-25-mm-en-el-sector-de-el-campanario-en-gomez-palacio.html
10. https://periodicoelcentaurodelnorte.com.mx/lluvias-en-gomez-palacio-ocasionaron-diversos-encharcamientos-atendidos-de-inmediato/
11. https://periodicoelcentaurodelnorte.com.mx/granizada-y-chubasco-colapsan-vialidades-en-gomez-palacio-activan-operativo-emergente/
12. https://www.elsiglodetorreon.com.mx/noticia/2026/tras-lluvias-gomez-palacio-esta-transitable-proteccion-civil.html
13. https://www.elsiglodetorreon.com.mx/noticia/2026/es-deprimente-dicen-vecinos-de-hamburgo-tras-inundaciones-por-lluvias.html
14. https://www.elsiglodetorreon.com.mx/noticia/2026/lluvias-causan-afectaciones-en-21-sectores-urbanos-de-gomez-palacio.html
15. https://www.elsiglodetorreon.com.mx/noticia/2026/presentan-saldo-que-dejaron-lluvias-en-gomez-palacio-anuncian-42mdp-para-cuartos-dormitorio.html
16. https://www.elsiglodetorreon.com.mx/noticia/2026/gomez-palacio-activa-protocolo-por-lluvias-falla-bomba-de-drenaje-pluvial-en-hamburgo.html
