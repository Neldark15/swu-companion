#!/usr/bin/env python3
"""
Construye la base de datos del módulo RULLINGS a partir del PDF oficial.

── Por qué existe ────────────────────────────────────────────────────

El módulo RULLINGS necesita TODAS las reglas oficiales del juego, buscables
sin conexión y sin IA. La fuente normativa es el Comprehensive Rules de
Fantasy Flight Games (PDF público, en inglés). Este script lo convierte UNA
vez en un JSON estático que viaja con la app (el mismo patrón que
build-card-hashes.py con public/card-hashes.bin): jerarquía completa
capítulo → sección → regla → letra, con índice por mecánica y referencias
cruzadas, listo para búsqueda local en el cliente.

El texto de las reglas se conserva EN INGLÉS tal cual está en el documento:
es el texto normativo y traducirlo sería inventar reglas. La interfaz
alrededor va en español.

── Cómo lee el PDF (sin pip, puro stdlib) ────────────────────────────

El PDF del CR es formato clásico: tablas xref, objetos sueltos, streams
FlateDecode y fuentes con ToUnicode. Eso permite extraer el texto con zlib +
un intérprete mínimo de los operadores de texto (Tj/TJ/Td/Tm…), llevando la
posición (x, y) de cada trozo. Con la posición se reconstruyen las líneas y
la jerarquía, que en este documento es 100% posicional:

    x≈43  tamaño 13  →  título de capítulo («1. GAME CONCEPTS»)
    x≈54  tamaño 11  →  número de sección en el margen («6. »)
    x≈81  tamaño 10  →  título de sección (MAYÚSCULAS) o regla («3. …»)
    x≈110 tamaño 9   →  letra («a. …»)  /  continuación de regla (x≈108)
    x≈123 tamaño 8   →  continuación de letra, ejemplos (itálica), viñetas
    y<25             →  pie de página (se descarta)

Los iconos del juego van en una fuente propia (SWUnlimitedIconFont) con
glifos apilados en el área de uso privado; se mapean a tokens legibles
([Vigilance], [Resource], ◆…) para no perder el sentido de frases como
«uses a [Resource] icon».

── Validación dura ───────────────────────────────────────────────────

El script FALLA (exit 1) si: la numeración no es consecutiva en cualquier
nivel, el índice del propio PDF (CONTENTS) no coincide sección por sección
con lo parseado, alguna mecánica del índice queda sin reglas, o la
versión/fecha no se pudo leer del PDF. Un texto mal parseado es peor que no
tenerlo: un juez confiaría en algo roto.

── Uso ───────────────────────────────────────────────────────────────

    python3 scripts/build-rulings.py [--pdf ruta] [--salida ruta]

Si no se le da --pdf, baja el PDF oficial del CDN de FFG a scripts/.cache/.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.request
import zlib
from datetime import date

# ── Fuente oficial ────────────────────────────────────────────────────

PDF_URL = "https://cdn.starwarsunlimited.com//SWH_Comp_Rules_v8_0_e26603c6e1.pdf"
PAGINA_FUENTE = "https://starwarsunlimited.com/how-to-play?chapter=rules"

# Mecánicas que el índice DEBE cubrir (si alguna queda sin reglas, se falla).
# Los nombres quedan en inglés porque así aparecen en el texto normativo.
MECANICAS = [
    "Ambush", "Aspect", "Bounty", "Capture", "Coordinate", "Disclose",
    "Epic Action", "Experience", "Exploit", "Grit", "Hidden", "Indirect Damage",
    "Overwhelm", "Pilot", "Plot", "Raid", "Restore", "Saboteur", "Sentinel",
    "Shield", "Smuggle", "Support",
]

# Glifos de SWUnlimitedIconFont → token legible. Cada icono se dibuja como
# varios glifos apilados (fondo + figura); f6d0/f6e1 son capas decorativas.
GLIFOS_ICONO = {
    0xF6DC: "[Vigilance]", 0xF6D4: "[Vigilance]",
    0xF6DE: "[Command]", 0xF6D6: "[Command]",
    0xF6DB: "[Aggression]", 0xF6D3: "[Aggression]",
    0xF6DD: "[Cunning]", 0xF6D5: "[Cunning]",
    0xF6DF: "[Villainy]", 0xF6D7: "[Villainy]",
    0xF6E0: "[Heroism]", 0xF6D8: "[Heroism]",
    0xF6D1: "[Resource]", 0xF6D2: "[Resource]",
    0xF6D9: "[Exhaust]",
    0xF6DA: "◆",  # icono de carta única, el PDF lo usa inline en títulos
}
GLIFOS_CAPA = {0xF6D0, 0xF6E1}

# WinAnsiEncoding, rango 0x80-0x9F: los CMap ToUnicode de algunas fuentes del
# PDF no cubren estos códigos (visto: 0x97 em-dash en «them—viewing», que sin
# esta tabla se perdía y pegaba las palabras). Fallback estándar de WinAnsi.
WINANSI = {
    0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†",
    0x87: "‡", 0x88: "ˆ", 0x89: "‰", 0x8A: "Š", 0x8B: "‹", 0x8C: "Œ",
    0x8E: "Ž", 0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•",
    0x96: "–", 0x97: "—", 0x98: "˜", 0x99: "™", 0x9A: "š", 0x9B: "›",
    0x9C: "œ", 0x9E: "ž", 0x9F: "Ÿ",
}

# Bytes que ninguna tabla pudo decodificar (si queda alguno, se falla:
# perder un carácter en un reglamento es corromper la regla).
BYTES_PERDIDOS: list[tuple[str, int]] = []


def fallar(msg: str) -> None:
    print(f"\n✗ VALIDACIÓN FALLIDA: {msg}", file=sys.stderr)
    sys.exit(1)


# ══════════════════════════════════════════════════════════════════════
#  1. Lector de PDF (objetos, streams, fuentes, operadores de texto)
# ══════════════════════════════════════════════════════════════════════


class LectorPDF:
    """Extrae trozos de texto con posición de un PDF clásico (sin ObjStm)."""

    def __init__(self, ruta: str):
        self.data = open(ruta, "rb").read()
        self.objs: dict[int, bytes] = {}
        for m in re.finditer(rb"(\d+)\s+0\s+obj\b(.*?)endobj", self.data, re.S):
            self.objs[int(m.group(1))] = m.group(2)
        self._fuentes: dict[int, tuple[bool, dict[int, str], str]] = {}
        self.paginas = self._arbol_paginas()

    # ── objetos y streams ──

    def _stream(self, num: int) -> bytes | None:
        raw = self.objs[num]
        m = re.search(rb"stream\r?\n", raw)
        if not m:
            return None
        cuerpo = re.sub(rb"\r?\n?endstream\s*$", b"", raw[m.end():])
        if b"/FlateDecode" in raw[: m.start()]:
            try:
                return zlib.decompress(cuerpo)
            except zlib.error:
                return zlib.decompressobj().decompress(cuerpo)
        return cuerpo

    def _dic(self, num: int) -> bytes:
        raw = self.objs[num]
        m = re.search(rb"stream", raw)
        return raw[: m.start()] if m else raw

    @staticmethod
    def _ref(d: bytes, clave: bytes) -> int | None:
        m = re.search(rb"/" + clave + rb"\s+(\d+)\s+0\s+R", d)
        return int(m.group(1)) if m else None

    def _arbol_paginas(self) -> list[int]:
        raiz = next(
            n for n, raw in self.objs.items()
            if b"/Type/Catalog" in raw.replace(b" ", b"")
        )
        paginas: list[int] = []

        def bajar(num: int) -> None:
            d = self.objs[num]
            if re.search(rb"/Type\s*/Pages", d):
                kids = re.search(rb"/Kids\s*\[(.*?)\]", d, re.S).group(1)
                for m in re.finditer(rb"(\d+)\s+0\s+R", kids):
                    bajar(int(m.group(1)))
            else:
                paginas.append(num)

        bajar(self._ref(self.objs[raiz], b"Pages"))
        return paginas

    # ── fuentes: CMap ToUnicode ──

    def _cmap(self, stream: bytes) -> dict[int, str]:
        cmap: dict[int, str] = {}
        for m in re.finditer(rb"beginbfchar(.*?)endbfchar", stream, re.S):
            for mm in re.finditer(rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", m.group(1)):
                h = mm.group(2).decode()
                cmap[int(mm.group(1), 16)] = "".join(
                    chr(int(h[i : i + 4], 16)) for i in range(0, len(h), 4)
                )
        for m in re.finditer(rb"beginbfrange(.*?)endbfrange", stream, re.S):
            patron = rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<([0-9A-Fa-f]+)>|\[(.*?)\])"
            for mm in re.finditer(patron, m.group(1), re.S):
                lo, hi = int(mm.group(1), 16), int(mm.group(2), 16)
                if mm.group(4):
                    base = int(mm.group(4), 16)
                    for i in range(hi - lo + 1):
                        cmap[lo + i] = chr(base + i)
                else:
                    for i, a in enumerate(re.findall(rb"<([0-9A-Fa-f]+)>", mm.group(5))):
                        h = a.decode()
                        cmap[lo + i] = "".join(
                            chr(int(h[j : j + 4], 16)) for j in range(0, len(h), 4)
                        )
        return cmap

    def _fuente(self, num: int) -> tuple[bool, dict[int, str], str]:
        if num not in self._fuentes:
            d = self._dic(num)
            dos_bytes = b"Identity-H" in d or b"/Type0" in d
            tu = self._ref(d, b"ToUnicode")
            cmap = self._cmap(self._stream(tu)) if tu else {}
            m = re.search(rb"/BaseFont\s*/([A-Za-z0-9+\-]+)", d)
            nombre = m.group(1).decode() if m else "?"
            self._fuentes[num] = (dos_bytes, cmap, nombre)
        return self._fuentes[num]

    # ── tokenizador del content stream ──

    @staticmethod
    def _tokens(s: bytes):
        ESCAPES = {b"n": b"\n", b"r": b"\r", b"t": b"\t", b"b": b"\b",
                   b"f": b"\f", b"(": b"(", b")": b")", b"\\": b"\\"}
        i, n = 0, len(s)
        while i < n:
            c = s[i : i + 1]
            if c in b" \t\r\n":
                i += 1
            elif c == b"(":  # string literal con escapes y paréntesis anidados
                j, prof, out = i + 1, 1, bytearray()
                while j < n and prof:
                    ch = s[j : j + 1]
                    if ch == b"\\":
                        sig = s[j + 1 : j + 2]
                        if sig in ESCAPES:
                            out += ESCAPES[sig]
                            j += 2
                            continue
                        mo = re.match(rb"[0-7]{1,3}", s[j + 1 : j + 4])
                        if mo:
                            out.append(int(mo.group(0), 8))
                            j += 1 + len(mo.group(0))
                            continue
                        j += 2
                        continue
                    if ch == b"(":
                        prof += 1
                    elif ch == b")":
                        prof -= 1
                        if not prof:
                            j += 1
                            break
                    out += ch
                    j += 1
                yield ("str", bytes(out))
                i = j
            elif c == b"<" and s[i + 1 : i + 2] != b"<":
                j = s.index(b">", i)
                h = re.sub(rb"\s", b"", s[i + 1 : j])
                if len(h) % 2:
                    h += b"0"
                yield ("str", bytes.fromhex(h.decode()))
                i = j + 1
            elif s[i : i + 2] in (b"<<", b">>"):
                i += 2
            elif c in b"[]":
                i += 1
            elif c == b"/":
                m = re.match(rb"/([^\s\[\]<>/()]*)", s[i:])
                yield ("name", m.group(1).decode("latin1"))
                i += m.end()
            else:
                m = re.match(rb"[+\-.\d][\d.\-+]*", s[i:])
                if m:
                    try:
                        yield ("num", float(m.group(0)))
                    except ValueError:
                        yield ("num", 0.0)
                    i += m.end()
                    continue
                m = re.match(rb"[A-Za-z'\"*01]+", s[i:])
                if m:
                    yield ("op", m.group(0).decode("latin1"))
                    i += m.end()
                else:
                    i += 1

    @staticmethod
    def _decodificar(b: bytes, fuente) -> str:
        dos_bytes, cmap, nombre = fuente
        if dos_bytes:
            out = []
            for k in range(0, len(b) - 1, 2):
                cid = (b[k] << 8) | b[k + 1]
                if cid in cmap:
                    out.append(cmap[cid])
                elif "IconFont" not in nombre:
                    BYTES_PERDIDOS.append((nombre, cid))
            return "".join(out)
        out = []
        for ch in b:
            if ch in cmap:
                out.append(cmap[ch])
            elif 32 <= ch < 127 or ch >= 160:
                out.append(chr(ch))  # ASCII / Latin-1 ≈ WinAnsi en ese rango
            elif ch in WINANSI:
                out.append(WINANSI[ch])
            elif ch not in (0, 9, 10, 13):
                BYTES_PERDIDOS.append((nombre, ch))
        return "".join(out)

    @staticmethod
    def _mul(a, b):
        return [
            a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
            a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
            a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5],
        ]

    def trozos(self, pagina: int) -> list[tuple[float, float, float, str, str]]:
        """Devuelve (x, y, tamaño, fuente, texto) de cada Tj/TJ de la página.

        Interpreta lo justo del content stream: matrices de texto (Td/TD/Tm/
        T*/TL), selección de fuente (Tf) y pintado (Tj/TJ/'/"). El resto de
        operadores solo consume argumentos.
        """
        d = self._dic(pagina)
        fuentes: dict[str, int] = {}
        rm = re.search(rb"/Resources\s*<<(.*)", d, re.S)
        fm = re.search(rb"/Font\s*<<(.*?)>>", rm.group(1) if rm else b"", re.S)
        if fm:
            for mm in re.finditer(rb"/(\w+)\s+(\d+)\s+0\s+R", fm.group(1)):
                fuentes[mm.group(1).decode()] = int(mm.group(2))

        streams: list[bytes] = []
        ca = re.search(rb"/Contents\s*\[(.*?)\]", d, re.S)
        cm = re.search(rb"/Contents\s+(\d+)\s+0\s+R", d)
        if ca:
            streams = [self._stream(int(m.group(1)))
                       for m in re.finditer(rb"(\d+)\s+0\s+R", ca.group(1))]
        elif cm:
            streams = [self._stream(int(cm.group(1)))]
        contenido = b"\n".join(s for s in streams if s)

        runs: list[tuple[float, float, float, str, str]] = []
        tm = [1, 0, 0, 1, 0, 0]
        tlm = list(tm)
        ctm = [1, 0, 0, 1, 0, 0]
        pila: list[list[float]] = []
        fuente = None
        tam = 0.0
        interlinea = 0.0
        args: list[tuple[str, object]] = []

        def pintar(texto: str) -> None:
            if texto:
                m2 = self._mul(tm, ctm)
                escala = abs(tm[3]) or 1.0
                runs.append((m2[4], m2[5], tam * escala, fuente[2], texto))

        for t, v in self._tokens(contenido):
            if t != "op":
                args.append((t, v))
                continue
            op = v
            if op == "BT":
                tm = [1, 0, 0, 1, 0, 0]
                tlm = list(tm)
            elif op == "Tf" and len(args) >= 2:
                nombre = args[-2][1]
                tam = float(args[-1][1])
                fuente = self._fuente(fuentes[nombre]) if nombre in fuentes else None
            elif op in ("Td", "TD") and len(args) >= 2:
                if op == "TD":
                    interlinea = -float(args[-1][1])
                tlm = self._mul([1, 0, 0, 1, float(args[-2][1]), float(args[-1][1])], tlm)
                tm = list(tlm)
            elif op == "TL" and args:
                interlinea = float(args[-1][1])
            elif op == "Tm" and len(args) >= 6:
                tlm = [float(a[1]) for a in args[-6:]]
                tm = list(tlm)
            elif op == "T*":
                tlm = self._mul([1, 0, 0, 1, 0, -interlinea], tlm)
                tm = list(tlm)
            elif op in ("Tj", "'", '"'):
                if op != "Tj":
                    tlm = self._mul([1, 0, 0, 1, 0, -interlinea], tlm)
                    tm = list(tlm)
                textos = [a for a in args if a[0] == "str"]
                if textos and fuente:
                    pintar(self._decodificar(textos[-1][1], fuente))
            elif op == "TJ":
                # Los números del array TJ son kerning: se ignoran y se pegan
                # los strings. Así «V)60.1 (.1.1» vuelve a ser «6.1.1».
                if fuente:
                    pintar("".join(
                        self._decodificar(a[1], fuente) for a in args if a[0] == "str"
                    ))
            elif op == "cm" and len(args) >= 6:
                ctm = self._mul([float(a[1]) for a in args[-6:]], ctm)
            elif op == "q":
                pila.append(list(ctm))
            elif op == "Q" and pila:
                ctm = pila.pop()
            args = []
        return runs


# ══════════════════════════════════════════════════════════════════════
#  2. De trozos a líneas (agrupado por y, iconos → tokens)
# ══════════════════════════════════════════════════════════════════════


def a_lineas(runs) -> list[dict]:
    """Agrupa los trozos en líneas visuales.

    Tolerancia vertical de 4pt: los glifos de icono se pintan hasta 3pt por
    debajo de la línea base del texto que acompañan y deben caer en la misma
    línea. Las líneas reales del documento van a ≥10pt de distancia.
    """
    if not runs:
        return []
    orden = sorted(runs, key=lambda r: -r[1])
    lineas: list[list] = []
    for run in orden:
        if lineas and abs(lineas[-1][0][1] - run[1]) <= 4:
            lineas[-1].append(run)
        else:
            lineas.append([run])

    salida = []
    for grupo in lineas:
        partes = sorted(grupo, key=lambda r: r[0])
        texto = []
        ultimo_icono = None  # (x, token) para deduplicar glifos apilados
        for x, y, tam, fn, txt in partes:
            if "SWUnlimitedIconFont" in fn:
                for ch in txt:
                    cp = ord(ch)
                    if cp in GLIFOS_CAPA:
                        continue
                    token = GLIFOS_ICONO.get(cp, "[icono]")
                    if ultimo_icono and ultimo_icono[1] == token and abs(x - ultimo_icono[0]) < 8:
                        continue  # capa repetida del mismo icono
                    texto.append(token)
                    ultimo_icono = (x, token)
            else:
                texto.append(txt)
                ultimo_icono = None
        txt = re.sub(r"[ \t]+", " ", "".join(texto)).strip()
        if not txt:
            continue
        principales = [p for p in partes if "SWUnlimitedIconFont" not in p[3]] or partes
        salida.append({
            "x": principales[0][0],
            "y": max(p[1] for p in grupo),
            "tam": max(p[2] for p in principales),
            "fuentes": [p[3].split("+")[-1] for p in principales],
            "texto": txt,
        })
    return salida


# ══════════════════════════════════════════════════════════════════════
#  3. De líneas a la jerarquía capítulo → sección → regla → letra
# ══════════════════════════════════════════════════════════════════════

RE_CAPITULO = re.compile(r"^(\d+)\.\s+(.+)$")
RE_NUM_MARGEN = re.compile(r"^(\d+)\.$")
RE_REGLA = re.compile(r"^(\d+)\.\s+(.*)$")
RE_LETRA = re.compile(r"^([a-z])\.\s+(.*)$")


def construir(lector: LectorPDF) -> tuple[dict, list, str]:
    entradas: dict[str, dict] = {}
    capitulos: list[dict] = []
    copyright_pdf: list[str] = []

    cap = sec = regla = letra = None  # entradas abiertas
    seccion_pendiente = None          # número de margen esperando su título

    def anexar(linea_txt: str, destino: dict, parrafo: bool = False) -> None:
        """Pega una línea al texto de una entrada, resolviendo guiones de corte.

        En este documento las únicas líneas que terminan en «-» son palabras
        compuestas partidas (out-of-play, non-token): el guion se CONSERVA y
        se une sin espacio.
        """
        t = destino["texto"]
        if not t:
            destino["texto"] = linea_txt
        elif parrafo:
            destino["texto"] = t + "\n" + linea_txt
        elif t.endswith("-"):
            destino["texto"] = t + linea_txt
        else:
            destino["texto"] = t + " " + linea_txt

    def abrir(id_: str, tipo: str, texto: str, titulo: str | None,
              pagina: int, padre: dict | None) -> dict:
        e = {"id": id_, "tipo": tipo, "titulo": titulo, "texto": texto,
             "pagina": pagina, "padre": padre["id"] if padre else None, "hijos": []}
        if id_ in entradas:
            fallar(f"id duplicado: {id_}")
        entradas[id_] = e
        if padre:
            padre["hijos"].append(id_)
        return e

    # Páginas de contenido: de la 4 en adelante (1 portada, 2-3 índice).
    for num_pag in range(3, len(lector.paginas)):
        pagina = num_pag + 1
        for ln in a_lineas(lector.trozos(lector.paginas[num_pag])):
            x, tam, txt = ln["x"], ln["tam"], ln["texto"]
            fuentes = ln["fuentes"]
            if ln["y"] < 25:
                continue  # pie de página
            if txt.startswith("©") or (copyright_pdf and x < 50 and tam < 9):
                copyright_pdf.append(txt)
                continue

            # ── título de capítulo ──
            if x < 62 and tam >= 12.5:
                m = RE_CAPITULO.match(txt)
                if not m:
                    fallar(f"pág {pagina}: título de capítulo raro: {txt!r}")
                cap = abrir(m.group(1), "capitulo", "", m.group(2).strip(), pagina, None)
                capitulos.append(cap)
                sec = regla = letra = None
                continue

            # ── número de sección en el margen ──
            if x < 62 and tam >= 10.5 and RE_NUM_MARGEN.match(txt):
                seccion_pendiente = (int(txt[:-1]), pagina)
                continue

            # ── sección con número y título en la misma línea visual ──
            # (pasa cuando la línea base del número de margen queda a <4pt
            # del título y el agrupador los fusiona: «1. GENERAL»)
            if x < 62 and tam >= 10.5 and RE_CAPITULO.match(txt):
                m = RE_CAPITULO.match(txt)
                sec = abrir(f"{cap['id']}.{m.group(1)}", "seccion", "",
                            m.group(2).strip(), pagina, cap)
                regla = letra = None
                seccion_pendiente = None
                continue

            # ── título de sección (MAYÚSCULAS junto al margen) ──
            if 76 <= x <= 96 and seccion_pendiente and not RE_REGLA.match(txt):
                n, pag_sec = seccion_pendiente
                sec = abrir(f"{cap['id']}.{n}", "seccion", "", txt, pag_sec, cap)
                regla = letra = None
                seccion_pendiente = None
                continue

            # ── regla numerada ──
            if 76 <= x <= 96 and RE_REGLA.match(txt):
                m = RE_REGLA.match(txt)
                regla = abrir(f"{sec['id']}.{m.group(1)}", "regla",
                              m.group(2).strip(), None, pagina, sec)
                letra = None
                continue

            # ── letra (sub-regla) ──
            if 105 <= x <= 114 and RE_LETRA.match(txt) and "Barlow-SemiBold" in fuentes:
                m = RE_LETRA.match(txt)
                letra = abrir(f"{regla['id']}{m.group(1).upper()}", "letra",
                              m.group(2).strip(), None, pagina, regla)
                continue

            # ── continuaciones, ejemplos y viñetas ──
            destino = letra or regla or sec
            if destino is None:
                fallar(f"pág {pagina}: línea suelta sin entrada abierta: {txt!r}")
            if 105 <= x <= 114:
                anexar(txt, regla or destino)      # continuación de regla
            elif txt.startswith("•"):
                anexar(txt, destino, parrafo=True)  # viñeta
            elif "Barlow-Italic" in fuentes or "Barlow-BoldItalic" in fuentes \
                    or "Arial-ItalicMT" in fuentes:
                # Ejemplo en itálica: párrafo aparte si arranca uno nuevo
                nuevo = txt.startswith("For example") or txt.startswith("Example")
                anexar(txt, destino, parrafo=nuevo)
            else:
                anexar(txt, destino)

    # Reglas cuyo «texto» es solo un encabezado corto («Aspects», «Grit»,
    # «Raid X») y tienen hijos: eso es un título, no texto normativo.
    for e in entradas.values():
        if e["tipo"] == "regla" and e["hijos"] and len(e["texto"]) <= 40 \
                and not e["texto"].endswith("."):
            e["titulo"], e["texto"] = e["texto"], ""

    return entradas, capitulos, " ".join(copyright_pdf)


# ══════════════════════════════════════════════════════════════════════
#  4. Introducción, versión y CONTENTS (para validar)
# ══════════════════════════════════════════════════════════════════════


def leer_portada(lector: LectorPDF) -> tuple[str, str, str]:
    texto = " ".join(r[4] for r in lector.trozos(lector.paginas[0]))
    m = re.search(r"(\d{1,2})/(\d{1,2})/(\d{2})\s*[–—-]\s*V\s*(\d+\.\d+)", texto)
    if not m:
        fallar(f"no pude leer versión/fecha de la portada: {texto!r}")
    mes, dia, anio = int(m.group(1)), int(m.group(2)), 2000 + int(m.group(3))
    return m.group(4), f"{anio:04d}-{mes:02d}-{dia:02d}", f"{m.group(1)}/{m.group(2)}/{m.group(3)}"


def leer_introduccion(lector: LectorPDF) -> str:
    """Párrafos de INTRODUCTION (página 2, antes de CONTENTS)."""
    partes = []
    dentro = False
    for ln in a_lineas(lector.trozos(lector.paginas[1])):
        if ln["texto"] == "INTRODUCTION":
            dentro = True
            continue
        if ln["texto"] == "CONTENTS":
            break
        if dentro and ln["y"] > 25:
            partes.append(ln["texto"])
    txt = " ".join(partes)
    return re.sub(r"\s+", " ", txt).strip()


def leer_contents(lector: LectorPDF, titulos_capitulos: dict[int, str]) -> list[tuple[int, int, str]]:
    """Parsea el índice del PDF: [(capítulo, sección, título), …].

    El índice va a dos columnas; se lee columna por columna. Una entrada es
    capítulo cuando su número es el siguiente capítulo esperado Y su título
    coincide con un título de capítulo real del cuerpo.
    """
    filas: list[tuple[int, str]] = []  # (número, título) en orden de lectura
    for idx in (1, 2):
        runs = lector.trozos(lector.paginas[idx])
        for col in (lambda r: r[0] < 300, lambda r: r[0] >= 300):
            lineas = a_lineas([r for r in runs if col(r)])
            for ln in lineas:
                if ln["y"] < 25 or ln["tam"] > 8:
                    continue  # pie o encabezados INTRODUCTION/CONTENTS
                m = re.match(r"^(\d+)\.\s+(.+?)\s+(\d+)$", ln["texto"])
                if m:
                    filas.append((int(m.group(1)), m.group(2).strip()))

    def norm(s: str) -> str:
        return re.sub(r"[^A-Z0-9]", "", s.upper())

    titulos_norm = {n: norm(t) for n, t in titulos_capitulos.items()}
    resultado = []
    cap_actual = 0
    for n, titulo in filas:
        if n == cap_actual + 1 and titulos_norm.get(n) == norm(titulo):
            cap_actual = n
        else:
            if cap_actual == 0:
                fallar(f"CONTENTS: sección {n}. {titulo!r} antes del primer capítulo")
            resultado.append((cap_actual, n, titulo))
    return resultado


# ══════════════════════════════════════════════════════════════════════
#  5. Referencias cruzadas e índice por mecánica
# ══════════════════════════════════════════════════════════════════════

def reconciliar_titulos(entradas: dict[str, dict], contents: list) -> None:
    """Completa títulos de sección con el CONTENTS del propio PDF.

    Caso real: el encabezado de 8.30 pinta «UP TO » y el «X» va como adorno
    vectorial (no es texto), pero el índice del PDF sí dice «UP TO X». Si el
    título del cuerpo es prefijo estricto del que da el índice, se adopta el
    del índice. Cualquier otra discrepancia la atrapa la validación.
    """
    def norm(s: str) -> str:
        return re.sub(r"[^A-Z0-9]", "", s.upper())

    por_id = {f"{c}.{s}": t for c, s, t in contents}
    for e in entradas.values():
        if e["tipo"] != "seccion" or e["id"] not in por_id:
            continue
        del_indice = por_id[e["id"]]
        if norm(e["titulo"]) != norm(del_indice) \
                and norm(del_indice).startswith(norm(e["titulo"])):
            print(f"  · título de {e['id']} completado con CONTENTS: "
                  f"{e['titulo']!r} → {del_indice!r}")
            e["titulo"] = del_indice


RE_REF = re.compile(
    r"(?:[Ss]ee(?: also)?|specified in|described in|detailed in|as per|per rule)"
    r"\s+(\d{1,2}(?:\.\d{1,2}){0,2})"
)


def extraer_refs(entradas: dict[str, dict]) -> int:
    total = 0
    for e in entradas.values():
        base = (e["texto"] or "") + " " + (e["titulo"] or "")
        refs = []
        for m in RE_REF.finditer(base):
            objetivo = m.group(1).rstrip(".")
            if objetivo in entradas and objetivo != e["id"]:
                refs.append(objetivo)
        e["refs"] = sorted(set(refs))
        total += len(e["refs"])
    return total


def indexar_mecanicas(entradas: dict[str, dict]) -> dict[str, dict]:
    indice: dict[str, dict] = {}
    for mecanica in MECANICAS:
        # Búsqueda por palabra completa, con plural simple y sin distinguir
        # mayúsculas ("Pilot" también cubre "Piloting").
        sufijo = r"\w*" if mecanica in ("Pilot", "Aspect", "Shield", "Capture") else r"s?"
        patron = re.compile(r"\b" + re.escape(mecanica) + sufijo + r"\b", re.I)
        ids = []
        definicion = None
        for e in entradas.values():
            en_titulo = e["titulo"] and patron.search(e["titulo"])
            en_texto = e["texto"] and patron.search(e["texto"])
            if en_titulo or en_texto:
                ids.append(e["id"])
            # La definición es la sección/regla titulada con la mecánica,
            # quitando placeholders de coste («Raid X», «Smuggle [Y]»)
            if e["titulo"] and e["tipo"] in ("seccion", "regla"):
                t = re.sub(r"\s+(?:X|\[[XYZ]\])$", "", e["titulo"].strip())
                if (t.upper() in (mecanica.upper(), mecanica.upper() + "S",
                                  mecanica.upper() + "D",     # «Shielded»
                                  mecanica.upper() + "ING")   # «Piloting»
                        and definicion is None):
                    definicion = e["id"]
        if definicion is None:
            # Sin entrada titulada (p. ej. «Epic Action» se define dentro de
            # 7.2): la definición es la primera entrada que la presenta con
            # «… is a/an …».
            patron_def = re.compile(
                re.escape(mecanica) + r"\w*[^.]{0,40}\b(?:is|are) (?:a|an|the)\b", re.I)
            for id_ in sorted(ids, key=clave_id):
                if patron_def.search(entradas[id_]["texto"] or ""):
                    definicion = id_
                    break
        indice[mecanica] = {"def": definicion, "reglas": sorted(ids, key=clave_id)}
    return indice


def clave_id(id_: str) -> tuple:
    """Orden natural de ids tipo 7.5.13B."""
    m = re.match(r"^(\d+)(?:\.(\d+))?(?:\.(\d+))?([A-Z])?$", id_)
    return tuple(int(g) if g and g.isdigit() else (ord(g) if g else 0) for g in m.groups())


# ══════════════════════════════════════════════════════════════════════
#  6. Validación dura
# ══════════════════════════════════════════════════════════════════════


def validar(entradas: dict, capitulos: list, contents: list, indice: dict) -> None:
    # 1) Numeración consecutiva en todos los niveles
    if [int(c["id"]) for c in capitulos] != list(range(1, len(capitulos) + 1)):
        fallar(f"capítulos no consecutivos: {[c['id'] for c in capitulos]}")
    for e in entradas.values():
        hijos = e["hijos"]
        if not hijos:
            continue
        if entradas[hijos[0]]["tipo"] == "letra":
            letras = [h[-1] for h in hijos]
            esperado = [chr(ord("A") + i) for i in range(len(letras))]
            if letras != esperado:
                fallar(f"{e['id']}: letras no consecutivas: {letras}")
        else:
            nums = [int(h.rsplit(".", 1)[-1]) for h in hijos]
            # El cap. 6 numera sus pasos desde «0. General» a propósito:
            # se exige consecutivo, arrancando en 0 o en 1.
            if nums[0] not in (0, 1) or nums != list(range(nums[0], nums[0] + len(nums))):
                fallar(f"{e['id']}: numeración con huecos: {nums}")

    # 2) El CONTENTS del propio PDF coincide sección por sección
    def norm(s: str) -> str:
        return re.sub(r"[^A-Z0-9]", "", s.upper())

    secciones_pdf = {(c, s): norm(t) for c, s, t in contents}
    secciones_mias = {
        tuple(map(int, e["id"].split("."))): norm(e["titulo"] or "")
        for e in entradas.values() if e["tipo"] == "seccion"
    }
    if set(secciones_pdf) != set(secciones_mias):
        faltan = set(secciones_pdf) - set(secciones_mias)
        sobran = set(secciones_mias) - set(secciones_pdf)
        fallar(f"CONTENTS no coincide. Faltan: {sorted(faltan)} Sobran: {sorted(sobran)}")
    for k, titulo in secciones_pdf.items():
        if titulo != secciones_mias[k]:
            fallar(f"título de {k} difiere: PDF={titulo!r} parseado={secciones_mias[k]!r}")

    # 3) Toda mecánica tiene al menos una regla
    for mecanica, datos in indice.items():
        if not datos["reglas"]:
            fallar(f"la mecánica {mecanica!r} quedó sin reglas asociadas")

    # 4) Ningún byte quedó sin decodificar
    if BYTES_PERDIDOS:
        resumen = {}
        for fuente, cod in BYTES_PERDIDOS:
            resumen.setdefault(f"{fuente}:{cod:#x}", 0)
            resumen[f"{fuente}:{cod:#x}"] += 1
        fallar(f"caracteres sin decodificar: {resumen}")

    # 5) Nada quedó vacío
    for e in entradas.values():
        if e["tipo"] in ("regla", "letra") and not e["texto"] and not e["hijos"]:
            fallar(f"{e['id']}: entrada sin texto ni hijos")


# ══════════════════════════════════════════════════════════════════════
#  main
# ══════════════════════════════════════════════════════════════════════


def main() -> None:
    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--pdf", help="ruta al PDF del Comprehensive Rules (si no, se baja)")
    ap.add_argument("--salida", default=os.path.join(raiz, "public", "rulings", "index.json"))
    args = ap.parse_args()

    ruta_pdf = args.pdf
    if not ruta_pdf:
        cache = os.path.join(raiz, "scripts", ".cache")
        os.makedirs(cache, exist_ok=True)
        ruta_pdf = os.path.join(cache, os.path.basename(PDF_URL))
        if not os.path.exists(ruta_pdf):
            print(f"Bajando {PDF_URL} …")
            urllib.request.urlretrieve(PDF_URL, ruta_pdf)

    lector = LectorPDF(ruta_pdf)
    version, fecha_iso, fecha_texto = leer_portada(lector)
    entradas, capitulos, copyright_pdf = construir(lector)
    intro = leer_introduccion(lector)
    contents = leer_contents(lector, {int(c["id"]): c["titulo"] for c in capitulos})
    reconciliar_titulos(entradas, contents)
    total_refs = extraer_refs(entradas)
    indice = indexar_mecanicas(entradas)

    validar(entradas, capitulos, contents, indice)

    reglas = [e for e in entradas.values() if e["tipo"] == "regla"]
    letras = [e for e in entradas.values() if e["tipo"] == "letra"]
    secciones = [e for e in entradas.values() if e["tipo"] == "seccion"]

    # Glosario derivado: el PDF v8 no trae un capítulo de glosario aparte;
    # sus términos viven como secciones del cap. 8 (ADDITIONAL RULES) y como
    # keywords titulados bajo 7.5 (KEYWORD ABILITIES).
    glosario = sorted(
        (
            {"termino": e["titulo"], "id": e["id"]}
            for e in entradas.values()
            if e["titulo"] and (
                e["id"].startswith("8.") and e["tipo"] == "seccion"
                or e["padre"] == "7.5" and e["tipo"] == "regla"
            )
        ),
        key=lambda g: g["termino"].upper(),
    )

    datos = {
        "meta": {
            "titulo": "Star Wars: Unlimited — Comprehensive Rules",
            "version": version,
            "fecha": fecha_iso,
            "fechaTexto": fecha_texto,
            "idiomaReglas": "en",
            "fuente": PAGINA_FUENTE,
            "pdf": PDF_URL,
            "copyright": copyright_pdf,
            "generado": date.today().isoformat(),
            "introduccion": intro,
            "totales": {
                "capitulos": len(capitulos),
                "secciones": len(secciones),
                "reglas": len(reglas),
                "letras": len(letras),
                "refs": total_refs,
            },
        },
        "capitulos": [c["id"] for c in capitulos],
        "entradas": {k: entradas[k] for k in sorted(entradas, key=clave_id)},
        "indice": indice,
        "glosario": glosario,
    }

    os.makedirs(os.path.dirname(args.salida), exist_ok=True)
    with open(args.salida, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, separators=(",", ":"))
    peso = os.path.getsize(args.salida)

    print(f"✓ CR v{version} ({fecha_iso})")
    print(f"  capítulos: {len(capitulos)}  secciones: {len(secciones)} "
          f"(CONTENTS del PDF: {len(contents)})")
    print(f"  reglas: {len(reglas)}  letras: {len(letras)}  refs cruzadas: {total_refs}")
    print(f"  glosario derivado: {len(glosario)} términos  "
          f"mecánicas indexadas: {len(indice)}")
    print(f"  → {args.salida} ({peso / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
