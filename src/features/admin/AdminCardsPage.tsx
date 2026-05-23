import { useEffect, useState } from 'react'
import { Library, RefreshCw, Trash2, Loader2, CheckCircle2 } from 'lucide-react'
import { clearLocalCardsCache, getLocalCardsCount } from '../../services/adminService'
import { useAuth } from '../../hooks/useAuth'

export function AdminCardsPage() {
  const { currentProfile } = useAuth()
  const [count, setCount] = useState<number | null>(null)
  const [clearing, setClearing] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)

  const refresh = async () => {
    setCount(await getLocalCardsCount())
  }
  useEffect(() => { refresh() }, [])

  const handleClear = async () => {
    if (!currentProfile) return
    if (!confirm('¿Limpiar la caché local de cartas en este dispositivo? La próxima vez que abras Buscar Cartas se repoblará desde el API.')) return
    setClearing(true)
    setLastResult(null)
    const result = await clearLocalCardsCache({ id: currentProfile.id, name: currentProfile.name })
    setLastResult(`Limpiadas ${result.cleared.toLocaleString()} entradas locales`)
    await refresh()
    setClearing(false)
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-swu-text">Base de cartas</h1>
        <p className="text-sm text-swu-muted mt-1">Gestión del caché local (IndexedDB / Dexie)</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Local cache stats */}
        <div className="bg-swu-surface rounded-xl border border-swu-border p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-swu-muted">
            <Library size={12} />
            <span>Caché local (este device)</span>
          </div>
          <p className="text-3xl font-extrabold font-mono text-swu-text mt-2">
            {count === null ? '…' : count.toLocaleString()}
          </p>
          <p className="text-[11px] text-swu-muted mt-1">cartas en IndexedDB</p>
        </div>

        {/* Action: clear */}
        <div className="bg-swu-surface rounded-xl border border-swu-border p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-swu-text">Limpiar caché local</h3>
            <p className="text-[11px] text-swu-muted mt-0.5">
              Borra todas las cartas guardadas en este dispositivo. El próximo uso de la app las re-descarga desde api.swuapi.com.
            </p>
          </div>
          <button
            disabled={clearing}
            onClick={handleClear}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-swu-red/15 text-swu-red text-sm font-semibold hover:bg-swu-red/25 transition-colors disabled:opacity-50"
          >
            {clearing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {clearing ? 'Limpiando…' : 'Limpiar caché'}
          </button>
          {lastResult && (
            <p className="flex items-center gap-1 text-[11px] text-swu-green">
              <CheckCircle2 size={12} /> {lastResult}
            </p>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="bg-swu-surface/50 rounded-xl border border-swu-border/40 p-4 text-[11px] text-swu-muted leading-relaxed">
        <p className="font-semibold text-swu-text mb-1.5 flex items-center gap-1.5">
          <RefreshCw size={12} /> Nota sobre refresh global
        </p>
        <p>
          Cada usuario tiene su propia caché en su navegador. No hay forma de "forzar refresh" a todos
          los devices remotamente sin agregar un mecanismo de versioning (tabla <code className="font-mono bg-black/30 px-1 rounded">cards_revision</code>
          que los clientes consulten al arrancar). Si lo necesitas, lo agregamos como tarea aparte.
        </p>
      </div>
    </div>
  )
}
