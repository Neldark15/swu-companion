/**
 * MeleeSetting — enlazar (o soltar) el perfil público de melee.gg.
 *
 * Es opcional y reversible. Lo que la pantalla dice sin adornos:
 *
 * - Lo que se guarda es solo el NOMBRE DE USUARIO, que ya es público.
 * - Los resultados quedan visibles para cualquiera que vea el perfil, porque
 *   ya son públicos en melee; enlazarlos acá los junta, no los revela.
 * - **Nadie puede comprobar que la cuenta sea tuya.** Melee no expone ningún
 *   campo editable en el perfil público —ni biografía ni descripción— así que
 *   no hay dónde poner un código de confirmación. La insignia de «verificado»
 *   la pone un admin a mano. Se avisa antes, no después.
 */

import { useState, useEffect } from 'react'
import { Swords, Check, Trash2, ExternalLink, ShieldAlert } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import {
  leerEnlaceMelee, guardarUsuarioMelee, desenlazarMelee, urlPerfilMelee,
} from '../../services/meleeProfileService'

export function MeleeSetting({ userId }: { userId: string }) {
  const [valor, setValor] = useState('')
  const [guardado, setGuardado] = useState<string | null>(null)
  const [verificado, setVerificado] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    let cancelado = false
    void leerEnlaceMelee(userId).then(r => {
      if (cancelado) return
      setGuardado(r.usuario)
      setVerificado(r.verificado)
      setValor(r.usuario ?? '')
    })
    return () => { cancelado = true }
  }, [userId])

  const guardar = async () => {
    setOcupado(true)
    setError(null)
    setOk(false)
    const r = await guardarUsuarioMelee(userId, valor)
    setOcupado(false)
    if (!r.ok) { setError(r.error); return }
    setGuardado(r.usuario)
    setValor(r.usuario)
    // Cambiar de cuenta baja la insignia: lo hace un disparador en la base,
    // así que acá solo se refleja.
    setVerificado(false)
    setOk(true)
    setTimeout(() => setOk(false), 2500)
  }

  const soltar = async () => {
    setOcupado(true)
    setError(null)
    const r = await desenlazarMelee(userId)
    setOcupado(false)
    if (!r.ok) { setError(r.error ?? 'No se pudo desenlazar'); return }
    setGuardado(null)
    setVerificado(false)
    setValor('')
  }

  const cambiado = valor.trim() !== (guardado ?? '')

  return (
    <div className="bg-swu-surface rounded-xl border border-swu-border p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Swords size={15} className="text-swu-cyan flex-shrink-0" aria-hidden />
        <h3 className="text-sm font-bold text-swu-text flex-1">Mi perfil de Melee</h3>
        {guardado && (
          <a
            href={urlPerfilMelee(guardado)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-swu-cyan hover:underline flex items-center gap-1"
          >
            Ver <ExternalLink size={9} aria-hidden />
          </a>
        )}
      </div>

      <p className="text-[11px] text-swu-muted leading-snug">
        Enlazá tu perfil de melee.gg y tus torneos de Star Wars: Unlimited aparecen
        acá solos, con puesto y récord. Se guarda solo tu nombre de usuario.
      </p>

      <input
        value={valor}
        onChange={e => { setValor(e.target.value); setError(null) }}
        placeholder="https://melee.gg/Profile/Index/tu-usuario"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="w-full bg-swu-bg border border-swu-border rounded-lg px-3 py-2 text-sm
                   text-swu-text placeholder:text-swu-muted/50
                   focus:outline-none focus:ring-2 focus:ring-swu-accent"
      />

      <div className="flex gap-2">
        <Button
          size="sm"
          block
          loading={ocupado}
          disabled={!cambiado || !valor.trim()}
          onClick={() => void guardar()}
        >
          {ok ? <><Check size={14} aria-hidden /> Enlazado</> : 'Enlazar'}
        </Button>
        {guardado && (
          <Button size="sm" variant="secondary" disabled={ocupado} onClick={() => void soltar()}>
            <Trash2 size={14} aria-hidden />
          </Button>
        )}
      </div>

      {error && <p className="text-[11px] text-swu-red-texto leading-snug">{error}</p>}

      {/* La honestidad va acá y no en letra chica al final. */}
      {guardado && !verificado && (
        <p className="text-[10px] text-swu-muted/80 leading-snug flex gap-1.5">
          <ShieldAlert size={12} className="text-swu-amber flex-shrink-0 mt-px" aria-hidden />
          <span>
            Aparece como <b>sin verificar</b>: melee no ofrece ninguna forma de comprobar
            que una cuenta es tuya, así que la insignia la da un administrador.
          </span>
        </p>
      )}
    </div>
  )
}
