/**
 * BANCO DE AVISOS — el toast y la campana, sin esperar a que pase algo.
 *
 * Existe porque estos dos componentes solo se ven cuando ocurre un hecho real
 * —ganás un logro, te cae un regalo, se reparte el sobre diario— y encima el
 * toast dura CINCO segundos. Revisarlos «de verdad» era provocar el hecho y
 * llegar a mirar antes de que se fuera.
 *
 * Y estaban sin mirar: el campo `link` prometía llevarte a algún lado desde
 * que se escribió, y ni la campana ni el toast lo leían. Tipos, lint y build
 * pasaban perfecto con la promesa incumplida.
 *
 * Los dos casos que importan y que se ven distinto:
 *   · CON destino  → lleva a la ruta, se marca leída y aparece la flecha.
 *   · SIN destino  → solo se cierra. NO es un caso raro: los cuatro avisos de
 *                    mesa de un torneo van sin `link` a propósito, porque ya
 *                    estás en esa pantalla y navegar te sacaría de la partida.
 *
 * Y el tercero, que es el que de verdad hay que poder probar: un destino
 * MANIPULADO. Las notificaciones viven en localStorage, así que cualquiera
 * puede editarlas; `esRutaInterna` tiene que dejar esos afuera y el aviso
 * comportarse como si no tuviera destino.
 */

import { useState } from 'react'
import { useNotificationStore } from '../../services/notificationService'
import { esRutaInterna } from '../../services/rutaInterna'
import { TarjetaOferta, PopupOferta } from '../../features/sobres/OfertaSobresDiarios'
import { CartaDelDia } from '../../features/home/CartaDelDia'

/** Cada botón deja un aviso distinto. El texto dice a dónde debería llevar. */
const CASOS: { rotulo: string; link?: string; nota: string }[] = [
  { rotulo: 'Con destino (/sobres)', link: '/sobres', nota: 'flecha + navega + marca leída' },
  { rotulo: 'Con destino (/profile)', link: '/profile', nota: 'flecha + navega' },
  { rotulo: 'Sin destino', nota: 'sin flecha, solo cierra' },
  // Los tres que NO deben navegar. Si alguno lleva a otro dominio, la guarda
  // está rota y la app es un redirector abierto.
  { rotulo: 'Manipulado //evil.com', link: '//evil.com', nota: 'DEBE portarse como «sin destino»' },
  { rotulo: 'Manipulado /\\evil.com', link: '/\\evil.com', nota: 'DEBE portarse como «sin destino»' },
  { rotulo: 'Manipulado /<TAB>/evil.com', link: '/\t/evil.com', nota: 'DEBE portarse como «sin destino»' },
]

export function BancoAvisos() {
  const addNotification = useNotificationStore(s => s.addNotification)
  const notifications = useNotificationStore(s => s.notifications)
  const unreadCount = useNotificationStore(s => s.unreadCount)
  const [verPopup, setVerPopup] = useState(0)

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <h1 className="text-xl font-black text-swu-text">Banco de avisos</h1>
      <p className="text-sm text-swu-muted">
        Solo en desarrollo. Tocá un botón y mirá el toast arriba; después abrí la
        campana del encabezado. El toast se va solo a los 5 segundos.
      </p>

      <div className="grid gap-2">
        {CASOS.map((c, i) => (
          <button
            key={c.rotulo}
            type="button"
            onClick={() => addNotification({
              type: 'gift',
              title: c.rotulo,
              message: c.nota,
              icon: '🎁',
              link: c.link,
              // Clave única por toque: si no, la guarda de repetidos se lo come
              // a partir del segundo y el banco parecería roto.
              dedupKey: `banco:${i}:${notifications.length}`,
            })}
            className="flex items-center justify-between gap-3 rounded-lg border border-swu-border bg-swu-surface px-3 py-2.5 text-left"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm text-swu-text">{c.rotulo}</span>
              <span className="block text-[11px] text-swu-muted">{c.nota}</span>
            </span>
            <span className={`shrink-0 rounded px-2 py-1 font-mono text-[10px] ${
              esRutaInterna(c.link) ? 'bg-swu-green/20 text-swu-green' : 'bg-swu-surface-hover text-swu-muted'
            }`}>
              {esRutaInterna(c.link) ? 'navega' : 'no navega'}
            </span>
          </button>
        ))}
      </div>

      {/* La tarjeta del sobre diario, que va en la puerta de instalación, en el
          muro de acceso y en la bienvenida. Las tres están detrás de estados
          que no se pueden provocar a mano (no instalado / sin sesión), así que
          sin esto se subiría sin que nadie la viera. */}
      <div className="border-t border-swu-border pt-4">
        <p className="mb-2 text-sm text-swu-muted">La tarjeta del sobre diario</p>
        <TarjetaOferta />

        {/* Y el emergente, el que de verdad hay que mirar: es el único que se
            dibuja encima de todo y el que lleva el botón que suscribe. En
            producción solo lo ve quien NO tiene avisos y una vez por día, así
            que acá se fuerza borrando su marca. */}
        <button
          type="button"
          onClick={() => { try { localStorage.removeItem('swu_oferta_sobres_visto') } catch { /* modo privado */ } setVerPopup(v => v + 1) }}
          className="mt-3 w-full rounded-lg border border-swu-border bg-swu-surface px-3 py-2.5 text-sm text-swu-text"
        >
          Mostrar el emergente
        </button>
        {verPopup > 0 && (
          <PopupOferta key={verPopup} userId="banco" alIrAAjustes={() => alert('iría a /settings')} />
        )}
      </div>

      {/* La carta del dia de Inicio. Lee el catalogo local, asi que si el banco
          la muestra vacia es que Dexie todavia no bajo las cartas. */}
      <div className="border-t border-swu-border pt-4">
        <p className="mb-1 text-sm text-swu-muted">La carta del día (de Inicio)</p>
        <div className="-mx-4"><CartaDelDia /></div>
      </div>

      <div className="rounded-lg bg-swu-surface px-3 py-2.5 text-xs text-swu-muted tabular-nums">
        {notifications.length} en la campana · {unreadCount} sin leer
        <button
          type="button"
          onClick={() => useNotificationStore.setState({ notifications: [], unreadCount: 0, currentToast: null })}
          className="ml-3 text-swu-accent-texto underline"
        >
          vaciar
        </button>
      </div>
    </div>
  )
}
