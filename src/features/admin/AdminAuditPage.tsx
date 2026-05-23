import { useEffect, useMemo, useState } from 'react'
import { ScrollText, Loader2, Filter, AlertTriangle } from 'lucide-react'
import { getAuditLogs, type AuditLog } from '../../services/adminService'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const days = Math.floor(hr / 24)
  return `${days}d`
}

export function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState<string>('')

  useEffect(() => {
    getAuditLogs(200).then(l => {
      setLogs(l)
      setLoading(false)
    })
  }, [])

  const actionTypes = useMemo(() => {
    const set = new Set<string>()
    logs.forEach(l => set.add(l.action))
    return Array.from(set).sort()
  }, [logs])

  const filtered = useMemo(() => {
    if (!actionFilter) return logs
    return logs.filter(l => l.action === actionFilter)
  }, [logs, actionFilter])

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-swu-text">Auditoría</h1>
        <p className="text-sm text-swu-muted mt-1">Registro de acciones administrativas (últimos 200)</p>
      </header>

      {/* Filter */}
      {actionTypes.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-swu-muted" />
          <button
            onClick={() => setActionFilter('')}
            className={`text-[11px] px-2.5 py-1 rounded-md ${
              actionFilter === '' ? 'bg-swu-accent/20 text-swu-accent' : 'text-swu-muted hover:text-swu-text'
            }`}
          >
            Todas
          </button>
          {actionTypes.map(a => (
            <button
              key={a}
              onClick={() => setActionFilter(a)}
              className={`text-[11px] px-2.5 py-1 rounded-md font-mono ${
                actionFilter === a ? 'bg-swu-accent/20 text-swu-accent' : 'text-swu-muted hover:text-swu-text'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-swu-muted text-sm">
          <Loader2 size={16} className="animate-spin" /> Cargando…
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-swu-surface rounded-xl p-6 border border-swu-border space-y-3">
          <div className="flex items-center gap-2 text-swu-amber">
            <AlertTriangle size={16} />
            <p className="text-sm font-semibold">No hay logs de auditoría aún</p>
          </div>
          <p className="text-[11px] text-swu-muted leading-relaxed">
            Esto puede pasar por dos razones:
          </p>
          <ol className="text-[11px] text-swu-muted space-y-1 list-decimal list-inside pl-1">
            <li>La tabla <code className="font-mono bg-black/30 px-1 rounded">audit_logs</code> no existe todavía en Supabase. Aplica la migración <code className="font-mono bg-black/30 px-1 rounded">supabase/migrations/audit-logs-migration.sql</code> desde el SQL Editor.</li>
            <li>Aún no se ha realizado ninguna acción admin registrada (cambio de rol, edición de evento, etc.).</li>
          </ol>
        </div>
      ) : (
        <div className="bg-swu-surface rounded-xl border border-swu-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-black/20 text-[10px] uppercase tracking-wider text-swu-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Cuándo</th>
                  <th className="px-3 py-2 text-left">Acción</th>
                  <th className="px-3 py-2 text-left">Quién</th>
                  <th className="px-3 py-2 text-left">Target</th>
                  <th className="px-3 py-2 text-left">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-swu-border/40">
                {filtered.map(log => (
                  <tr key={log.id} className="hover:bg-black/10">
                    <td className="px-3 py-2 whitespace-nowrap text-xs" title={formatDate(log.created_at)}>
                      <span className="font-mono text-swu-muted">hace {relativeTime(log.created_at)}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[11px] font-mono bg-black/30 px-1.5 py-0.5 rounded text-swu-accent">{log.action}</span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className="text-swu-text">{log.actor_name ?? 'Sistema'}</span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {log.target_type ? (
                        <span className="text-swu-muted">
                          <span className="font-mono">{log.target_type}</span>
                          {log.target_id && <span className="text-swu-muted/60 ml-1 font-mono text-[10px]">{log.target_id.slice(0, 8)}…</span>}
                        </span>
                      ) : (
                        <span className="text-swu-muted/40">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-swu-muted">
                      <code className="font-mono text-[10px]">
                        {Object.keys(log.metadata || {}).length === 0
                          ? '—'
                          : JSON.stringify(log.metadata)}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-[10px] text-swu-muted/60">
        <ScrollText size={12} />
        <span>Mostrando {filtered.length} de {logs.length} registros</span>
      </div>
    </div>
  )
}
