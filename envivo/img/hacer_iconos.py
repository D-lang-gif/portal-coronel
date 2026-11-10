"""Genera los iconos PNG de la app (Android los pide en PNG) desde iconos_png.b64.json.
Lo ejecuta el workflow de GitHub Pages antes de publicar."""
import base64, json, os
aqui = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(aqui, "iconos_png.b64.json")) as f:
    for nombre, b64 in json.load(f).items():
        with open(os.path.join(aqui, nombre), "wb") as out:
            out.write(base64.b64decode(b64))
        print("icono", nombre)
