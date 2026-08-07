/**
 * WhatsappSetting — compartir (o retirar) el teléfono para intercambios.
 *
 * Es OPCIONAL y reversible: vaciar el campo borra el número.
 *
 * Lo que la pantalla le dice al usuario, sin adornos: quien tenga cuenta en la
 * app va a poder escribirle. No se lo mostramos a nadie como texto —solo se
 * usa para armar el enlace del chat— pero guardarlo es guardarlo, y eso se
 * avisa antes de pedirlo, no después.
 */

import { useState, useEffect } from 'react'
import { MessageCircle, Check, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import {
  getMyWhatsapp, setMyWhatsapp, formatWhatsappForInput,
} from '../../services/tradeService'

export function WhatsappSetting({ userId }: { userId: string }) {
  const [value, setValue] = useState('')
  const [saved, setSaved] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    let cancelled = false
    getMyWhatsapp(userId).then(v => {
      if (cancelled) return
      setSaved(v)
      setValue(formatWhatsappForInput(v))
    })
    return () => { cancelled = true }
  }, [userId])

  const save = async (raw: string) => {
    setBusy(true)
    setError(null)
    const r = await setMyWhatsapp(userId, raw)
    setBusy(false)
    if (!r.ok) { setError(r.error ?? 'No se pudo guardar'); return }
    const v = await getMyWhatsapp(userId)
    setSaved(v)
    setValue(formatWhatsappForInput(v))
    setOk(true)
    setTimeout(() => setOk(false), 2000)
  }

  return (
    <div className="bg-swu-surface rounded-2xl p-4 border border-swu-border space-y-3">
      <div className="flex items-center gap-2">
        <MessageCircle size={16} className="text-swu-green" />
        <p className="text-sm font-bold text-swu-text">WhatsApp para intercambios</p>
        {saved && (
          <span className="text-[10px] font-bold text-swu-green bg-swu-green/15 px-1.5 py-0.5 rounded">
            Compartido
          </span>
        )}
      </div>

      <p className="text-[11px] text-swu-muted leading-relaxed">
        Opcional. Si lo ponés, quien tenga cuenta puede abrir un chat con vos
        desde una coincidencia de intercambio, con el mensaje ya escrito.
        Tu número no se muestra en ninguna pantalla, pero queda guardado — si
        preferís que no, dejá el campo vacío y se borra.
      </p>

      <div className="flex gap-2">
        <input
          type="tel"
          inputMode="tel"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null) }}
          placeholder="+503 7123 4567"
          aria-label="Número de WhatsApp"
          className="flex-1 px-3 py-2 bg-swu-bg border border-swu-border rounded-lg text-sm text-swu-text font-mono"
        />
        <Button size="sm" variant="primary" loading={busy} onClick={() => save(value)}>
          {ok ? <><Check size={13} aria-hidden /> Listo</> : 'Guardar'}
        </Button>
      </div>

      {saved && (
        <Button
          size="xs"
          variant="danger"
          onClick={() => save('')}
          disabled={busy}
        >
          <Trash2 size={11} aria-hidden /> Borrar mi número
        </Button>
      )}

      {error && <p className="text-[11px] text-swu-red-texto">{error}</p>}

      <p className="text-[10px] text-swu-muted/60">
        Un número local de 8 dígitos se asume de El Salvador (+503).
      </p>
    </div>
  )
}
