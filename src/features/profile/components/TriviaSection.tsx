import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, XCircle, ChevronRight, Zap, Flame, Star } from 'lucide-react'
import { HolocronIcon } from '../../../components/SWIcons'
import { getDailyQuestions, getTodayProgress, recordTriviaAnswer, getTriviaStats, type TriviaQuestion, type TriviaProgress } from '../../../services/trivia'

interface TriviaSectionProps {
  userId: string
  onXpGained?: (xp: number) => void
}

export function TriviaSection({ userId, onXpGained }: TriviaSectionProps) {
  const [progress, setProgress] = useState<TriviaProgress | null>(null)
  const [questions, setQuestions] = useState<TriviaQuestion[]>([])
  const [stats, setStats] = useState({ totalCorrect: 0, totalAnswered: 0, streakDays: 0 })
  const [playing, setPlaying] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [sessionXp, setSessionXp] = useState(0)
  const [loading, setLoading] = useState(true)
  // Use state instead of ref so disabled prop re-renders properly
  const [locked, setLocked] = useState(false)
  // Animation state for answer feedback
  const [answerAnim, setAnswerAnim] = useState<'idle' | 'correct' | 'wrong'>('idle')

  useEffect(() => {
    async function load() {
      const [prog, triviaStats] = await Promise.all([
        getTodayProgress(userId),
        getTriviaStats(userId),
      ])
      setProgress(prog)
      setStats(triviaStats)
      setQuestions(getDailyQuestions(userId))
      setLoading(false)
    }
    load()
  }, [userId])

  const answeredToday = progress?.questionsAnswered || 0
  const remainingToday = 10 - answeredToday
  const todayXp = progress?.xpEarned || 0
  const todayCorrect = progress?.correctAnswers || 0

  const answeredIds = progress?.answeredIds || []
  const unanswered = questions.filter(q => !answeredIds.includes(q.id))

  const startTrivia = () => {
    setPlaying(true)
    setCurrentIndex(0)
    setSelectedAnswer(null)
    setShowResult(false)
    setSessionCorrect(0)
    setSessionXp(0)
    setLocked(false)
    setAnswerAnim('idle')
  }

  const handleAnswer = useCallback((optionIndex: number) => {
    // Guard: prevent double answers
    if (showResult || selectedAnswer !== null || locked) return

    setLocked(true)
    setSelectedAnswer(optionIndex)
    setShowResult(true)

    const question = unanswered[currentIndex]
    if (!question) return
    const isCorrect = optionIndex === question.correctIndex

    setAnswerAnim(isCorrect ? 'correct' : 'wrong')

    if (isCorrect) {
      setSessionCorrect(prev => prev + 1)
      setSessionXp(prev => prev + 2)
    }

    // Record to Supabase (fire and forget, don't block UI)
    recordTriviaAnswer(userId, question.id, isCorrect).then(result => {
      if (result.ok && result.xpEarned > 0 && onXpGained) {
        onXpGained(result.xpEarned)
      }
    })

    // Update local progress
    setProgress(prev => ({
      date: new Date().toISOString().split('T')[0],
      questionsAnswered: (prev?.questionsAnswered || 0) + 1,
      correctAnswers: (prev?.correctAnswers || 0) + (isCorrect ? 1 : 0),
      xpEarned: (prev?.xpEarned || 0) + (isCorrect ? 2 : 0),
      answeredIds: [...(prev?.answeredIds || []), question.id],
    }))
  }, [showResult, selectedAnswer, locked, currentIndex, unanswered, userId, onXpGained])

  const nextQuestion = useCallback(() => {
    if (currentIndex + 1 >= unanswered.length) {
      setPlaying(false)
      return
    }

    // Reset everything for next question
    setLocked(false)
    setSelectedAnswer(null)
    setShowResult(false)
    setAnswerAnim('idle')
    setCurrentIndex(prev => prev + 1)
  }, [currentIndex, unanswered.length])

  if (loading) return null

  // ── Playing mode ──
  if (playing && unanswered.length > 0 && currentIndex < unanswered.length) {
    const question = unanswered[currentIndex]
    const isCorrect = selectedAnswer === question.correctIndex
    const totalQ = Math.min(10, unanswered.length + answeredToday)

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-swu-amber uppercase tracking-widest flex items-center gap-1.5">
            <HolocronIcon size={14} /> Archivos Jedi
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-swu-muted font-mono">
              {currentIndex + 1 + answeredToday}/{totalQ}
            </span>
            {sessionXp > 0 && (
              <span className="text-[10px] font-bold text-swu-amber flex items-center gap-0.5">
                <Zap size={10} /> +{sessionXp}
              </span>
            )}
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1">
          {Array.from({ length: totalQ }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i < answeredToday + currentIndex
                  ? 'bg-swu-amber'
                  : i === answeredToday + currentIndex
                    ? answerAnim === 'correct'
                      ? 'bg-green-400'
                      : answerAnim === 'wrong'
                        ? 'bg-red-400'
                        : 'bg-swu-accent animate-pulse'
                    : 'bg-swu-border'
              }`}
            />
          ))}
        </div>

        {/* Question card */}
        <div className="bg-swu-surface rounded-xl border border-swu-border p-4 space-y-3">
          <div className="flex items-start gap-2">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
              question.category === 'swu'
                ? 'bg-swu-accent/20 text-swu-accent'
                : 'bg-swu-amber/20 text-swu-amber'
            }`}>
              {question.category === 'swu' ? 'SWU' : 'Universo'}
            </span>
            <p className="text-sm font-bold text-swu-text leading-snug">{question.question}</p>
          </div>

          {/* Options — NO disabled prop, all logic in handler for reliable mobile taps */}
          <div className="space-y-2">
            {question.options.map((option, i) => {
              const answered = showResult || selectedAnswer !== null
              let style = 'bg-swu-bg border-swu-border text-swu-text'
              let iconEl: React.ReactNode = null

              if (showResult) {
                if (i === question.correctIndex) {
                  style = 'bg-green-500/15 border-green-500/40 text-green-400 scale-[1.01]'
                  iconEl = <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                } else if (i === selectedAnswer && !isCorrect) {
                  style = 'bg-red-500/15 border-red-500/40 text-red-400'
                  iconEl = <XCircle size={14} className="text-red-400 shrink-0" />
                } else {
                  style = 'bg-swu-bg border-swu-border/40 text-swu-muted/40'
                }
              }

              return (
                <div
                  key={`${currentIndex}-${i}`}
                  role="button"
                  tabIndex={0}
                  onPointerUp={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (!answered) handleAnswer(i)
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm font-medium transition-all duration-200 select-none flex items-center gap-2 cursor-pointer ${style} ${!answered ? 'active:scale-[0.98]' : 'cursor-default'}`}
                  style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                >
                  <span className="text-[10px] font-bold opacity-40 shrink-0 w-4">{['A', 'B', 'C', 'D'][i]}</span>
                  <span className="flex-1">{option}</span>
                  {iconEl}
                </div>
              )
            })}
          </div>

          {/* Result feedback */}
          {showResult && (
            <div className={`rounded-lg p-3 text-xs transition-all duration-300 ${
              isCorrect
                ? 'bg-green-500/10 border border-green-500/20'
                : 'bg-red-500/10 border border-red-500/20'
            }`}>
              <p className={`font-bold mb-1 ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                {isCorrect ? '¡Correcto! +2 XP' : 'Incorrecto'}
              </p>
              <p className="text-swu-muted leading-relaxed">{question.funFact}</p>
            </div>
          )}

          {showResult && (
            <button
              onClick={nextQuestion}
              className="w-full py-2.5 rounded-lg bg-swu-accent text-white text-sm font-bold flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform select-none touch-manipulation"
            >
              {currentIndex + 1 >= unanswered.length ? 'Finalizar' : 'Siguiente'}
              <ChevronRight size={14} />
            </button>
          )}
        </div>

        {/* Session stats */}
        <div className="flex items-center justify-center gap-4 text-[10px] text-swu-muted">
          <span className="flex items-center gap-1"><CheckCircle2 size={10} className="text-green-400" /> {sessionCorrect} correctas</span>
          <span className="flex items-center gap-1"><Zap size={10} className="text-swu-amber" /> +{sessionXp} XP</span>
        </div>
      </div>
    )
  }

  // ── Summary / Start mode ──
  const accuracy = stats.totalAnswered > 0 ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100) : 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-swu-amber uppercase tracking-widest flex items-center gap-1.5">
          <HolocronIcon size={14} /> Archivos Jedi
        </p>
        <span className="text-[10px] text-swu-muted font-mono">{answeredToday}/10 hoy</span>
      </div>

      <div className="bg-swu-surface rounded-xl border border-swu-border p-4 space-y-3">
        {/* Today's stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-lg font-extrabold text-green-400">{todayCorrect}</p>
            <p className="text-[9px] text-swu-muted uppercase">Correctas</p>
          </div>
          <div>
            <p className="text-lg font-extrabold text-swu-amber">{todayXp}</p>
            <p className="text-[9px] text-swu-muted uppercase">XP Hoy</p>
          </div>
          <div>
            <p className="text-lg font-extrabold text-swu-accent flex items-center justify-center gap-1">
              {stats.streakDays}<Flame size={14} />
            </p>
            <p className="text-[9px] text-swu-muted uppercase">Racha</p>
          </div>
        </div>

        {/* Progress bar for today */}
        <div className="relative h-2 bg-swu-bg rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-swu-amber to-yellow-400 transition-all duration-500"
            style={{ width: `${(answeredToday / 10) * 100}%` }}
          />
        </div>

        {/* All-time stats */}
        <div className="flex items-center justify-between text-[10px] text-swu-muted pt-1 border-t border-swu-border/50">
          <span className="flex items-center gap-1"><Star size={10} /> {stats.totalCorrect} correctas ({accuracy}%)</span>
          <span>{stats.totalAnswered} respondidas</span>
        </div>

        {/* Start button */}
        {remainingToday > 0 ? (
          <button
            onClick={startTrivia}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-swu-amber to-yellow-500 text-black text-sm font-extrabold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
          >
            <HolocronIcon size={16} />
            {answeredToday === 0 ? 'Comenzar Trivia del Día' : `Continuar (${remainingToday} restantes)`}
          </button>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm font-bold text-green-400 flex items-center justify-center gap-1.5">
              <CheckCircle2 size={16} /> Trivia completada hoy
            </p>
            <p className="text-[10px] text-swu-muted mt-1">Vuelva mañana para más preguntas</p>
          </div>
        )}
      </div>
    </div>
  )
}
