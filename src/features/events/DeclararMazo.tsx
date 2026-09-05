/**
 * Con qué mazo vas a jugar, declarado AL INSCRIBIRTE.
 *
 * ── Por qué se pregunta acá y no después ─────────────────────────────
 *
 * Hasta ahora el mazo de cada quien se cargaba a mano DESPUÉS del torneo,
 * preguntándole uno por uno qué había jugado. Los doce del torneo del 29/8 se
 * escribieron así, y uno terminó inventado porque nadie se acordaba.
 *
 * Preguntado al inscribirse, el dato lo pone quien lo sabe, en el momento en
 * que lo sabe. Y de ahí viaja solo: al sembrar la clasificación se copia, así
 * que el archivo del torneo queda con los mazos sin que nadie los transcriba.
 *
 * ── Twin Suns ────────────────────────────────────────────────────────
 *
 * Se piden DOS líderes cuando el torneo es de ese formato. Un segundo líder
 * vacío en un Premier no es un dato a medias: es que no existe.
 *
 * ── Nada de esto es obligatorio ──────────────────────────────────────
 *
 * Se puede entrar sin declarar nada: mucha gente se anota una semana antes y
 * decide el mazo la noche anterior. Bloquear la inscripción por eso costaría
 * inscritos, que es lo único que un torneo no puede permitirse. Se puede
 * completar después desde el lobby.
 */

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { ElegirCarta } from '../../components/ElegirCarta'
import { ensureCards } from '../../services/swuApi'
import { cargarIndice, claveDeCarta, SEPARADOR, type IndiceCartas } from '../amistosas/cartasAmistosas'
import { db } from '../../services/db'
import type { Card, Deck } from '../../types'
import type { MazoDeclarado } from '../../services/events'

interface Props {
  /** `true` en un torneo de Twin Suns: se piden dos líderes. */
  dosLideres: boolean
  inicial?: MazoDeclarado
  etiquetaAceptar: string
  ocupado?: boolean
  onAceptar: (m: MazoDeclarado) => void
  onCancelar: () => void
}

export function DeclararMazo({
  dosLideres, inicial, etiquetaAceptar, ocupado, onAceptar, onCancelar,
}: Props) {
  const [indice, setIndice] = useState<IndiceCartas | null>(null)
  const [mazos, setMazos] = useState<Deck[]>([])
  const [l1, setL1] = useState<Card | null>(null)
  const [l2, setL2] = useState<Card | null>(null)
  const [base, setBase] = useState<Card | null>(null)
  const [nombre, setNombre] = useState(inicial?.deck_nombre ?? '')

  useEffect(() => {
    let vivo = true
    void (async () => {
      // `ensureCards` antes de `cargarIndice`: con la base local vacía el
      // índice sale vacío SIN error y el buscador se vería roto sin decir por qué.
      await ensureCards()
      const [i, ms] = await Promise.all([cargarIndice(), db.decks.toArray()])
      if (!vivo) return
      setIndice(i)
      setMazos(ms)
      // Lo ya declarado se resuelve contra el índice para poder mostrarlo.
      if (inicial?.leader_1) setL1(i.porClave.get(inicial.leader_1) ?? null)
      if (inicial?.leader_2) setL2(i.porClave.get(inicial.leader_2) ?? null)
      if (inicial?.base_carta) setBase(i.porClave.get(inicial.base_carta) ?? null)
    })()
    return () => { vivo = false }
    // Solo al montar: `inicial` es el punto de partida, no una atadura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Los mazos guardados que sirven para este torneo. */
  const candidatos = useMemo(
    () => mazos.filter(m => (m.leaders?.length ?? 0) >= (dosLideres ? 2 : 1)),
    [mazos, dosLideres],
  )

  const tomarDe = (d: Deck) => {
    if (!indice) return
    /* El líder se busca por «Nombre — Subtítulo», NO por el nombre pelado.
       Hay cuatro Ahsoka Tano y dos Cad Bane: el índice mapea el nombre suelto
       a la PRIMERA alfabéticamente, así que buscar así elegía otro líder y la
       miniatura mostraba una carta que la persona no juega. El subtítulo es
       justo lo que los distingue, y la carta del mazo ya lo trae. */
    const lider = (c?: { name: string; subtitle: string | null }) => {
      if (!c) return null
      return indice.porClave.get(c.subtitle ? `${c.name}${SEPARADOR}${c.subtitle}` : c.name) ?? null
    }
    setL1(lider(d.leaders?.[0]))
    setL2(dosLideres ? lider(d.leaders?.[1]) : null)
    // Las bases van por nombre pelado: es como se guardan y no llevan subtítulo.
    setBase(d.base?.name ? indice.porClave.get(d.base.name) ?? null : null)
    setNombre(d.name)
  }

  const aceptar = () => onAceptar({
    leader_1: l1 ? claveDeCarta(l1) : null,
    // El segundo líder solo existe en Twin Suns. Mandarlo en un Premier
    // guardaría un dato que después nadie sabría interpretar.
    leader_2: dosLideres && l2 ? claveDeCarta(l2) : null,
    // La base va por nombre pelado, que es como la resuelve el índice.
    base_carta: base ? base.name : null,
    deck_nombre: nombre.trim() || null,
  })

  if (!indice) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-xs text-swu-muted">
        <Loader2 size={14} className="animate-spin" /> Cargando cartas…
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-swu-muted">
        Decinos con qué vas a jugar. Podés dejarlo en blanco y completarlo
        después desde el lobby.
      </p>

      {candidatos.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-swu-muted">
            De tus mazos guardados
          </p>
          <div className="flex flex-wrap gap-1.5">
            {candidatos.slice(0, 8).map(d => (
              <button
                key={d.id}
                type="button"
                onClick={() => tomarDe(d)}
                className="rounded-lg border border-swu-border bg-swu-bg px-2 py-1 text-[11px] font-semibold text-swu-text hover:border-swu-accent/50"
              >
                {d.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <ElegirCarta
        etiqueta={dosLideres ? 'Líder 1' : 'Tu líder'}
        opciones={indice.lideres} valor={l1} onElegir={setL1}
      />
      {dosLideres && (
        <ElegirCarta etiqueta="Líder 2" opciones={indice.lideres} valor={l2} onElegir={setL2} />
      )}
      <ElegirCarta etiqueta="Tu base" opciones={indice.bases} valor={base} onElegir={setBase} />

      <div className="flex gap-2 pt-1">
        <Button variant="primary" size="sm" block onClick={aceptar} loading={ocupado}>
          {etiquetaAceptar}
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
