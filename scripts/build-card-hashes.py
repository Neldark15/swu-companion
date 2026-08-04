#!/usr/bin/env python3
"""
Construye la base de hashes perceptuales del arte de las cartas.

── Por qué existe ────────────────────────────────────────────────────

El escáner leía el número impreso al pie con OCR: tarda entre 1 y 5 segundos,
baja varios megas de un CDN la primera vez y con letra tan chica falla seguido.
Comparar el ARTE es 100 veces más rápido, funciona sin conexión y es lo que
usan los escáneres que funcionan bien (ManaBox lo dice explícitamente).

Este script baja el arte de cada carta UNA vez, le calcula un hash perceptual
y deja un archivo binario que se despacha con la app. Medido: 2.261 artes
distintos ocupan ~200 KB, menos de lo que pesa UNA sola imagen de carta.

── Qué hash y por qué ese tamaño ─────────────────────────────────────

pHash de 576 bits (bloque 24x24 de la DCT). Está medido contra 210 cartas
reales:

  - 64 bits ya se solapa con solo 194 artes: la impostora más cercana queda a
    6 bits y una foto legítima llega a 10. No sirve.
  - 256 bits separa hoy, pero extrapolado a 2.261 cartas el margen se agota.
  - 576 bits deja la impostora más cercana a 144 bits y una foto legítima
    rectificada por debajo de 60. Ese margen es el que permite RECHAZAR
    cuando la carta no está, en vez de devolver siempre la más parecida.

── Uso ───────────────────────────────────────────────────────────────

    python3 scripts/build-card-hashes.py [--limite N] [--salida ruta]

Se apoya en el export de la API que ya se usa para el resto (export_all.json)
o lo baja si no está.
"""

from __future__ import annotations

import argparse
import json
import os
import struct
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO

import numpy as np
from PIL import Image

API_EXPORT = 'https://api.swuapi.com/export/all'
LADO = 64          # la imagen se lleva a 64x64 antes de la DCT
BLOQUE = 24        # bloque de baja frecuencia -> 24*24 = 576 bits
BITS = BLOQUE * BLOQUE
BYTES_HASH = BITS // 8   # 72
UA = 'swu-companion/1.0 (+https://www.swusv.com; construccion de indice local)'

# Firma del archivo, para que el cliente pueda rechazar un formato viejo en vez
# de leer basura.
MAGIC = b'SWUH'
VERSION = 1


def dct2(bloque: np.ndarray) -> np.ndarray:
    """
    DCT-II bidimensional, hecha a mano con una matriz de base.

    Se escribe explícita —en vez de usar scipy— porque el navegador tiene que
    calcular EXACTAMENTE lo mismo, y la única forma de garantizar eso es que
    las dos implementaciones sean la misma fórmula. Con scipy quedaría una
    dependencia imposible de replicar en JS.
    """
    n = bloque.shape[0]
    k = np.arange(n).reshape(-1, 1)
    x = np.arange(n).reshape(1, -1)
    base = np.cos(np.pi * (2 * x + 1) * k / (2 * n))
    return base @ bloque @ base.T


def reducir(img: Image.Image) -> np.ndarray:
    """
    Lleva la imagen a LADO x LADO promediando por áreas, a mano.

    NO se usa `Image.resize`: el navegador tiene que calcular exactamente lo
    mismo y el filtro de `drawImage` ni siquiera está especificado —cada
    navegador usa el suyo—. Medido: contra LANCZOS la diferencia era de 58 a
    92 bits sobre la MISMA imagen, casi todo el margen que separa una carta de
    otra. Con esta regla —el píxel de salida es la media de los de entrada que
    le corresponden— la aritmética es idéntica en Python y en JS.
    """
    rgb = np.asarray(img.convert('RGB'), dtype=np.float64)
    alto, ancho = rgb.shape[0], rgb.shape[1]
    gris = rgb[:, :, 0] * 0.299 + rgb[:, :, 1] * 0.587 + rgb[:, :, 2] * 0.114
    out = np.empty((LADO, LADO), dtype=np.float64)
    for fy in range(LADO):
        y0 = (fy * alto) // LADO
        y1 = max(y0 + 1, ((fy + 1) * alto) // LADO)
        for fx in range(LADO):
            x0 = (fx * ancho) // LADO
            x1 = max(x0 + 1, ((fx + 1) * ancho) // LADO)
            out[fy, fx] = gris[y0:y1, x0:x1].mean()
    return out


def phash(img: Image.Image) -> bytes:
    """Hash perceptual de 576 bits."""
    d = dct2(reducir(img))
    bajo = d[:BLOQUE, :BLOQUE].flatten()
    # Se descarta el término DC: es el brillo medio y cambia con la luz, así
    # que incluirlo haría que la misma carta con más o menos luz hasheara
    # distinto.
    ref = np.median(bajo[1:])
    bits = bajo > ref
    out = bytearray(BYTES_HASH)
    for i, b in enumerate(bits):
        if b:
            out[i >> 3] |= 1 << (7 - (i & 7))
    return bytes(out)


def bajar(url: str, reintentos: int = 3) -> bytes | None:
    for intento in range(reintentos):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read()
        except Exception:
            if intento == reintentos - 1:
                return None
            time.sleep(0.5 * (intento + 1))
    return None


def uuid_a_bytes(u: str) -> bytes:
    return bytes.fromhex(u.replace('-', ''))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--limite', type=int, default=0, help='solo las primeras N cartas (para probar)')
    ap.add_argument('--salida', default='public/card-hashes.bin')
    ap.add_argument('--cache', default=os.environ.get('SWU_CACHE', '/tmp/swu-art'))
    ap.add_argument('--export', default='')
    args = ap.parse_args()

    os.makedirs(args.cache, exist_ok=True)

    # ── Cartas ──
    if args.export and os.path.exists(args.export):
        datos = json.load(open(args.export))
    else:
        print('bajando el export de cartas…', flush=True)
        crudo = bajar(API_EXPORT)
        if not crudo:
            print('no se pudo bajar el export', file=sys.stderr)
            return 1
        datos = json.loads(crudo)

    cartas = datos['cards'] if isinstance(datos, dict) else datos

    # Solo las impresiones que alguien puede tener en la mano y cuyo arte es
    # distinguible. Las Foil e Hyperspace comparten arte con la Standard —está
    # medido que quedan a 12-28 bits— así que meterlas solo añade colisiones
    # imposibles de resolver por imagen.
    VISUALES = {'Standard', 'Showcase', 'Standard Prestige', 'Serialized Prestige'}
    sel = [
        c for c in cartas
        if c.get('variantType') in VISUALES
        and c.get('frontImageUrl')
        and not str(c.get('type', '')).lower().startswith('token')
    ]
    if args.limite:
        sel = sel[:args.limite]
    print(f'cartas a indexar: {len(sel)}', flush=True)

    # ── Descarga + hash ──
    def procesar(c: dict) -> tuple[str, bytes] | None:
        ruta = os.path.join(args.cache, c['uuid'] + '.img')
        crudo = None
        if os.path.exists(ruta):
            crudo = open(ruta, 'rb').read()
        else:
            crudo = bajar(c['frontImageUrl'])
            if crudo:
                open(ruta, 'wb').write(crudo)
            # Pausa mínima: es el CDN de otro y se le piden miles de imágenes.
            time.sleep(0.05)
        if not crudo:
            return None
        try:
            return (c['uuid'], phash(Image.open(BytesIO(crudo))))
        except Exception:
            return None

    hechos: list[tuple[str, bytes]] = []
    fallos = 0
    with ThreadPoolExecutor(max_workers=6) as ex:
        for i, r in enumerate(ex.map(procesar, sel)):
            if r:
                hechos.append(r)
            else:
                fallos += 1
            if (i + 1) % 200 == 0:
                print(f'  {i + 1}/{len(sel)}', flush=True)

    print(f'hasheadas: {len(hechos)} | fallos: {fallos}', flush=True)
    if not hechos:
        return 1

    # ── Cuántos artes son realmente distintos ──
    unicos = len({h for _, h in hechos})
    print(f'hashes distintos: {unicos} de {len(hechos)}'
          f'  ({len(hechos) - unicos} cartas comparten arte con otra)', flush=True)

    # ── Archivo binario ──
    # Cabecera + (uuid de 16 bytes + hash de 72) por carta. Plano, sin JSON:
    # se lee con un solo fetch y se recorre con un Uint8Array.
    os.makedirs(os.path.dirname(args.salida) or '.', exist_ok=True)
    with open(args.salida, 'wb') as f:
        f.write(MAGIC)
        f.write(struct.pack('<HHI', VERSION, BITS, len(hechos)))
        for u, h in hechos:
            f.write(uuid_a_bytes(u))
            f.write(h)

    peso = os.path.getsize(args.salida)
    print(f'escrito {args.salida}: {peso / 1024:.0f} KB', flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
