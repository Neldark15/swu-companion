import { useState, useEffect } from 'react'
import { BookOpen, CheckCircle2, XCircle, ChevronRight, Zap, Flame, Star } from 'lucide-react'
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

  // Load data on mount
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

  // Get unanswered questions
  const answeredIds = progress?.answeredIds || []
  const unanswered = questions.filter(q => !answeredIds.includes(q.id))

  const startTrivia = () => {
    setPlaying(true)
    setCurrentIndex(0)
    setSelectedAnswer(null)
    setShowResult(false)
    setSessionCorrect(0)
    setSessionXp(0)
  }

  const handleAnswer = async (optionIndex: number) => {
    if (selectedAnswer !== null) return // Already answered
    setSelectedAnswer(optionIndex)
    setShowResult(true)

    const question = unanswered[currentIndex]
    const isCorrect = optionIndex === question.correctIndex

    if (isCorrect) {
      setSessionCorrect(prev => prev + 1)
      setSessionXp(prev => prev + 2)
    }

    // Record to Supabase
    const result = await recordTriviaAnswer(userId, question.id, isCorrect)
    if (result.ok && result.xpEarned > 0 && onXpGained) {
      onXpGained(result.xpEarned)
    }

    // Update local progress
    setProgress(prev => ({
      date: new Date().toISOString().split('T')[0],
      questionsAnswered: (prev?.questionsAnswered || 0) + 1,
      correctAnswers: (prev?.correctAnswers || 0) + (isCorrect ? 1 : 0),
      xpEarned: (prev?.xpEarned || 0) + (isCorrect ? 2 : 0),
      answeredIds: [...(prev?.answeredIds || []), question.id],
    }))
  }

  const nextQuestion = () => {
    if (currentIndex + 1 >= unanswered.length) {
      // Done for today
      setPlaying(false)
      return
    }
    setCurrentIndex(prev => prev + 1)
    setSelectedAnswer(null)
    setShowResult(false)
  }

  if (loading) return null

  // ── Playing mode ──
  if (playing && unanswered.length > 0 && currentIndex < unanswered.length) {
    const question = unanswered[currentIndex]
    const isCorrect = selectedAnswer === question.correctIndex

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-swu-amber uppercase tracking-widest flex items-center gap-1.5">
            <BookOpen size={14} /> Archivos Jedi
          </p>
          <span className="text-[10px] text-swu-muted font-mono">
            {currentIndex + 1 + answeredToday}/{10}
          </span>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all ${
                i < answeredToday + currentIndex
                  ? 'bg-swu-amber'
                  : i === answeredToday + currentIndex
                    ? 'bg-swu-accent animate-pulse'
                    : 'bg-swu-border'
              }`}
            />
          ))}
        </div>

        {/* Question card */}
        <div className="bg-swu-surface rounded-xl border border-swu-border p-4 space-y-3">
          <div className="flex items-start gap-2">
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-swu-accent/20 text-swu-accent uppercase shrink-0">
              {question.category === 'swu' ? 'SWU' : 'Universo'}
            </span>
            <p className="text-sm font-bold text-swu-text">{question.question}</p>
          </div>

          {/* Options */}
          <div className="space-y-2">
            {question.options.map((option, i) => {
              let style = 'bg-swu-bg border-swu-border text-swu-text'
              if (showResult) {
                if (i === question.correctIndex) {
                  style = 'bg-green-500/20 border-green-500/40 text-green-400'
                } else if (i === selectedAnswer && !isCorrect) {
                  style = 'bg-red-500/20 border-red-500/40 text-red-400'
                } else {
                  style = 'bg-swu-bg border-swu-border/50 text-swu-muted opacity-50'
                }
              }

              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={showResult}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm font-medium transition-all active:scale-[0.98] ${style}`}
                >
                  <span className="text-[10px] font-bold mr-2 opacity-50">{['A', 'B', 'C', 'D'][i]}</span>
                  {option}
                  {showResult && i === question.correctIndex && (
                    <CheckCircle2 size={14} className="inline ml-2 text-green-400" />
                  )}
                  {showResult && i === selectedAnswer && !isCorrect && (
                    <XCircle size={14} className="inline ml-2 text-red-400" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Result feedback */}
          {showResult && (
            <div className={`rounded-lg p-3 text-xs ${isCorrect ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
              <p className={`font-bold mb-1 ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                {isCorrect ? '¡Correcto! +2 XP' : 'Incorrecto'}
              </p>
              <p className="text-swu-muted">{question.funFact}</p>
            </div>
          )}

          {showResult && (
            <button
              onClick={nextQuestion}
              className="w-full py-2.5 rounded-lg bg-swu-accent text-white text-sm font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
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
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-swu-amber uppercase tracking-widest flex items-center gap-1.5">
          <BookOpen size={14} /> Archivos Jedi
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
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-swu-amber to-yellow-400 transition-all"
            style={{ width: `${(answeredToday / 10) * 100}%` }}
          />
        </div>

        {/* All-time stats */}
        <div className="flex items-center justify-between text-[10px] text-swu-muted pt-1 border-t border-swu-border/50">
          <span className="flex items-center gap-1"><Star size={10} /> {stats.totalCorrect} totales correctas</span>
          <span>{stats.totalAnswered} respondidas</span>
        </div>

        {/* Start button */}
        {remainingToday > 0 ? (
          <button
            onClick={startTrivia}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-swu-amber to-yellow-500 text-black text-sm font-extrabold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
          >
            <BookOpen size={16} />
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
