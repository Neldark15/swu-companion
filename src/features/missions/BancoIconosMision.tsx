/**
 * Banco de los íconos de misión (solo desarrollo).
 *
 * Un ícono no se juzga leyendo su `path`. Los tres tamaños a los que se dibuja
 * de verdad son 15 (la franja de Inicio), 22 (la tarjeta) y 48 (nada todavía,
 * pero es donde se ve si el trazo está desbalanceado). Acá están los 16 en los
 * tres, más los siete de interfaz.
 *
 * Ya cazó uno: `SobreIcon` a 22 px se leía como un CALENDARIO —el dentado de
 * arriba más la banda diagonal— y la misión decía «Abrir 1 sobre». Un ícono
 * que se lee mal es peor que ninguno.
 */

import { ICONO_POR_OBJETIVO } from '../../components/icons/iconoMision'
import {
  DianaIcon, RelojIcon, CobrarIcon, SelloHechoIcon, SiempreIcon, IrIcon, CargandoIcon,
} from '../../components/icons/MisionIcons'
import type { ObjectiveType } from '../../services/misionesCatalogo'

const QUE_ES: Record<ObjectiveType, string> = {
  dia_visitado: 'Entrar hoy',
  sobre_abierto: 'Abrir un sobre',
  muro_publicado: 'Escribir en Comunidades',
  post_apoyado: 'Dar corazón',
  trivia_respondida: 'Contestar la trivia',
  card_favorited: 'Marcar favorita',
  carta_agregada: 'Sumar carta al botín',
  carta_deseada: 'Marcar «la busco»',
  chat_enviado: 'Escribir en el chat',
  deck_created: 'Armar un mazo',
  carta_en_venta: 'Poner en venta',
  mazo_compartido: 'Compartir el mazo',
  amistosa_registrada: 'Registrar amistosa',
  match_played: 'Jugar una partida',
  match_won: 'Ganar una partida',
  gift_sent: 'Enviar un regalo',
}

const INTERFAZ = [
  ['Diana (encabezado)', DianaIcon],
  ['Reloj (reinicio)', RelojIcon],
  ['Cobrar', CobrarIcon],
  ['Hecho', SelloHechoIcon],
  ['Siempre (hazañas)', SiempreIcon],
  ['Ir', IrIcon],
  ['Cargando', CargandoIcon],
] as const

export function BancoIconosMision() {
  const objetivos = Object.keys(ICONO_POR_OBJETIVO) as ObjectiveType[]

  return (
    <div className="min-h-screen bg-swu-bg p-5 text-swu-text">
      <h1 className="text-lg font-bold">Íconos de misión</h1>
      <p className="mb-5 text-xs text-swu-muted">
        Solo desarrollo. 15 px es la franja de Inicio, 22 px la tarjeta.
        Si a 15 no se distingue de su vecino, no sirve.
      </p>

      <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-swu-muted">
        Por objetivo ({objetivos.length})
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {objetivos.map((o) => {
          const Icono = ICONO_POR_OBJETIVO[o]
          return (
            <div key={o} className="flex items-center gap-3 rounded-xl border border-swu-border bg-swu-surface/60 p-3">
              <span className="flex w-24 shrink-0 items-center justify-around text-swu-accent-texto">
                <Icono size={15} />
                <Icono size={22} />
                <Icono size={34} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold">{QUE_ES[o]}</p>
                <p className="truncate font-mono text-[10px] text-swu-muted">{o}</p>
              </div>
            </div>
          )
        })}
      </div>

      <h2 className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-wider text-swu-muted">
        De interfaz
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {INTERFAZ.map(([nombre, Icono]) => (
          <div key={nombre} className="flex items-center gap-3 rounded-xl border border-swu-border bg-swu-surface/60 p-3">
            <span className="flex w-24 shrink-0 items-center justify-around text-swu-accent-texto">
              <Icono size={15} />
              <Icono size={22} />
              <Icono size={34} />
            </span>
            <p className="truncate text-[12px] font-semibold">{nombre}</p>
          </div>
        ))}
      </div>

      {/* Sobre la chapa clara: los íconos heredan el color, así que hay que ver
          que ninguno dependa de un relleno oscuro para leerse. */}
      <h2 className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-wider text-swu-muted">
        Sobre fondo claro
      </h2>
      <div className="flex flex-wrap gap-3 rounded-xl bg-swu-text/90 p-4 text-swu-bg">
        {objetivos.map((o) => {
          const Icono = ICONO_POR_OBJETIVO[o]
          return <Icono key={o} size={26} />
        })}
      </div>
    </div>
  )
}
