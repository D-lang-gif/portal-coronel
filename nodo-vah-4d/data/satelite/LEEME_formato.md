# Formato de capas satelitales (Nodo VAH)

Archivos que el visor carga en el panel **Vigilancia satelital**.

## Dónde colocarlos

1. En este expediente: `Aportes_Pliego/satelite/` (trabajo de Pulso, Nano y el resto del equipo).
2. Copia publicada del visor: `nodo-vah-4d/data/satelite/`, listada en `index.json`.

El panel **carga cualquier `*.geojson` que aparezca en** `data/satelite/index.json`. No recorre el directorio por su cuenta.

## Nombres reservados

| Archivo | Quién lo produce |
|---|---|
| `zonas_humedad_pulso_2026.geojson` | Pulso (manchas de humedad / vegetación fuera de temporada, Sentinel-2). Ya cargado, solo zonas al poniente del Río Nazas (Gómez Palacio). |
| `zonas_humedad.geojson` | Motor automático (otro compañero, más adelante). No usar este nombre para el archivo de Pulso. |
| `zonas_hundimiento_*.geojson` | Nano (hundimientos, Sentinel-1 InSAR), cuando existan. |

`index.json` tiene la forma:

```json
{ "archivos": ["zonas_humedad_pulso_2026.geojson"] }
```

## Esquema GeoJSON

`FeatureCollection` en **WGS84 (EPSG:4326)**. Cada *feature* es un `Point` o un `Polygon` / `MultiPolygon`.

Propiedades obligatorias:

| Campo | Tipo | Valores |
|---|---|---|
| `id` | texto | Identificador único (ej. `H03`) |
| `tipo` | texto | `humedad` o `hundimiento` |
| `intensidad` | número | Magnitud de la anomalía (en el archivo de Pulso es el mismo valor que `persist`) |
| `fecha` | texto | Fecha o intervalo de las escenas (ISO, `YYYY-MM-DD` o `YYYY-MM-DD/YYYY-MM-DD`) |
| `fuente` | texto | Sensor, proveedor y método |
| `nota` | texto | Lectura cautelosa de lo que sí y no se afirma |

Propiedades opcionales que el visor ya entiende:

| Campo | Uso |
|---|---|
| `etiqueta` | Texto en lista y mapa. En humedad debe ser **Zona a revisar con cámara**. Nunca «fuga confirmada». |
| `foto` | Ruta relativa al GeoJSON (par de imágenes color real + humedad, u otra evidencia) |
| `area_m2`, `persist`, `ndmi`, `ndvi` | Valores originales de Pulso; no alterarlos |
| `escenas`, `tile`, `metodo`, `origen` | Trazabilidad |

Ejemplo mínimo:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [-103.48824, 25.54904] },
      "properties": {
        "id": "H03",
        "tipo": "humedad",
        "intensidad": 0.983,
        "fecha": "2025-11-02/2026-05-11",
        "fuente": "Sentinel-2 L2A (ESA/Copernicus)",
        "nota": "Zonas candidatas a revisar con cámara; no confirman fuga.",
        "etiqueta": "Zona a revisar con cámara"
      }
    }
  ]
}
```

## Cómo se presenta en el visor

- Título de la capa en la vista principal: **Zonas para revisar primero (satelital)**.
- Cada mancha de humedad se etiqueta **Zona a revisar con cámara**. No se afirma que sea una fuga.
- En **Fichas técnicas** se recuerda que una mancha también puede ser un lavadero, un autolavado o una llave que chorrea.
- Al pulsar una zona, el visor vuela hasta ella, abre el par de fotos si existe y señala calles, tuberías y la obra del Plan Fluye más cercana.


## Zona GP-001 (motor de humedad Pulso)

Además de las manchas de temporada seca (`zonas_humedad_pulso_2026.geojson`), el índice carga `zona_humedad_motor_fugas_gp001.geojson`: una zona de humedad nueva (posible fuga) del motor de Pulso, corrida 19-nov-2026. Se etiqueta «Zona a revisar con cámara». El nombre `zonas_humedad.geojson` sigue reservado para el motor automático.

Los encharcamientos (oficial + prensa) no van en este índice: son la capa «Encharcamientos». Ver `LEEME_encharcamientos.md`.
