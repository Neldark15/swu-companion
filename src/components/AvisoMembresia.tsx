import { useAuth } from '../hooks/useAuth'

export function AvisoMembresia() {
  const error = useAuth(s => s.errorMembresia)
  const preparando = useAuth(s => s.preparandoMembresia)
  const initAuth = useAuth(s => s.initAuth)
  if (!error) return null

  return (
    <div role="alert" className="m-4 rounded-xl border border-swu-amber/40 bg-swu-amber/10 p-4 text-sm text-swu-text">
      <p>{error}</p>
      <button
        type="button"
        disabled={preparando}
        onClick={() => { void initAuth().catch(() => {}) }}
        className="mt-3 rounded-lg border border-swu-amber/40 px-4 py-2 font-semibold disabled:opacity-50"
      >
        {preparando ? 'Preparando perfil…' : 'Reintentar'}
      </button>
    </div>
  )
}
