/**
 * AvisoEncuesta — el cartel que pide contestar la encuesta.
 *
 * ── «Casi obligatorio» quiere decir esto exactamente ─────────────────
 *
 * No es un muro. La app ya aprendió que «un modal que tapa la pantalla al
 * entrar es la forma más rápida de que la gente aprenda a cerrar avisos sin
 * leerlos — y después no lee los que sí importan». Y también que echar a
 * alguien por un botón mal tocado es un bug, no una regla más dura.
 *
 * Pero tampoco es el aviso de perfil, que se calla PARA SIEMPRE con un toque.
 * Ese silencio permanente convertiría la encuesta en opcional, que es justo lo
 * que no se quiere.
 *
 * El punto medio, y es el diseño entero: se puede posponer, no silenciar.
 * «Ahora no» son 24 horas. La encuesta dura siete días, así que quien la
 * aplace cada vez la habrá visto siete veces — y siete «ahora no» ya son una
 * respuesta. Y desaparece para siempre al contestar, cosa que no decide este
 * cartel: la decide el servidor, que deja de devolverla.
 *
 * ── A quién se le muestra NO se decide acá ───────────────────────────
 *
 * Este componente no sabe de países. Llama a `encuestaPendiente()` y dibuja lo
 * que venga; si la cuenta no es de El Salvador, el servidor devuelve nada.
 * Filtrar en el cliente sería poner la regla del otro lado de la puerta.
 */

import { useEffect, useState } from 'react'
import { ClipboardList, Clock } from 'lucide-react'
import {
  encuestaPendiente, encuestaPospuesta, posponerEncuesta,
  type EncuestaPendiente,
} from '../../services/encuesta'
import { EncuestaSheet } from './EncuestaSheet'

interface Props {
  /** Sin sesión no hay a quién preguntarle. */
  userId: string | null | undefined
}

export function AvisoEncuesta({ userId }: Props) {
  const [enc, setEnc] = useState<EncuestaPendiente | null>(null)
  const [abierta, setAbierta] = useState(false)
  const [gracias, setGracias] = useState(false)

  // El guard va DENTRO del efecto y antes de tocar el estado: un `setEnc(null)`
  // síncrono en el cuerpo del efecto encadena un render antes de pintar, y es
  // lo que la regla `set-state-in-effect` marca. Mismo patrón que
  // `AvisoSobreDiario`.
  useEffect(() => {
    if (!userId) return
    let vivo = true
    void (async () => {
      const e = await encuestaPendiente()
      if (vivo) setEnc(e)
    })()
    return () => { vivo = false }
  }, [userId])

  if (!userId || !enc) return null
  // Se consulta igual estando pospuesta —así el estado está fresco cuando
  // vuelva— pero no se dibuja nada hasta que pase el día.
  if (encuestaPospuesta() && !abierta && !gracias) return null

  const dias = enc.cierra ? diasHasta(enc.cierra) : null

  if (gracias) {
    return (
      <div className="mx-4 mb-3 rounded-xl border border-swu-green/40 bg-swu-green/10 px-3 py-2.5">
        <p className="text-[12px] font-bold text-swu-green">¡Gracias! Quedó registrada.</p>
        <p className="mt-0.5 text-[11px] leading-snug text-swu-muted">
          Cuando cierre, los resultados se publican para todos.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="mx-4 mb-3 rounded-xl border border-swu-cyan/40 bg-swu-cyan/10 p-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center
                           rounded-full bg-swu-cyan/20 text-swu-cyan">
            <ClipboardList size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-black leading-tight text-swu-text">{enc.titulo}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-swu-muted">
              {enc.descripcion}
            </p>
            {/* El plazo va con todas las letras: una encuesta «hasta que
                respondan» se llena dos días y después no se mueve más. */}
            {dias !== null && (
              <p className="mt-1 flex items-center gap-1 font-mono text-[10px] text-swu-cyan">
                <Clock size={11} />
                {dias <= 0 ? 'Cierra hoy' : dias === 1 ? 'Cierra mañana' : `Cierra en ${dias} días`}
              </p>
            )}
          </div>
        </div>

        <div className="mt-2.5 flex gap-2">
          <button
            onClick={() => setAbierta(true)}
            className="min-h-[44px] flex-1 rounded-xl bg-swu-cyan text-[13px] font-black text-swu-bg
                       active:scale-95 transition-transform"
          >
            Contestar · 3 min
          </button>
          {/* No hay «no me lo recuerdes». Ver la cabecera: eso la volvería
              opcional, y opcional con 25 personas es cero respuestas. */}
          <button
            onClick={() => { posponerEncuesta(); setEnc(null) }}
            className="min-h-[44px] rounded-xl border border-swu-border px-3 text-[12px]
                       font-bold text-swu-muted"
          >
            Ahora no
          </button>
        </div>
      </div>

      <EncuestaSheet
        open={abierta}
        clave={enc.clave}
        titulo={enc.titulo}
        descripcion={enc.descripcion}
        onCerrar={() => setAbierta(false)}
        onEnviada={() => { setAbierta(false); setGracias(true) }}
      />
    </>
  )
}

/** Días que faltan, contando por DÍA y no por horas: «cierra en 0 días» a las
 *  23:00 es peor que «cierra hoy». */
function diasHasta(fecha: string): number {
  const hoy = new Date()
  const fin = new Date(`${fecha}T23:59:59`)
  return Math.ceil((fin.getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000)) - 1
}
