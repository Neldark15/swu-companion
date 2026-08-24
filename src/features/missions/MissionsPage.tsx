/**
 * Misiones — «Órdenes del Día», «Campañas Semanales» y «Hazañas».
 *
 * Las Hazañas son de UNA sola vez (`period_key = 'once'`) y por eso se
 * muestran TODAS, no una selección sorteada: son hitos, y esconder uno ya
 * cumplido le quitaría a alguien la prueba de haberlo hecho. Tampoco llevan
 * reloj de reinicio — no se reinician nunca, y poner uno ahí sería prometer
 * que la hazaña vuelve.
 */

import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ICONO_POR_OBJETIVO } from '../../components/icons/iconoMision'
import {
  DianaIcon, RelojIcon, CobrarIcon, SelloHechoIcon,
  SiempreIcon, IrIcon, CargandoIcon,
} from '../../components/icons/MisionIcons'
import { useAuth } from '../../hooks/useAuth'
import {
  getUserMissions,
  claimMissionReward,
  getTimeUntilDailyReset,
  getTimeUntilWeeklyReset,
  BONUS_POR_TIPO,
  type UserMission,
} from '../../services/missionService'

export default function MissionsPage() {
  const { supabaseUser } = useAuth()
  const [daily, setDaily] = useState<UserMission[]>([])
  const [weekly, setWeekly] = useState<UserMission[]>([])
  const [unicas, setUnicas] = useState<UserMission[]>([])
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState<string | null>(null)
  // Arrancan con la hora REAL, no en cero: si no, el reloj muestra 0h 0m
  // durante el primer minuto y parece que el reinicio ya pasó.
  const [dailyTimer, setDailyTimer] = useState(getTimeUntilDailyReset)
  const [weeklyTimer, setWeeklyTimer] = useState(getTimeUntilWeeklyReset)

  // Se carga dentro del efecto y no por un `useCallback` aparte: envolverlo
  // solo para llamarlo desde acá creaba una dependencia que cambiaba de
  // identidad, y con `supabaseUser?.id` en el arreglo el compilador de React
  // ni siquiera podía conservar la memoización.
  const userId = supabaseUser?.id
  useEffect(() => {
    let vivo = true
    void (async () => {
      /* Sin sesión se pinta el CATÁLOGO en cero, no un spinner. Antes el
       * efecto salía con `if (!userId) return` y `loading` se quedaba en true
       * para siempre: una rueda girando donde debería verse qué hay por
       * hacer. En producción `AuthGate` no deja llegar hasta acá, pero es lo
       * que hace mirable `/banco-misiones`. */
      const data = await getUserMissions(userId ?? '')
      if (!vivo) return
      setDaily(data.daily)
      setWeekly(data.weekly)
      setUnicas(data.unicas)
      setLoading(false)
    })()
    return () => { vivo = false }
  }, [userId])

  // Timer countdown
  // El primer valor sale del estado inicial y no de un `tick()` dentro del
  // efecto: llamarlo ahí encadena un render antes de la primera pintada, y el
  // reloj ya arranca con la hora correcta.
  useEffect(() => {
    const interval = setInterval(() => {
      setDailyTimer(getTimeUntilDailyReset())
      setWeeklyTimer(getTimeUntilWeeklyReset())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleClaim = async (missionId: string) => {
    if (!supabaseUser?.id || claiming) return
    setClaiming(missionId)
    const result = await claimMissionReward(supabaseUser.id, missionId)
    if (result.success) {
      // Update local state
      const update = (missions: UserMission[]) =>
        missions.map(m => m.missionId === missionId ? { ...m, claimed: true } : m)
      setDaily(prev => update(prev))
      setWeekly(prev => update(prev))
      setUnicas(prev => update(prev))
    }
    setClaiming(null)
  }

  const dailyCompleted = daily.filter(m => m.completed).length
  const weeklyCompleted = weekly.filter(m => m.completed).length
  const unicasHechas = unicas.filter(m => m.completed).length
  /* Las pendientes arriba: una lista de 10 con las cumplidas al principio
     empuja abajo del pliegue justo lo único sobre lo que se puede actuar. */
  const unicasOrdenadas = [...unicas].sort(
    (a, b) => Number(a.completed) - Number(b.completed),
  )

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a1a] to-[#1a1a2e] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a1a]/90 backdrop-blur-md border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center">
            <DianaIcon size={18} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Misiones</h1>
            <p className="text-[11px] text-white/40">Diarias, semanales y hazañas de una sola vez</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="mision-gira inline-flex text-white/30"><CargandoIcon size={24} /></span>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-6">
          {/* Daily Missions */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-cyan-400">Órdenes del Día</span>
                <span className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
                  {dailyCompleted}/{daily.length}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-white/30">
                <RelojIcon size={11} />
                <span>Reinicio en {dailyTimer.hours}h {dailyTimer.minutes}m</span>
              </div>
            </div>

            <div className="space-y-2">
              {daily.map((m, i) => (
                <MissionCard
                  key={m.missionId}
                  indice={i}
                  mission={m}
                  onClaim={handleClaim}
                  claiming={claiming === m.missionId}
                />
              ))}
            </div>
          </section>

          {/* Weekly Missions */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-amber-400">Campañas Semanales</span>
                <span className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
                  {weeklyCompleted}/{weekly.length}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-white/30">
                <RelojIcon size={11} />
                <span>Reinicio en {weeklyTimer.days}d {weeklyTimer.hours}h</span>
              </div>
            </div>

            <div className="space-y-2">
              {weekly.map((m, i) => (
                <MissionCard
                  key={m.missionId}
                  indice={i}
                  mission={m}
                  onClaim={handleClaim}
                  claiming={claiming === m.missionId}
                />
              ))}
            </div>
          </section>

          {/* Hazañas — una sola vez, nunca se reinician */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-violet-400">Hazañas</span>
                <span className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
                  {unicasHechas}/{unicas.length}
                </span>
              </div>
              {/* Donde las otras dos llevan reloj, acá va lo contrario: no vuelven. */}
              <div className="flex items-center gap-1 text-[10px] text-white/30">
                <SiempreIcon size={11} />
                <span>Una sola vez</span>
              </div>
            </div>

            <div className="space-y-2">
              {unicasOrdenadas.map((m, i) => (
                <MissionCard
                  key={m.missionId}
                  indice={i}
                  mission={m}
                  onClaim={handleClaim}
                  claiming={claiming === m.missionId}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function MissionCard({ mission, onClaim, claiming, indice }: {
  mission: UserMission
  onClaim: (id: string) => void
  claiming: boolean
  /** Posición en la lista: mueve el retardo de la entrada escalonada. */
  indice: number
}) {
  const { template, progress, completed, claimed } = mission
  const pct = Math.min(progress / template.objectiveValue, 1)
  /* Lo que se anuncia tiene que ser lo que se paga: `claimMissionReward`
     abona `rewardXp + BONUS_POR_TIPO[type]`, y la tarjeta enseñaba solo el
     primero — o sea 20 XP de menos en cada diaria y 60 en cada semanal. */
  const xpTotal = template.rewardXp + BONUS_POR_TIPO[template.type]

  /* El ícono sale del OBJETIVO, no de la misión.
   *
   * Antes cada plantilla traía un emoji propio, y un emoji lo dibuja el
   * sistema operativo: el mismo catálogo se veía distinto en cada teléfono, y
   * los que no existen salían como un cuadrito. Además «abrir 1 sobre» y
   * «abrir 3 sobres» llevaban dos dibujos para la MISMA acción. */
  const Icono = ICONO_POR_OBJETIVO[template.objectiveType]

  /* El destello del cobro se dispara UNA vez, al pasar de no-cobrada a
     cobrada. Con `claimed` a secas volvería a correr en cada repintado de la
     lista y la tarjeta parpadearía sola para siempre. */
  const [reciénCobrada, setReciénCobrada] = useState(false)
  const cobradaAntes = useRef(claimed)
  useEffect(() => {
    const eraNueva = claimed && !cobradaAntes.current
    cobradaAntes.current = claimed
    if (!eraNueva) return
    /* El `setState` va detrás de un temporizador y no en el cuerpo del efecto:
       la regla `react-hooks/set-state-in-effect` lo veta ahí, y de paso el
       destello arranca un frame después de que la tarjeta ya se repintó como
       cobrada — que es cuando se ve. */
    const enciende = setTimeout(() => setReciénCobrada(true), 0)
    const apaga = setTimeout(() => setReciénCobrada(false), 1600)
    return () => { clearTimeout(enciende); clearTimeout(apaga) }
  }, [claimed])

  const listaParaCobrar = completed && !claimed

  return (
    <div
      style={{ ['--i' as string]: Math.min(indice, 12) }}
      className={`mision-entra rounded-xl border p-3 transition-colors ${
        reciénCobrada ? 'mision-destello' : ''
      } ${
        claimed
          ? 'border-white/5 bg-white/[0.02] opacity-60'
          : completed
          ? 'border-green-500/30 bg-green-500/5'
          : 'border-white/10 bg-white/[0.03]'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`shrink-0 ${listaParaCobrar ? 'mision-lista text-green-300' : 'text-swu-accent-texto'}`}
        >
          <Icono size={22} />
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-white/90 truncate">{template.name}</p>
            <span className="relative text-[10px] text-amber-400 font-medium shrink-0">
              +{xpTotal} XP
              {/* El XP despega al cobrar: sin esto, reclamar solo apaga un
                  botón y no se ve que el pago ocurrió. */}
              {reciénCobrada && (
                <span className="mision-xp pointer-events-none absolute left-0 top-0 whitespace-nowrap font-bold text-green-300">
                  +{xpTotal} XP
                </span>
              )}
            </span>
          </div>
          <p className="text-[11px] text-white/40 mt-0.5">{template.description}</p>

          {/* Progreso. La barra se anima con `scaleX` y NO con `width`: animar
              el ancho recalcula el diseño en cada frame, y acá hay 20 filas. */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                style={{ ['--p' as string]: pct }}
                className={`mision-barra h-full w-full rounded-full ${
                  completed ? 'bg-green-500' : 'bg-cyan-500'
                }`}
              />
            </div>
            <span className="text-[10px] text-white/40 shrink-0 w-12 text-right tabular-nums">
              {progress}/{template.objectiveValue}
            </span>
          </div>
        </div>

        {/* Acción */}
        <div className="shrink-0 ml-1">
          {claimed ? (
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-green-400/60">
              <SelloHechoIcon size={15} />
            </div>
          ) : completed ? (
            <button
              onClick={() => onClaim(mission.missionId)}
              disabled={claiming}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-500/20 border border-green-500/30 text-green-300 text-[10px] font-bold hover:bg-green-500/30 active:scale-95 transition-transform"
            >
              {claiming
                ? <span className="mision-gira inline-flex"><CargandoIcon size={13} /></span>
                : <CobrarIcon size={13} />}
              <span>Reclamar</span>
            </button>
          ) : (
            /*
             * ADÓNDE SE HACE. Es la mitad que faltaba.
             *
             * La misión decía «Publicar algo en el muro» y la palabra «muro»
             * NO existe en ninguna pantalla de la app: la sección se llama
             * «Comunidades», está a tres toques dentro de Perfil → Más, y el
             * botón dice «Escribir al grupo…». Nel, que construyó esto, no
             * supo cómo cumplirla. Una misión que no se sabe dónde se hace no
             * es difícil: es invisible.
             */
            <Link
              to={template.ruta}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/25 text-cyan-300 text-[10px] font-bold hover:bg-cyan-500/25 active:scale-95 transition-transform whitespace-nowrap"
            >
              <span>{template.donde}</span>
              <IrIcon size={12} />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
