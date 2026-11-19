# Encharcamientos en el visor

Capa única **Encharcamientos**, coloreada por fuente (oficial Nova / prensa Crownteer). Donde coinciden (`enc_nova`) el marca es más fuerte. El tamaño sigue el número de tormentas distintas en la hemeroteca (Hamburgo y su puente: 7; El Amigo: 6; Torremolinos: 6; Felipe Ángeles: 5).

- `encharcamientos_oficiales_gp.geojson` — 15 registros de Nova (Protección Civil, Tránsito, Atlas). ENC-15 es un **hundimiento**, no un encharcamiento. Algunos puntos sin coordenada original se geocodificaron con un centroide o cruce OSM de Gómez Palacio, con la precisión en la ficha. El Amigo, El Campanario, Abraham Rosales y el paso 11-40 no tienen objeto OSM claro y no se inventó coordenada.
- `encharcamientos_prensa_gp.geojson` — 93 puntos fechados (10 eventos, 2023-2026). Solo se dibujan los 45 que ya traen coordenada. Los demás se listan en Fichas técnicas, por colonia. 47 tienen `enc_nova`. No se carga `encharcamientos_prensa_lerdo`.

Fuentes y método: `Aportes_Pliego/satelite/LEEME_encharcamientos_Nova.md` y `LEEME_encharcamientos_prensa.md`.
