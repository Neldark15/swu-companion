import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { syncSettingsToCloud } from '../services/sync'
import { aplicarTemaFondo, esTemaFondo, esTinteTarjeta, esMarcoElegido } from '../services/personalizacion'
import type { TemaFondoId, TinteTarjetaId, MarcoElegido } from '../services/personalizacion'
// Solo tipos y validadores (datos puros, sin React): el dibujo de la
// credencial NO entra al bundle principal por esta importación.
import { esTemaCredencial, esEmblemaCredencial } from '../features/credencial/credencialTemas'
import type { TemaCredencialId, EmblemaCredencialId } from '../features/credencial/credencialTemas'
import { useAuth } from './useAuth'

// ── Accent Color System ──
export type AccentColor = 'red' | 'green' | 'blue' | 'purple' | 'yellow' | 'white'

export const ACCENT_COLORS: Record<AccentColor, string> = {
  // Era #EF4444. Medido: con texto blanco encima daba 3,76:1, por debajo del
  // 4,5 de WCAG. #DC2626 es el rojo más cercano que sí pasa (4,83) y así los
  // botones principales conservan el texto BLANCO, que es lo que se espera de
  // un botón rojo. Los otros cinco acentos no tienen esa salida — ver abajo.
  red:    '#DC2626',
  green:  '#22C55E',
  blue:   '#60A5FA',
  purple: '#A78BFA',
  yellow: '#FACC15',
  white:  '#E2E8F0',
}

/** Negro de la marca para texto sobre un acento claro. No es #000: ese vibra
 *  sobre un color saturado. */
const TINTA_OSCURA = '#0B0B12'

function luminancia(hex: string): number {
  const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * f(v[0]) + 0.7152 * f(v[1]) + 0.0722 * f(v[2])
}

/**
 * Qué color de texto se lee encima de este acento.
 *
 * Se prefiere el BLANCO y solo se cae al oscuro cuando el blanco no llega a
 * 4,5:1, porque un botón de color con letra blanca es lo convencional y
 * cambiarlo sin necesidad se nota.
 *
 * Hacía falta de verdad: medido, los SEIS acentos elegibles fallaban con
 * blanco fijo —rojo 3,76 · verde 2,28 · azul 2,54 · púrpura 2,72 · blanco
 * 1,23— y el amarillo daba **1,53:1**, o sea texto invisible en todos los
 * botones principales de quien eligiera ese color. No era un problema del
 * rojo: era de la paleta entera.
 */
export function tintaSobreAcento(acento: string): string {
  const l = luminancia(acento)
  const conBlanco = 1.05 / (l + 0.05)
  return conBlanco >= 4.5 ? '#FFFFFF' : TINTA_OSCURA
}

export const ACCENT_LABELS: Record<AccentColor, string> = {
  red:    'Rojo',
  green:  'Verde',
  blue:   'Azul',
  purple: 'Púrpura',
  yellow: 'Amarillo',
  white:  'Blanco',
}

export function applyAccentColor(color: AccentColor) {
  const acento = ACCENT_COLORS[color]
  document.documentElement.style.setProperty('--color-swu-accent', acento)
  // La tinta que se lee ENCIMA del acento. `--color-swu-accent-texto` (el
  // acento aclarado, para leerlo sobre el fondo oscuro) se deriva solo con
  // color-mix en index.css; esta no se puede derivar en CSS porque hay que
  // mirar la luminancia para decidir, y eso CSS no lo sabe hacer.
  document.documentElement.style.setProperty('--color-swu-accent-fg', tintaSobreAcento(acento))
}

// ── Saber Colors (for XP bar lightsaber) ──
/* EL COLOR DE LA HOJA SE RETIRÓ DE LOS AJUSTES (2026-08-27).
 *
 * Había un `saberColor` con siete colores propios —incluido el ROJO, que
 * tenían puesto cuatro personas— y era lo único que pintaba la barra de XP.
 * Ahora la barra saca el color del KYBER que se forja en el Taller
 * (`hojaEnBarra` en `features/sable/partesSable.ts`), que es la fuente única y
 * la que ya decide el 3D. Dos sitios eligiendo el mismo color es el §3c.
 *
 * El rojo, de paso, deja de existir también como TIPO: en este producto no se
 * elige de una lista, se gana sangrando un cristal, y el servidor lo cierra
 * desde el primer día (`comprar_parte_sable` rechaza las piezas ocultas).
 *
 * El valor viejo puede seguir guardado en `profiles.settings.saberColor` y no
 * molesta: al no validarse, se ignora. No hace falta migrar nada.
 */

/**
 * La credencial de jugador (/credencial), personalizable de punta a punta.
 * Viaja en el MISMO JSON de profiles.settings que el resto de ajustes —
 * cero cambios de base de datos — y con la misma regla: lo que llega de la
 * nube se valida campo por campo antes de entrar al estado.
 */
export interface AjustesCredencial {
  credencialTema: TemaCredencialId
  credencialEmblema: EmblemaCredencialId
  /** Vacío = usar el título activo del perfil como apodo. */
  credencialApodo: string
  /** Vacío = usar el país de la cuenta. */
  credencialUbicacion: string
  /** Id del mazo favorito en la tabla decks; vacío = ninguno elegido. */
  credencialMazoId: string
  credencialMostrarMazo: boolean
  /**
   * El NOMBRE del líder del mazo elegido, ya resuelto y guardado.
   *
   * Resolverlo cuesta una consulta a Supabase (los mazos) más una lectura de
   * Dexie (la carta del líder). En /credencial eso está bien porque es la
   * pantalla del tema; en Inicio, donde la placa es un módulo más, sería
   * cargar la red para pintar un renglón. Así que /credencial lo deja
   * resuelto acá y las demás pantallas lo leen de una.
   */
  credencialMazoLider: string
}

interface SettingsState extends AjustesCredencial {
  theme: 'dark' | 'light'
  fontSize: 'sm' | 'md' | 'lg' | 'xl'
  hapticFeedback: boolean
  showShields: boolean
  showExperience: boolean
  showResources: boolean
  playerName: string
  accentColor: AccentColor
  // ── Personalización (catálogos en services/personalizacion.ts) ──
  temaFondo: TemaFondoId
  tinteTarjeta: TinteTarjetaId
  marcoElegido: MarcoElegido

  setTheme: (t: 'dark' | 'light') => void
  setFontSize: (s: 'sm' | 'md' | 'lg' | 'xl') => void
  toggleHaptic: () => void
  toggleCounter: (counter: 'showShields' | 'showExperience' | 'showResources') => void
  setPlayerName: (name: string) => void
  setAccentColor: (c: AccentColor) => void
  setTemaFondo: (t: TemaFondoId) => void
  setTinteTarjeta: (t: TinteTarjetaId) => void
  setMarcoElegido: (m: MarcoElegido) => void
  /** Un solo setter con parche: la pantalla edita varios campos a la vez. */
  setCredencial: (parche: Partial<AjustesCredencial>) => void
}

/** Debounced cloud sync for settings */
let syncTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSyncSettings() {
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    const { supabaseUser } = useAuth.getState()
    if (!supabaseUser) return
    const state = useSettings.getState()
    const settingsData = {
      theme: state.theme,
      fontSize: state.fontSize,
      hapticFeedback: state.hapticFeedback,
      showShields: state.showShields,
      showExperience: state.showExperience,
      showResources: state.showResources,
      playerName: state.playerName,
      accentColor: state.accentColor,
      temaFondo: state.temaFondo,
      tinteTarjeta: state.tinteTarjeta,
      marcoElegido: state.marcoElegido,
      credencialTema: state.credencialTema,
      credencialEmblema: state.credencialEmblema,
      credencialApodo: state.credencialApodo,
      credencialUbicacion: state.credencialUbicacion,
      credencialMazoId: state.credencialMazoId,
      credencialMostrarMazo: state.credencialMostrarMazo,
      credencialMazoLider: state.credencialMazoLider,
    }
    syncSettingsToCloud(supabaseUser.id, settingsData).catch(() => {})
  }, 1500)
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      fontSize: 'md',
      hapticFeedback: true,
      showShields: true,
      showExperience: true,
      showResources: true,
      playerName: '',
      accentColor: 'red',
      temaFondo: 'holocron',
      tinteTarjeta: 'auto',
      marcoElegido: 'auto',
      credencialTema: 'jedi',
      credencialEmblema: 'jedi-order',
      credencialApodo: '',
      credencialUbicacion: '',
      credencialMazoId: '',
      credencialMostrarMazo: false,
      credencialMazoLider: '',

      setTheme: (theme) => { set({ theme }); debouncedSyncSettings() },
      setFontSize: (fontSize) => { set({ fontSize }); debouncedSyncSettings() },
      toggleHaptic: () => { set((s) => ({ hapticFeedback: !s.hapticFeedback })); debouncedSyncSettings() },
      toggleCounter: (counter) => { set((s) => ({ [counter]: !s[counter] })); debouncedSyncSettings() },
      setPlayerName: (playerName) => { set({ playerName }); debouncedSyncSettings() },
      setAccentColor: (accentColor) => { set({ accentColor }); applyAccentColor(accentColor); debouncedSyncSettings() },
      setTemaFondo: (temaFondo) => { set({ temaFondo }); aplicarTemaFondo(temaFondo); debouncedSyncSettings() },
      setTinteTarjeta: (tinteTarjeta) => { set({ tinteTarjeta }); debouncedSyncSettings() },
      setMarcoElegido: (marcoElegido) => { set({ marcoElegido }); debouncedSyncSettings() },
      setCredencial: (parche) => { set(parche); debouncedSyncSettings() },
    }),
    {
      name: 'swu-settings',
      /**
       * Sanea lo que vuelve de localStorage.
       *
       * Los valores que llegan de la NUBE ya se validan uno por uno en
       * `aplicarSettingsDeNube`, pero los que restaura `persist` entraban
       * crudos — y un catálogo puede cambiar entre dos versiones de la app.
       * Pasó: la credencial nació con un juego de emblemas propio, después se
       * cambió por los íconos del perfil, y las cuentas que ya habían elegido
       * quedaron con ids como `calavera`. Al restaurarlos, la pantalla se caía
       * con «Cannot destructure property 'url'».
       *
       * Un catálogo que evoluciona es normal. Que un valor viejo tumbe una
       * pantalla, no: acá se cambia por el de por defecto y se sigue.
       */
      merge: (persistido, actual) => {
        const guardado = (persistido ?? {}) as Partial<SettingsState>
        return {
          ...actual,
          ...guardado,
          credencialTema: esTemaCredencial(guardado.credencialTema)
            ? guardado.credencialTema : actual.credencialTema,
          credencialEmblema: esEmblemaCredencial(guardado.credencialEmblema)
            ? guardado.credencialEmblema : actual.credencialEmblema,
        }
      },
    }
  )
)

/**
 * Aplica al store EN MEMORIA los settings que llegan de la nube, campo por
 * campo y VALIDADOS — un valor corrupto o desconocido se ignora y queda el
 * default, nunca entra al estado.
 *
 * Existe para la restauración de `pullAllFromCloud` (sync.ts): escribir el
 * JSON crudo a localStorage no servía, porque el store ya rehidrató con
 * defaults al arrancar — el tema/tinte/marco restaurados no se veían hasta
 * recargar y, peor, el primer ajuste que la persona tocara subía a la nube
 * los defaults en memoria, pisando la elección hecha en su otro dispositivo.
 * Pasar por `setState` arregla las dos cosas: se aplica al instante (persist
 * escribe el localStorage solo) y lo que se sincronice después ya lleva lo
 * restaurado. Los efectos visuales (acento, tema) se disparan acá mismo.
 */
export function aplicarSettingsDeNube(nube: Record<string, unknown>): void {
  const parche: Partial<SettingsState> = {}
  if (nube.theme === 'dark' || nube.theme === 'light') parche.theme = nube.theme
  if (nube.fontSize === 'sm' || nube.fontSize === 'md' || nube.fontSize === 'lg' || nube.fontSize === 'xl') parche.fontSize = nube.fontSize
  if (typeof nube.hapticFeedback === 'boolean') parche.hapticFeedback = nube.hapticFeedback
  if (typeof nube.showShields === 'boolean') parche.showShields = nube.showShields
  if (typeof nube.showExperience === 'boolean') parche.showExperience = nube.showExperience
  if (typeof nube.showResources === 'boolean') parche.showResources = nube.showResources
  if (typeof nube.playerName === 'string') parche.playerName = nube.playerName
  if (typeof nube.accentColor === 'string' && nube.accentColor in ACCENT_COLORS) parche.accentColor = nube.accentColor as AccentColor
  if (esTemaFondo(nube.temaFondo)) parche.temaFondo = nube.temaFondo
  if (esTinteTarjeta(nube.tinteTarjeta)) parche.tinteTarjeta = nube.tinteTarjeta
  if (esMarcoElegido(nube.marcoElegido)) parche.marcoElegido = nube.marcoElegido
  if (esTemaCredencial(nube.credencialTema)) parche.credencialTema = nube.credencialTema
  if (esEmblemaCredencial(nube.credencialEmblema)) parche.credencialEmblema = nube.credencialEmblema
  if (typeof nube.credencialApodo === 'string') parche.credencialApodo = nube.credencialApodo
  if (typeof nube.credencialUbicacion === 'string') parche.credencialUbicacion = nube.credencialUbicacion
  if (typeof nube.credencialMazoId === 'string') parche.credencialMazoId = nube.credencialMazoId
  if (typeof nube.credencialMostrarMazo === 'boolean') parche.credencialMostrarMazo = nube.credencialMostrarMazo
  if (Object.keys(parche).length === 0) return
  useSettings.setState(parche)
  if (parche.accentColor) applyAccentColor(parche.accentColor)
  if (parche.temaFondo) aplicarTemaFondo(parche.temaFondo)
}
