/**
 * SettingsPage — la configuración, organizada por lo que cada control TOCA:
 *
 * - «Apariencia»: lo que repinta la app entera (acento + tema de fondo).
 * - «Tarjeta de jugador»: lo que solo vive en la tarjeta (tinte del nombre y
 *   el sable de la barra de XP), con la tarjeta REAL montada arriba como
 *   vista previa — la gracia de personalizar es ver el cambio, no imaginarlo.
 * - «Marco del avatar»: los 7 marcos que se ganan por nivel. Los no ganados
 *   se ven atenuados con candado y su «Nv. X»: verlos es el incentivo.
 *
 * Cada control aplica al instante: los setters de useSettings persisten en
 * localStorage y sincronizan a la nube solos, así que acá no hay botón de
 * guardar ni estado intermedio que se pueda desincronizar.
 */

import { useState, useEffect } from 'react'
import {
  ChevronLeft, Palette, Type, Vibrate, MessageSquare, Shield, Info,
  Smartphone, Check, KeyRound, Eye, EyeOff, Zap, Layers, Brush, Frame, Lock, Languages,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { useIdioma, useT, type Idioma } from '../../services/i18n'
import { useSettings, ACCENT_COLORS, ACCENT_LABELS, SABER_COLORS } from '../../hooks/useSettings'
import type { AccentColor, SaberColor } from '../../hooks/useSettings'
import {
  TEMAS_FONDO, TINTES_TARJETA, ORDEN_TINTES, MARCOS,
  marcoGanado, resolverMarco, esTemaFondo, esTinteTarjeta,
} from '../../services/personalizacion'
import type { MarcoPerfil } from '../../services/personalizacion'
import { useAuth } from '../../hooks/useAuth'
import { db } from '../../services/db'
import { calculateLevel, type PlayerStats } from '../../services/gamification'
import { TarjetaJugador } from '../profile/TarjetaJugador'
import { PushNotificationToggle } from './components/PushNotificationToggle'

/**
 * El swatch de 'auto' no es un color: es «el color de tu RANGO decide».
 * Se pinta como una vuelta por los colores reales de los 7 rangos (los de
 * RANKS en gamification.ts, en orden; el último repite el primero para
 * cerrar el cónico), para que se entienda que va cambiando con vos.
 * OJO: son colores de rango, no de marco — el marco 'auto' tiene su propio
 * swatch (la MiniMarco del más alto ganado) y su paleta es otra.
 */
const GRADIENTE_AUTO =
  'conic-gradient(from 45deg, #9CA3AF, #60A5FA, #4ADE80, #FACC15, #FBBF24, #FCD34D, #FDE047, #9CA3AF)'

/** Las cuatro esquinas decorativas de los marcos ricos, como clases de posición. */
const ESQUINAS_MINI = [
  '-top-0.5 -left-0.5', '-top-0.5 -right-0.5',
  '-bottom-0.5 -left-0.5', '-bottom-0.5 -right-0.5',
]

/**
 * Miniatura CUADRADA de un marco para la cuadrícula del picker. Es un boceto
 * del marco real (borde, glow estático, esquinas), no el marco entero: acá
 * solo hace falta distinguirlos y ver cuál está elegido.
 *
 * El pulso de los marcos animados va con animate-pulse, que solo anima
 * opacidad — nada de filter/blur (doctrina del repo: teléfonos de gama baja).
 */
function MiniMarco({ marco, activo, ganado }: { marco: MarcoPerfil; activo: boolean; ganado: boolean }) {
  return (
    <div
      className="relative w-12 h-12 rounded-xl flex items-center justify-center bg-swu-bg"
      style={{
        border: `2px solid ${marco.borde}`,
        boxShadow: activo
          ? `0 0 0 2px var(--color-swu-surface), 0 0 0 4px var(--color-swu-accent), 0 0 10px ${marco.brillo}40`
          : `0 0 10px ${marco.brillo}40`,
      }}
    >
      {marco.esquinas && ESQUINAS_MINI.map((pos) => (
        <span
          key={pos}
          className={`absolute ${pos} w-1.5 h-1.5 rounded-[2px]`}
          style={{ backgroundColor: marco.brillo }}
        />
      ))}
      {marco.animado && (
        <span
          className="absolute inset-0.5 rounded-[9px] animate-pulse motion-reduce:animate-none pointer-events-none"
          style={{ border: `1px solid ${marco.brillo}` }}
        />
      )}
      {/* El candado dice «todavía no» sin depender del color (atenuado). */}
      {!ganado
        ? <Lock size={14} className="text-swu-muted" aria-label="Bloqueado" />
        : activo && <Check size={16} className="text-swu-text" strokeWidth={3} />}
    </div>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const {
    accentColor, setAccentColor, fontSize, setFontSize, hapticFeedback, toggleHaptic,
    saberColor, setSaberColor,
    temaFondo, setTemaFondo, tinteTarjeta, setTinteTarjeta, marcoElegido, setMarcoElegido,
  } = useSettings()
  const auth = useAuth()
  const t = useT()
  const idioma = useIdioma((s) => s.idioma)
  const cambiarIdioma = useIdioma((s) => s.cambiarIdioma)
  const [showAbout, setShowAbout] = useState(false)

  // ── Stats reales para la vista previa y el nivel de los marcos ──
  // Mismo camino que HomePage: la fila de playerStats en Dexie. Sin stats el
  // nivel es 1 — solo el primer marco ganado, que es la verdad de una cuenta
  // que recién empieza.
  const [statsJugador, setStatsJugador] = useState<PlayerStats | null>(null)
  useEffect(() => {
    if (!auth.currentProfile) return
    let vivo = true
    db.playerStats.get(auth.currentProfile.id)
      .then((s) => { if (vivo && s) setStatsJugador(s) })
      .catch(() => {})
    return () => { vivo = false }
  }, [auth.currentProfile])

  const nivel = statsJugador ? calculateLevel(statsJugador.xp).level : 1

  // Los pickers marcan siempre lo EFECTIVO, no lo guardado: si el valor
  // guardado está corrupto (localStorage editado, datos viejos), la app se
  // comporta como con el default — el picker tiene que marcar ESE default,
  // no quedarse sin ninguna opción activa. Misma regla que ya tenía el de
  // marcos, extendida a tema y tinte.
  const temaActivo = esTemaFondo(temaFondo) ? temaFondo : 'holocron'
  const tinteActivo = esTinteTarjeta(tinteTarjeta) ? tinteTarjeta : 'auto'

  // El marco que la cuadrícula marca como activo. Si lo guardado no está
  // ganado (datos viejos), lo efectivo es 'auto' — misma regla que
  // resolverMarco, para que el picker no marque algo que no se muestra.
  const marcoActivo = marcoElegido !== 'auto' && marcoGanado(marcoElegido, nivel)
    ? marcoElegido
    : 'auto'
  /** Lo que 'auto' significa HOY para este nivel: el más alto ganado. */
  const marcoAuto = resolverMarco('auto', nivel)

  // Change password state
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [newPwd, setNewPwd] = useState('')
  const [newPwdConfirm, setNewPwdConfirm] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [pwdSuccess, setPwdSuccess] = useState(false)
  const [pwdLoading, setPwdLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)

  const handleChangePassword = async () => {
    setPwdError('')
    if (newPwd.length < 6) { setPwdError('La contraseña debe tener al menos 6 caracteres'); return }
    if (newPwd !== newPwdConfirm) { setPwdError('Las contraseñas no coinciden'); return }
    setPwdLoading(true)
    const result = await auth.updatePassword(newPwd)
    setPwdLoading(false)
    if (!result.ok) { setPwdError(result.error || 'Error al actualizar'); return }
    setPwdSuccess(true)
    setNewPwd('')
    setNewPwdConfirm('')
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 pb-8 lg:pb-8 max-w-5xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-swu-muted">
        <ChevronLeft size={18} /> {t('Volver', 'Back')}
      </button>

      <h2 className="text-lg font-bold text-swu-text">{t('Configuración', 'Settings')}</h2>

      {/* ── Idioma — lo primero: cambia TODA la app ── */}
      <div>
        <p className="text-[10px] text-swu-muted uppercase tracking-wider font-bold mb-2 px-1">{t('Idioma', 'Language')}</p>
        <div className="bg-swu-surface rounded-2xl p-3 space-y-2">
          <div className="flex items-center gap-3">
            <Languages size={20} className="text-swu-accent-texto" />
            <span className="text-sm font-medium text-swu-text">{t('Idioma de la app', 'App language')}</span>
          </div>
          <SegmentedControl<Idioma>
            label={t('Idioma', 'Language')}
            value={idioma}
            onChange={cambiarIdioma}
            options={[
              { value: 'es', label: 'Español' },
              { value: 'en', label: 'English' },
            ]}
          />
          <p className="text-[10px] text-swu-muted">
            {t(
              'La app se recarga para aplicar el idioma. La traducción avanza por partes: el contenido de las cartas ya es bilingüe.',
              'The app reloads to apply the language. Translation is rolling out in phases: card content is already bilingual.',
            )}
          </p>
        </div>
      </div>

      {/* Notifications */}
      <div>
        <p className="text-[10px] text-swu-muted uppercase tracking-wider font-bold mb-2 px-1">{t('Notificaciones', 'Notifications')}</p>
        <PushNotificationToggle />
      </div>

      {/* ── Apariencia: lo que repinta la app ENTERA ── */}
      <div>
        <p className="text-[10px] text-swu-muted uppercase tracking-wider font-bold mb-2 px-1">Apariencia</p>
        <div className="bg-swu-surface rounded-2xl overflow-hidden">
          {/* Accent Color Picker */}
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Palette size={20} className="text-swu-accent-texto" />
              <span className="text-sm font-medium text-swu-text">Color de acento</span>
            </div>
            <div className="flex gap-3 justify-center">
              {(Object.keys(ACCENT_COLORS) as AccentColor[]).map((color) => (
                <button
                  key={color}
                  onClick={() => setAccentColor(color)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 ${
                      accentColor === color
                        ? 'scale-110'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: ACCENT_COLORS[color],
                      boxShadow: accentColor === color
                        ? `0 0 20px ${ACCENT_COLORS[color]}50, 0 0 0 3px var(--color-swu-surface), 0 0 0 5px ${ACCENT_COLORS[color]}`
                        : 'var(--neu-shadow-sm)',
                    }}
                  >
                    {accentColor === color && <Check size={18} className="text-white" strokeWidth={3} />}
                  </div>
                  <span className={`text-[10px] font-mono tracking-wider ${
                    accentColor === color ? 'text-swu-text font-bold' : 'text-swu-muted'
                  }`}>
                    {ACCENT_LABELS[color]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Tema de fondo ──
              Cada tarjetita se pinta con los colores REALES del tema (bg
              afuera, surface adentro, dos líneas falsas de texto): un mini
              boceto de la app, no un nombre que hay que creerse. Al tocar,
              setTemaFondo repinta la app entera al instante — esa es la
              gracia: verla cambiar debajo del dedo. */}
          <div className="border-t border-swu-border/30 p-4">
            <div className="flex items-center gap-3 mb-3">
              <Layers size={20} className="text-swu-accent-texto" />
              <span className="text-sm font-medium text-swu-text">Tema de fondo</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {TEMAS_FONDO.map((tema) => {
                const activo = temaActivo === tema.id
                return (
                  <button
                    key={tema.id}
                    onClick={() => setTemaFondo(tema.id)}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div
                      className={`relative w-full h-12 rounded-lg p-1.5 transition-all duration-200 ${
                        activo ? 'ring-2 ring-swu-accent' : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: tema.bg, border: `1px solid ${tema.border}` }}
                    >
                      <div
                        className="h-full rounded-md px-1.5 py-1 space-y-1"
                        style={{ backgroundColor: tema.surface }}
                      >
                        {/* Dos «líneas de texto» con los colores reales de texto y muted. */}
                        <div className="h-1 w-3/4 rounded-full" style={{ backgroundColor: '#E2E8F0', opacity: 0.85 }} />
                        <div className="h-1 w-1/2 rounded-full" style={{ backgroundColor: '#7C8BA1' }} />
                      </div>
                      {activo && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-swu-accent flex items-center justify-center">
                          <Check size={10} className="text-white" strokeWidth={4} />
                        </span>
                      )}
                    </div>
                    <span className={`text-[9px] font-mono tracking-wide ${
                      activo ? 'text-swu-text font-bold' : 'text-swu-muted'
                    }`}>
                      {tema.etiqueta}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="border-t border-swu-border/30 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Type size={20} className="text-swu-muted" />
              <span className="text-sm font-medium text-swu-text">Tamaño de fuente</span>
            </div>
            <div className="flex gap-1">
              {(['sm', 'md', 'lg', 'xl'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFontSize(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                    fontSize === s ? 'bg-swu-accent text-white' : 'bg-swu-bg text-swu-muted neu-inset'
                  }`}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-swu-border/30 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Vibrate size={20} className="text-swu-muted" />
              <span className="text-sm font-medium text-swu-text">Haptic feedback</span>
            </div>
            {/* El estado del interruptor vivía SOLO en el color y en dónde
                queda la bolita: un lector de pantalla anunciaba «botón» y
                nada más — ni qué controla ni si está encendido. */}
            <button
              onClick={toggleHaptic}
              role="switch"
              aria-checked={hapticFeedback}
              aria-label="Haptic feedback"
              className={`w-12 h-7 rounded-full transition-colors ${hapticFeedback ? 'bg-swu-accent' : 'bg-swu-bg neu-inset'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform mx-1 ${hapticFeedback ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Tarjeta de jugador: tinte del nombre/rango + sable ── */}
      <div>
        <p className="text-[10px] text-swu-muted uppercase tracking-wider font-bold mb-2 px-1">Tarjeta de jugador</p>
        <div className="bg-swu-surface rounded-2xl overflow-hidden">
          {/* Vista previa EN VIVO: la misma TarjetaJugador del inicio y el
              perfil, con el perfil y las stats reales. Los pickers de abajo
              escriben en useSettings y la tarjeta lee de ahí, así que cada
              toque se ve acá arriba sin cablear nada. */}
          {auth.currentProfile && (
            <div className="p-4 border-b border-swu-border/30">
              <TarjetaJugador perfil={auth.currentProfile} stats={statsJugador} />
            </div>
          )}

          {/* Tinte del nombre y el rango */}
          <div className="p-4">
            <div className="flex items-center gap-3 mb-1">
              <Brush size={20} className="text-swu-accent-texto" />
              <span className="text-sm font-medium text-swu-text">Tinte del nombre</span>
            </div>
            <p className="text-[10px] text-swu-muted mb-3 pl-8">
              Auto: el color de tu rango decide.
            </p>
            <div className="flex gap-2 justify-center flex-wrap">
              {ORDEN_TINTES.map((id) => {
                const tinte = id === 'auto' ? null : TINTES_TARJETA[id]
                const activo = tinteActivo === id
                return (
                  <button
                    key={id}
                    onClick={() => setTinteTarjeta(id)}
                    className="flex flex-col items-center gap-1"
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                        activo ? 'scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{
                        background: tinte
                          ? `radial-gradient(circle, ${tinte.nucleo} 40%, ${tinte.brillo} 100%)`
                          : GRADIENTE_AUTO,
                        boxShadow: activo
                          ? `0 0 16px ${tinte ? tinte.nucleo : 'var(--color-swu-accent)'}, 0 0 0 2px var(--color-swu-surface), 0 0 0 4px ${tinte ? tinte.nucleo : 'var(--color-swu-accent)'}`
                          : tinte ? `0 0 8px ${tinte.nucleo}30` : 'var(--neu-shadow-sm)',
                      }}
                    >
                      {activo && <Check size={16} className="text-white" strokeWidth={3} style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.5))' }} />}
                    </div>
                    <span className={`text-[9px] font-mono ${activo ? 'text-swu-text font-bold' : 'text-swu-muted'}`}>
                      {tinte ? tinte.etiqueta : 'Auto'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Saber Color Picker — vive acá porque el sable ES parte de la
              tarjeta (la barra de XP), no de la app entera. */}
          <div className="border-t border-swu-border/30 p-4">
            <div className="flex items-center gap-3 mb-3">
              <Zap size={20} className="text-swu-accent-texto" />
              <span className="text-sm font-medium text-swu-text">Color de sable de luz</span>
            </div>
            <div className="flex gap-2 justify-center flex-wrap">
              {(Object.keys(SABER_COLORS) as SaberColor[]).map((color) => (
                <button
                  key={color}
                  onClick={() => setSaberColor(color)}
                  className="flex flex-col items-center gap-1"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                      saberColor === color ? 'scale-110' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{
                      background: `radial-gradient(circle, ${SABER_COLORS[color].core} 40%, ${SABER_COLORS[color].glow} 100%)`,
                      boxShadow: saberColor === color
                        ? `0 0 16px ${SABER_COLORS[color].core}80, 0 0 0 2px var(--color-swu-surface), 0 0 0 4px ${SABER_COLORS[color].core}`
                        : `0 0 8px ${SABER_COLORS[color].core}30`,
                    }}
                  >
                    {saberColor === color && <Check size={16} className="text-white" strokeWidth={3} style={{ filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.5))' }} />}
                  </div>
                  <span className={`text-[9px] font-mono ${saberColor === color ? 'text-swu-text font-bold' : 'text-swu-muted'}`}>
                    {SABER_COLORS[color].label}
                  </span>
                </button>
              ))}
            </div>
            {/* Mini preview bar */}
            <div className="mt-3 mx-4 h-2 rounded-full overflow-hidden bg-black/40">
              <div
                className="h-full rounded-full w-3/4 transition-all duration-500"
                style={{
                  background: `linear-gradient(90deg, ${SABER_COLORS[saberColor].glow}, ${SABER_COLORS[saberColor].core} 60%, white)`,
                  boxShadow: `0 0 8px ${SABER_COLORS[saberColor].core}, 0 0 16px ${SABER_COLORS[saberColor].core}60`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Marco del avatar: uno por rango, ganado es ganado ── */}
      <div>
        <p className="text-[10px] text-swu-muted uppercase tracking-wider font-bold mb-2 px-1">Marco del avatar</p>
        <div className="bg-swu-surface rounded-2xl overflow-hidden">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-1">
              <Frame size={20} className="text-swu-accent-texto" />
              <span className="text-sm font-medium text-swu-text">Marco de la fotografía</span>
            </div>
            <p className="text-[10px] text-swu-muted mb-3 pl-8">
              Se ganan subiendo de nivel y no se pierden: elegí cualquiera que ya
              hayas alcanzado. Tu nivel: {nivel}.
            </p>
            <div className="grid grid-cols-4 gap-3 justify-items-center">
              {/* 'Auto' primero: muestra lo que significa HOY (el más alto
                  ganado), no un dibujo genérico. */}
              <button
                onClick={() => setMarcoElegido('auto')}
                className="flex flex-col items-center gap-1"
              >
                <MiniMarco marco={marcoAuto} activo={marcoActivo === 'auto'} ganado />
                <span className={`text-[9px] font-mono text-center leading-tight ${
                  marcoActivo === 'auto' ? 'text-swu-text font-bold' : 'text-swu-muted'
                }`}>
                  Auto
                </span>
              </button>

              {MARCOS.map((marco) => {
                const ganado = marcoGanado(marco.id, nivel)
                const activo = marcoActivo === marco.id
                return (
                  <button
                    key={marco.id}
                    onClick={() => ganado && setMarcoElegido(marco.id)}
                    disabled={!ganado}
                    className={`flex flex-col items-center gap-1 ${ganado ? '' : 'opacity-40 cursor-not-allowed'}`}
                    aria-label={ganado ? marco.nombre : `${marco.nombre} — se gana en el nivel ${marco.minLevel}`}
                  >
                    <MiniMarco marco={marco} activo={activo} ganado={ganado} />
                    <span className={`text-[9px] font-mono text-center leading-tight ${
                      activo ? 'text-swu-text font-bold' : 'text-swu-muted'
                    }`}>
                      {marco.nombre}
                    </span>
                    {!ganado && (
                      <span className="text-[8px] text-swu-muted font-mono">Nv. {marco.minLevel}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Change Password — only for logged-in users */}
      {auth.currentProfile && auth.supabaseUser && (
        <div>
          <p className="text-[10px] text-swu-muted uppercase tracking-wider font-bold mb-2 px-1">Seguridad</p>
          <div className="bg-swu-surface rounded-2xl overflow-hidden">
            <button
              onClick={() => { setShowChangePassword(!showChangePassword); setPwdSuccess(false); setPwdError(''); setNewPwd(''); setNewPwdConfirm('') }}
              className="w-full p-4 flex items-center gap-3 active:bg-swu-bg transition-colors"
            >
              <KeyRound size={20} className="text-swu-accent-texto" />
              <span className="flex-1 text-left text-sm font-medium text-swu-text">Cambiar Contraseña</span>
              <ChevronLeft size={16} className={`text-swu-muted transition-transform ${showChangePassword ? '-rotate-90' : ''}`} />
            </button>

            {showChangePassword && (
              <div className="border-t border-swu-border/30 px-4 py-4 space-y-3">
                {!pwdSuccess ? (
                  <>
                    <div>
                      <p className="text-xs text-swu-muted mb-1.5">Nueva Contraseña (mínimo 6 caracteres)</p>
                      <div className="relative">
                        <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-swu-muted" />
                        <input type={showPwd ? 'text' : 'password'} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="••••••••"
                          className="w-full bg-swu-bg border border-swu-border rounded-xl p-2.5 pl-9 pr-10 text-sm text-swu-text outline-none focus:border-swu-accent" />
                        <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-swu-muted">
                          {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-swu-muted mb-1.5">Confirmar Nueva Contraseña</p>
                      <input type={showPwd ? 'text' : 'password'} value={newPwdConfirm} onChange={(e) => setNewPwdConfirm(e.target.value)} placeholder="••••••••"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleChangePassword() }}
                        className="w-full bg-swu-bg border border-swu-border rounded-xl p-2.5 text-sm text-swu-text outline-none focus:border-swu-accent" />
                    </div>
                    {pwdError && <p className="text-xs text-swu-red-texto text-center font-medium">{pwdError}</p>}
                    <button onClick={handleChangePassword} disabled={pwdLoading}
                      className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${!pwdLoading ? 'bg-swu-accent text-white active:scale-[0.98]' : 'bg-swu-border text-swu-muted'}`}>
                      {pwdLoading ? 'Actualizando...' : 'Cambiar Contraseña'}
                    </button>
                  </>
                ) : (
                  <div className="bg-swu-green/10 rounded-lg p-3 border border-swu-green/30 text-center">
                    <p className="text-sm text-swu-green font-bold">Contraseña actualizada</p>
                    <p className="text-[10px] text-swu-muted mt-0.5">Su nueva contraseña ya está activa</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* App Info */}
      <div>
        <p className="text-[10px] text-swu-muted uppercase tracking-wider font-bold mb-2 px-1">Aplicación</p>
        <div className="bg-swu-surface rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowAbout(!showAbout)}
            className="w-full p-4 flex items-center gap-3 active:bg-swu-bg transition-colors"
          >
            <Info size={20} className="text-swu-accent-texto" />
            <span className="flex-1 text-left text-sm font-medium text-swu-text">Acerca de</span>
            <ChevronLeft size={16} className={`text-swu-muted transition-transform ${showAbout ? '-rotate-90' : ''}`} />
          </button>

          {showAbout && (
            <div className="border-t border-swu-border px-4 py-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-swu-muted">Versión</span>
                <span className="text-swu-text font-mono">1.0.0</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-swu-muted">Plataforma</span>
                <span className="text-swu-text font-mono">PWA</span>
              </div>
              <p className="text-[10px] text-swu-muted pt-1">
                Todos los datos se sincronizan automáticamente con su cuenta en la nube.
              </p>
            </div>
          )}

          <div className="border-t border-swu-border" />

          <button className="w-full p-4 flex items-center gap-3 active:bg-swu-bg transition-colors">
            <Smartphone size={20} className="text-swu-muted" />
            <div className="flex-1 text-left">
              <span className="text-sm font-medium text-swu-text block">Instalar App</span>
              <span className="text-[10px] text-swu-muted">Agregue al inicio para acceso rápido</span>
            </div>
          </button>

          <div className="border-t border-swu-border" />

          <button className="w-full p-4 flex items-center gap-3 active:bg-swu-bg transition-colors">
            <MessageSquare size={20} className="text-swu-muted" />
            <span className="text-sm font-medium text-swu-text">Feedback</span>
          </button>

          <div className="border-t border-swu-border" />

          <button className="w-full p-4 flex items-center gap-3 active:bg-swu-bg transition-colors">
            <Shield size={20} className="text-swu-muted" />
            <span className="text-sm font-medium text-swu-text">Legal / Privacidad</span>
          </button>
        </div>
      </div>

      <p className="text-[11px] text-swu-muted text-center pt-2">
        HOLOCRON SWU v1.0.0 · Fan-made · No afiliado a FFG/Lucasfilm/Disney
      </p>
    </div>
  )
}
