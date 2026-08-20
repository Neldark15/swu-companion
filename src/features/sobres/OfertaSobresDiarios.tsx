/**
 * «Uno al día. TRES con los avisos puestos.»
 *
 * ── Por qué esto existe ──────────────────────────────────────────────
 *
 * El sobre diario ya se reparte solo a las 8 de la mañana, y desde hoy son
 * TRES para quien tenga los avisos activados. Pero un premio que nadie sabe que
 * existe no cambia la conducta de nadie: medido, 7 de 27 perfiles tienen
 * suscripción de push, o sea que 20 personas están cobrando un sobre en vez de
 * tres sin enterarse.
 *
 * ── El criterio que se anuncia es el MISMO que reparte ───────────────
 *
 * `dar_sobre_diario()` mira `push_subscriptions`. Acá se dice «avisos
 * activados» y no «app instalada» porque eso es lo que de verdad se comprueba;
 * prometer una cosa y premiar otra es cómo se pierde la confianza en un premio.
 * (En iOS los avisos EXIGEN la app instalada, así que en la práctica el que
 * cobra tres hizo las dos cosas.)
 *
 * ── Y por qué dice «mañana» ──────────────────────────────────────────
 *
 * El reparto es una foto que se toma a las 8:00: quien active los avisos a
 * mediodía ya cobró el suyo de hoy y empieza a cobrar tres en la corrida
 * siguiente. Decir «al instante» sería mentira y la primera mañana se notaría.
 */

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { CargoIcon } from '../../components/SWIcons'
import { isUserSubscribed, subscribeToPush, getNotificationPermission } from '../../services/pushService'
import { diaCalendarioSV } from '../../services/horaSV'

/** Las dos cifras viven acá y no sueltas en el texto: si cambia el reparto, cambia en un sitio. */
export const SOBRES_SIN_AVISOS = 1
export const SOBRES_CON_AVISOS = 3

/**
 * La tarjeta, para pantallas que YA son sobre esto: la puerta de instalación y
 * el acceso. Ahí no va un emergente —sería un cartel encima de un cartel—, va
 * la razón por la que vale la pena dar el paso que la pantalla está pidiendo.
 */
export function TarjetaOferta() {
  return (
    <div className="clip-hud bg-swu-amber/12 px-4 py-3">
      <div className="flex items-center gap-3">
        <CargoIcon size={24} className="shrink-0 text-swu-amber" />
        <div className="min-w-0">
          <p className="text-sm font-black text-swu-text">
            {SOBRES_CON_AVISOS} sobres al día con los avisos puestos
          </p>
          <p className="text-[11px] leading-snug text-swu-muted">
            Sin ellos es {SOBRES_SIN_AVISOS}. Caen solos cada mañana a las 8:00 y se abren en La Bóveda.
          </p>
        </div>
      </div>
    </div>
  )
}

/** Una vez por día y por aparato: insistir en cada arranque es como se enseña a ignorar un cartel. */
const CLAVE_VISTO = 'swu_oferta_sobres_visto'

/**
 * El emergente, para quien YA está dentro sin avisos.
 *
 * Es el caso que más importa y el único que no tiene pantalla propia: quien
 * entró por la salida de emergencia de la puerta («entrar sin avisos») o quien
 * ya tenía cuenta de antes. A esa persona nadie le va a contar lo de los tres
 * sobres si no se le dice acá.
 *
 * No se dibuja nunca para quien ya está suscrito — sería pedirle algo que ya
 * hizo—, y se calla solo por el resto del día en cuanto se cierra.
 */
export function PopupOferta({ userId, alIrAAjustes }: {
  /** El id de auth. Sin él no hay a quién suscribir. */
  userId: string
  /** Salida de emergencia si el navegador dice que no. */
  alIrAAjustes: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [pidiendo, setPidiendo] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let vivo = true

    void (async () => {
      // La marca del día se mira PRIMERO y en seco: es síncrona y descarta al
      // que ya vio el cartel hoy sin tocar el service worker.
      let visto: string | null = null
      try { visto = localStorage.getItem(CLAVE_VISTO) } catch { return }
      if (visto === diaCalendarioSV(new Date())) return

      // El permiso es la respuesta rápida y NO puede colgarse. Si no está
      // concedido, no hay suscripción posible: esta persona está cobrando uno.
      const permiso = getNotificationPermission()
      if (permiso !== 'granted') { if (vivo) setVisible(true); return }

      // Con el permiso ya dado casi siempre hay suscripción, pero no siempre
      // (borrar los datos del sitio la deja sin ella). Se comprueba, con reloj:
      // `isUserSubscribed` espera a `navigator.serviceWorker.ready`, y esa
      // promesa NO RESUELVE NUNCA si no hay service worker registrado —
      // comprobado en el banco, el efecto se colgaba y el cartel no salía jamás.
      //
      // Si el reloj gana, se decide NO mostrar. Es el lado seguro: enseñarle
      // «estás cobrando 1» a alguien que cobra 3 sería mentirle, y una mentira
      // en un premio es peor que un cartel que no salió.
      const conReloj = await Promise.race([
        isUserSubscribed().catch(() => true),
        new Promise<boolean>(r => setTimeout(() => r(true), 3000)),
      ])
      if (vivo && !conReloj) setVisible(true)
    })()

    return () => { vivo = false }
  }, [userId])

  const cerrar = () => {
    try { localStorage.setItem(CLAVE_VISTO, diaCalendarioSV(new Date())) } catch { /* modo privado */ }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[190] flex items-end justify-center bg-black/60 p-4 pb-24 sm:items-center sm:pb-4">
      <div className="clip-hud w-full max-w-sm bg-swu-surface p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-swu-amber/15">
            <CargoIcon size={24} className="text-swu-amber" />
          </div>
          {/* 44×44 de área táctil, no el tamaño del ícono. */}
          <button
            onClick={cerrar}
            aria-label="Cerrar"
            className="-mt-1 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center text-swu-muted hover:text-swu-text"
          >
            <X size={18} />
          </button>
        </div>

        <h2 className="text-lg font-black text-swu-text">
          Estás cobrando {SOBRES_SIN_AVISOS} sobre al día
        </h2>
        <p className="mt-1.5 text-sm leading-snug text-swu-muted">
          Con los avisos activados son <strong className="text-swu-amber">{SOBRES_CON_AVISOS}</strong>,
          todas las mañanas a las 8:00. Se te avisa cuando caen y los abrís en La Bóveda.
        </p>
        <p className="mt-2 text-[11px] leading-snug text-swu-muted">
          Empiezan a caer de a {SOBRES_CON_AVISOS} en el reparto siguiente, no al instante: el de hoy
          ya se repartió. Si algún día apagás los avisos, volvés a {SOBRES_SIN_AVISOS}.
        </p>

        {/* El fallo se enseña tal cual lo devuelve el servicio: «el navegador no
            los soporta» y «tocaste Bloquear» piden cosas distintas, y un
            «no se pudo» genérico no le sirve a ninguno de los dos. */}
        {fallo && (
          <p className="mt-3 rounded-lg bg-swu-red/15 px-3 py-2 text-[11px] leading-snug text-swu-red-texto">
            {fallo}{' '}
            <button onClick={() => { cerrar(); alIrAAjustes() }} className="underline">
              Abrir Ajustes
            </button>
          </p>
        )}

        <div className="mt-4 flex gap-2">
          {/* Se suscribe DESDE ACÁ y no mandando a Ajustes: `subscribeToPush`
              exige un gesto del usuario, y este clic lo es. Se llama a la misma
              función que usa el interruptor de Ajustes — tener dos maneras de
              suscribir es cómo una de las dos se queda vieja. */}
          <button
            disabled={pidiendo}
            onClick={async () => {
              setPidiendo(true)
              setFallo(null)
              const r = await subscribeToPush(userId)
              setPidiendo(false)
              if (r.ok) cerrar()
              else setFallo(r.error ?? 'No se pudieron activar.')
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-swu-amber py-2.5 text-sm font-bold text-black disabled:opacity-60"
          >
            <Bell size={16} />
            {pidiendo ? 'Activando…' : 'Activar avisos'}
          </button>
          <button
            onClick={cerrar}
            className="rounded-lg px-3 py-2.5 text-sm text-swu-muted"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  )
}
