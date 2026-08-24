/**
 * Banco del TALLER KYBER. Solo desarrollo (`/banco-kyber`).
 *
 * `/sable` exige sesión Y estar en `sable_probadores`, así que sin este banco la
 * única forma de MIRAR la pantalla sería entrar con la cuenta buena. Acá van las
 * piezas visuales con datos sintéticos: los cuatro pasos, la barra de stats y
 * las tarjetas en sus TRES estados —puesta, comprada sin poner, y a la venta—
 * que es justo lo que no se puede ver de una sola vez con datos reales.
 */

import { useState } from 'react'
import { BarraStats } from './BarraStats'
import { PiezaTarjeta } from './PiezaTarjeta'
import { MiniaturaPieza } from './MiniaturaPieza'
import { IDS_CONOCIDOS } from './partesSable'
import { PASOS, sumarStats, deltaDe, type Paso } from './kyber'
import { ICONO_POR_TEMA } from '../trivia/iconoTema'
import { TEMAS } from '../../services/trivia'
import type { ParteTaller } from '../../services/sableService'

const PARTES: ParteTaller[] = [
  { id: 'emi_estandar', tipo: 'emisor', nombre: 'AURORA', precio: 0, orden: 1, tengo: true, rareza: 'comun', potencia: 12, control: 12, energia: 12 },
  { id: 'emi_ranurado', tipo: 'emisor', nombre: 'OBSIDIAN', precio: 400, orden: 2, tengo: true, rareza: 'raro', potencia: 18, control: 14, energia: 11 },
  { id: 'emi_conico', tipo: 'emisor', nombre: 'VÓRTICE', precio: 900, orden: 3, tengo: false, rareza: 'epico', potencia: 26, control: 10, energia: 14 },
  { id: 'emi_dentado', tipo: 'emisor', nombre: 'KRAKEN', precio: 1800, orden: 4, tengo: false, rareza: 'legendario', potencia: 32, control: 13, energia: 10 },
  { id: 'cue_liso', tipo: 'cuerpo', nombre: 'FUNDAMENTO', precio: 0, orden: 1, tengo: true, rareza: 'comun', potencia: 12, control: 12, energia: 12 },
  { id: 'pom_plano', tipo: 'pomo', nombre: 'YUNQUE', precio: 0, orden: 1, tengo: true, rareza: 'comun', potencia: 12, control: 12, energia: 12 },
  { id: 'col_azul', tipo: 'color', nombre: 'KYBER AZUL', precio: 0, orden: 1, tengo: true, rareza: 'comun', potencia: 14, control: 14, energia: 14 },
]

const PUESTAS = ['emi_estandar', 'cue_liso', 'pom_plano', 'col_azul']

export function BancoKyber() {
  const [paso, setPaso] = useState<Paso>('piezas')
  const stats = sumarStats(PARTES, PUESTAS)

  return (
    <div className="mx-auto min-h-screen max-w-2xl space-y-6 bg-swu-bg p-5">
      <div>
        <h1 className="text-lg font-black text-swu-text">Taller Kyber — piezas de pantalla</h1>
        <p className="text-[12px] text-swu-muted">Datos sintéticos. La escena 3D vive en /banco-sable-3d.</p>
      </div>

      <section>
        <h2 className="mb-2 text-[11px] font-black uppercase tracking-widest text-swu-muted">
          Íconos de tema de la Trivia (antes eran emoji de sistema)
        </h2>
        <div className="flex flex-wrap items-end gap-5 rounded-xl border border-swu-border bg-swu-surface p-4">
          {TEMAS.map(t => {
            const { Icono, clase } = ICONO_POR_TEMA[t.id]
            return (
              <div key={t.id} className="flex flex-col items-center gap-1.5">
                <span className="flex gap-3">
                  <Icono size={18} className={clase} />
                  <Icono size={28} className={clase} />
                </span>
                <span className="font-mono text-[9px] text-swu-muted">{t.nombre}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[11px] font-black uppercase tracking-widest text-swu-muted">Los cuatro pasos</h2>
        <div className="flex items-center gap-1">
          {PASOS.map((p, i) => {
            const activo = p.id === paso
            return (
              <div key={p.id} className="flex min-w-0 flex-1 items-center gap-1">
                <button onClick={() => setPaso(p.id)} className="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-1">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-black
                    ${activo ? 'border-swu-amber bg-swu-amber text-swu-bg' : 'border-swu-border bg-swu-surface text-swu-muted'}`}>{p.n}</span>
                  <span className={`truncate text-[9px] font-black uppercase tracking-wider ${activo ? 'text-swu-amber' : 'text-swu-muted'}`}>{p.rotulo}</span>
                </button>
                {i < PASOS.length - 1 && <span className="h-px w-2 shrink-0 bg-swu-border" />}
              </div>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[11px] font-black uppercase tracking-widest text-swu-muted">La barra de stats</h2>
        <BarraStats stats={stats} />
        <p className="mt-1 text-[11px] text-swu-muted">Suma de las cuatro piezas puestas: {stats.potencia} / {stats.control} / {stats.energia}.</p>
      </section>

      <section>
        <h2 className="mb-2 text-[11px] font-black uppercase tracking-widest text-swu-muted">
          Miniaturas: la silueta REAL de cada pieza
        </h2>
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-swu-border bg-swu-surface p-4">
          {(['emisor', 'cuerpo', 'pomo'] as const).flatMap(tipo =>
            IDS_CONOCIDOS[tipo].map(id => (
              <div key={id} className="flex flex-col items-center gap-1">
                <MiniaturaPieza tipo={tipo} id={id} size={56} />
                <span className="font-mono text-[9px] text-swu-muted">{id.replace(/^[a-z]+_/, '')}</span>
              </div>
            )),
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-swu-muted">
          Salen del MISMO perfil que la malla 3D: si dos se ven iguales acá, se
          ven iguales en el sable.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-[11px] font-black uppercase tracking-widest text-swu-muted">
          Tarjetas: los tres estados y las cuatro rarezas
        </h2>
        {/* La MISMA tira horizontal que usa la página: si acá se desliza y las
            tarjetas salen parejas, allá también. */}
        <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
          {PARTES.filter(p => p.tipo === 'emisor').map(p => (
            <div key={p.id} className="flex w-44 shrink-0 snap-start">
              <PiezaTarjeta
                parte={p}
                puesta={p.id === 'emi_estandar'}
                delta={deltaDe(PARTES, PUESTAS, p)}
                ocupado={false}
                alElegir={() => {}}
              />
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-swu-muted">
          AURORA está puesta · OBSIDIAN la tenés sin poner · VÓRTICE y KRAKEN se compran.
          El delta es lo que convierte un precio en una decisión. La tira se
          desliza de izquierda a derecha, como en el taller.
        </p>
      </section>
    </div>
  )
}
