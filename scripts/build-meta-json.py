#!/usr/bin/env python3
"""
Convierte el Excel del snapshot de meta a un JSON que la app empaqueta.

Por qué un JSON empaquetado y no una tabla en Supabase: es una FOTO de un
torneo concreto, no un dato vivo. Se consulta mucho y se escribe una vez por
snapshot, la app es offline-first, y son ~30 KB. Cambiar de snapshot es
reemplazar el .xlsx y volver a correr esto.

Uso:  python3 scripts/build-meta-json.py <archivo.xlsx>
Sale: src/data/meta-snapshot.json
"""
import json, sys, re
from pathlib import Path
import openpyxl

src = Path(sys.argv[1] if len(sys.argv) > 1
           else '/Users/nelson/Claude/SWU_Meta_Matchups_Galactic_2026_v2.xlsx')
wb = openpyxl.load_workbook(src, data_only=True)


def rows(sheet):
    return list(wb[sheet].iter_rows(values_only=True))


def find_header(rs, first_col):
    """Índice de la fila de encabezado, buscando por su primera celda."""
    for i, r in enumerate(rs):
        if r and str(r[0]).strip() == first_col:
            return i
    raise SystemExit(f'No se encontró el encabezado "{first_col}"')


def num(v):
    if v is None or v == '':
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def txt(v):
    if v is None:
        return None
    s = str(v).strip()
    return s or None


# ── Metadatos ────────────────────────────────────────────────────────
metaFields, sources, notes = {}, [], []
mode = None
for r in rows('Fuente y notas'):
    cells = [c for c in r if c is not None and str(c).strip()]
    if not cells:
        continue
    head = str(cells[0]).strip()
    if head == 'Campo':      mode = 'fields';  continue
    if head == 'Recurso':    mode = 'sources'; continue
    if head.startswith('Notas metodológicas'): mode = 'notes'; continue
    if head in ('Metadatos verificados', 'Enlaces'): continue
    if mode == 'fields' and len(cells) >= 2:
        metaFields[head] = str(cells[1]).strip()
    elif mode == 'sources' and len(cells) >= 2 and str(cells[1]).startswith('http'):
        sources.append({'name': head, 'url': str(cells[1]).strip(),
                        'use': str(cells[2]).strip() if len(cells) > 2 else None})
    elif mode == 'notes':
        notes.append(head)

# ── Resumen: portada + rendimiento por arquetipo ─────────────────────
rs = rows('Resumen')
summaryNums, findings = [], []
for r in rs:
    cells = [c for c in r if c is not None and str(c).strip()]
    if not cells:
        continue
    if str(cells[0]).startswith('·'):
        findings.append(str(cells[0]).strip())
    if str(cells[0]).strip() == 'Jugadores' and len(cells) >= 4:
        continue
    if all(isinstance(c, (int, float)) for c in cells[:4]) and len(cells) == 4 and not summaryNums:
        summaryNums = [num(c) for c in cells[:4]]

perf = {}
h = find_header(rs, 'Rank')
for r in rs[h + 1:]:
    if not r or not r[1]:
        continue
    perf[str(r[1]).strip()] = {
        'rank': int(num(r[0]) or 0),
        'wrVsTop10': num(r[3]), 'wrGeneral': num(r[4]),
        'sampleN': int(num(r[5]) or 0),
        'favorable': int(num(r[6]) or 0), 'unfavorable': int(num(r[7]) or 0),
    }

# ── Meta del torneo ──────────────────────────────────────────────────
rs = rows('Meta del torneo')
h = find_header(rs, 'ID')
tourney = {}
for r in rs[h + 1:]:
    if not r or not r[0]:
        continue
    tourney[str(r[0]).strip()] = {
        'name': txt(r[1]), 'strategy': txt(r[2]),
        'decks': int(num(r[3]) or 0), 'metaShare': num(r[4]),
        'top8': int(num(r[5]) or 0), 'titles': int(num(r[6]) or 0),
        'top8Conversion': num(r[7]), 'set': txt(r[8]),
        'kyberTier': txt(r[9]), 'kyberWR': num(r[10]),
        'kyberGames': int(num(r[11]) or 0),
    }

# ── Arquetipos: clasificación ────────────────────────────────────────
rs = rows('Arquetipos')
h = find_header(rs, 'Rank')
classification = {}
for r in rs[h + 1:]:
    if not r or not r[1] or not txt(r[0]) or not str(r[0]).strip().isdigit():
        continue
    classification[str(r[1]).strip()] = {
        'leader': txt(r[2]), 'base': txt(r[3]),
        'strategy': txt(r[4]), 'substrategy': txt(r[5]),
        'speed': int(num(r[6]) or 0), 'confidence': txt(r[7]),
        'gameplan': txt(r[8]), 'set': txt(r[9]), 'communityTag': txt(r[10]),
    }

# ── Fusionar por ID ──────────────────────────────────────────────────
#
# La hoja de meta trae, además de los 25 arquetipos reales, una fila "Otros"
# (la cola larga), un "TOTAL" de control y una nota al pie. Los tres se
# separan acá: "Otros" es información útil (el 18% del meta que no entra en
# el top 25), "TOTAL" es una suma de verificación y la nota no es un dato.
SKIP = {'TOTAL'}
archetypes, otherBucket = [], None
for aid, row in tourney.items():
    if aid in SKIP or aid.startswith('Nota'):
        continue
    if aid == 'Otros':
        otherBucket = {'decks': row['decks'], 'metaShare': row['metaShare']}
        continue
    a = {'id': aid}
    a.update(row)
    a.update(classification.get(aid, {}))
    a.update(perf.get(aid, {}))
    archetypes.append(a)
archetypes.sort(key=lambda a: a.get('rank') or 999)

# Suma de control: si la hoja trae TOTAL, tiene que cuadrar con lo extraído.
total_row = tourney.get('TOTAL')
if total_row:
    got = sum(a['decks'] for a in archetypes) + (otherBucket['decks'] if otherBucket else 0)
    if got != total_row['decks']:
        print(f'  AVISO: los decks suman {got} y el TOTAL de la hoja dice {total_row["decks"]}')

# ── Matchups (formato largo) ─────────────────────────────────────────
rs = rows('Datos largos')
h = find_header(rs, 'Rank origen')
matchups = []
for r in rs[h + 1:]:
    if not r or not r[1] or not r[5]:
        continue
    wr = num(r[8])
    if wr is None:      # celda vacía = SIN DATO, no un 0%
        continue
    matchups.append({'source': str(r[1]).strip(), 'target': str(r[5]).strip(), 'winRate': wr})

out = {
    'tournament': {
        'name': metaFields.get('Torneo'),
        'venue': metaFields.get('Sede'),
        'dates': metaFields.get('Fechas del Main Event'),
        'meleeId': metaFields.get('Melee ID'),
        'players': int(re.sub(r'\D', '', metaFields.get('Jugadores', '0')) or 0),
        'format': metaFields.get('Formato'),
        'legalSets': metaFields.get('Sets legales (Premier)'),
        'champion': metaFields.get('Campeón'),
        'runnerUp': metaFields.get('Finalista'),
        'top8': metaFields.get('Top 8'),
        'capturedAt': metaFields.get('Fecha de captura de la imagen'),
        'verifiedAt': metaFields.get('Fecha de verificación'),
        'archetypeCount': int(summaryNums[1]) if len(summaryNums) > 1 else len(archetypes),
        'pairsWithData': int(summaryNums[2]) if len(summaryNums) > 2 else len(matchups),
        'coverage': summaryNums[3] if len(summaryNums) > 3 else None,
        'otherDecks': otherBucket['decks'] if otherBucket else None,
        'otherShare': otherBucket['metaShare'] if otherBucket else None,
    },
    'findings': findings,
    'notes': notes,
    'sources': sources,
    'archetypes': archetypes,
    'matchups': matchups,
}

dest = Path(__file__).parent.parent / 'src' / 'data' / 'meta-snapshot.json'
dest.parent.mkdir(parents=True, exist_ok=True)
dest.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
print(f'{dest}  ·  {len(archetypes)} arquetipos  ·  {len(matchups)} matchups con dato')
print(f'cobertura {out["tournament"]["coverage"]}  ·  {len(sources)} fuentes  ·  {len(notes)} notas')
