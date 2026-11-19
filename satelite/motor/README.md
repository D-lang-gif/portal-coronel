# Motor satelital · NODO VAH (Gómez Palacio, Dgo.)

Motor automático que alimenta el panel **Vigilancia satelital** del visor `nodo-vah-4d/`.
Busca **zonas urbanas que siguen húmedas en temporada seca** (posibles fugas de agua potable o
drenaje) y las entrega como **«Zona a revisar con cámara»**. No confirma fugas.

## Qué hace cada corrida

1. **Escenas**: Copernicus Sentinel-2 L2A en Earth Search (Element 84, sin llave), tile 13RFJ,
   últimos ~13 meses. Lee solo la ventana de la ciudad de B04, B08, B8A, B11 y SCL (COG).
2. **Área**: municipio de Gómez Palacio (límite OSM) ∩ recorte urbano. Torreón y Lerdo quedan fuera.
   Solo píxeles **construidos** (ESA WorldCover 2021, clase 50) y fuera de parques, canchas, cultivos,
   pasto, cuerpos de agua y canales de OpenStreetMap (+20 m).
3. **Lluvia** (doble filtro): (a) lluvia diaria de Open-Meteo (reanálisis ERA5): escena «tras lluvia» si
   llovió > 2 mm (día + 3 previos) o > 5 mm (día + 7 previos); (b) filtro de Pulso: si la mediana urbana
   del NDMI ese día supera la mediana del año en > 0.04 (equivale al +0.03 de Pulso, que trabajó sin corregir
   el desplazamiento BOA de −1000), toda la ciudad está mojada. Esas escenas **no se usan para fugas**;
   si están despejadas, sirven para **encharcamientos** (agua SCL en zona urbana).
4. **Índices** (20 m): NDMI = (B8A−B11)/(B8A+B11); NDVI = (B08−B04)/(B08+B04); nubes, sombras y
   orillas fuera con SCL (clases 4, 5, 6, igual que Pulso). Último año de escenas despejadas.
5. **Anomalía (método Pulso, `motor_fugas/UMBRALES_PULSO.md`)**: en cada escena, z del NDMI contra la
   mediana y desviación de **la ciudad ese mismo día** (quita el cambio de temporada; con una línea base fija
   salían ~143 falsas fugas tras lluvias). Píxeles con NDVI mediano < 0.35. Dos clases:
   - **nueva**: z > 2.5 y z − z histórico del propio píxel > 2, en ≥ 60 % de las escenas de los últimos
     45 días (mín. 2) y en < 20 % de su historia.
   - **humedad constante** (posible fuga vieja, descarga, tanque o riego): z > 2 en ≥ 60 % de todas las escenas.
   - Prueba **«recién mojada»**: una «nueva» debe haber estado seca (z ≤ 2) en ≥ 80 % de al menos 6 escenas
     previas a su primera detección; si no, pasa a «humedad constante». El resultado va en `prueba_recien_mojada`.
   Grupos de ≥ 4 píxeles (1,600 m²) → polígonos. Pulso además aplica una apertura morfológica; aquí no,
   para no borrar manchas de 4–5 píxeles (por eso salen más «nuevas» de confianza media o baja).
6. **Seguimiento**: `estado/seguimiento.json` une cada zona con la de corridas anteriores
   (IoU ≥ 0.1 o centroides a ≤ 60 m) y conserva su ID (`GP-H001`…). Se retira tras 3 corridas
   con escena nueva sin verla.
7. **Por zona**: «presente en N pasadas desde <fecha>», días en imágenes (días que el satélite la
   ha visto, **no** la antigüedad de una fuga), intensidad 0–100, confianza, explicación en español,
   calle más cercana (OSM) y distancia al colector/emisor del visor (trazo **referencial**).

## Salidas (`nodo-vah-4d/data/satelite/`)

| Archivo | Contenido |
|---|---|
| `zonas_humedad.geojson` | Zonas `tipo: humedad` (esquema de `LEEME_formato.md` + campos extra) |
| `encharcamientos.geojson` | `tipo: encharcamiento` tras lluvia (solo Sentinel-2 despejado) |
| `escenas.json` | Escenas consultadas: fecha, nubes, % despejado, lluvia 3d/7d, uso, miniatura |
| `lluvia_gp.json` | Lluvia diaria de los últimos 12 meses (Open-Meteo/ERA5, CC BY 4.0) |
| `estado_motor.json` | Última corrida, conteos, parámetros, versión |
| `index.json` | Se agregan los archivos del motor sin quitar los de otros |

## Intensidad (0–100)

`100 × (0.35·min(1,(z_ciudad−2)/3) + 0.30·persistencia (reciente en «nueva», anual en «constante») + 0.15·min(1, días/60) + 0.20·min(1, píxeles/15))`

## Confianza y prioridad

- **baja**: vista en una sola pasada, o a < 40 m de parque/cancha/parcela (OSM).
- **alta**: ≥ 6 píxeles y ≥ 10 días húmeda (regla de prioridad de Pulso) y sin lo anterior.
- **media**: el resto. Las «nuevas» que aparecen ≤ 14 días después de una lluvia ≥ 5 mm lo dicen en la explicación.

## Modos

- `normal` (por defecto): umbrales de Pulso.
- `estricto`: `MOTOR_MODO=estricto` o `--modo estricto` (z nueva > 3, z constante > 2.5, persistencia ≥ 80 %,
  ≥ 6 píxeles, ≥ 85 % de ciudad despejada). Menos zonas, más seguras.

## Correr a mano

```bash
pip install -r satelite/motor/requirements.txt
python satelite/motor/motor.py --png vista_previa.png
```

El workflow `.github/workflows/motor_satelital.yml` corre cada 5 días (revisita de Sentinel-2)
y a mano (`workflow_dispatch`); solo hace commit si cambian las salidas.

## Límites

- 20 m por píxel: una fuga pequeña bajo banqueta no se ve; se ven manchas ≥ ~1,600 m².
- Humedad ≠ fuga: lavaderos, autolavados, riego no mapeado, sombra o techos pueden dar señal.
- OSM (`cache/osm_gp.json`, extracto Geofabrik 17-nov-2026) se refresca con Overpass cada 120 días si responde.
- Colectores y emisor del visor son trazos referenciales; la distancia es orientativa.
- Credenciales futuras (Copernicus, NASA Earthdata): solo como GitHub Secrets. Sin datos personales en salidas.
- Hundimientos (Sentinel-1 InSAR): ver `INSAR_LEEME.md`.
