#!/usr/bin/env python3
"""Construye public/datos-cr/cartas.json con los rulings POR CARTA oficiales.

Fuente: https://api.swuapi.com/cards (la MISMA que usa la app — los uuid
coinciden con las claves primarias de Dexie). Sin auth, paginado con
next_cursor. Se baja completo con pausa de 1 s entre páginas para no
castigar a la fuente amiga.

Campos que interesan por carta:
  - additionalRulings: array de aclaraciones oficiales (la fuente principal)
  - rules: el mismo texto en un solo string; solo se usa si trae algo que
    additionalRulings no cubre y que no sea el texto impreso de la carta.
  - variant_of_uuid: apunta al uuid de la impresión CANÓNICA. Las
    impresiones alternativas comparten rulings, así que se guarda UNA
    entrada por carta canónica con los ids de TODAS sus impresiones.

Salida: public/datos-cr/cartas.json
  { "meta": {...}, "suspendidas": [...], "transicion": {...},
    "porId": { "<uuid canónico>": { nombre, ids[], rulings[] } } }

Uso:  python3 scripts/build-card-rulings.py
"""

import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

API = "https://api.swuapi.com/cards"
PAGE_SIZE = 500          # el API lo respeta; menos viajes = menos carga
PAUSA_S = 1.0            # pausa entre páginas — fuente amiga
MIN_CARTAS_CON_RULINGS = 200   # ~53% de ASH ya trae rulings; <200 = algo se rompió

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "public" / "datos-cr" / "cartas.json"

# ─── Datos oficiales estáticos (de starwarsunlimited.com) ───

SUSPENDIDAS = [
    {"nombre": "IG-2000", "set": "JTL", "num": 140, "formato": "Eternal"},
    {"nombre": "War Juggernaut", "set": "JTL", "num": 170, "formato": "Eternal"},
]

TRANSICION = {
    "titulo": "CR8→CR9",
    "texto": (
        "Nota transicional oficial: cuando una unidad sale de juego, sus "
        "mejoras se consideran derrotadas SIMULTÁNEAMENTE con ella (no en "
        "secuencia). La regla 1.16.5C del CR 8.0 ya no aplica y será "
        "eliminada en el CR 9.0."
    ),
    "afecta": ["ASH 161"],
}


def bajar_todas():
    """Descarga /cards completo paginando por OFFSET.

    OJO: el API anuncia next_cursor pero esa paginación está ROTA con
    limit alto (medido 2026-08-06: página 1 de 500 → el cursor salta casi
    todo y la página 2 trae 225 filas con next_cursor null). La de offset
    sí funciona. Se avanza por lo que VINO (no por lo pedido), como con
    melee (gotcha 2p del CLAUDE.md).
    """
    cartas = []
    offset = 0
    pagina = 0
    while True:
        params = {"limit": str(PAGE_SIZE), "offset": str(offset)}
        url = API + "?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(
            url, headers={"User-Agent": "swu-companion-rulings/1.0 (+https://swusv.com)"}
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.load(resp)

        lote = data.get("cards", [])
        pag = data.get("pagination", {}) or {}
        cartas.extend(lote)
        pagina += 1
        total = pag.get("total")
        print(f"  página {pagina}: +{len(lote)} (acumulado {len(cartas)}"
              + (f" de {total}" if total else "") + ")")

        if not lote:
            break
        offset += len(lote)
        if isinstance(total, int) and offset >= total:
            break
        time.sleep(PAUSA_S)
    return cartas


def limpiar(texto):
    """Normaliza un ruling: recorta espacios; descarta vacíos."""
    if not isinstance(texto, str):
        return None
    t = texto.strip()
    return t or None


def rulings_de(carta):
    """Extrae la lista de rulings de una fila del API."""
    vistos = set()
    resultado = []

    for r in carta.get("additionalRulings") or []:
        t = limpiar(r)
        if t and t not in vistos:
            vistos.add(t)
            resultado.append(t)

    # `rules` es (verificado) el mismo contenido unido con \n. Solo se
    # aprovechan las líneas que additionalRulings no traiga y que no sean
    # el texto impreso de la carta.
    reglas = carta.get("rules")
    if isinstance(reglas, str) and reglas.strip():
        texto_carta = (carta.get("text") or "").strip()
        for linea in reglas.split("\n"):
            t = limpiar(linea)
            if t and t not in vistos and t != texto_carta and t not in texto_carta:
                vistos.add(t)
                resultado.append(t)

    return resultado


def main():
    print("Bajando /cards completo…")
    filas = bajar_todas()
    if len(filas) < 5000:
        sys.exit(f"ERROR: solo llegaron {len(filas)} filas (esperaba ~9.000). No escribo nada.")

    # ─── Agrupar por carta canónica ───
    # variant_of_uuid apunta a la impresión canónica, PERO hay cadenas
    # anidadas (medido: la promo LAWP de Zeb apunta a una variante que a su
    # vez apunta a la canónica de LAW). Se sigue la cadena hasta la raíz,
    # con corte por si algún día viene un ciclo.
    por_uuid = {c["uuid"]: c for c in filas}

    def raiz(uuid):
        visto = set()
        while uuid not in visto:
            visto.add(uuid)
            padre = (por_uuid.get(uuid) or {}).get("variant_of_uuid")
            if not padre or padre not in por_uuid:
                return uuid
            uuid = padre
        return uuid  # ciclo raro: quedarse donde está

    grupos = {}  # uuid canónico -> {"ids": [...], "filas": [...]}
    for c in filas:
        canon = raiz(c["uuid"])
        g = grupos.setdefault(canon, {"ids": [], "filas": []})
        g["ids"].append(c["uuid"])
        g["filas"].append(c)

    por_id = {}
    total_rulings = 0
    for canon, g in grupos.items():
        # Unión de rulings de todas las impresiones (algunas variantes
        # traen rulings aunque otras no), deduplicada preservando orden.
        vistos = set()
        rulings = []
        for fila in g["filas"]:
            for r in rulings_de(fila):
                if r not in vistos:
                    vistos.add(r)
                    rulings.append(r)
        if not rulings:
            continue

        base = por_uuid.get(canon) or g["filas"][0]
        nombre = base.get("name") or "?"
        if base.get("subtitle"):
            nombre = f"{nombre}, {base['subtitle']}"

        por_id[canon] = {
            "nombre": nombre,
            "set": base.get("set_code"),
            "num": base.get("card_number"),
            "ids": sorted(g["ids"]),
            "rulings": rulings,
        }
        total_rulings += len(rulings)

    # ─── Validación: fallar antes que escribir un JSON vacío o roto ───
    if len(por_id) < MIN_CARTAS_CON_RULINGS:
        sys.exit(f"ERROR: solo {len(por_id)} cartas con rulings "
                 f"(mínimo {MIN_CARTAS_CON_RULINGS}). No escribo nada.")
    for canon, entrada in por_id.items():
        for r in entrada["rulings"]:
            if not r or not r.strip():
                sys.exit(f"ERROR: ruling vacío en {canon} ({entrada['nombre']}).")

    salida = {
        "meta": {
            "fuente": "api.swuapi.com",
            "descargado": date.today().isoformat(),
            "cartasConRulings": len(por_id),
            "rulingsTotales": total_rulings,
        },
        "suspendidas": SUSPENDIDAS,
        "transicion": TRANSICION,
        "porId": por_id,
    }

    texto = json.dumps(salida, ensure_ascii=False, separators=(",", ":"))
    json.loads(texto)  # el JSON parsea (paranoia barata)

    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_text(texto, encoding="utf-8")

    kb = SALIDA.stat().st_size / 1024
    print(f"\nOK → {SALIDA}")
    print(f"  filas del API:        {len(filas)}")
    print(f"  cartas con rulings:   {len(por_id)}")
    print(f"  rulings totales:      {total_rulings}")
    print(f"  tamaño del archivo:   {kb:,.1f} KB")


if __name__ == "__main__":
    main()
