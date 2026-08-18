/**
 * Archivos Jedi — la trivia del perfil.
 *
 * ── El bug que motivó la reescritura ─────────────────────────────────
 *
 * «Contestás una pregunta y la siguiente aparece ya contestada.» La causa
 * estaba en UNA derivación: la lista de preguntas pendientes se calculaba en
 * vivo desde el progreso (`questions.filter(q => !answeredIds.includes(q.id))`)
 * y `handleAnswer` metía la pregunta recién contestada en `answeredIds` AL
 * INSTANTE. En el re-render la lista se encogía, el índice quedaba apuntando a
 * la pregunta SIGUIENTE, y como `showResult`/`selectedAnswer` seguían puestos,
 * esa siguiente se pintaba ya respondida — con el veredicto y el dato curioso
 * de la pregunta equivocada. Y «Siguiente» avanzaba el índice sobre la lista
 * ya corrida, saltándose una.
 *
 * La regla que lo hace imposible ahora: **la sesión se CONGELA al arrancar**.
 * `sesion.preguntas` es una foto; el progreso vivo solo se usa para decidir
 * qué entra en la PRÓXIMA sesión, nunca para mover la actual bajo el dedo.
 *
 * ── Temas y medallas ─────────────────────────────────────────────────
 *
 * - La DIARIA sigue igual: 10 mezcladas, 2 XP por correcta.
 * - La PRÁCTICA por tema (Jedi, Sith, criaturas…) no paga XP — pagarlo la
 *   volvería una granja infinita— pero alimenta el contador del tema, y de ese
 *   contador salen las medallas (bronce 10 · plata 25 · oro 50 correctas).
 *   El contador vive en el servidor detrás de una RPC que suma de a uno:
 *   escribirlo a mano está bloqueado, así que la medalla no es autoservida.
 * - Un mismo tema se practica UNA vez al día por pregunta (candado local):
 *   la medalla mide constancia, no una tarde de repetir.
 */

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, XCircle, ChevronRight, Zap, Flame, Star, Award, ArrowLeft } from 'lucide-react'
import { HolocronIcon } from '../../../components/SWIcons'
import {
  getDailyQuestions, getTemaQuestions, getTodayProgress, recordTriviaAnswer,
  getTriviaStats, getProgresoTemas, sumarTema, medallaDe, siguienteUmbral,
  temaRespondidasHoy, marcarTemaRespondida, TEMAS,
  type TriviaQuestion, type TriviaProgress, type TemaTrivia, type ProgresoTema,
} from '../../../services/trivia'
import { diaCalendarioSV } from '../../../services/horaSV'

interface TriviaSectionProps {
  userId: string
  onXpGained?: (xp: number) => void
}

/** Una partida en curso: modo + preguntas CONGELADAS. Ver la cabecera. */
interface Sesion {
  modo: 'diaria' | TemaTrivia
  preguntas: TriviaQuestion[]
}

const COLOR_MEDALLA = {
  oro: 'text-yellow-400',
  plata: 'text-gray-300',
  bronce: 'text-amber-600',
} as const

export function TriviaSection({ userId, onXpGained }: TriviaSectionProps) {
  const [progress, setProgress] = useState<TriviaProgress | null>(null)
  const [stats, setStats] = useState({ totalCorrect: 0, totalAnswered: 0, streakDays: 0 })
  const [temas, setTemas] = useState<Map<TemaTrivia, ProgresoTema>>(new Map())
  const [loading, setLoading] = useState(true)

  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [sessionXp, setSessionXp] = useState(0)
  /** La pantalla de cierre: cuántas salieron bien, en vez de volver de golpe. */
  const [recap, setRecap] = useState<{ correctas: number; total: number; xp: number; modo: Sesion['modo'] } | null>(null)

  useEffect(() => {
    let vivo = true
    void (async () => {
      const [prog, triviaStats, progTemas] = await Promise.all([
        getTodayProgress(userId),
        getTriviaStats(userId),
        getProgresoTemas(userId),
      ])
      if (!vivo) return
      setProgress(prog)
      setStats(triviaStats)
      setTemas(progTemas)
      setLoading(false)
    })()
    return () => { vivo = false }
  }, [userId])

  const answeredToday = progress?.questionsAnswered || 0
  const remainingToday = 10 - answeredToday

  const empezarDiaria = () => {
    const answeredIds = progress?.answeredIds || []
    // La foto se toma ACÁ, una vez. Es el arreglo del bug.
    const preguntas = getDailyQuestions(userId).filter(q => !answeredIds.includes(q.id))
    if (preguntas.length === 0) return
    setSesion({ modo: 'diaria', preguntas })
    setCurrentIndex(0); setSelectedAnswer(null)
    setSessionCorrect(0); setSessionXp(0); setRecap(null)
  }

  const empezarTema = (tema: TemaTrivia) => {
    const hechas = temaRespondidasHoy()
    const preguntas = getTemaQuestions(userId, tema).filter(q => !hechas.has(q.id))
    if (preguntas.length === 0) return
    setSesion({ modo: tema, preguntas })
    setCurrentIndex(0); setSelectedAnswer(null)
    setSessionCorrect(0); setSessionXp(0); setRecap(null)
  }

  const handleAnswer = useCallback((optionIndex: number) => {
    if (!sesion || selectedAnswer !== null) return
    const question = sesion.preguntas[currentIndex]
    if (!question) return

    setSelectedAnswer(optionIndex)
    const isCorrect = optionIndex === question.correctIndex
    if (isCorrect) setSessionCorrect(p => p + 1)

    if (sesion.modo === 'diaria') {
      if (isCorrect) setSessionXp(p => p + 2)
      // A la nube sin bloquear la interfaz; el XP flotante avisa cuando llega.
      void recordTriviaAnswer(userId, question.id, isCorrect).then(r => {
        if (r.ok && r.xpEarned > 0) onXpGained?.(r.xpEarned)
      })
      // La diaria TAMBIÉN alimenta la medalla del tema de la pregunta: jugar
      // todos los días tiene que contar para algo más que el XP.
      void sumarTema(question.tema, isCorrect).then(p => {
        if (p) setTemas(prev => new Map(prev).set(question.tema, p))
      })
      // El progreso vivo se actualiza para la PRÓXIMA sesión y el resumen.
      // La sesión actual ni se entera: sus preguntas están congeladas.
      setProgress(prev => ({
        date: diaCalendarioSV(new Date()),
        questionsAnswered: (prev?.questionsAnswered || 0) + 1,
        correctAnswers: (prev?.correctAnswers || 0) + (isCorrect ? 1 : 0),
        xpEarned: (prev?.xpEarned || 0) + (isCorrect ? 2 : 0),
        answeredIds: [...(prev?.answeredIds || []), question.id],
      }))
    } else {
      marcarTemaRespondida(question.id)
      void sumarTema(sesion.modo, isCorrect).then(p => {
        if (p) setTemas(prev => new Map(prev).set(sesion.modo as TemaTrivia, p))
      })
    }
  }, [sesion, selectedAnswer, currentIndex, userId, onXpGained])

  const nextQuestion = useCallback(() => {
    if (!sesion) return
    if (currentIndex + 1 >= sesion.preguntas.length) {
      setRecap({
        correctas: sessionCorrect,
        total: sesion.preguntas.length,
        xp: sessionXp,
        modo: sesion.modo,
      })
      setSesion(null)
      return
    }
    setSelectedAnswer(null)
    setCurrentIndex(p => p + 1)
  }, [sesion, currentIndex, sessionCorrect, sessionXp])

  if (loading) return null

  const cabecera = (
    <p className="text-xs font-bold text-swu-amber uppercase tracking-widest flex items-center gap-1.5">
      <HolocronIcon size={14} /> Archivos Jedi
    </p>
  )

  // ── Jugando ──
  if (sesion) {
    const question = sesion.preguntas[currentIndex]
    const showResult = selectedAnswer !== null
    const isCorrect = selectedAnswer === question.correctIndex
    const nombreModo = sesion.modo === 'diaria'
      ? 'Diaria'
      : TEMAS.find(t => t.id === sesion.modo)?.nombre ?? sesion.modo

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          {cabecera}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-swu-muted font-mono">
              {nombreModo} · {currentIndex + 1}/{sesion.preguntas.length}
            </span>
            {sessionXp > 0 && (
              <span className="text-[10px] font-bold text-swu-amber flex items-center gap-0.5">
                <Zap size={10} /> +{sessionXp}
              </span>
            )}
          </div>
        </div>

        {/* Puntos de progreso DE LA SESIÓN: congelados igual que las preguntas. */}
        <div className="flex gap-1">
          {sesion.preguntas.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i < currentIndex
                  ? 'bg-swu-amber'
                  : i === currentIndex
                    ? showResult
                      ? isCorrect ? 'bg-green-400' : 'bg-red-400'
                      : 'bg-swu-accent animate-pulse'
                    : 'bg-swu-border'
              }`}
            />
          ))}
        </div>

        <div className="bg-swu-surface rounded-xl border border-swu-border p-4 space-y-3">
          <div className="flex items-start gap-2">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
              question.category === 'swu'
                ? 'bg-swu-accent/20 text-swu-accent-texto'
                : 'bg-swu-amber/20 text-swu-amber'
            }`}>
              {TEMAS.find(t => t.id === question.tema)?.nombre ?? 'SW'}
            </span>
            <p className="text-sm font-bold text-swu-text leading-snug">{question.question}</p>
          </div>

          <div className="space-y-2">
            {question.options.map((option, i) => {
              let style = 'bg-swu-bg border-swu-border text-swu-text'
              let iconEl: React.ReactNode = null
              if (showResult) {
                if (i === question.correctIndex) {
                  style = 'bg-green-500/15 border-green-500/40 text-green-400 scale-[1.01]'
                  iconEl = <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                } else if (i === selectedAnswer) {
                  style = 'bg-red-500/15 border-red-500/40 text-red-400'
                  iconEl = <XCircle size={14} className="text-red-400 shrink-0" />
                } else {
                  style = 'bg-swu-bg border-swu-border/40 text-swu-muted/40'
                }
              }
              return (
                // `onClick` y NO `onPointerUp`: pointerup se dispara también al
                // SOLTAR un scroll — deslizabas para leer las opciones y la que
                // quedó bajo el dedo se contestaba sola. `click` ya distingue
                // toque de arrastre; es su trabajo.
                <button
                  key={i}
                  type="button"
                  onClick={() => handleAnswer(i)}
                  disabled={showResult}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm font-medium
                              transition-all duration-200 select-none flex items-center gap-2
                              disabled:cursor-default ${style} ${!showResult ? 'active:scale-[0.98]' : ''}`}
                  style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                >
                  <span className="text-[10px] font-bold opacity-40 shrink-0 w-4">{['A', 'B', 'C', 'D'][i]}</span>
                  <span className="flex-1">{option}</span>
                  {iconEl}
                </button>
              )
            })}
          </div>

          {showResult && (
            <div className={`rounded-lg p-3 text-xs ${
              isCorrect
                ? 'bg-green-500/10 border border-green-500/20'
                : 'bg-red-500/10 border border-red-500/20'
            }`}>
              <p className={`font-bold mb-1 ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                {isCorrect
                  ? sesion.modo === 'diaria' ? '¡Correcto! +2 XP' : '¡Correcto!'
                  : 'Incorrecto'}
              </p>
              <p className="text-swu-muted leading-relaxed">{question.funFact}</p>
            </div>
          )}

          {showResult && (
            <button
              onClick={nextQuestion}
              className="w-full py-2.5 rounded-lg bg-swu-accent text-white text-sm font-bold flex
                         items-center justify-center gap-1.5 active:scale-[0.97] transition-transform select-none"
              style={{ touchAction: 'manipulation' }}
            >
              {currentIndex + 1 >= sesion.preguntas.length ? 'Finalizar' : 'Siguiente'}
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Cierre de sesión ──
  if (recap) {
    const pct = recap.total > 0 ? Math.round((recap.correctas / recap.total) * 100) : 0
    return (
      <div className="space-y-3">
        {cabecera}
        <div className="bg-swu-surface rounded-xl border border-swu-border p-4 text-center space-y-2">
          <p className="text-2xl font-extrabold text-swu-text">{recap.correctas}/{recap.total}</p>
          <p className="text-xs text-swu-muted">
            {pct >= 80 ? 'Nivel de Maestro Jedi' : pct >= 50 ? 'La Fuerza es intensa en vos' : 'Los Archivos siempre están abiertos'}
          </p>
          {recap.xp > 0 && (
            <p className="text-sm font-bold text-swu-amber flex items-center justify-center gap-1">
              <Zap size={14} /> +{recap.xp} XP
            </p>
          )}
          <button
            onClick={() => setRecap(null)}
            className="w-full py-2.5 rounded-lg bg-swu-accent text-white text-sm font-bold flex
                       items-center justify-center gap-1.5 active:scale-[0.97] transition-transform"
          >
            <ArrowLeft size={14} /> Volver
          </button>
        </div>
      </div>
    )
  }

  // ── Inicio ──
  const accuracy = stats.totalAnswered > 0 ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100) : 0
  const hechasHoy = temaRespondidasHoy()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {cabecera}
        <span className="text-[10px] text-swu-muted font-mono">{answeredToday}/10 hoy</span>
      </div>

      <div className="bg-swu-surface rounded-xl border border-swu-border p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-extrabold text-green-400">{progress?.correctAnswers || 0}</p>
            <p className="text-[9px] text-swu-muted uppercase">Correctas</p>
          </div>
          <div>
            <p className="text-lg font-extrabold text-swu-amber">{progress?.xpEarned || 0}</p>
            <p className="text-[9px] text-swu-muted uppercase">XP Hoy</p>
          </div>
          <div>
            <p className="text-lg font-extrabold text-swu-accent-texto flex items-center justify-center gap-1">
              {stats.streakDays}<Flame size={14} />
            </p>
            <p className="text-[9px] text-swu-muted uppercase">Racha</p>
          </div>
        </div>

        <div className="relative h-2 bg-swu-bg rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-swu-amber to-yellow-400 transition-all duration-500"
            style={{ width: `${(answeredToday / 10) * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-swu-muted pt-1 border-t border-swu-border/50">
          <span className="flex items-center gap-1"><Star size={10} /> {stats.totalCorrect} correctas ({accuracy}%)</span>
          <span>{stats.totalAnswered} respondidas</span>
        </div>

        {remainingToday > 0 ? (
          <button
            onClick={empezarDiaria}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-swu-amber to-yellow-500 text-black
                       text-sm font-extrabold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
          >
            <HolocronIcon size={16} />
            {answeredToday === 0 ? 'Trivia del Día (+XP)' : `Continuar la diaria (${remainingToday})`}
          </button>
        ) : (
          <p className="text-center text-xs font-bold text-green-400 flex items-center justify-center gap-1.5 py-1">
            <CheckCircle2 size={14} /> Diaria completada · mañana hay más
          </p>
        )}
      </div>

      {/* ── Medallas por tema ──
          La práctica no paga XP (lo dice el rótulo, no se descubre a la mala):
          paga MEDALLA, que es de lo que va esta sección. */}
      <div className="bg-swu-surface rounded-xl border border-swu-border p-4 space-y-2.5">
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] font-bold text-swu-text uppercase tracking-wider">Medallas por tema</p>
          <p className="text-[9px] text-swu-muted">practicá sin XP · 🥉10 🥈25 🥇50</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {TEMAS.map(t => {
            const prog = temas.get(t.id) ?? { correctas: 0, respondidas: 0 }
            const medalla = medallaDe(prog.correctas)
            const meta = siguienteUmbral(prog.correctas)
            const agotadoHoy = getTemaQuestions(userId, t.id).every(q => hechasHoy.has(q.id))
            return (
              <button
                key={t.id}
                onClick={() => empezarTema(t.id)}
                disabled={agotadoHoy}
                className="flex items-center gap-2 rounded-lg border border-swu-border bg-swu-bg
                           p-2.5 text-left transition-colors active:scale-[0.98]
                           disabled:opacity-45 hover:border-swu-amber/30"
              >
                <span className="text-base leading-none">{t.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-bold text-swu-text">{t.nombre}</span>
                  <span className="block text-[9px] text-swu-muted">
                    {agotadoHoy
                      ? 'mañana de nuevo'
                      : meta === null
                        ? `${prog.correctas} correctas`
                        : `${prog.correctas}/${meta} para la próxima`}
                  </span>
                </span>
                {medalla && <Award size={15} className={`shrink-0 ${COLOR_MEDALLA[medalla]}`} />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
