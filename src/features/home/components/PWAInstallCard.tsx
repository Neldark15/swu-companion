/**
 * PWAInstallCard — instrucciones de instalación de la PWA por plataforma.
 *
 * Comportamiento:
 * - Si la app ya está instalada (display-mode standalone), muestra confirmación.
 * - Si el navegador dispara beforeinstallprompt (Chrome/Edge/Android), muestra
 *   un botón "Instalar app" que llama prompt() nativo.
 * - Si es iOS Safari, muestra los pasos manuales (Compartir → Añadir a Inicio).
 * - Si es Mac Safari, muestra Compartir → Añadir al Dock.
 * - Si es otro escritorio sin prompt, muestra instrucción genérica.
 */

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Download, Share, Plus, Smartphone, Monitor, Apple } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Platform = 'ios' | 'android' | 'mac-safari' | 'desktop' | 'unknown'

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isAndroid = /Android/.test(ua)
  const isMacSafari = /Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Edg|OPR/.test(ua)
  const isMobile = isIOS || isAndroid

  if (isIOS) return 'ios'
  if (isAndroid) return 'android'
  if (isMacSafari) return 'mac-safari'
  if (!isMobile) return 'desktop'
  return 'unknown'
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  // iOS legacy property
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true
}

export function PWAInstallCard() {
  const platform = useMemo(() => detectPlatform(), [])
  const [standalone, setStandalone] = useState<boolean>(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installing, setInstalling] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    setStandalone(isStandalone())

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    const onAppInstalled = () => {
      setInstalled(true)
      setInstallPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const triggerInstall = async () => {
    if (!installPrompt) return
    setInstalling(true)
    try {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice
      if (choice.outcome === 'accepted') setInstalled(true)
    } catch {
      // user dismissed or error — silent
    }
    setInstalling(false)
    setInstallPrompt(null)
  }

  if (standalone || installed) {
    return (
      <div className="bg-swu-green/10 border border-swu-green/30 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-swu-green/15 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 size={20} className="text-swu-green" />
        </div>
        <div>
          <p className="text-sm font-bold text-swu-green">App instalada</p>
          <p className="text-[11px] text-swu-muted mt-0.5">
            Tenés HOLOCRON SWU corriendo como PWA — recibís notificaciones, funciona offline parcialmente.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-swu-surface rounded-2xl border border-swu-accent/30 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-swu-accent/10 to-swu-amber/5 p-4 border-b border-swu-border">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-lg bg-swu-accent/15 flex items-center justify-center flex-shrink-0">
            <Download size={20} className="text-swu-accent" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-swu-text">Instalá HOLOCRON SWU</h3>
            <p className="text-[11px] text-swu-muted mt-0.5">
              Acceso desde el ícono del teléfono, modo offline, notificaciones push.
            </p>
          </div>
        </div>
      </div>

      {/* Programmatic install (Android Chrome / Desktop Chrome/Edge) */}
      {installPrompt && (
        <div className="p-4 border-b border-swu-border">
          <button
            onClick={triggerInstall}
            disabled={installing}
            className="w-full py-2.5 rounded-lg bg-swu-accent text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
          >
            <Download size={14} />
            {installing ? 'Instalando…' : 'Instalar ahora'}
          </button>
        </div>
      )}

      {/* Platform-specific instructions */}
      <div className="p-4 space-y-3">
        {platform === 'ios' && <IOSSteps />}
        {platform === 'android' && <AndroidSteps hasPrompt={!!installPrompt} />}
        {platform === 'mac-safari' && <MacSafariSteps />}
        {platform === 'desktop' && <DesktopSteps hasPrompt={!!installPrompt} />}
        {platform === 'unknown' && <GenericSteps />}
      </div>
    </div>
  )
}

// ─── Platform-specific step blocks ────────────────────────

function IOSSteps() {
  return (
    <>
      <PlatformHeader icon={Apple} label="iPhone / iPad" />
      <Step n={1}>
        Tocá el ícono <ShareIcon /> <strong>Compartir</strong> (en iOS 17/18 está
        en la barra inferior de Safari, al medio).
      </Step>
      <Step n={2}>
        Desplazate hacia abajo en el menú y tocá <PlusIcon /> <strong>Añadir a pantalla de inicio</strong>.
      </Step>
      <Step n={3}>
        Tocá <strong>Añadir</strong> arriba a la derecha.
      </Step>
      <Step n={4}>
        Abrí HOLOCRON SWU desde el <strong>ícono nuevo</strong> en tu pantalla principal
        (no desde Safari) para tener notificaciones push, modo offline y experiencia full app.
      </Step>
      <Note>
        ⚠️ <strong>En iOS las notificaciones push solo funcionan si entrás desde el ícono instalado.</strong>
        Si entrás a swusv.com en Safari, las notificaciones quedan deshabilitadas (limitación de Apple).
      </Note>
    </>
  )
}

function AndroidSteps({ hasPrompt }: { hasPrompt: boolean }) {
  return (
    <>
      <PlatformHeader icon={Smartphone} label="Android" />
      {hasPrompt ? (
        <p className="text-[12px] text-swu-muted">
          Tu navegador soporta instalación directa — tocá el botón <strong>Instalar ahora</strong> arriba.
        </p>
      ) : (
        <>
          <Step n={1}>
            En Chrome, tocá los <strong>3 puntos</strong> arriba a la derecha.
          </Step>
          <Step n={2}>
            Tocá <strong>Instalar aplicación</strong> (o "Agregar a pantalla de inicio").
          </Step>
          <Step n={3}>
            Confirmá. El ícono aparece en tu drawer y pantalla de inicio.
          </Step>
        </>
      )}
    </>
  )
}

function MacSafariSteps() {
  return (
    <>
      <PlatformHeader icon={Apple} label="Mac Safari" />
      <Step n={1}>
        En Safari, click el menú <strong>Archivo</strong> arriba a la izquierda.
      </Step>
      <Step n={2}>
        Click <strong>Añadir al Dock…</strong> (requiere macOS Sonoma 14+).
      </Step>
      <Step n={3}>
        Confirmar nombre y click <strong>Añadir</strong>. Aparece como app independiente en el Dock.
      </Step>
      <Note>
        Si no ves la opción Añadir al Dock, abrí con Chrome o Edge — esos sí dan botón directo.
      </Note>
    </>
  )
}

function DesktopSteps({ hasPrompt }: { hasPrompt: boolean }) {
  return (
    <>
      <PlatformHeader icon={Monitor} label="Escritorio (Chrome / Edge)" />
      {hasPrompt ? (
        <p className="text-[12px] text-swu-muted">
          Tu navegador soporta instalación — tocá <strong>Instalar ahora</strong> arriba.
        </p>
      ) : (
        <>
          <Step n={1}>
            En la barra de direcciones, buscá el ícono <Download className="inline" size={12} /> <strong>Instalar</strong>
            (al final de la URL).
          </Step>
          <Step n={2}>
            Click → <strong>Instalar</strong>. La app se abre como ventana independiente.
          </Step>
        </>
      )}
    </>
  )
}

function GenericSteps() {
  return (
    <>
      <PlatformHeader icon={Download} label="Tu navegador" />
      <p className="text-[12px] text-swu-muted">
        Buscá en el menú de tu navegador la opción <strong>Instalar aplicación</strong>,
        <strong> Añadir a inicio</strong> o <strong>Añadir al escritorio</strong>.
      </p>
    </>
  )
}

// ─── Tiny helpers ─────────────────────────────────────────

function PlatformHeader({ icon: Icon, label }: { icon: typeof Apple; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-swu-amber font-bold">
      <Icon size={12} />
      <span>{label}</span>
    </div>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 text-[12px] text-swu-text leading-relaxed">
      <span className="w-5 h-5 rounded-full bg-swu-accent/20 text-swu-accent text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
        {n}
      </span>
      <p>{children}</p>
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-swu-amber/10 border border-swu-amber/30 rounded-lg p-2.5 text-[11px] text-swu-muted leading-relaxed mt-2">
      {children}
    </div>
  )
}

function ShareIcon() {
  return <Share size={11} className="inline align-text-bottom" />
}
function PlusIcon() {
  return <Plus size={11} className="inline align-text-bottom" />
}
