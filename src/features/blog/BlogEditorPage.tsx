/**
 * BlogEditorPage — escribir un artículo.
 *
 * Editor de texto plano con vista previa, no un editor enriquecido. Es a
 * propósito: un editor visual obliga a manejar HTML pegado desde otras
 * páginas, y eso es justo lo que el renderizador evita al armar elementos
 * React en vez de inyectar marcado.
 *
 * Quien escribe ve la ayuda de sintaxis siempre a mano, incluida la ficha de
 * carta, que es lo único que no se adivina.
 */

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save, Eye, EyeOff, Trash2, Send, ImagePlus, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { Articulo } from './Articulo'
import {
  guardar, borrar, listarTodos, slugificar, minutosDeLectura, subirImagen,
  KIND_LABEL, type BlogKind, type BlogPost,
} from '../../services/blogService'

const AYUDA = `# Título grande
## Subtítulo
### Apartado

**negrita**  ·  *cursiva*  ·  \`código\`

> una cita

- lista
1. lista numerada

[texto del enlace](https://…)
![pie de la imagen](https://…)

[[carta:Bo-Katan Kryze]]   ← incrusta la carta
[[carta:Cad Bane|ASH-11]]  ← una impresión concreta

─ Bloques de datos ─
Cada bloque termina en la línea en blanco.
El título tras «:» y la línea «fuente:» son opcionales.

[[barras: Winrate contra el meta]]
Cad Bane — campeón: 79.7
Lando Calrissian: 37.7
fuente: 600 partidas por rival, SWUSIM
↑ barras horizontales: ≥80 ámbar, <50 rojo

[[curva: Curva de coste]]
1:3 2:15 3:20 4:12 5:9 6:2
↑ barras verticales, pares coste:cantidad

[[ficha: El mazo en números]]
Unidades: 57
Con Restore: 5 · Vida de base: 33
↑ rejilla de etiqueta:valor (vale · o | para
poner varios en una línea)

Si un bloque no cumple el formato se muestra
como texto plano: se ve el error, no se rompe.`

export function BlogEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { supabaseUser, isAdmin } = useAuth()

  const [post, setPost] = useState<Partial<BlogPost>>({
    title: '', excerpt: '', content: '', kind: 'articulo', tags: [], published: false,
  })
  const [cargando, setCargando] = useState(!!id)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [vista, setVista] = useState<'escribir' | 'previa'>('escribir')
  const [tagsTexto, setTagsTexto] = useState('')
  const [subiendo, setSubiendo] = useState<'portada' | 'texto' | null>(null)
  const portadaRef = useRef<HTMLInputElement>(null)
  const textoRef = useRef<HTMLInputElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!id) return
    let vivo = true
    void listarTodos().then(todos => {
      if (!vivo) return
      const p = todos.find(x => x.id === id)
      if (p) {
        setPost(p)
        setTagsTexto(p.tags.join(', '))
      }
      setCargando(false)
    })
    return () => { vivo = false }
  }, [id])

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-20 text-center">
        <p className="blog-serif text-2xl text-swu-text/70 italic">El blog lo escriben los administradores.</p>
        <Link to="/blog" className="inline-block mt-4 text-sm text-swu-cyan">Volver al blog</Link>
      </div>
    )
  }

  const enviar = async (publicar: boolean) => {
    if (!supabaseUser) return
    if (!post.title?.trim()) { setError('Falta el título.'); return }
    setGuardando(true)
    setError(null)
    const r = await guardar({
      ...post,
      title: post.title,
      author_id: supabaseUser.id,
      published: publicar,
      tags: tagsTexto.split(',').map(t => t.trim()).filter(Boolean),
    })
    setGuardando(false)
    if (!r.ok) { setError(r.error); return }
    navigate(`/blog/${r.slug}`)
  }

  /**
   * Sube una imagen y la coloca.
   *
   * Para el TEXTO se inserta en la posición del cursor, no al final: quien
   * está escribiendo el tercer párrafo quiere la foto ahí, y tener que
   * cortar y pegar el `![…]()` desde el final es exactamente la fricción que
   * hace que después nadie ponga imágenes.
   */
  const subir = async (archivo: File, destino: 'portada' | 'texto') => {
    if (!supabaseUser) return
    setSubiendo(destino)
    setError(null)
    const r = await subirImagen(archivo, supabaseUser.id)
    setSubiendo(null)
    if (!r.ok) { setError(r.error); return }

    if (destino === 'portada') {
      setPost(p => ({ ...p, cover_url: r.url }))
      return
    }

    const marca = `\n![](${r.url})\n`
    const area = areaRef.current
    const actual = post.content ?? ''
    if (!area) { setPost(p => ({ ...p, content: actual + marca })); return }

    const ini = area.selectionStart ?? actual.length
    const fin = area.selectionEnd ?? actual.length
    const nuevo = actual.slice(0, ini) + marca + actual.slice(fin)
    setPost(p => ({ ...p, content: nuevo }))
    // Devolver el cursor DENTRO de los corchetes del pie, que es lo
    // siguiente que se quiere escribir.
    requestAnimationFrame(() => {
      area.focus()
      const pos = ini + 3
      area.setSelectionRange(pos, pos)
    })
  }

  const eliminar = async () => {
    if (!id) return
    if (!confirm('¿Borrar este artículo? No se puede deshacer.')) return
    const r = await borrar(id)
    if (r.ok) navigate('/blog')
    else setError(r.error ?? 'No se pudo borrar')
  }

  if (cargando) {
    return <div className="max-w-3xl mx-auto px-5 py-10"><div className="h-64 rounded-xl carta-esqueleto" /></div>
  }

  const slug = post.slug || slugificar(post.title ?? '')

  return (
    <div className="min-h-screen bg-swu-bg pb-24">
      <div className="max-w-3xl mx-auto px-5 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/blog')} className="flex items-center gap-1.5 text-[12px] text-swu-muted">
            <ArrowLeft size={14} aria-hidden /> Blog
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVista(v => (v === 'escribir' ? 'previa' : 'escribir'))}
              className="flex items-center gap-1.5 text-[11px] text-swu-cyan border border-swu-cyan/40 rounded-full px-3 py-1.5"
            >
              {vista === 'escribir'
                ? <><Eye size={12} aria-hidden /> Vista previa</>
                : <><EyeOff size={12} aria-hidden /> Escribir</>}
            </button>
            {id && (
              <button onClick={() => void eliminar()} className="text-swu-red-texto p-1.5" aria-label="Borrar">
                <Trash2 size={15} aria-hidden />
              </button>
            )}
          </div>
        </div>

        {vista === 'previa' ? (
          <div className="blog-medida mx-auto blog-prosa">
            <h1 className="blog-serif text-4xl font-bold text-swu-text leading-tight mb-4">
              {post.title || 'Sin título'}
            </h1>
            {post.excerpt && (
              <p className="blog-serif text-lg italic text-swu-text/65 mb-6">{post.excerpt}</p>
            )}
            <Articulo contenido={post.content ?? ''} />
          </div>
        ) : (
          <>
            <input
              value={post.title ?? ''}
              onChange={e => setPost(p => ({ ...p, title: e.target.value }))}
              placeholder="Título del artículo"
              className="w-full bg-transparent blog-serif text-3xl font-bold text-swu-text
                         placeholder:text-swu-muted/40 focus:outline-none border-b border-swu-border pb-2"
            />
            {/* La dirección se muestra mientras se escribe: es lo que se va a
                compartir por WhatsApp y conviene verla antes de publicar. */}
            {slug && <p className="text-[10px] font-mono text-swu-muted">swusv.com/blog/{slug}</p>}

            <textarea
              value={post.excerpt ?? ''}
              onChange={e => setPost(p => ({ ...p, excerpt: e.target.value }))}
              placeholder="Resumen — es lo que se lee en la portada del blog"
              rows={2}
              maxLength={400}
              className="w-full bg-swu-surface border border-swu-border rounded-lg px-3 py-2 text-sm
                         text-swu-text placeholder:text-swu-muted/50 focus:outline-none focus:ring-2 focus:ring-swu-accent"
            />

            <div className="grid grid-cols-2 gap-2">
              <select
                value={post.kind}
                onChange={e => setPost(p => ({ ...p, kind: e.target.value as BlogKind }))}
                className="bg-swu-surface border border-swu-border rounded-lg px-3 py-2 text-sm text-swu-text"
              >
                {(Object.keys(KIND_LABEL) as BlogKind[]).map(k => (
                  <option key={k} value={k}>{KIND_LABEL[k]}</option>
                ))}
              </select>
              <input
                value={tagsTexto}
                onChange={e => setTagsTexto(e.target.value)}
                placeholder="etiquetas, separadas, por comas"
                className="bg-swu-surface border border-swu-border rounded-lg px-3 py-2 text-sm
                           text-swu-text placeholder:text-swu-muted/50"
              />
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  value={post.cover_url ?? ''}
                  onChange={e => setPost(p => ({ ...p, cover_url: e.target.value }))}
                  placeholder="Portada: pegá una URL o subí una foto"
                  inputMode="url"
                  className="flex-1 min-w-0 bg-swu-surface border border-swu-border rounded-lg px-3 py-2 text-sm
                             text-swu-text placeholder:text-swu-muted/50"
                />
                <button
                  onClick={() => portadaRef.current?.click()}
                  disabled={subiendo !== null}
                  className="flex-shrink-0 flex items-center gap-1.5 text-[11px] text-swu-cyan border border-swu-cyan/40
                             rounded-lg px-3 disabled:opacity-40"
                >
                  {subiendo === 'portada'
                    ? <Loader2 size={13} className="animate-spin" aria-hidden />
                    : <ImagePlus size={13} aria-hidden />}
                  Subir
                </button>
              </div>
              {post.cover_url && (
                <div className="relative">
                  <img src={post.cover_url} alt="" className="w-full aspect-[16/9] object-cover rounded-lg" />
                  <button
                    onClick={() => setPost(p => ({ ...p, cover_url: null }))}
                    className="absolute top-2 right-2 bg-black/75 text-white rounded-full p-1.5"
                    aria-label="Quitar la portada"
                  >
                    <Trash2 size={13} aria-hidden />
                  </button>
                </div>
              )}
            </div>
            <input
              ref={portadaRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void subir(f, 'portada')
              }}
            />

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-swu-muted">Cuerpo del artículo</span>
              <button
                onClick={() => textoRef.current?.click()}
                disabled={subiendo !== null}
                className="flex items-center gap-1.5 text-[11px] text-swu-cyan border border-swu-cyan/40
                           rounded-full px-2.5 py-1 disabled:opacity-40"
              >
                {subiendo === 'texto'
                  ? <Loader2 size={12} className="animate-spin" aria-hidden />
                  : <ImagePlus size={12} aria-hidden />}
                Insertar foto
              </button>
            </div>
            <input
              ref={textoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void subir(f, 'texto')
              }}
            />
            <textarea
              ref={areaRef}
              value={post.content ?? ''}
              onChange={e => setPost(p => ({ ...p, content: e.target.value }))}
              placeholder="Escribí el artículo…"
              rows={18}
              className="w-full bg-swu-surface border border-swu-border rounded-lg px-3 py-3 text-sm
                         text-swu-text placeholder:text-swu-muted/50 font-mono leading-relaxed
                         focus:outline-none focus:ring-2 focus:ring-swu-accent"
            />

            <div className="flex items-center justify-between text-[10px] text-swu-muted">
              <span>{minutosDeLectura(post.content ?? '')} min de lectura</span>
              <span>{(post.content ?? '').length} caracteres</span>
            </div>

            <details className="bg-swu-surface border border-swu-border rounded-lg">
              <summary className="px-3 py-2 text-[11px] text-swu-cyan cursor-pointer">
                Cómo dar formato
              </summary>
              <pre className="px-3 pb-3 text-[10px] font-mono text-swu-muted whitespace-pre-wrap leading-relaxed">
                {AYUDA}
              </pre>
            </details>
          </>
        )}

        {error && <p className="text-[12px] text-swu-red-texto">{error}</p>}

        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="secondary" block loading={guardando} onClick={() => void enviar(false)}>
            <Save size={14} aria-hidden /> Guardar borrador
          </Button>
          <Button size="sm" block loading={guardando} onClick={() => void enviar(true)}>
            <Send size={14} aria-hidden /> Publicar
          </Button>
        </div>
      </div>
    </div>
  )
}
