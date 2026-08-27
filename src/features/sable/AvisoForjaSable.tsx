/**
 * «Todavía no forjaste tu sable» — el recordatorio del perfil.
 *
 * Medido el día que se armó: **4 de 41 cuentas** han forjado uno. El Taller
 * está abierto para todos desde hace días y la casi totalidad de la comunidad
 * ni entró.
 *
 * ── Por qué va acá y no en Inicio ────────────────────────────────────
 *
 * Porque acá está la CONSECUENCIA. La barra de XP de este mismo perfil ya
 * dibuja tu empuñadura y ahora también tu color, así que el aviso cae a un
 * dedo de lo que va a cambiar: no dice «hay un taller», dice «esta barra que
 * estás mirando puede ser tuya». Un recordatorio lejos de su efecto es
 * publicidad; pegado a él es una explicación.
 *
 * ── Es un ESTADO, no una novedad (§3v) ───────────────────────────────
 *
 * Por eso NO se descarta y no tiene botón de cerrar: desaparece sola el día
 * que forjás, que es la única forma honesta de que un recordatorio se vaya.
 * Un aviso que se puede callar sin hacer nada enseña a callar avisos.
 *
 * Y no se dibuja mientras no se sabe: un cartel que aparece medio segundo
 * después de abrir el perfil, y solo a veces, se lee como un parpadeo.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { SaberIcon } from '../../components/SWIcons'
import { miDisenoSable } from '../../services/sableService'

export function AvisoForjaSable() {
  // `null` = todavía no se preguntó. `true`/`false` = respuesta.
  const [tiene, setTiene] = useState<boolean | null>(null)

  useEffect(() => {
    let vivo = true
    void miDisenoSable().then(d => { if (vivo) setTiene(d !== null) })
    return () => { vivo = false }
  }, [])

  const navigate = useNavigate()
  if (tiene !== false) return null

  return (
    <button
      onClick={() => navigate('/sable')}
      className="flex w-full items-center gap-3 rounded-2xl border border-swu-accent/40 bg-swu-accent/10 px-4 py-3 text-left transition active:scale-[0.99]"
    >
      <SaberIcon size={22} className="shrink-0 text-swu-accent-texto" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-black text-swu-text">Todavía no forjaste tu sable</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-swu-muted">
          La empuñadura y el color de tu barra de XP salen del sable que armás
          en el Taller. Mientras tanto llevás el de fábrica.
        </p>
      </div>
      <ChevronRight size={18} className="shrink-0 text-swu-muted" />
    </button>
  )
}
