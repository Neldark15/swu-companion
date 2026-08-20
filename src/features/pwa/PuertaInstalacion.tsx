/**
 * La puerta: para usar la app hay que tenerla instalada y con avisos activos.
 *
 * ── Lo que NO se puede exigir, y por qué ─────────────────────────────
 *
 * Un requisito que la persona no puede cumplir no es un requisito, es una
 * pared sin puerta. Tres casos reales:
 *
 * 1. **Navegador de Instagram / Facebook / TikTok.** Desde ahí NO se puede
 *    instalar: en iOS «Añadir a inicio» solo existe en Safari, y el navegador
 *    de Instagram es un WKWebView sin ese menú; en Android son WebViews que
 *    nunca disparan `beforeinstallprompt`. Ahí se pasa de largo y se ofrece
 *    abrir en el navegador de verdad.
 * 2. **En iOS el permiso de avisos solo se puede pedir DESPUÉS de instalar.**
 *    Antes de estar en la pantalla de inicio, `Notification.requestPermission`
 *    ni existe. Por eso el orden de los pasos es instalar → abrir instalada →
 *    activar avisos, y no al revés.
 * 3. **Si alguien toca «Bloquear», el navegador no deja volver a preguntar.**
 *    El permiso queda en `denied` para siempre desde código. Bloquearlo ahí
 *    sería echarlo de la app sin manera de volver, por un botón mal tocado.
 *    Se le enseña cómo reactivarlo, con un botón para volver a comprobar, y si
 *    aun así no quiere, entra con el aviso puesto.
 *
 * ── Escritorio ───────────────────────────────────────────────────────
 *
 * En computadora se puede instalar (Chrome/Edge) pero no es lo que se busca —
 * la app es de teléfono y se usa en la mesa. Se muestra la puerta con el
 * código QR mental («abrila en tu teléfono») pero se deja pasar: bloquear la
 * computadora estorbaría a quien organiza un torneo desde la laptop.
 */

import { useCallback, useEffect, useState } from 'react'
import { TarjetaOferta } from '../sobres/OfertaSobresDiarios'
import { useLocation } from 'react-router-dom'
import { Download, Bell, Check, Share, Plus, ExternalLink, AlertTriangle, Smartphone } from 'lucide-react'
import { esStandalone, navegadorEmbebido, plataforma, rutaLibre } from '../../services/entorno'
import { getNotificationPermission, checkPushSupport, subscribeToPush } from '../../services/pushService'
import { useAuth } from '../../hooks/useAuth'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Quien decidió seguir sin avisos. Se recuerda para no volver a frenarlo. */
const CLAVE_SIN_AVISOS = 'swu.puerta.sinAvisos'

export function PuertaInstalacion({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const { supabaseUser } = useAuth()
  const [instalada] = useState(esStandalone)
  const [embebido] = useState(navegadorEmbebido)
  const [plat] = useState(plataforma)
  const [promptInstalar, setPromptInstalar] = useState<BeforeInstallPromptEvent | null>(null)
  const [permiso, setPermiso] = useState<NotificationPermission | 'unsupported'>(getNotificationPermission)
  const [pidiendo, setPidiendo] = useState(false)
  const [sinAvisos, setSinAvisos] = useState(() => {
    try { return localStorage.getItem(CLAVE_SIN_AVISOS) === '1' } catch { return false }
  })

  useEffect(() => {
    const alPoder = (e: Event) => {
      e.preventDefault()
      setPromptInstalar(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', alPoder)
    return () => window.removeEventListener('beforeinstallprompt', alPoder)
  }, [])

  const pedirAvisos = useCallback(async () => {
    setPidiendo(true)
    try {
      // `subscribeToPush` ya pide el permiso y registra la suscripción; sin
      // usuario todavía, al menos se consigue el permiso del navegador.
      if (supabaseUser) await subscribeToPush(supabaseUser.id)
      else if (typeof Notification !== 'undefined') await Notification.requestPermission()
      setPermiso(getNotificationPermission())
    } finally {
      setPidiendo(false)
    }
  }, [supabaseUser])

  const recomprobar = useCallback(() => setPermiso(getNotificationPermission()), [])

  const seguirSinAvisos = useCallback(() => {
    try { localStorage.setItem(CLAVE_SIN_AVISOS, '1') } catch { /* modo privado */ }
    setSinAvisos(true)
  }, [])

  // ── Quién pasa sin preguntas ──
  if (rutaLibre(pathname)) return <>{children}</>
  if (embebido) return <><AvisoEmbebido cual={embebido} />{children}</>
  if (plat === 'escritorio' || plat === 'desconocida') return <>{children}</>

  // Falta instalar: la puerta, con el paso 1 activo.
  if (!instalada) {
    return <Pantalla paso={1} plat={plat} promptInstalar={promptInstalar} />
  }

  // Instalada pero sin avisos.
  const soporte = checkPushSupport()
  const faltanAvisos = soporte.supported && permiso !== 'granted' && !sinAvisos
  if (faltanAvisos) {
    return (
      <Pantalla
        paso={permiso === 'denied' ? 3 : 2}
        plat={plat}
        promptInstalar={null}
        onPedir={() => void pedirAvisos()}
        onRecomprobar={recomprobar}
        onSeguir={seguirSinAvisos}
        pidiendo={pidiendo}
      />
    )
  }

  return <>{children}</>
}

/** Barra fina en el navegador de Instagram: se puede usar, pero se avisa. */
function AvisoEmbebido({ cual }: { cual: string }) {
  const nombre = cual === 'instagram' ? 'Instagram' : cual === 'facebook' ? 'Facebook' : 'TikTok'
  return (
    <div className="sticky top-0 z-40 flex items-center gap-2 bg-swu-accent/15 px-3 py-2 text-[11px] text-swu-text">
      <ExternalLink size={13} className="shrink-0 text-swu-accent-texto" />
      <span className="flex-1">
        Estás en el navegador de {nombre}. Para instalar la app y recibir avisos, abrí
        <strong> swusv.com</strong> en Chrome o Safari.
      </span>
    </div>
  )
}

function Pantalla({ paso, plat, promptInstalar, onPedir, onRecomprobar, onSeguir, pidiendo }: {
  paso: 1 | 2 | 3
  plat: 'ios' | 'android'
  promptInstalar: BeforeInstallPromptEvent | null
  onPedir?: () => void
  onRecomprobar?: () => void
  onSeguir?: () => void
  pidiendo?: boolean
}) {
  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-swu-bg">
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-5 p-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-swu-accent/15">
            <Smartphone size={26} className="text-swu-accent-texto" />
          </div>
          <h1 className="text-lg font-black text-swu-text">HOLOCRON SWU</h1>
          <p className="mt-1 text-[12px] text-swu-muted">
            La app se usa instalada en el teléfono: así abre al instante, funciona sin señal en la
            mesa y te avisa de los torneos.
          </p>
        </div>

        {/* El premio va ARRIBA de los pasos, no debajo: es la razón por la que
            vale la pena hacerlos, y debajo del formulario no lo lee nadie. */}
        <TarjetaOferta />

        <Pasos activo={paso} />

        {paso === 1 && <PasoInstalar plat={plat} promptInstalar={promptInstalar} />}
        {paso === 2 && <PasoAvisos onPedir={onPedir} pidiendo={pidiendo} />}
        {paso === 3 && <PasoDenegado plat={plat} onRecomprobar={onRecomprobar} onSeguir={onSeguir} />}
      </div>
    </div>
  )
}

function Pasos({ activo }: { activo: 1 | 2 | 3 }) {
  const items = [
    { n: 1, t: 'Instalar' },
    { n: 2, t: 'Abrir la app' },
    { n: 3, t: 'Activar avisos' },
  ]
  // El paso 3 de la barra representa «avisos»; la pantalla 2 y la 3 son dos
  // momentos del mismo paso (pedirlos y recuperarse de un «Bloquear»).
  const marca = activo === 1 ? 1 : 3
  return (
    <div className="flex items-center gap-1.5">
      {items.map((it, i) => (
        <div key={it.n} className="flex flex-1 items-center gap-1.5">
          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
            marca > it.n ? 'bg-swu-green/20 text-swu-green'
            : marca === it.n ? 'bg-swu-accent text-swu-accent-fg'
            : 'bg-swu-surface text-swu-muted'
          }`}>
            {marca > it.n ? <Check size={12} /> : it.n}
          </div>
          <span className={`text-[10px] ${marca === it.n ? 'font-bold text-swu-text' : 'text-swu-muted'}`}>
            {it.t}
          </span>
          {i < items.length - 1 && <div className="h-px flex-1 bg-swu-border" />}
        </div>
      ))}
    </div>
  )
}

function PasoInstalar({ plat, promptInstalar }: {
  plat: 'ios' | 'android'; promptInstalar: BeforeInstallPromptEvent | null
}) {
  const [lanzando, setLanzando] = useState(false)
  const instalar = async () => {
    if (!promptInstalar) return
    setLanzando(true)
    try {
      await promptInstalar.prompt()
      await promptInstalar.userChoice
    } finally { setLanzando(false) }
  }

  if (plat === 'android') {
    return (
      <div className="space-y-3 rounded-2xl border border-swu-border bg-swu-surface p-4">
        {promptInstalar ? (
          <>
            <button
              onClick={() => void instalar()}
              disabled={lanzando}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-swu-accent px-4 py-3 text-sm font-bold text-swu-accent-fg active:scale-[0.98]"
            >
              <Download size={16} /> {lanzando ? 'Instalando…' : 'Instalar la app'}
            </button>
            <p className="text-center text-[11px] text-swu-muted">
              Se abre el cuadro de Android. Tocá <strong>Instalar</strong> y después abrí la app
              desde tu pantalla de inicio.
            </p>
          </>
        ) : (
          <Manual pasos={[
            <>Tocá el menú <strong>⋮</strong> arriba a la derecha</>,
            <>Elegí <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla principal</strong></>,
            <>Confirmá y abrí <strong>HOLOCRON SWU</strong> desde tu inicio</>,
          ]} />
        )}
      </div>
    )
  }

  // iOS: no hay instalación programática. Nunca la hubo y no la va a haber.
  return (
    <div className="space-y-3 rounded-2xl border border-swu-border bg-swu-surface p-4">
      <Manual pasos={[
        <>Tocá <Share size={13} className="inline text-swu-accent-texto" /> <strong>Compartir</strong>, en la barra de abajo de Safari</>,
        <>Bajá y elegí <Plus size={13} className="inline text-swu-accent-texto" /> <strong>Añadir a pantalla de inicio</strong></>,
        <>Tocá <strong>Añadir</strong> y abrí <strong>HOLOCRON SWU</strong> desde tu inicio</>,
      ]} />
      <p className="rounded-xl bg-swu-bg/60 px-3 py-2 text-[10.5px] leading-relaxed text-swu-muted">
        En iPhone esto solo se puede desde <strong>Safari</strong>. Si estás en Chrome o en el
        navegador de otra app, copiá <strong>swusv.com</strong> y abrilo en Safari.
      </p>
    </div>
  )
}

function Manual({ pasos }: { pasos: React.ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {pasos.map((p, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-swu-accent/15 text-[10px] font-bold text-swu-accent-texto">
            {i + 1}
          </span>
          <span className="text-[12px] leading-relaxed text-swu-text">{p}</span>
        </li>
      ))}
    </ol>
  )
}

function PasoAvisos({ onPedir, pidiendo }: { onPedir?: () => void; pidiendo?: boolean }) {
  return (
    <div className="space-y-3 rounded-2xl border border-swu-border bg-swu-surface p-4">
      <div className="flex items-start gap-2.5">
        <Bell size={18} className="mt-0.5 shrink-0 text-swu-accent-texto" />
        <div>
          <p className="text-sm font-bold text-swu-text">Activá los avisos</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-swu-muted">
            Es como te enterás de que abrió la inscripción de un torneo, de que alguien te propuso
            un cambio o de que tu rival confirmó una amistosa. Sin esto la app no te avisa de nada.
          </p>
        </div>
      </div>
      <button
        onClick={onPedir}
        disabled={pidiendo}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-swu-accent px-4 py-3 text-sm font-bold text-swu-accent-fg active:scale-[0.98]"
      >
        <Bell size={16} /> {pidiendo ? 'Esperando…' : 'Activar los avisos'}
      </button>
      <p className="text-center text-[10.5px] text-swu-muted">
        El teléfono te va a preguntar. Tocá <strong>Permitir</strong>.
      </p>
    </div>
  )
}

function PasoDenegado({ plat, onRecomprobar, onSeguir }: {
  plat: 'ios' | 'android'; onRecomprobar?: () => void; onSeguir?: () => void
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-swu-amber/40 bg-swu-amber/10 p-4">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-swu-amber" />
        <div>
          <p className="text-sm font-bold text-swu-text">Los avisos están bloqueados</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-swu-muted">
            Una vez que se bloquean, la app ya no puede volver a preguntar: hay que reactivarlos a
            mano en los ajustes del teléfono.
          </p>
        </div>
      </div>

      <Manual pasos={plat === 'ios' ? [
        <>Abrí <strong>Ajustes</strong> del iPhone</>,
        <>Bajá hasta <strong>HOLOCRON SWU</strong></>,
        <>Entrá en <strong>Notificaciones</strong> y activá <strong>Permitir notificaciones</strong></>,
      ] : [
        <>Mantené pulsado el ícono de <strong>HOLOCRON SWU</strong></>,
        <>Entrá en <strong>Información de la app</strong> → <strong>Notificaciones</strong></>,
        <>Activá <strong>Todas las notificaciones</strong></>,
      ]} />

      <button
        onClick={onRecomprobar}
        className="w-full rounded-xl bg-swu-accent px-4 py-2.5 text-sm font-bold text-swu-accent-fg active:scale-[0.98]"
      >
        Ya las activé
      </button>
      <button
        onClick={onSeguir}
        className="w-full text-center text-[11px] text-swu-muted underline underline-offset-2"
      >
        Entrar sin avisos por ahora
      </button>
    </div>
  )
}
