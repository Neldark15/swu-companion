import { useEffect, useMemo, useState } from 'react'
import { Search, ShieldCheck, ShieldOff, Loader2, ExternalLink, Users as UsersIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getAllUsers, updateUserRole, type AdminUserRow } from '../../services/adminService'
import { useAuth } from '../../hooks/useAuth'

export function AdminUsersPage() {
  const { currentProfile } = useAuth()
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'admin' | 'user'>('all')

  const refresh = async () => {
    setLoading(true)
    setUsers(await getAllUsers())
    setLoading(false)
  }
  useEffect(() => { refresh() }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users.filter(u => {
      if (filter !== 'all' && u.role !== filter) return false
      if (!q) return true
      return u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)
    })
  }, [users, query, filter])

  const toggleRole = async (u: AdminUserRow) => {
    if (!currentProfile) return
    if (u.id === currentProfile.id) {
      alert('No puedes cambiar tu propio rol.')
      return
    }
    const newRole = u.role === 'admin' ? 'user' : 'admin'
    if (!confirm(`¿Cambiar el rol de ${u.name} a "${newRole}"?`)) return
    setSavingId(u.id)
    const result = await updateUserRole(u.id, newRole, { id: currentProfile.id, name: currentProfile.name })
    if (result.ok) {
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: newRole } : x))
    } else {
      alert(`Error: ${result.error ?? 'No se pudo cambiar el rol'}`)
    }
    setSavingId(null)
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-swu-text">Usuarios</h1>
          <p className="text-sm text-swu-muted mt-1">{filtered.length} de {users.length} usuarios</p>
        </div>
      </header>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o ID…"
            className="w-full pl-9 pr-3 py-2 bg-swu-surface border border-swu-border rounded-lg text-sm text-swu-text placeholder-swu-muted"
          />
        </div>
        <div className="flex bg-swu-surface rounded-lg p-0.5 border border-swu-border">
          {(['all', 'admin', 'user'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === f ? 'bg-swu-accent/20 text-swu-accent' : 'text-swu-muted hover:text-swu-text'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'admin' ? 'Admins' : 'Usuarios'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center gap-2 text-swu-muted text-sm">
          <Loader2 size={16} className="animate-spin" /> Cargando…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-swu-surface rounded-xl p-8 text-center border border-swu-border">
          <UsersIcon size={32} className="mx-auto text-swu-muted/40 mb-2" />
          <p className="text-sm text-swu-muted">Sin resultados</p>
        </div>
      ) : (
        <div className="bg-swu-surface rounded-xl border border-swu-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-black/20 text-[10px] uppercase tracking-wider text-swu-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Usuario</th>
                  <th className="px-3 py-2 text-left">Rol</th>
                  <th className="px-3 py-2 text-right">Nivel</th>
                  <th className="px-3 py-2 text-right">XP</th>
                  <th className="px-3 py-2 text-right">W/L</th>
                  <th className="px-3 py-2 text-left">País</th>
                  <th className="px-3 py-2 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-swu-border/40">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-black/10">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-swu-text">{u.name}</span>
                        <Link
                          to={`/u/${u.id}`}
                          className="text-swu-muted hover:text-swu-accent"
                          title="Ver perfil público"
                        >
                          <ExternalLink size={12} />
                        </Link>
                      </div>
                      <p className="text-[10px] text-swu-muted/60 font-mono mt-0.5 truncate max-w-[180px]">{u.id}</p>
                    </td>
                    <td className="px-3 py-2">
                      {u.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-swu-accent bg-swu-accent/15 px-2 py-0.5 rounded-full">
                          <ShieldCheck size={10} /> ADMIN
                        </span>
                      ) : (
                        <span className="text-[10px] text-swu-muted">user</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{u.level}</td>
                    <td className="px-3 py-2 text-right font-mono">{u.xp.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{u.wins}/{u.losses}</td>
                    <td className="px-3 py-2">
                      {u.country ? (
                        <span className="text-xs font-mono">{u.country}</span>
                      ) : (
                        <span className="text-[10px] text-swu-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        disabled={savingId === u.id || u.id === currentProfile?.id}
                        onClick={() => toggleRole(u)}
                        className={`text-[11px] px-2 py-1 rounded-md font-medium transition-colors ${
                          u.id === currentProfile?.id
                            ? 'text-swu-muted/40 cursor-not-allowed'
                            : u.role === 'admin'
                            ? 'text-swu-red hover:bg-swu-red/10'
                            : 'text-swu-accent hover:bg-swu-accent/10'
                        }`}
                      >
                        {savingId === u.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : u.role === 'admin' ? (
                          <span className="flex items-center gap-1"><ShieldOff size={11} /> Quitar admin</span>
                        ) : (
                          <span className="flex items-center gap-1"><ShieldCheck size={11} /> Hacer admin</span>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
