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

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Printer } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useSettings } from '../../hooks/useSettings'
import { db, type UserProfile } from '../../services/db'
import { type PlayerStats } from '../../services/gamification'
import { misMazos, type MazoCompartible } from '../../services/galaxiaCompartir'
import { CredencialInteractiva } from './CredencialInteractiva'
import { useDatosCredencial } from './useDatosCredencial'
import { CompartirCredencial } from './CompartirCredencial'
import { ACABADOS, proximoAcabado } from './acabadosCredencial'
import { TEMAS_CREDENCIAL, EMBLEMAS_CREDENCIAL_IDS, temaCredencial } from './credencialTemas'
import { emblemaDe } from './emblemasCredencial'


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
  // `[data-cara="frente"]` y no el primer `svg` a secas: desde que la placa
  // se puede girar hay DOS svg en la zona (frente y dorso), y depender del
  // orden del DOM es apostar a que nadie los reordene nunca.
  const svg =
    document.querySelector('#zona-credencial svg[data-cara="frente"]') ??
    document.querySelector('#zona-credencial svg')
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

/**
 * Portero. El hook `useDatosCredencial` no puede colgar de un `if`, así que la
 * comprobación de sesión vive acá afuera y adentro el perfil ya es un hecho.
 */
export function CredencialPage() {
  const { currentProfile } = useAuth()
  // AuthGate ya exige sesión; esto solo cubre el instante de hidratación.
  if (!currentProfile) return null
  return <CredencialInterna perfil={currentProfile} />
}

function CredencialInterna({ perfil }: { perfil: UserProfile }) {
  const navigate = useNavigate()
  const { supabaseUser } = useAuth()
  const {
    credencialTema, credencialEmblema, credencialApodo, credencialUbicacion,
    credencialMazoId, credencialMostrarMazo, credencialMazoLider, setCredencial,
  } = useSettings()

  const [stats, setStats] = useState<PlayerStats | null>(null)
  /** Si la impresión no pudo arrancar (ventana bloqueada), se dice por qué. */
  const [avisoImpresion, setAvisoImpresion] = useState<string | null>(null)
  const [mazos, setMazos] = useState<MazoCompartible[]>([])
  /** Último líder escrito en ajustes: evita que el efecto se re-dispare solo. */
  const liderRef = useRef(credencialMazoLider)

  // Stats (rango + título activo) desde Dexie, mazos desde Supabase. La fecha
  // de alta la resuelve `useDatosCredencial`, que la cachea entre pantallas.
  useEffect(() => {
    let vivo = true
    void (async () => {
      const ps = await db.playerStats.get(perfil.id)
      if (vivo && ps) setStats(ps)
      if (supabaseUser) {
        const lista = await misMazos(supabaseUser.id)
        if (vivo) setMazos(lista)
      }
    })()
    return () => { vivo = false }
  }, [perfil.id, supabaseUser])

  // El renglón del mazo muestra el NOMBRE DEL LÍDER, no el apodo del mazo:
  // el líder identifica un mazo de un vistazo; el nombre suele ser broma
  // interna. El cardId del líder se resuelve contra el catálogo local y el
  // resultado se GUARDA en ajustes: así la placa de Inicio y la del perfil
  // muestran el mismo renglón sin repetir la consulta a la nube.
  useEffect(() => {
    let vivo = true
    void (async () => {
      const mazo = mazos.find((m) => m.id === credencialMazoId)
      if (!mazo) {
        if (vivo && liderRef.current) { liderRef.current = ''; setCredencial({ credencialMazoLider: '' }) }
        return
      }
      const carta = mazo.lider ? await db.cards.get(mazo.lider) : undefined
      const nombre = carta?.name ?? mazo.nombre
      // Solo se escribe si CAMBIÓ: `setCredencial` dispara la sincronización
      // con la nube, y un efecto que se reescribe a sí mismo es un bucle.
      if (vivo && nombre !== liderRef.current) {
        liderRef.current = nombre
        setCredencial({ credencialMazoLider: nombre })
      }
    })()
    return () => { vivo = false }
  }, [mazos, credencialMazoId, setCredencial])

  const { datos, nivel, acabado } = useDatosCredencial(perfil, stats)
  const siguiente = proximoAcabado(nivel)

  const tema = temaCredencial(credencialTema)

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
        <CredencialInteractiva
          datos={datos}
          tema={tema}
          emblema={credencialEmblema}
          acabado={acabado}
          nivel={nivel}
        />
      </div>

      <CompartirCredencial
        // El SVG se busca en el momento del clic y no se pasa por ref: la
        // placa vive dentro del envoltorio 3D y se vuelve a montar cuando
        // cambia el tema, así que una ref capturada al montar apuntaría a un
        // nodo viejo.
        contenedor={() => document.querySelector('#zona-credencial svg[data-cara="frente"]')}
        nombre={datos.nombre}
        rango={datos.rango}
        nivel={nivel}
      />

      {/* ── Acabados ganados por nivel ── */}
      <div className="bg-swu-surface rounded-2xl p-4 border border-swu-border">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs text-swu-muted">Acabado de la placa</p>
          <p className="text-[11px] font-bold text-swu-accent-texto">{acabado.nombre}</p>
        </div>
        <p className="mt-1 text-[11px] text-swu-muted">{acabado.detalle}</p>

        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {ACABADOS.map((ac) => {
            const ganado = nivel >= ac.desde
            const puesto = ac.id === acabado.id
            return (
              <div
                key={ac.id}
                className={`rounded-lg border px-1.5 py-2 text-center ${
                  puesto
                    ? 'border-swu-accent bg-swu-accent/10'
                    : ganado
                      ? 'border-swu-border bg-swu-bg/40'
                      : 'border-swu-border/50 bg-swu-bg/20 opacity-45'
                }`}
              >
                <p className={`text-[10px] font-bold leading-tight ${ganado ? 'text-swu-text' : 'text-swu-muted'}`}>
                  {ac.nombre}
                </p>
                <p className="text-[9px] text-swu-muted">Nv {ac.desde}</p>
              </div>
            )
          })}
        </div>

        {siguiente && (
          <p className="mt-2.5 text-[11px] text-swu-muted">
            En el nivel <span className="font-bold text-swu-text">{siguiente.desde}</span> se desbloquea{' '}
            <span className="font-bold text-swu-accent-texto">{siguiente.nombre}</span> — {siguiente.detalle.toLowerCase()}
          </p>
        )}
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
              const { etiqueta, url } = emblemaDe(id)
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
              placeholder={datos.apodo}
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
              placeholder={datos.ubicacion}
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
