/**
 * BANCO DE AMISTOSAS — mirar las tres vistas sin tener sesión.
 *
 * Existe porque `/amistosas` está detrás del login y de la puerta de
 * instalación, así que las pantallas de esta carpeta se estaban subiendo a
 * producción SIN QUE NADIE LAS VIERA: se comprobaban tipos, lint y build —que
 * pasan igual con un encabezado duplicado o un texto ilegible— y el primero en
 * mirarlas era quien las usaba.
 *
 * En esta misma sesión eso ya costó dos fallos en el álbum (dos `<h1>` iguales
 * pegados, y un número al 45% de opacidad con 2,02:1 de contraste). Los dos
 * pasaron todas las comprobaciones automáticas.
 *
 * Los datos son de mentira PERO con los casos que rompen:
 *   · un duelo 0-0, que NO es empate
 *   · un rival sin cuenta (solo nombre, sin perfil al que enlazar)
 *   · un nombre con acento, para el buscador
 *   · alguien con solo partidas sin marcar, cuyo porcentaje debe CALLARSE
 */

import { useState } from 'react'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import type { DueloVisto, FilaRankingAmistosas } from '../../services/amistosas'
import { agruparCaraACara, winrateAmistosas } from '../../services/amistosas'
import { Avatar } from '../../components/ui/Avatar'

function lado(nombre: string, perfilId: string | null, victorias: number) {
  return { perfilId, nombre, avatar: null, mazoId: null, lider: '', base: '', victorias }
}

const DUELOS: DueloVisto[] = [
  {
    id: '1', cuando: new Date().toISOString(),
    yo: lado('Yo', 'yo', 2), rival: lado('Nicolás Peña', 'r1', 1),
    resultado: 'gane', rondas: 3, estado: 'confirmada', laAnoteYo: true,
  },
  {
    id: '2', cuando: new Date(Date.now() - 86400000).toISOString(),
    yo: lado('Yo', 'yo', 0), rival: lado('Nicolás Peña', 'r1', 2),
    resultado: 'perdi', rondas: 2, estado: 'confirmada', laAnoteYo: false,
  },
  {
    // El caso que más importa: nadie marcó quién ganó. No es empate.
    id: '3', cuando: new Date(Date.now() - 2 * 86400000).toISOString(),
    yo: lado('Yo', 'yo', 0), rival: lado('Marlin', 'r2', 0),
    resultado: 'sin-marcador', rondas: 1, estado: 'confirmada', laAnoteYo: true,
  },
  {
    // Invitado sin cuenta: no hay perfil al que enlazar.
    id: '4', cuando: new Date(Date.now() - 3 * 86400000).toISOString(),
    yo: lado('Yo', 'yo', 2), rival: lado('Invitado', null, 0),
    resultado: 'gane', rondas: 2, estado: 'sin_rival', laAnoteYo: true,
  },
]

const RANKING: FilaRankingAmistosas[] = [
  { userId: 'r1', nombre: 'Nicolás Peña', avatar: null, duelos: 9, ganados: 6, perdidos: 2, empatados: 1, sinMarcador: 0, rivales: 4 },
  { userId: 'yo', nombre: 'Yo', avatar: null, duelos: 4, ganados: 2, perdidos: 1, empatados: 0, sinMarcador: 1, rivales: 3 },
  // Su porcentaje TIENE que callarse: no hay ni una partida marcada.
  { userId: 'r2', nombre: 'Marlin', avatar: null, duelos: 3, ganados: 0, perdidos: 0, empatados: 0, sinMarcador: 3, rivales: 2 },
]

export function BancoAmistosas() {
  const [busca, setBusca] = useState('')
  const [vista, setVista] = useState<'cara' | 'ranking'>('ranking')

  const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  const cara = agruparCaraACara(DUELOS).filter(c => !busca || norm(c.nombre).includes(norm(busca)))

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <h1 className="text-xl font-black text-swu-text">Banco de amistosas</h1>
      <p className="text-sm text-swu-muted">
        Solo en desarrollo. Datos de mentira, con los casos que rompen: un 0-0,
        un invitado sin cuenta, un nombre con acento y alguien sin ninguna
        partida marcada.
      </p>

      <SegmentedControl<'cara' | 'ranking'>
        label="Vista"
        value={vista}
        onChange={setVista}
        options={[{ value: 'cara', label: 'Cara a cara' }, { value: 'ranking', label: 'Ranking' }]}
      />

      <input
        value={busca}
        onChange={e => setBusca(e.target.value)}
        placeholder="Buscar por oponente… (probá «nicolas» sin tilde)"
        className="w-full rounded-lg border border-swu-border bg-swu-surface px-3 py-2 text-sm text-swu-text"
      />

      {vista === 'cara' && (
        <ul className="divide-y divide-swu-border overflow-hidden rounded-xl bg-swu-surface">
          {cara.map(c => (
            <li key={c.rivalId ?? `n:${c.nombre}`} className="flex items-center gap-3 px-3 py-2.5">
              <Avatar avatar={c.avatar} size={40} anillo={c.rivalId ?? c.nombre} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-swu-text">{c.nombre}</span>
                <span className="block text-[10px] text-swu-muted">
                  {c.duelos} {c.duelos === 1 ? 'duelo' : 'duelos'}
                  {c.sinMarcador > 0 && ` · ${c.sinMarcador} sin marcador`}
                  {!c.rivalId && ' · sin cuenta'}
                </span>
              </span>
              <span className="shrink-0 font-mono text-sm font-black tabular-nums">
                <span className="text-swu-green">{c.ganados}</span>
                <span className="text-swu-muted">–</span>
                <span className="text-swu-red-texto">{c.perdidos}</span>
              </span>
            </li>
          ))}
          {cara.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-swu-muted">Nunca jugaste contra «{busca}».</li>
          )}
        </ul>
      )}

      {vista === 'ranking' && (
        <ul className="divide-y divide-swu-border overflow-hidden rounded-xl bg-swu-surface">
          {RANKING.map((f, i) => {
            const wr = winrateAmistosas(f)
            return (
              <li key={f.userId} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-5 shrink-0 text-center text-sm font-black tabular-nums text-swu-muted">{i + 1}</span>
                <Avatar avatar={f.avatar} size={32} anillo={f.userId} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-swu-text">{f.nombre}</span>
                  <span className="block text-[11px] tabular-nums text-swu-muted">
                    {f.ganados}-{f.perdidos}{f.empatados > 0 && `-${f.empatados}`}
                    {' · '}{f.duelos} duelos · {f.rivales} rivales
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {wr !== null
                    ? <span className="text-base font-black tabular-nums text-swu-green">{wr}%</span>
                    : <span className="text-[10px] text-swu-muted">sin marcador</span>}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
