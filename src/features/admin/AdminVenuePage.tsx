/**
 * AdminVenuePage — crear y personalizar MI sede.
 *
 * Cada administrador registra una sola sede; la regla la aplica la base con
 * `unique(owner_id)`, así que si alguien llega acá con una ya creada, la
 * pantalla entra en modo edición en vez de ofrecerle crear otra.
 *
 * ── Por qué la vista previa está arriba ───────────────────────────────
 *
 * Lo que se personaliza acá lo ve el resto de la comunidad. Con la previa
 * pegada al formulario se ve el resultado mientras se escribe, en vez de tener
 * que guardar, ir a la página pública y volver.
 */

import { useState, useEffect, useRef } from 'react'
import {
  Store, MapPin, Phone, Clock, Image as ImageIcon, Trash2, Save,
  ExternalLink, AlertTriangle, Check, Loader2, Eye,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../hooks/useAuth'
import {
  miSede, crearSede, actualizarSede, subirImagen, borrarImagen,
  ACENTOS, type Sede, type SedeEditable, type AcentoSede,
} from '../../services/venuesService'
import { HUD_TEXTO } from '../../components/hudTones'
import { SedeCabecera } from '../venues/SedeCabecera'

/** Muestra del color en el selector de acento. */
const PUNTO: Record<AcentoSede, string> = {
  cyan: 'bg-swu-cyan', amber: 'bg-swu-amber', green: 'bg-swu-green',
  red: 'bg-swu-red', purple: 'bg-purple-400',
}

const VACIA: SedeEditable = {
  name: '', address: '', phone: null, city: null, notes: null,
  description: null, banner_url: null, logo_url: null,
  accent: 'cyan', schedule: null, instagram: null, whatsapp: null, maps_url: null,
}

/** Los campos opcionales se guardan como null y no como '': un string vacío
 *  pasa los CHECK de formato y deja basura en la base. */
const limpio = (v: string) => {
  const t = v.trim()
  return t === '' ? null : t
}

function Campo({
  label, valor, onChange, placeholder, icono, ayuda, maxLength, multilinea,
}: {
  label: string
  valor: string
  onChange: (v: string) => void
  placeholder?: string
  icono?: React.ReactNode
  ayuda?: string
  maxLength?: number
  multilinea?: boolean
}) {
  const clases = 'w-full bg-swu-bg border border-swu-border rounded-lg px-3 py-2 text-sm text-swu-text outline-none focus:border-swu-accent'
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-swu-muted mb-1">
        {icono}{label}
      </span>
      {multilinea
        ? <textarea value={valor} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            maxLength={maxLength} rows={3} className={`${clases} resize-none`} />
        : <input value={valor} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            maxLength={maxLength} className={clases} />}
      {ayuda && <span className="block text-[10px] text-swu-muted/70 mt-0.5">{ayuda}</span>}
    </label>
  )
}

export function AdminVenuePage() {
  const { supabaseUser, currentProfile } = useAuth()
  const uid = supabaseUser?.id ?? ''

  const [sede, setSede] = useState<Sede | null>(null)
  const [form, setForm] = useState<SedeEditable>(VACIA)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState<'banner' | 'logo' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const bannerRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let vivo = true
    // Sin sesión no hay nada que consultar, pero igual hay que salir del
    // estado de carga: se resuelve dentro del mismo camino asíncrono para no
    // llamar a setState en seco durante el efecto.
    void (uid ? miSede(uid) : Promise.resolve(null)).then(s => {
      if (!vivo) return
      if (s) {
        setSede(s)
        setForm({
          name: s.name, address: s.address, phone: s.phone, city: s.city, notes: s.notes,
          description: s.description, banner_url: s.banner_url, logo_url: s.logo_url,
          accent: s.accent, schedule: s.schedule, instagram: s.instagram,
          whatsapp: s.whatsapp, maps_url: s.maps_url,
        })
      }
      setCargando(false)
    })
    return () => { vivo = false }
  }, [uid])

  const set = <K extends keyof SedeEditable>(k: K, v: SedeEditable[K]) => {
    setForm(f => ({ ...f, [k]: v }))
    setOk(false)
  }

  const subir = async (archivo: File, tipo: 'banner' | 'logo') => {
    setSubiendo(tipo)
    setError(null)
    const anterior = tipo === 'banner' ? form.banner_url : form.logo_url
    const r = await subirImagen(uid, archivo, tipo)
    setSubiendo(null)
    if (!r.ok || !r.url) { setError(r.error ?? 'No se pudo subir la imagen.'); return }
    set(tipo === 'banner' ? 'banner_url' : 'logo_url', r.url)
    // La anterior se borra recién con la nueva ya arriba: si se borrara antes
    // y fallara la subida, la sede se quedaría sin imagen.
    void borrarImagen(anterior)
  }

  const guardar = async () => {
    setError(null)
    setOk(false)
    if (form.name.trim().length < 2) { setError('Escribí el nombre de la tienda.'); return }
    if (form.address.trim().length < 4) { setError('Escribí la dirección.'); return }

    setGuardando(true)
    const datos: SedeEditable = {
      ...form,
      name: form.name.trim(),
      address: form.address.trim(),
      phone: form.phone ? limpio(form.phone) : null,
      city: form.city ? limpio(form.city) : null,
      description: form.description ? limpio(form.description) : null,
      schedule: form.schedule ? limpio(form.schedule) : null,
      instagram: form.instagram ? limpio(form.instagram.replace(/^@/, '')) : null,
      whatsapp: form.whatsapp ? limpio(form.whatsapp.replace(/[\s()-]/g, '')) : null,
      maps_url: form.maps_url ? limpio(form.maps_url) : null,
    }
    const r = sede ? await actualizarSede(sede.id, datos) : await crearSede(uid, datos)
    setGuardando(false)
    if (!r.ok) { setError(r.error ?? 'No se pudo guardar.'); return }
    if (r.sede) setSede(r.sede)
    setOk(true)
  }

  if (cargando) {
    return <p className="text-center text-xs text-swu-muted py-10">Cargando tu sede…</p>
  }

  // Vista previa con lo que hay escrito ahora mismo, no con lo guardado.
  const previa: Sede = {
    ...(sede ?? {
      id: 'previa', owner_id: uid,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    } as Sede),
    ...form,
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-swu-text">Mi sede</h1>
          <p className="text-[11px] text-swu-muted leading-relaxed">
            El lugar donde organizás. Cada administrador puede tener{' '}
            <span className="text-swu-text font-semibold">una sola</span>, y los torneos que
            crees se pueden ligar a ella.
          </p>
        </div>
        {sede && (
          <Link
            to={`/sede/${sede.id}`}
            className="flex items-center gap-1 text-[11px] text-swu-cyan whitespace-nowrap pt-1"
          >
            <Eye size={13} aria-hidden /> Ver pública
          </Link>
        )}
      </div>

      {/* ── Vista previa ── */}
      <div>
        <p className="text-[10px] font-mono uppercase tracking-wider text-swu-muted/60 mb-1.5">
          Así se ve
        </p>
        <SedeCabecera sede={previa} />
      </div>

      {/* ── Imágenes ── */}
      <div className="grid grid-cols-2 gap-2">
        {([['banner', bannerRef, form.banner_url], ['logo', logoRef, form.logo_url]] as const).map(
          ([tipo, ref, url]) => (
            <div key={tipo} className="bg-swu-surface border border-swu-border rounded-xl p-3 space-y-2">
              <p className="text-[11px] font-mono uppercase tracking-wider text-swu-muted">
                {tipo === 'banner' ? 'Banner' : 'Logo'}
              </p>
              <input
                ref={ref}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) void subir(f, tipo)
                  e.target.value = ''
                }}
              />
              <Button
                size="sm" block variant="secondary"
                loading={subiendo === tipo}
                onClick={() => ref.current?.click()}
              >
                <ImageIcon size={13} aria-hidden /> {url ? 'Cambiar' : 'Subir'}
              </Button>
              {url && (
                <button
                  onClick={() => { void borrarImagen(url); set(tipo === 'banner' ? 'banner_url' : 'logo_url', null) }}
                  className="w-full text-[10px] text-swu-red-texto flex items-center justify-center gap-1"
                >
                  <Trash2 size={11} aria-hidden /> Quitar
                </button>
              )}
            </div>
          ),
        )}
      </div>

      {/* ── Acento ── */}
      <div>
        <p className="text-[11px] font-mono uppercase tracking-wider text-swu-muted mb-1.5">
          Color de la sede
        </p>
        {/* Botones propios y no `Chip`: los tonos de la sede son los del HUD
            —incluyen rojo y violeta— y la paleta de Chip no los tiene. */}
        <div className="flex flex-wrap gap-1.5">
          {ACENTOS.map(a => (
            <button
              key={a.valor}
              onClick={() => set('accent', a.valor)}
              aria-pressed={form.accent === a.valor}
              className={`flex items-center gap-1.5 text-[11px] font-semibold rounded-lg border px-2.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swu-accent ${
                form.accent === a.valor
                  ? `${HUD_TEXTO[a.valor]} border-current`
                  : 'text-swu-muted border-swu-border'
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${PUNTO[a.valor]}`} aria-hidden />
              {a.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-swu-muted/70 mt-1">
          Se elige de la paleta de la app para que la sede se sienta parte del Holocrón.
        </p>
      </div>

      {/* ── Datos ── */}
      <div className="bg-swu-surface border border-swu-border rounded-xl p-3 space-y-3">
        <Campo
          label="Tienda" icono={<Store size={12} aria-hidden />} maxLength={80}
          valor={form.name} onChange={v => set('name', v)}
          placeholder="Ej: Coliseum Games"
        />
        <Campo
          label="Dirección" icono={<MapPin size={12} aria-hidden />} maxLength={200}
          valor={form.address} onChange={v => set('address', v)}
          placeholder="Calle, número, colonia"
        />
        <div className="grid grid-cols-2 gap-2">
          <Campo
            label="Teléfono" icono={<Phone size={12} aria-hidden />} maxLength={25}
            valor={form.phone ?? ''} onChange={v => set('phone', v)}
            placeholder="+503 7777 7777"
          />
          <Campo
            label="Ciudad" maxLength={60}
            valor={form.city ?? ''} onChange={v => set('city', v)}
            placeholder="San Salvador"
          />
        </div>
        <Campo
          label="Días de juego" icono={<Clock size={12} aria-hidden />} maxLength={300} multilinea
          valor={form.schedule ?? ''} onChange={v => set('schedule', v)}
          placeholder="Jueves 6pm · Sábados 2pm"
        />
        <Campo
          label="Descripción" maxLength={600} multilinea
          valor={form.description ?? ''} onChange={v => set('description', v)}
          placeholder="Qué van a encontrar: mesas, torneos, venta de producto…"
          ayuda={`${(form.description ?? '').length}/600`}
        />
        <div className="grid grid-cols-2 gap-2">
          <Campo
            label="Instagram" maxLength={30}
            valor={form.instagram ?? ''} onChange={v => set('instagram', v)}
            placeholder="mitienda" ayuda="Sin la @"
          />
          <Campo
            label="WhatsApp" maxLength={16}
            valor={form.whatsapp ?? ''} onChange={v => set('whatsapp', v)}
            placeholder="50377777777" ayuda="Solo números"
          />
        </div>
        <Campo
          label="Mapa" maxLength={300}
          valor={form.maps_url ?? ''} onChange={v => set('maps_url', v)}
          placeholder="https://maps.app.goo.gl/…"
          ayuda="Enlace de Google Maps"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 text-[11px] text-swu-red-texto bg-swu-red/10 border border-swu-red/30 rounded-lg px-3 py-2">
          <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" aria-hidden />
          <span>{error}</span>
        </div>
      )}
      {ok && (
        <div className="flex items-center gap-2 text-[11px] text-swu-green bg-swu-green/10 border border-swu-green/30 rounded-lg px-3 py-2">
          <Check size={13} aria-hidden />
          <span>Sede guardada.</span>
          {sede && (
            <Link to={`/sede/${sede.id}`} className="ml-auto flex items-center gap-1 text-swu-cyan">
              Verla <ExternalLink size={11} aria-hidden />
            </Link>
          )}
        </div>
      )}

      <Button block onClick={() => void guardar()} loading={guardando}>
        {guardando ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Save size={15} aria-hidden />}
        {sede ? 'Guardar cambios' : 'Crear mi sede'}
      </Button>

      {!currentProfile && (
        <p className="text-[11px] text-swu-muted text-center">
          Necesitás sesión iniciada para crear una sede.
        </p>
      )}
    </div>
  )
}
