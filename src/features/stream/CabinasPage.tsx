/**
 * CABINAS — el selector de transmisión.
 *
 * Con más de una sede, entrar directo a un código deja de tener sentido: cada
 * quien ve las cabinas que tiene asignadas y entra a la suya. Si solo opera
 * una, se salta la pantalla y va derecho a su estudio.
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Lock, RadioTower } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { listarSesiones, misSesiones, type SesionStream } from '../../services/streamSesiones'

export function CabinasPage() {
  const navigate = useNavigate()
  const { currentProfile, initAuth, authListo } = useAuth()

  const [sesiones, setSesiones] = useState<SesionStream[]>([])
  const [mias, setMias] = useState<string[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    initAuth()
  }, [initAuth])

  useEffect(() => {
    if (!currentProfile) return
    let vivo = true

    Promise.all([listarSesiones(), misSesiones(currentProfile.id)])
      .then(([todas, propias]) => {
        if (!vivo) return
        setSesiones(todas)
        setMias(propias)
        setCargando(false)
      })
      .catch(e => {
        if (!vivo) return
        setError(e instanceof Error ? e.message : 'No se pudieron cargar las cabinas')
        setCargando(false)
      })

    return () => {
      vivo = false
    }
  }, [currentProfile])

  const propias = useMemo(() => sesiones.filter(s => mias.includes(s.code)), [sesiones, mias])
  const ajenas = useMemo(() => sesiones.filter(s => !mias.includes(s.code)), [sesiones, mias])

  // Con una sola cabina no hay nada que elegir.
  useEffect(() => {
    if (!cargando && propias.length === 1) {
      navigate(`/estudio/${propias[0].code}`, { replace: true })
    }
  }, [cargando, propias, navigate])

  if (!authListo) return <Marco>Verificando acceso…</Marco>

  if (!currentProfile) {
    return (
      <Marco>
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-lg font-semibold text-swu-text">Cabinas de transmisión</p>
          <p className="max-w-xs text-sm text-swu-muted">
            Iniciá sesión para ver las transmisiones que podés operar.
          </p>
          <button
            onClick={() => navigate('/profile')}
            className="rounded-xl bg-swu-accent px-5 py-3 text-sm font-bold text-white"
          >
            Iniciar sesión
          </button>
        </div>
      </Marco>
    )
  }

  if (cargando) return <Marco>Cargando cabinas…</Marco>

  return (
    <div className="min-h-screen bg-[#0d0f14] text-swu-text">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <button
          onClick={() => navigate('/')}
          className="rounded-lg p-2 text-swu-muted transition hover:bg-white/5"
          aria-label="Volver"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-sm font-black uppercase tracking-[0.2em] text-swu-muted">
          Cabinas de transmisión
        </h1>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col gap-5 p-4">
        {error && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        {propias.length === 0 && !error && (
          <div className="rounded-2xl border border-white/10 bg-[#12151c] px-6 py-10 text-center">
            <Lock size={30} className="mx-auto mb-3 text-swu-muted" />
            <p className="font-bold">No tenés cabinas asignadas</p>
            <p className="mt-1.5 text-sm text-swu-muted">
              Pedile a un administrador que te agregue como operador de una transmisión.
            </p>
          </div>
        )}

        {propias.map(s => (
          <button
            key={s.code}
            onClick={() => navigate(`/estudio/${s.code}`)}
            className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#12151c] p-4 text-left transition hover:border-swu-accent/50 hover:bg-white/5"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-swu-accent/15 text-swu-accent-texto">
              <RadioTower size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-black">{s.nombre}</span>
              <span className="block font-mono text-xs text-swu-muted">{s.code}</span>
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-swu-muted">
              Entrar
            </span>
          </button>
        ))}

        {/* Las de otras sedes se ven, pero cerradas: deja claro que existen y
            que el acceso es por asignación, no un error de la app. */}
        {ajenas.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-swu-muted">
              Otras sedes
            </p>
            {ajenas.map(s => (
              <div
                key={s.code}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 p-3 opacity-60"
              >
                <Lock size={16} className="shrink-0 text-swu-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{s.nombre}</span>
                  <span className="block font-mono text-[11px] text-swu-muted">{s.code}</span>
                </span>
                <span className="text-[10px] uppercase tracking-wider text-swu-muted">Sin acceso</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#0d0f14] px-6 text-swu-muted">{children}</div>
  )
}
