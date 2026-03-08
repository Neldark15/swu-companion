import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  Plus,
  Trash2,
  Pin,
  PinOff,
  Loader2,
  Newspaper,
  ExternalLink,
  Image,
  Save,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { getNews, createNews, updateNews, deleteNews, type NewsItem } from '../../services/news'

const TAG_OPTIONS = [
  { label: 'Set Nuevo', color: 'amber' },
  { label: 'Eventos', color: 'green' },
  { label: 'Meta', color: 'purple' },
  { label: 'Roadmap', color: 'accent' },
  { label: 'OP', color: 'default' },
  { label: 'General', color: 'default' },
  { label: 'Comunidad', color: 'green' },
  { label: 'Reglas', color: 'amber' },
]

type ViewState = 'list' | 'create' | 'edit'

export function ManageNewsPage() {
  const navigate = useNavigate()
  const { isAdmin, supabaseUser } = useAuth()
  const [viewState, setViewState] = useState<ViewState>('list')
  const [newsList, setNewsList] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Form fields
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [tag, setTag] = useState('General')
  const [tagColor, setTagColor] = useState('default')
  const [url, setUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [pinned, setPinned] = useState(false)

  const loadNews = async () => {
    setLoading(true)
    const items = await getNews(50)
    setNewsList(items)
    setLoading(false)
  }

  useEffect(() => {
    loadNews()
  }, [])

  const resetForm = () => {
    setTitle('')
    setSummary('')
    setTag('General')
    setTagColor('default')
    setUrl('')
    setImageUrl('')
    setPinned(false)
    setEditId(null)
  }

  const openCreate = () => {
    resetForm()
    setViewState('create')
  }

  const openEdit = (item: NewsItem) => {
    setEditId(item.id)
    setTitle(item.title)
    setSummary(item.summary)
    setTag(item.tag)
    setTagColor(item.tag_color)
    setUrl(item.url || '')
    setImageUrl(item.image_url || '')
    setPinned(item.pinned)
    setViewState('edit')
  }

  const handleSave = async () => {
    if (!title.trim() || !summary.trim() || !supabaseUser) return
    setSaving(true)

    if (viewState === 'create') {
      const result = await createNews({
        title: title.trim(),
        summary: summary.trim(),
        tag,
        tagColor,
        url: url.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        pinned,
        authorId: supabaseUser.id,
      })
      if (result.ok) {
        resetForm()
        setViewState('list')
        loadNews()
      }
    } else if (viewState === 'edit' && editId) {
      const result = await updateNews(editId, {
        title: title.trim(),
        summary: summary.trim(),
        tag,
        tag_color: tagColor,
        url: url.trim() || null,
        image_url: imageUrl.trim() || null,
        pinned,
      })
      if (result.ok) {
        resetForm()
        setViewState('list')
        loadNews()
      }
    }

    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const result = await deleteNews(id)
    if (result.ok) {
      setNewsList(prev => prev.filter(n => n.id !== id))
    }
  }

  const handleTogglePin = async (item: NewsItem) => {
    const result = await updateNews(item.id, { pinned: !item.pinned })
    if (result.ok) {
      setNewsList(prev =>
        prev.map(n => (n.id === item.id ? { ...n, pinned: !n.pinned } : n))
      )
    }
  }

  if (!isAdmin) {
    return (
      <div className="p-4 space-y-4">
        <button onClick={() => navigate('/')} className="flex items-center gap-1 text-sm text-swu-muted">
          <ChevronLeft size={18} /> Inicio
        </button>
        <div className="bg-swu-surface rounded-2xl border border-swu-border p-8 text-center">
          <Newspaper size={48} className="mx-auto text-swu-muted mb-3" />
          <h3 className="text-lg font-bold text-swu-text">Acceso Restringido</h3>
          <p className="text-sm text-swu-muted mt-1">Solo administradores pueden gestionar noticias.</p>
        </div>
      </div>
    )
  }

  // ─── Form View ─────────────────────────────────────────
  if (viewState === 'create' || viewState === 'edit') {
    return (
      <div className="p-4 lg:p-6 space-y-4 pb-24 lg:pb-8 max-w-5xl mx-auto">
        <button onClick={() => { resetForm(); setViewState('list') }} className="flex items-center gap-1 text-sm text-swu-muted">
          <ChevronLeft size={18} /> Volver a Noticias
        </button>

        <h2 className="text-lg font-bold text-swu-text">
          {viewState === 'create' ? 'Nueva Noticia' : 'Editar Noticia'}
        </h2>

        <div className="space-y-3">
          {/* Title */}
          <div>
            <label className="text-xs text-swu-muted font-medium mb-1 block">Título *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Título de la noticia"
              className="w-full bg-swu-surface border border-swu-border rounded-xl p-3 text-sm text-swu-text outline-none focus:border-swu-accent"
            />
          </div>

          {/* Summary */}
          <div>
            <label className="text-xs text-swu-muted font-medium mb-1 block">Resumen *</label>
            <textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="Resumen breve de la noticia..."
              rows={3}
              className="w-full bg-swu-surface border border-swu-border rounded-xl p-3 text-sm text-swu-text outline-none focus:border-swu-accent resize-none"
            />
          </div>

          {/* Tag */}
          <div>
            <label className="text-xs text-swu-muted font-medium mb-1 block">Etiqueta</label>
            <div className="flex flex-wrap gap-2">
              {TAG_OPTIONS.map(opt => (
                <button
                  key={opt.label}
                  onClick={() => { setTag(opt.label); setTagColor(opt.color) }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    tag === opt.label
                      ? 'bg-swu-accent/20 border-swu-accent text-swu-accent'
                      : 'bg-swu-surface border-swu-border text-swu-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* URL */}
          <div>
            <label className="text-xs text-swu-muted font-medium mb-1 flex items-center gap-1">
              <ExternalLink size={12} /> Enlace (opcional)
            </label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-swu-surface border border-swu-border rounded-xl p-3 text-sm text-swu-text outline-none focus:border-swu-accent"
            />
          </div>

          {/* Image URL */}
          <div>
            <label className="text-xs text-swu-muted font-medium mb-1 flex items-center gap-1">
              <Image size={12} /> URL de Imagen (opcional)
            </label>
            <input
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              placeholder="https://...imagen.jpg"
              className="w-full bg-swu-surface border border-swu-border rounded-xl p-3 text-sm text-swu-text outline-none focus:border-swu-accent"
            />
            {imageUrl && (
              <div className="mt-2 rounded-lg overflow-hidden border border-swu-border">
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="w-full h-32 object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
            )}
          </div>

          {/* Pinned toggle */}
          <button
            onClick={() => setPinned(!pinned)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              pinned
                ? 'bg-swu-amber/20 border-swu-amber/40 text-swu-amber'
                : 'bg-swu-surface border-swu-border text-swu-muted'
            }`}
          >
            {pinned ? <Pin size={16} /> : <PinOff size={16} />}
            {pinned ? 'Fijada (aparece primero)' : 'No fijada'}
          </button>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!title.trim() || !summary.trim() || saving}
            className={`w-full py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all ${
              title.trim() && summary.trim() && !saving
                ? 'bg-swu-accent text-white active:scale-[0.98]'
                : 'bg-swu-border text-swu-muted cursor-not-allowed'
            }`}
          >
            {saving ? (
              <><Loader2 size={18} className="animate-spin" /> Guardando...</>
            ) : (
              <><Save size={18} /> {viewState === 'create' ? 'Publicar Noticia' : 'Guardar Cambios'}</>
            )}
          </button>
        </div>
      </div>
    )
  }

  // ─── List View ─────────────────────────────────────────
  return (
    <div className="p-4 lg:p-6 space-y-4 pb-24 lg:pb-8 max-w-5xl mx-auto">
      <button onClick={() => navigate('/')} className="flex items-center gap-1 text-sm text-swu-muted">
        <ChevronLeft size={18} /> Inicio
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-swu-text">Gestionar Noticias</h2>
          <p className="text-xs text-swu-muted">{newsList.length} noticias publicadas</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-swu-accent text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 active:scale-[0.97] transition-transform"
        >
          <Plus size={16} /> Nueva
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={28} className="text-swu-accent animate-spin" />
        </div>
      ) : newsList.length === 0 ? (
        <div className="bg-swu-surface rounded-2xl border border-swu-border p-8 text-center">
          <Newspaper size={40} className="mx-auto text-swu-muted mb-2" />
          <p className="text-sm text-swu-muted">No hay noticias aún.</p>
          <button onClick={openCreate} className="mt-3 text-sm text-swu-accent font-bold">
            Crear primera noticia
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {newsList.map(item => (
            <div
              key={item.id}
              className="bg-swu-surface rounded-xl border border-swu-border p-3"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0" onClick={() => openEdit(item)} role="button">
                  <div className="flex items-center gap-2 mb-1">
                    {item.pinned && <Pin size={12} className="text-swu-amber flex-shrink-0" />}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      item.tag_color === 'amber' ? 'bg-swu-amber/20 text-swu-amber' :
                      item.tag_color === 'green' ? 'bg-swu-green/20 text-swu-green' :
                      item.tag_color === 'purple' ? 'bg-purple-500/20 text-purple-400' :
                      item.tag_color === 'accent' ? 'bg-swu-accent/20 text-swu-accent' :
                      'bg-swu-border text-swu-muted'
                    }`}>{item.tag}</span>
                    <span className="text-[10px] text-swu-muted">
                      {new Date(item.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-swu-text truncate">{item.title}</p>
                  <p className="text-xs text-swu-muted line-clamp-1 mt-0.5">{item.summary}</p>
                </div>

                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleTogglePin(item)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      item.pinned ? 'bg-swu-amber/20 text-swu-amber' : 'bg-swu-bg text-swu-muted'
                    }`}
                    title={item.pinned ? 'Desfijar' : 'Fijar'}
                  >
                    {item.pinned ? <Pin size={14} /> : <PinOff size={14} />}
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-lg bg-swu-bg text-swu-muted hover:text-swu-red transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
