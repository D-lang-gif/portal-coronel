# Hundimientos con Sentinel-1 (InSAR) · ruta realista

Este motor **no** procesa InSAR en GitHub Actions: un procesamiento serio necesita decenas de
pares de radar (varios GB) y horas de cómputo. Lo que sí se puede hacer gratis:

## Ruta recomendada: ASF HyP3 (NASA / Alaska Satellite Facility)

1. **Cuenta NASA Earthdata a nombre de Raúl** (gratuita): https://urs.earthdata.nasa.gov/users/new
   La cuenta es personal; nadie más la crea ni la usa en su nombre.
2. En **ASF Vertex** (https://search.asf.alaska.edu/) se buscan escenas Sentinel-1 IW SLC sobre
   Gómez Palacio (misma órbita, 2–3 años) y se piden **pares InSAR GAMMA** o el flujo **SBAS**.
   HyP3 da un cupo mensual gratuito de créditos por cuenta (documentación: https://hyp3-docs.asf.alaska.edu/).
3. Con los interferogramas (GeoTIFF), una serie de tiempo SBAS (p. ej. MintPy) da velocidad de
   hundimiento en mm/año por píxel (~80 m tras multilook).
4. Para automatizarlo después: guardar usuario y contraseña de Earthdata **solo como GitHub Secrets**
   (`EARTHDATA_USERNAME`, `EARTHDATA_PASSWORD`) del repositorio; nunca en el código ni en los datos.

## Lugar reservado en el visor (compatible con Nano)

- Archivo: `nodo-vah-4d/data/satelite/zonas_hundimiento_<origen>.geojson` (nombre reservado en el
  LEEME del visor; el de Nano puede ser `zonas_hundimiento_nano.geojson`).
- Se agrega a `nodo-vah-4d/data/satelite/index.json` sin quitar otras entradas.
- Esquema: el mismo que `zonas_humedad.geojson` con `tipo: "hundimiento"`, más
  `velocidad_mm_anio` (negativo = se hunde), `velocidad_relativa_mm_anio` (frente a su entorno),
  `periodo` (`AAAA-MM-DD/AAAA-MM-DD`), `geometria_vision` (`LOS` o `vertical`).
- `etiqueta`: «Zona a revisar con cámara». En La Laguna todo el valle se hunde por el acuífero;
  lo útil para el drenaje es el **hundimiento diferencial** (una calle que se hunde más rápido que
  su entorno puede quebrar tubos o tener socavón).

## Mapa de Nano (Sentinel-1) y NASA OPERA

- Si Nano deja un GeoTIFF en `Aportes_Pliego/satelite/hundimiento/`, se publica tal cual (convertido a GeoJSON
  `zonas_hundimiento_nano.geojson` con el esquema de arriba); este motor no lo recalcula ni lo modifica.
- NASA OPERA DISP-S1 (desplazamiento InSAR ya procesado) también exige cuenta Earthdata. **No está activado**:
  solo se activará si Raúl abre su cuenta y guarda las credenciales como GitHub Secrets. Antes de activarlo hay
  que confirmar que la cobertura de OPERA DISP-S1 incluye Gómez Palacio.

## Referencias verificadas

- INEGI, *Detección de zonas de subsidencia en México con técnicas satelitales. Volumen 1*,
  apartado 2.4 «La Laguna»: Sentinel-1, técnica PSI, imágenes del 3-dic-2014 al 30-dic-2018;
  máximos de ~12 cm/año al este de Torreón y zona significativa entre El Lucero y San Felipe (Dgo.).
  https://www.inegi.org.mx/contenidos/productos/prod_serv/contenidos/espanol/bvinegi/productos/nueva_estruc/702825188290.pdf
  INEGI publica las capas GeoTIFF (~30 m, mm/año) en Temas › Marco Geodésico › Deformaciones del terreno.
- Estudio del Instituto de Geofísica de la UNAM (Cabral-Cano, Hernández-Luna y otros) sobre subsidencia
  en la Zona Metropolitana de La Laguna, Sentinel-1 de oct-2016/2017 a ago-2023: ~2,940 km² afectados,
  62.5 % del área urbana con subsidencia. Fuente consultada: nota de Milenio
  https://www.milenio.com/ciencia-y-salud/la-laguna-se-hunde-13-centimetros-por-ano-segun-estudio-de-la-unam
  (el sitio bloquea descargas automáticas; contenido verificado por buscador el 19-nov-2026). No se
  localizó en línea el artículo científico original; citar como nota de prensa.

## Lo que no se afirma

Un hundimiento medido por InSAR no prueba una fuga. Marca dónde revisar primero.
