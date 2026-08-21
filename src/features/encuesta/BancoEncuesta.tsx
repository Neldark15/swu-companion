/**
 * BancoEncuesta — banco de pruebas de la encuesta. **Solo desarrollo.**
 *
 * La hoja real solo aparece con sesión, con el país en SV y con la encuesta
 * abierta; o sea que sin banco no hay forma de MIRAR los seis tipos de
 * pregunta. Monta el componente de verdad —`EncuestaSheet`—, así que lo que se
 * ve acá es lo que va a ver la comunidad.
 *
 * Enviar desde acá FALLA a propósito y sin sesión no llega a la base: el banco
 * es para revisar el dibujo, no para meter respuestas de mentira en la muestra
 * de 25 personas.
 */

import { useState } from 'react'
import { EncuestaSheet } from './EncuestaSheet'
import { PREGUNTAS } from '../../services/encuesta'

export function BancoEncuesta() {
  const [abierta, setAbierta] = useState(true)

  return (
    <div className="min-h-screen bg-swu-bg p-4">
      <p className="font-mono text-[11px] text-swu-muted" data-banco-encuesta="1">
        Banco de la encuesta · {PREGUNTAS.length} preguntas ·{' '}
        {[...new Set(PREGUNTAS.map(p => p.tipo))].join(', ')}
      </p>
      <button
        onClick={() => setAbierta(true)}
        className="mt-3 min-h-[44px] rounded-xl bg-swu-cyan px-4 text-[13px] font-black text-swu-bg"
      >
        Abrir la encuesta
      </button>
      <p className="mt-3 font-mono text-[10px] leading-relaxed text-swu-muted">
        Enviar falla sin sesión: es a propósito, para no ensuciar la muestra.
      </p>

      <EncuestaSheet
        open={abierta}
        clave="banco"
        titulo="Encuesta de la comunidad"
        descripcion="Doce preguntas, tres minutos, sin tu nombre."
        onCerrar={() => setAbierta(false)}
        onEnviada={() => setAbierta(false)}
      />
    </div>
  )
}
