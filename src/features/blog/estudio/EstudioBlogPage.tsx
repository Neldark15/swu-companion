/**
 * EstudioPage — escribir un artículo del blog.
 *
 * Reemplaza al editor de un `<textarea rows={18}>` con conmutador de previa.
 * Lo que NO cambia: el formato de almacenamiento sigue siendo la misma
 * sintaxis de texto plano, y la previa sigue montando el MISMO `<Articulo>`
 * que la página pública. El estudio es una capa de composición encima; si
 * emitiera otro formato, los 7 artículos publicados dejarían de renderizarse.
 *
 * ══ 1. La disposición, con los anchos MEDIDOS ══════════════════════════
 *
 * `AppLayout` da `lg:ml-64 xl:ml-72` y `max-w-lg lg:max-w-full`, así que en
 * escritorio el contenido NO está limitado. Medido en el navegador contra
 * `#app-scroll`:
 *
 *     viewport 1024 → main  768 px   (barra lateral 256)
 *     viewport 1280 → main  992 px   (barra lateral 288)
 *     viewport 1440 → main 1152 px   (barra lateral 288)
 *
 * El editor de hoy se autolimita a `max-w-3xl` (768 px) y desperdicia 384 px
 * en un portátil de 1440.
 *
 * Los dos anchos que mandan, también medidos:
 *
 *   · La columna de lectura del artículo (`blog-medida`, 66ch en Inter
 *     Variable a 16 px) mide **666 px** exactos. Más `px-5` a cada lado = 706.
 *     Una previa de escritorio más angosta que eso deja de ser fiel: pinta los
 *     estilos `sm:` (correctos) sobre una medida que ningún lector ve.
 *   · Un carácter de JetBrains Mono a 13 px mide **7,8 px**. O sea 80 columnas
 *     necesitan 650 px de textarea.
 *
 * Con esos dos números el reparto se cae solo:
 *
 *   viewport ≥ 1280 (main ≥ 992), previa MÓVIL:
 *     [ escritura 554 px = 68 col ][ 16 ][ marco 422 px = 390 + 16·2 ]
 *   viewport 1440 (main 1152), previa MÓVIL:
 *     [ escritura 714 px = 91 col ][ 16 ][ marco 422 px ]
 *
 * Y la previa de ESCRITORIO no cabe al lado: 666 + 666 = 1332 > 1152. Por eso
 * no se intenta. En modo «Escritorio» el panel se queda con sus 706 px y la
 * escritura baja a 430 px (52 columnas) a partir de 1440; por debajo de eso el
 * panel ocupa la fila entera, que es lo que el editor de hoy ya hace, pero
 * ahora a la medida correcta.
 *
 * Por debajo de `lg` no hay estudio: una sola columna (ver el bloque 4).
 *
 * ══ 2. La vista móvil ══════════════════════════════════════════════════
 *
 * Va en un `<iframe>`, y no es una preferencia. Ver puentePrevia.ts: las tres
 * mediciones que descartan la caja de 375 px, lo que el iframe tampoco
 * reproduce, y por qué no lleva `sandbox`.
 *
 * ══ 3. Las herramientas ════════════════════════════════════════════════
 *
 * Barra horizontal sobre el texto, no una tercera columna: una columna de
 * herramientas costaría ~240 px de los 1152, y son 240 px que valen más como
 * texto. Cada herramienta abre un `Sheet` —el que ya existe, con trampa de
 * foco, Escape y bloqueo de scroll— y al aceptar INSERTA texto en el cursor.
 *
 * Todas las inserciones pasan por `insertarBloque`, que garantiza la línea en
 * blanco antes y después. Dos bloques pegados se destruyen mutuamente porque
 * dentro de un bloque toda línea es dato: es el error más fácil de cometer con
 * un botón de insertar y el más difícil de ver leyendo el textarea.
 *
 * ══ 4. En el teléfono ══════════════════════════════════════════════════
 *
 * Se degrada, no se avisa y no se bloquea. Por debajo de `lg` queda UNA
 * columna: los mismos campos, la misma barra de herramientas (los `Sheet` en
 * móvil son paneles inferiores, ya funcionan) y la previa como conmutador,
 * igual que hoy. Lo único que desaparece es el marco de teléfono, porque un
 * iframe de 390 px dentro de una pantalla de 390 px no informa de nada.
 * Corregir una errata desde el teléfono tiene que seguir siendo posible.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, Save, Send, Trash2, ImagePlus, Loader2, Smartphone, Monitor,
  PanelRightClose, Layers, BarChart3, TrendingUp, Table2, Sparkles,
} from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { SegmentedControl } from '../../../components/ui/SegmentedControl'
import { Sheet } from '../../../components/ui/Sheet'
import { SelectorCarta } from '../../../components/SelectorCarta'
import { useAuth } from '../../../hooks/useAuth'
import { Articulo } from '../Articulo'
import { MarcoMovil } from './MarcoMovil'
import { insertarBloque, insertarEnLinea, refImpresion } from './sintaxisSalida'
import {
  guardar, borrar, listarTodos, slugificar, minutosDeLectura, subirImagen,
  KIND_LABEL, type BlogKind, type BlogPost,
} from '../../../services/blogService'
import { leerBorrador, guardarBorrador, borrarBorrador } from '../../../services/borradores'
import type { Card } from '../../../types'

/** Una llave POR ARTÍCULO: con una sola, el borrador de uno pisaría al otro. */
const llaveBorrador = (id: string | undefined) => `swu_borrador_blog_v1:${id ?? 'nuevo'}`

interface BorradorBlog {
  post: Partial<BlogPost>
  tagsTexto: string
  /** El `updated_at` del servidor sobre el que se escribió. Ver «Recuperar». */
  base: string | null
}

type Panel = 'movil' | 'escritorio' | 'cerrado'
type Herramienta = null | 'carta' | 'mazo' | 'barras' | 'curva' | 'ficha'

const RETARDO_GUARDADO_MS = 800

export function EstudioBlogPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { supabaseUser, isAdmin, esAutorBlog } = useAuth()
  const puedeEscribir = isAdmin || esAutorBlog

  /* El borrador se lee en el INICIALIZADOR PEREZOSO, nunca en un `useEffect`:
     eso sería setState dentro de un efecto, encadena un render de más y el
     lint del repo lo rechaza (`react-hooks/set-state-in-effect`). Ver la
     cabecera de borradores.ts. */
  const [borrador] = useState(() => leerBorrador<BorradorBlog>(llaveBorrador(id)))

  const [post, setPost] = useState<Partial<BlogPost>>(() =>
    id ? {} : (borrador?.post ?? { title: '', excerpt: '', content: '', kind: 'articulo', tags: [], published: false }),
  )
  const [tagsTexto, setTagsTexto] = useState(() => (id ? '' : borrador?.tagsTexto ?? ''))
  /* `leerBorrador` devuelve `Partial<T>`: un borrador guardado por una versión
     anterior del estudio puede no tener todas las claves. Se lee campo a campo
     con `??`, tal como pide la cabecera de borradores.ts. */
  const [recuperable, setRecuperable] = useState<Partial<BorradorBlog> | null>(null)
  const [cargando, setCargando] = useState(!!id)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel>('movil')
  const [herramienta, setHerramienta] = useState<Herramienta>(null)
  const [subiendo, setSubiendo] = useState<'portada' | 'texto' | null>(null)
  const [sucio, setSucio] = useState(false)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const portadaRef = useRef<HTMLInputElement>(null)
  const textoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return
    let vivo = true
    // TODO: cambiar por `leerPorId(id)`. Hoy esto trae TODOS los artículos con
    // su `content` completo para mostrar uno (blogService no tiene leerPorId).
    void listarTodos().then(todos => {
      if (!vivo) return
      const p = todos.find(x => x.id === id)
      if (p) {
        setPost(p)
        setTagsTexto(p.tags.join(', '))
        /* El borrador NO se aplica solo sobre un artículo que ya existe. Si se
           escribió sobre la MISMA versión que acaba de llegar, es una
           continuación y se restaura; si el servidor cambió por debajo (otro
           aparato, otra persona), se pregunta. Restaurar en silencio sería
           pisar texto publicado con una copia vieja. */
        if (borrador?.post) {
          if (borrador.base === p.updated_at) {
            setPost(borrador.post)
            setTagsTexto(borrador.tagsTexto ?? '')
          } else {
            setRecuperable(borrador)
          }
        }
      }
      setCargando(false)
    })
    return () => { vivo = false }
  }, [id, borrador])

  /* Autoguardado con antirrebote + escritura forzada al desmontar.
     CLAUDE.md §3g lo midió en producción con el panel del planeta: 7 personas
     le pusieron nombre a su mundo y solo 2 tenían los colores, porque la vista
     previa en vivo les hizo creer que ya estaba guardado. Un estudio con la
     previa al lado es exactamente el mismo engaño, y encima con 1.700 palabras
     en juego. */
  /* El ref se escribe en un efecto SIN dependencias, no durante el render: el
     lint del repo lo exige (`react-hooks/refs`) y es el mismo molde que usa
     Sheet.tsx con `onCloseRef`. Lo que se busca es que el guardado forzado del
     desmontaje vea siempre lo último, sin que el efecto de guardar dependa del
     objeto entero. */
  const sobreBorrador = useRef<BorradorBlog>({ post, tagsTexto, base: post.updated_at ?? null })
  /* `sucio` también va al ref: sin él, el guardado del desmontaje reescribiría
     el borrador JUSTO DESPUÉS de que `enviar()` lo borró por haber guardado
     bien, y la próxima vez que se abriera el artículo saldría el cartel de
     «tenés cambios sin guardar» sobre un artículo que está al día. */
  const sucioRef = useRef(false)
  useEffect(() => {
    sobreBorrador.current = { post, tagsTexto, base: post.updated_at ?? null }
    sucioRef.current = sucio
  })

  useEffect(() => {
    if (!sucio) return
    const t = setTimeout(() => guardarBorrador(llaveBorrador(id), sobreBorrador.current), RETARDO_GUARDADO_MS)
    return () => clearTimeout(t)
  }, [post, tagsTexto, sucio, id])

  useEffect(() => {
    const idLocal = id
    return () => {
      if (sucioRef.current) guardarBorrador(llaveBorrador(idLocal), sobreBorrador.current)
    }
  }, [id])

  useEffect(() => {
    if (!sucio) return
    const alSalir = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', alSalir)
    return () => window.removeEventListener('beforeunload', alSalir)
  }, [sucio])

  const editar = useCallback((cambio: Partial<BlogPost>) => {
    setSucio(true)
    setPost(p => ({ ...p, ...cambio }))
  }, [])

  /** Inserta texto en el cursor del textarea y deja el cursor detrás. */
  const insertar = useCallback((frag: string, comoBloque: boolean) => {
    const area = areaRef.current
    const actual = post.content ?? ''
    const ini = area?.selectionStart ?? actual.length
    const fin = area?.selectionEnd ?? actual.length
    const r = comoBloque
      ? insertarBloque(actual, ini, fin, frag)
      : insertarEnLinea(actual, ini, fin, frag)
    editar({ content: r.texto })
    requestAnimationFrame(() => {
      area?.focus()
      area?.setSelectionRange(r.cursor, r.cursor)
    })
  }, [post.content, editar])

  const subir = async (archivo: File, destino: 'portada' | 'texto') => {
    if (!supabaseUser) return
    setSubiendo(destino)
    setError(null)
    const r = await subirImagen(archivo, supabaseUser.id)
    setSubiendo(null)
    if (!r.ok) { setError(r.error); return }
    if (destino === 'portada') { editar({ cover_url: r.url }); return }
    insertar(`![](${r.url})`, true)
  }

  /**
   * `publicar` es explícito y `salir` también.
   *
   * Hoy «Guardar borrador» sobre un artículo YA publicado lo DESPUBLICA y el
   * trigger `blog_posts_sellar` le pone `published_at` en null: la fecha
   * original se pierde para siempre. Acá guardar conserva el estado y
   * despublicar es su propio botón, con confirmación.
   */
  const enviar = async (publicar: boolean, salir: boolean) => {
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
    // Solo con el guardado EXITOSO: si falla, lo escrito tiene que seguir ahí.
    borrarBorrador(llaveBorrador(id))
    setSucio(false)
    if (salir) navigate(`/blog/${r.slug}`)
  }

  const eliminar = async () => {
    if (!id) return
    if (!confirm('¿Borrar este artículo? No se puede deshacer.')) return
    const r = await borrar(id)
    if (r.ok) { borrarBorrador(llaveBorrador(id)); navigate('/blog') }
    else setError(r.error ?? 'No se pudo borrar')
  }

  if (!puedeEscribir) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-20 text-center">
        <p className="blog-serif text-2xl text-swu-text/70 italic">El blog lo escriben los administradores.</p>
        <Link to="/blog" className="inline-block mt-4 text-sm text-swu-cyan">Volver al blog</Link>
      </div>
    )
  }

  if (cargando) {
    return <div className="max-w-3xl mx-auto px-5 py-10"><div className="h-64 rounded-xl carta-esqueleto" /></div>
  }

  const slug = post.slug || slugificar(post.title ?? '')
  const sobre = {
    contenido: post.content ?? '',
    titulo: post.title ?? '',
    excerpt: post.excerpt ?? '',
    portada: post.cover_url ?? null,
    kind: post.kind ?? 'articulo',
    tags: tagsTexto.split(',').map(t => t.trim()).filter(Boolean),
    autor: null,
  }

  return (
    /* `h-full` y no `min-h-screen`: el que scrollea en esta app es el `<main>`
       (scrollApp.ts), así que el estudio se queda con el alto que le den y cada
       columna scrollea por su cuenta. Con `min-h-screen` la barra de guardado
       se iría fuera de la pantalla al escribir. */
    <div className="flex h-full flex-col">
      <BarraSuperior
        slug={slug}
        sucio={sucio}
        conId={!!id}
        panel={panel}
        onPanel={setPanel}
        onVolver={() => navigate('/blog')}
        onBorrar={() => void eliminar()}
      />

      {recuperable && (
        <div className="mx-4 mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-swu-amber/40 px-3 py-2">
          <p className="flex-1 text-[12px] text-swu-amber">
            Tenés cambios sin guardar de una sesión anterior, escritos sobre una versión distinta a la que hay ahora.
          </p>
          <Button size="xs" onClick={() => {
            setPost(recuperable.post ?? {}); setTagsTexto(recuperable.tagsTexto ?? '')
            setRecuperable(null); setSucio(true)
          }}>Recuperarlos</Button>
          <Button size="xs" variant="ghost" onClick={() => {
            borrarBorrador(llaveBorrador(id)); setRecuperable(null)
          }}>Descartarlos</Button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-4 px-4 pb-3">
        {/* ── Columna de escritura ── */}
        <div className={`flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto
                         ${panel !== 'cerrado' ? 'hidden lg:flex lg:flex-1' : 'flex-1'}`}>
          <Cabecera post={post} tagsTexto={tagsTexto} onEditar={editar} onTags={t => { setSucio(true); setTagsTexto(t) }}
                    onSubirPortada={() => portadaRef.current?.click()} subiendo={subiendo} />

          <BarraHerramientas
            onAbrir={setHerramienta}
            onFoto={() => textoRef.current?.click()}
            subiendo={subiendo}
          />

          {/* `flex-1` y no `rows`: el textarea se come el alto que sobra. El
              artículo más largo son 158 líneas y la línea más larga 490
              caracteres; con `rows={18}` fijo se ve una fracción. */}
          <textarea
            ref={areaRef}
            value={post.content ?? ''}
            onChange={e => editar({ content: e.target.value })}
            placeholder="Escribí el artículo…"
            spellCheck
            className="min-h-[320px] flex-1 resize-none rounded-lg border border-swu-border bg-swu-surface
                       px-3 py-3 font-mono text-[13px] leading-relaxed text-swu-text
                       placeholder:text-swu-muted/50 focus:outline-none focus:ring-2 focus:ring-swu-accent"
          />

          <div className="flex flex-shrink-0 items-center justify-between text-[10px] text-swu-muted">
            <span>{minutosDeLectura(post.content ?? '')} min de lectura</span>
            <span>{(post.content ?? '').length} caracteres</span>
          </div>
        </div>

        {/* ── Panel de previa ── */}
        {panel === 'movil' && (
          /* 422 px = 390 del teléfono + 16 de marco a cada lado. Fijo, porque
             el marco NO puede encogerse: si se encogiera, el viewport de
             adentro cambiaría y la previa dejaría de ser la del teléfono. */
          <div className="hidden min-h-0 w-[422px] flex-shrink-0 lg:block">
            <MarcoMovil sobre={sobre} />
          </div>
        )}

        {panel === 'escritorio' && (
          /* 706 px = los 666 medidos de `blog-medida` + `px-5` a cada lado.
             `2xl:w-[706px]` para que a 1536+ conviva con la escritura; por
             debajo se queda con la fila entera, que es lo único honesto: una
             previa de escritorio más angosta que 666 px no es la de escritorio. */
          <div className="min-h-0 w-full overflow-y-auto rounded-xl border border-swu-border
                          bg-swu-bg p-5 2xl:w-[706px] 2xl:flex-shrink-0">
            <div className="blog-medida mx-auto blog-prosa">
              <h1 className="blog-serif text-[34px] sm:text-[44px] font-bold leading-[1.08] tracking-tight text-swu-text">
                {post.title || 'Sin título'}
              </h1>
              {post.excerpt && (
                <p className="blog-serif mt-4 text-[18px] italic leading-relaxed text-swu-text/65">{post.excerpt}</p>
              )}
              <div className="mt-6"><Articulo contenido={post.content ?? ''} /></div>
            </div>
          </div>
        )}
      </div>

      <BarraGuardado
        publicado={!!post.published}
        guardando={guardando}
        error={error}
        onGuardar={() => void enviar(!!post.published, false)}
        onPublicar={() => void enviar(true, true)}
        onDespublicar={() => {
          if (confirm('Esto lo saca de línea y borra su fecha de publicación. ¿Seguir?')) void enviar(false, false)
        }}
      />

      {/* Entradas de archivo, fuera del flujo. */}
      <input ref={portadaRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" className="hidden"
             onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void subir(f, 'portada') }} />
      <input ref={textoRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" className="hidden"
             onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void subir(f, 'texto') }} />

      {/* ── Herramientas ── */}
      <SelectorCarta
        abierto={herramienta === 'carta'}
        onCerrar={() => setHerramienta(null)}
        titulo="Insertar una carta"
        onElegir={(c: Card) => {
          setHerramienta(null)
          insertar(`[[carta:${c.name}|${refImpresion(c.setCode, c.setNumber)}]]`, false)
        }}
      />

      <Sheet
        open={herramienta === 'mazo'}
        onClose={() => setHerramienta(null)}
        title="Insertar un mazo"
      >
        {/* CONTRATO de esta herramienta (todavía sin cuerpo):
            1. Un textarea «Pegá la lista» → `importDeckFromText()` de
               services/deckImportExport.ts, que ya come SWUDB JSON, SWUDB CSV,
               texto de Melee y «3x Nombre», y devuelve `Partial<Deck>` con
               diagnóstico por línea.
            2. Convertir ese `Partial<Deck>` a las líneas de sintaxisMazo.ts
               emitiendo `refImpresion(setCode, setNumber)` por carta. Esa
               función de conversión va en un `.ts` puro, NUNCA acá.
            3. Filas editables a mano para lo que el importador no resolvió:
               `findCardFast` nunca hace match aproximado, así que devuelve
               `ambiguous` y hay que elegir con `SelectorCarta`.
            4. Antes de insertar, pasar el resultado por `parsearMazo()` —el
               parser REAL— y no dejar insertar si devuelve null.
            Esto borra las 40 líneas que el artículo de Berlín tiene tecleadas
            a mano, con su `|SEC-163` una por una. */}
        <div className="p-4 text-[12px] text-swu-muted">Pendiente de construir (ver el contrato en el código).</div>
      </Sheet>

      <Sheet
        open={herramienta === 'barras' || herramienta === 'curva' || herramienta === 'ficha'}
        onClose={() => setHerramienta(null)}
        title="Insertar un bloque de datos"
      >
        {/* CONTRATO: filas {etiqueta, valor} (o pares coste:cantidad para la
            curva), un campo de título y uno de fuente. Cada campo se valida con
            `revisarEtiqueta` / `revisarValorBarras` / `revisarValorFicha` de
            sintaxisSalida.ts —que son los seis casos de corrupción SILENCIOSA,
            los únicos que el fallback a texto no atrapa— y el bloque completo
            con `parsearBloqueEstadistico()`, el parser real, antes de dejar
            insertar. Se arma con `armarBloque()`. */}
        <div className="p-4 text-[12px] text-swu-muted">Pendiente de construir (ver el contrato en el código).</div>
      </Sheet>
    </div>
  )
}

// ── Piezas de la pantalla ────────────────────────────────────────────

function BarraSuperior(
  { slug, sucio, conId, panel, onPanel, onVolver, onBorrar }: {
    slug: string; sucio: boolean; conId: boolean; panel: Panel
    onPanel: (p: Panel) => void; onVolver: () => void; onBorrar: () => void
  },
) {
  return (
    <div className="flex flex-shrink-0 items-center gap-3 px-4 py-3">
      <button onClick={onVolver} className="flex items-center gap-1.5 text-[12px] text-swu-muted hover:text-swu-text">
        <ArrowLeft size={14} aria-hidden /> Blog
      </button>
      {slug && <p className="min-w-0 flex-1 truncate font-mono text-[10px] text-swu-muted">swusv.com/blog/{slug}</p>}

      {/* El estado de guardado se dice con palabras, no con un punto de color:
          es lo único que evita el «creí que ya estaba guardado» de §3g. */}
      <span className={`flex-shrink-0 text-[11px] ${sucio ? 'text-swu-amber' : 'text-swu-muted'}`}>
        {sucio ? 'Sin guardar · borrador local al día' : 'Todo guardado'}
      </span>

      <div className="hidden lg:block">
        <SegmentedControl<Panel>
          label="Vista previa"
          value={panel}
          onChange={onPanel}
          options={[
            { value: 'movil', label: 'Teléfono', icon: <Smartphone size={12} aria-hidden /> },
            { value: 'escritorio', label: 'Escritorio', icon: <Monitor size={12} aria-hidden /> },
            { value: 'cerrado', label: 'Solo texto', icon: <PanelRightClose size={12} aria-hidden /> },
          ]}
        />
      </div>

      {conId && (
        <button onClick={onBorrar} className="p-1.5 text-swu-red-texto" aria-label="Borrar">
          <Trash2 size={15} aria-hidden />
        </button>
      )}
    </div>
  )
}

function Cabecera(
  { post, tagsTexto, onEditar, onTags, onSubirPortada, subiendo }: {
    post: Partial<BlogPost>; tagsTexto: string
    onEditar: (c: Partial<BlogPost>) => void; onTags: (t: string) => void
    onSubirPortada: () => void; subiendo: 'portada' | 'texto' | null
  },
) {
  return (
    <div className="flex-shrink-0 space-y-2">
      <input
        value={post.title ?? ''}
        onChange={e => onEditar({ title: e.target.value })}
        placeholder="Título del artículo"
        className="w-full border-b border-swu-border bg-transparent pb-2 blog-serif text-3xl font-bold
                   text-swu-text placeholder:text-swu-muted/40 focus:outline-none"
      />
      <textarea
        value={post.excerpt ?? ''}
        onChange={e => onEditar({ excerpt: e.target.value })}
        placeholder="Resumen — es lo que se lee en la portada del blog"
        rows={2}
        maxLength={400}
        className="w-full resize-none rounded-lg border border-swu-border bg-swu-surface px-3 py-2 text-sm
                   text-swu-text placeholder:text-swu-muted/50 focus:outline-none focus:ring-2 focus:ring-swu-accent"
      />
      <div className="grid grid-cols-3 gap-2">
        <select
          value={post.kind ?? 'articulo'}
          onChange={e => onEditar({ kind: e.target.value as BlogKind })}
          className="rounded-lg border border-swu-border bg-swu-surface px-3 py-2 text-sm text-swu-text"
        >
          {(Object.keys(KIND_LABEL) as BlogKind[]).map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
        <input
          value={tagsTexto}
          onChange={e => onTags(e.target.value)}
          placeholder="etiquetas, por comas"
          className="rounded-lg border border-swu-border bg-swu-surface px-3 py-2 text-sm
                     text-swu-text placeholder:text-swu-muted/50"
        />
        <button
          onClick={onSubirPortada}
          disabled={subiendo !== null}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-swu-cyan/40
                     text-[11px] text-swu-cyan disabled:opacity-40"
        >
          {subiendo === 'portada'
            ? <Loader2 size={13} className="animate-spin" aria-hidden />
            : <ImagePlus size={13} aria-hidden />}
          {post.cover_url ? 'Cambiar portada' : 'Subir portada'}
        </button>
      </div>
    </div>
  )
}

function BarraHerramientas(
  { onAbrir, onFoto, subiendo }: {
    onAbrir: (h: Herramienta) => void; onFoto: () => void; subiendo: 'portada' | 'texto' | null
  },
) {
  const items: { h: Exclude<Herramienta, null>; icono: React.ReactNode; texto: string }[] = [
    { h: 'carta', icono: <Sparkles size={13} aria-hidden />, texto: 'Carta' },
    { h: 'mazo', icono: <Layers size={13} aria-hidden />, texto: 'Mazo' },
    { h: 'barras', icono: <BarChart3 size={13} aria-hidden />, texto: 'Barras' },
    { h: 'curva', icono: <TrendingUp size={13} aria-hidden />, texto: 'Curva' },
    { h: 'ficha', icono: <Table2 size={13} aria-hidden />, texto: 'Ficha' },
  ]
  return (
    <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
      {items.map(it => (
        <button
          key={it.h}
          onClick={() => onAbrir(it.h)}
          className="flex items-center gap-1.5 rounded-full border border-swu-border px-2.5 py-1
                     text-[11px] text-swu-text hover:border-swu-accent"
        >
          {it.icono} {it.texto}
        </button>
      ))}
      <button
        onClick={onFoto}
        disabled={subiendo !== null}
        className="flex items-center gap-1.5 rounded-full border border-swu-cyan/40 px-2.5 py-1
                   text-[11px] text-swu-cyan disabled:opacity-40"
      >
        {subiendo === 'texto'
          ? <Loader2 size={12} className="animate-spin" aria-hidden />
          : <ImagePlus size={12} aria-hidden />}
        Foto
      </button>
    </div>
  )
}

function BarraGuardado(
  { publicado, guardando, error, onGuardar, onPublicar, onDespublicar }: {
    publicado: boolean; guardando: boolean; error: string | null
    onGuardar: () => void; onPublicar: () => void; onDespublicar: () => void
  },
) {
  return (
    <div className="flex-shrink-0 border-t border-swu-border px-4 py-3">
      {error && <p className="mb-2 text-[12px] text-swu-red-texto">{error}</p>}
      <div className="flex items-center gap-2">
        {/* «Guardar» NO cambia el estado de publicación: hoy este botón
            despublica en silencio y el trigger borra `published_at`. */}
        <Button size="sm" variant="secondary" loading={guardando} onClick={onGuardar}>
          <Save size={14} aria-hidden /> Guardar y seguir
        </Button>
        {publicado
          ? <Button size="sm" variant="ghost" onClick={onDespublicar}>Despublicar</Button>
          : <Button size="sm" loading={guardando} onClick={onPublicar}><Send size={14} aria-hidden /> Publicar</Button>}
        <span className="flex-1" />
        <p className="text-[10px] text-swu-muted lg:hidden">El estudio completo está en la computadora.</p>
      </div>
    </div>
  )
}
