/**
 * /credencial — MI CREDENCIAL: la placa de identificación del jugador.
 *
 * La tarjeta es CredencialSVG; esta pantalla la alimenta con datos reales
 * (perfil, rango de gamification, título activo, país, mazo favorito) y
 * ofrece la personalización completa: tema, emblema, apodo, ubicación y
 * mazo. Cada elección se guarda al instante con el MISMO patrón que la
 * personalización del perfil (useSettings → debounce → profiles.settings),
 * así la credencial viaja con la cuenta a cualquier aparato.
 *
 * Imprimir/PDF: window.print() sobre reglas @media print que esconden todo
 * menos la credencial y la dimensionan a 85.6mm (ancho real de una tarjeta
 * CR80). El PDF sale del diálogo nativo — cero dependencias nuevas.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Printer } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useSettings } from '../../hooks/useSettings'
import { db } from '../../services/db'
import { calculateLevel, type PlayerStats } from '../../services/gamification'
import { getTitleById } from '../../services/cosmeticsService'
import { getCountryByCode } from '../../data/regions'
import { misMazos, type MazoCompartible } from '../../services/galaxiaCompartir'
import { CredencialSVG, type DatosCredencial } from './CredencialSVG'
import { TEMAS_CREDENCIAL, EMBLEMAS_CREDENCIAL_IDS, temaCredencial } from './credencialTemas'
import { EMBLEMAS_CREDENCIAL } from './emblemasCredencial'
import { supabase } from '../../services/supabase'

/**
 * «12 ENE 2026» — el formato de sello de despliegue, sin depender de locale.
 *
 * Acepta los dos formatos que llegan: los milisegundos del espejo local y el
 * ISO de `profiles.created_at`. Un `new Date` con el ISO ya trae su zona, así
 * que no hay que agregarle ninguna.
 */
function fechaDespliegue(cuando: number | string): string {
  const meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
  const f = new Date(cuando)
  if (Number.isNaN(f.getTime())) return '—'
  return `${String(f.getDate()).padStart(2, '0')} ${meses[f.getMonth()]} ${f.getFullYear()}`
}

/**
 * Reglas de impresión. Van en un <style> del propio componente y no en
 * index.css: solo existen mientras la pantalla está montada, y así la regla
 * «ocultá TODO el body» no puede afectar la impresión de otra pantalla.
 */
/**
 * Imprime la credencial en un DOCUMENTO APARTE.
 *
 * Imprimir esta pantalla no funcionaba, y no por el CSS: el caparazón de la
 * app es `h-[100dvh] overflow-hidden` con el contenido dentro de un `<main>`
 * que scrollea. Al imprimir, el navegador recorta TODO a una pantalla, y
 * `overflow: hidden` en un ancestro recorta pase lo que pase con la
 * `visibility` de los hijos. No hay regla `@media print` que salve eso desde
 * adentro.
 *
 * Así que se abre una ventana nueva con SOLO la credencial. Es el mismo
 * principio que sacar un modal a `<body>` por portal: cuando un ancestro te
 * pelea, salís del ancestro.
 *
 * Se toma el `outerHTML` del SVG que está EN PANTALLA, no se reconstruye: lo
 * que se imprime es exactamente lo que ves, sin una segunda implementación que
 * pueda separarse de la primera.
 */
function imprimirCredencial(): { ok: boolean; motivo?: string } {
  const svg = document.querySelector('#zona-credencial svg')
  if (!svg) return { ok: false, motivo: 'No se encontró la credencial.' }

  // Las rutas relativas (/avatars/x.png) no existen en una ventana en blanco:
  // se vuelven absolutas. Las fotos van en data URI y viajan solas.
  const clon = svg.cloneNode(true) as SVGElement
  clon.querySelectorAll('image').forEach(img => {
    const href = img.getAttribute('href') ?? img.getAttribute('xlink:href')
    if (href && href.startsWith('/')) {
      img.setAttribute('href', window.location.origin + href)
      img.removeAttribute('xlink:href')
    }
  })
  clon.removeAttribute('class')
  clon.setAttribute('width', '85.6mm')
  clon.removeAttribute('height')

  const ventana = window.open('', '_blank', 'width=900,height=650')
  if (!ventana) {
    return { ok: false, motivo: 'El navegador bloqueó la ventana. Permití las ventanas emergentes y volvé a intentar.' }
  }

  ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Credencial</title>
<style>
  /* 85,6 mm es el ancho real de una tarjeta CR80. El margen es de la HOJA. */
  @page { margin: 14mm; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { display: flex; justify-content: center; padding: 8mm 0; }
  svg { width: 85.6mm; height: auto; display: block;
        /* Sin esto el navegador descarta los fondos para ahorrar tinta y la
           placa sale como un contorno vacío. */
        -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media print { body { padding: 0; } }
</style></head><body>${clon.outerHTML}</body></html>`)
  ventana.document.close()

  // Se espera a que la ventana termine de cargar sus imágenes: llamar a
  // print() antes deja la foto y el emblema en blanco.
  const lanzar = () => { ventana.focus(); ventana.print() }
  if (ventana.document.readyState === 'complete') window.setTimeout(lanzar, 250)
  else ventana.addEventListener('load', () => window.setTimeout(lanzar, 250))

  return { ok: true }
}

export function CredencialPage() {
  const navigate = useNavigate()
  const { currentProfile, supabaseUser } = useAuth()
  const {
    credencialTema, credencialEmblema, credencialApodo, credencialUbicacion,
    credencialMazoId, credencialMostrarMazo, setCredencial,
  } = useSettings()

  const [stats, setStats] = useState<PlayerStats | null>(null)
  /** Si la impresión no pudo arrancar (ventana bloqueada), se dice por qué. */
  const [avisoImpresion, setAvisoImpresion] = useState<string | null>(null)
  const [mazos, setMazos] = useState<MazoCompartible[]>([])
  const [liderNombre, setLiderNombre] = useState<string | null>(null)
  /** Fecha de alta REAL de la cuenta (profiles.created_at). */
  const [altaCuenta, setAltaCuenta] = useState<string | null>(null)
  // «Hoy», congelado al montar (inicializador perezoso): Date.now() en el
  // cuerpo del render es impuro y el lint del compilador de React lo veta.
  const [hoy] = useState(() => Date.now())

  // Stats (rango + título activo) desde Dexie, mazos desde Supabase.
  useEffect(() => {
    let vivo = true
    void (async () => {
      if (currentProfile) {
        const ps = await db.playerStats.get(currentProfile.id)
        if (vivo && ps) setStats(ps)
      }
      if (supabaseUser) {
        const lista = await misMazos(supabaseUser.id)
        if (vivo) setMazos(lista)

        // La fecha de DESPLIEGUE sale de la CUENTA, no del aparato.
        //
        // `currentProfile.createdAt` lo estampa el espejo local de Dexie con
        // `Date.now()` la primera vez que esta cuenta se abre EN ESTE APARATO.
        // O sea que en el teléfono decía una fecha y en la compu otra, y
        // borrar los datos del sitio la reseteaba a hoy — en una credencial que
        // se imprime, eso es un dato inventado. `profiles.created_at` es la
        // fecha de verdad, es legible por `authenticated` y las 25 cuentas la
        // tienen (verificado).
        const { data, error } = await supabase
          .from('profiles').select('created_at').eq('id', supabaseUser.id).maybeSingle()
        if (error) console.warn('[credencial] no se pudo leer la fecha de alta:', error.message)
        if (vivo && data?.created_at) setAltaCuenta(data.created_at)
      }
    })()
    return () => { vivo = false }
  }, [currentProfile, supabaseUser])

  // El renglón del mazo muestra el NOMBRE DEL LÍDER, no el apodo del mazo:
  // el líder identifica un mazo de un vistazo; el nombre suele ser broma
  // interna. El cardId del líder se resuelve contra el catálogo local.
  useEffect(() => {
    let vivo = true
    void (async () => {
      const mazo = mazos.find((m) => m.id === credencialMazoId)
      if (!mazo) { setLiderNombre(null); return }
      const carta = mazo.lider ? await db.cards.get(mazo.lider) : undefined
      if (vivo) setLiderNombre(carta?.name ?? mazo.nombre)
    })()
    return () => { vivo = false }
  }, [mazos, credencialMazoId])

  if (!currentProfile) {
    // AuthGate ya exige sesión; esto solo cubre el instante de hidratación.
    return null
  }

  const tema = temaCredencial(credencialTema)
  const titulo = stats ? getTitleById(stats.activeTitle)?.name : undefined
  const pais = currentProfile.country ? getCountryByCode(currentProfile.country)?.name : undefined

  const datos: DatosCredencial = {
    nombre: currentProfile.name || 'Jugador',
    apodo: credencialApodo.trim() || titulo || 'Recluta',
    ubicacion: credencialUbicacion.trim() || pais || 'Borde Exterior',
    rango: stats ? calculateLevel(stats.xp).rank.name : 'Iniciado del Borde Exterior',
    // Si el perfil no trae fecha de registro (datos viejos), va la de hoy.
    desplegado: fechaDespliegue(altaCuenta ?? currentProfile.createdAt ?? hoy),
    avatar: currentProfile.avatar,
    mazo: credencialMostrarMazo ? liderNombre : null,
  }

  return (
    <div className="p-4 lg:p-6 pb-24 max-w-3xl mx-auto space-y-5">

      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-swu-muted">
          <ChevronLeft size={18} /> Volver
        </button>
        <button
          onClick={() => {
            const r = imprimirCredencial()
            if (!r.ok) setAvisoImpresion(r.motivo ?? 'No se pudo imprimir.')
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-swu-accent text-swu-accent-fg font-bold text-sm active:scale-[0.98] transition-transform"
        >
          <Printer size={16} /> Imprimir / PDF
        </button>
      </div>

      <div>
        <h1 className="text-lg font-bold text-swu-text">Mi Credencial</h1>
        <p className="text-xs text-swu-muted">Tu placa de identificación galáctica — personalizala e imprimila a tamaño real.</p>
      </div>

      {/* Si la impresión no pudo ni arrancar, se dice POR QUÉ. Un botón que no
          hace nada y no explica nada es lo que hace que la gente reporte «no
          funciona» sin más dato. */}
      {avisoImpresion && (
        <p className="rounded-xl border border-swu-amber/40 bg-swu-amber/10 px-3 py-2 text-[12px] text-swu-amber">
          {avisoImpresion}
        </p>
      )}

      {/* La credencial. El id es de dónde la toma la impresión. */}
      <div id="zona-credencial" className="flex justify-center">
        <CredencialSVG
          datos={datos}
          tema={tema}
          emblema={credencialEmblema}
          className="w-full max-w-xl drop-shadow-[0_12px_28px_rgba(0,0,0,0.55)]"
        />
      </div>

      {/* ── Personalización ── */}
      <div className="bg-swu-surface rounded-2xl p-5 border border-swu-border space-y-5">
        {/* Tema */}
        <div>
          <p className="text-xs text-swu-muted mb-2">Tema de la placa</p>
          <div className="flex flex-wrap gap-2">
            {TEMAS_CREDENCIAL.map((t) => (
              <button
                key={t.id}
                onClick={() => setCredencial({ credencialTema: t.id })}
                title={t.etiqueta}
                aria-label={`Tema ${t.etiqueta}`}
                className={`w-10 h-10 rounded-lg border-2 overflow-hidden transition-all ${
                  credencialTema === t.id ? 'border-swu-accent scale-110' : 'border-swu-border'
                }`}
                /* Las tres franjas ENSEÑAN la paleta (base/acento/panel):
                   una muestra de un solo color no distingue sith de imperial. */
                style={{ background: `linear-gradient(135deg, ${t.base} 45%, ${t.acento} 45%, ${t.acento} 62%, ${t.panel} 62%)` }}
              />
            ))}
          </div>
          <p className="text-[10px] text-swu-accent-texto mt-1.5 font-mono tracking-wider">{tema.etiqueta.toUpperCase()}</p>
        </div>

        {/* Emblema */}
        <div>
          <p className="text-xs text-swu-muted mb-2">Emblema grabado</p>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 justify-items-center">
            {EMBLEMAS_CREDENCIAL_IDS.map((id) => {
              const { etiqueta, url } = EMBLEMAS_CREDENCIAL[id]
              return (
                <button
                  key={id}
                  onClick={() => setCredencial({ credencialEmblema: id })}
                  title={etiqueta}
                  aria-label={`Emblema ${etiqueta}`}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center border-2 transition-all ${
                    credencialEmblema === id
                      ? 'border-swu-accent bg-swu-accent/20 text-swu-accent-texto scale-110'
                      : 'border-swu-border bg-swu-bg text-swu-muted'
                  }`}
                >
                  {/* El mismo PNG que ya usa el selector de avatar del perfil. */}
                  <img src={url} alt="" className="w-7 h-7 object-contain" />
                </button>
              )
            })}
          </div>
        </div>

        {/* Apodo y ubicación */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Apodo</p>
            <input
              value={credencialApodo}
              onChange={(e) => setCredencial({ credencialApodo: e.target.value })}
              maxLength={24}
              placeholder={titulo || 'Recluta'}
              className="w-full bg-swu-bg border border-swu-border rounded-xl p-3 text-sm text-swu-text outline-none focus:border-swu-accent"
            />
            <p className="text-[10px] text-swu-muted mt-1">Vacío = tu título activo del perfil.</p>
          </div>
          <div>
            <p className="text-xs text-swu-muted mb-1.5">Ubicación</p>
            <input
              value={credencialUbicacion}
              onChange={(e) => setCredencial({ credencialUbicacion: e.target.value })}
              maxLength={28}
              placeholder={pais || 'Borde Exterior'}
              className="w-full bg-swu-bg border border-swu-border rounded-xl p-3 text-sm text-swu-text outline-none focus:border-swu-accent"
            />
            <p className="text-[10px] text-swu-muted mt-1">Vacío = el país de tu cuenta.</p>
          </div>
        </div>

        {/* Mazo favorito */}
        <div>
          <label className="flex items-center justify-between cursor-pointer">
            <p className="text-xs text-swu-muted">Mostrar mi mazo favorito</p>
            <button
              role="switch"
              aria-checked={credencialMostrarMazo}
              onClick={() => setCredencial({ credencialMostrarMazo: !credencialMostrarMazo })}
              className={`w-11 h-6 rounded-full transition-colors relative ${credencialMostrarMazo ? 'bg-swu-accent' : 'bg-swu-border'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${credencialMostrarMazo ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </label>
          {credencialMostrarMazo && (
            mazos.length > 0 ? (
              <select
                value={credencialMazoId}
                onChange={(e) => setCredencial({ credencialMazoId: e.target.value })}
                className="w-full mt-2 bg-swu-bg border border-swu-border rounded-xl p-3 text-sm text-swu-text outline-none focus:border-swu-accent"
              >
                <option value="">— Elegí un mazo —</option>
                {mazos.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
            ) : (
              <p className="text-[10px] text-swu-muted mt-2">Todavía no tenés mazos guardados en la nube.</p>
            )
          )}
        </div>
      </div>
    </div>
  )
}
