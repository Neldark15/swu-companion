/**
 * DondeJugar — dónde comprar y jugar Star Wars: Unlimited en El Salvador.
 *
 * Desde 2026 el país tiene tienda reconocida por Fantasy Flight Games, que es
 * lo que habilita torneos sancionados y producto de lanzamiento. Es la noticia
 * más útil que puede darle esta app a alguien que empieza: no «existe el
 * juego», sino **dónde conseguirlo acá**.
 *
 * ── Por qué los datos están escritos y no se traen solos ──────────────
 *
 * El buscador de FFG carga las tiendas por JavaScript contra un Strapi cuyo
 * host no está expuesto en la página —comprobado: las rutas /api/stores dan
 * 404 y el HTML llega sin un solo dato—. Montar un raspador para UNA tienda
 * sería frágil y desproporcionado.
 *
 * Así que van acá, con dos salvaguardas: el enlace al buscador de FFG
 * siempre visible, para que cualquiera verifique o encuentre las que abran
 * después; y esta lista, que crece agregando un objeto.
 */

import { MapPin, Phone, Mail, ExternalLink, Store, Navigation } from 'lucide-react'

interface TiendaSWU {
  /** Id en el buscador de FFG, para enlazar directo a su ficha. */
  id: number
  nombre: string
  direccion: string
  ciudad: string
  telefono?: string
  correo?: string
}

/** Tiendas de El Salvador. Al abrir otra, se agrega acá. */
const TIENDAS: TiendaSWU[] = [
  {
    id: 4697,
    nombre: 'TCG Estadio Sonsonate',
    direccion: 'Av Morazán 6-4, Sonsonate Centro 03014',
    ciudad: 'Sonsonate, El Salvador',
    telefono: '+50324330000',
    correo: 'tcgsonso@gmail.com',
  },
]

const BUSCADOR_TIENDAS =
  'https://starwarsunlimited.com/search?searchTerm=el+salvador&distance=200'

/** `+50324330000` → `+503 2433 0000`, que es como se lee un número salvadoreño. */
function telefonoLegible(t: string): string {
  const m = /^\+503(\d{4})(\d{4})$/.exec(t.replace(/\s/g, ''))
  return m ? `+503 ${m[1]} ${m[2]}` : t
}

function Tienda({ t }: { t: TiendaSWU }) {
  const consulta = encodeURIComponent(`${t.nombre}, ${t.direccion}, ${t.ciudad}`)
  /** Ver el punto en el mapa. */
  const mapa = `https://www.google.com/maps/search/?api=1&query=${consulta}`
  /** Y llegar hasta él: Maps abre la navegación desde dónde estés. */
  const comoLlegar = `https://www.google.com/maps/dir/?api=1&destination=${consulta}`
  const fichaTienda = `${BUSCADOR_TIENDAS}&store=${t.id}`

  return (
    <div className="bg-swu-surface border border-swu-amber/30 rounded-xl overflow-hidden">
      <div className="px-3 py-2.5 flex items-center gap-2 border-b border-swu-border">
        <Store size={15} className="text-swu-amber flex-shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-swu-text truncate">{t.nombre}</p>
          <p className="text-[10px] text-swu-amber uppercase tracking-wider">Reconocida por FFG</p>
        </div>
      </div>

      <div className="p-3 space-y-2">
        {/* La dirección lleva al mapa: nadie copia una dirección a mano. */}
        <a
          href={mapa}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2 text-[12px] text-swu-text/85 hover:text-swu-cyan"
        >
          <MapPin size={13} className="text-swu-cyan flex-shrink-0 mt-0.5" aria-hidden />
          <span>
            {t.direccion}
            <br />
            <span className="text-swu-muted">{t.ciudad}</span>
            <span className="text-swu-cyan/70"> · ver en el mapa</span>
          </span>
        </a>

        {/* `tel:` y `mailto:` para que en el teléfono sea un toque y ya. */}
        {t.telefono && (
          <a
            href={`tel:${t.telefono}`}
            className="flex items-center gap-2 text-[12px] text-swu-cyan"
          >
            <Phone size={13} className="flex-shrink-0" aria-hidden />
            {telefonoLegible(t.telefono)}
          </a>
        )}
        {t.correo && (
          <a
            href={`mailto:${t.correo}`}
            className="flex items-center gap-2 text-[12px] text-swu-cyan break-all"
          >
            <Mail size={13} className="flex-shrink-0" aria-hidden />
            {t.correo}
          </a>
        )}

        {/* Las dos acciones que de verdad se usan, como botones y no como
            enlaces escondidos en el texto: llegar hasta la tienda, y verla en
            el sitio de FFG —que es donde figuran sus eventos—. */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <a
            href={comoLlegar}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 bg-swu-cyan/15 border border-swu-cyan/40
                       text-swu-cyan text-[11px] font-semibold rounded-lg py-2 active:scale-[0.98] transition-transform"
          >
            <Navigation size={12} aria-hidden /> Cómo llegar
          </a>
          <a
            href={fichaTienda}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 bg-swu-amber/15 border border-swu-amber/40
                       text-swu-amber text-[11px] font-semibold rounded-lg py-2 active:scale-[0.98] transition-transform"
          >
            <ExternalLink size={12} aria-hidden /> Ver en el sitio
          </a>
        </div>
      </div>
    </div>
  )
}

export function DondeJugar() {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Store size={15} className="text-swu-amber flex-shrink-0" aria-hidden />
        <h2 className="text-sm font-bold text-swu-text tracking-wide uppercase flex-1">
          Dónde jugar
        </h2>
      </div>

      <p className="text-[11px] text-swu-muted leading-snug">
        El Salvador ya tiene tienda de Star Wars: Unlimited reconocida por Fantasy
        Flight Games. Ahí se consigue producto de lanzamiento y se juegan los eventos.
      </p>

      <div className="space-y-3">
        {TIENDAS.map(t => <Tienda key={t.id} t={t} />)}
      </div>

      {/* Siempre visible, haya una tienda o diez: si abre otra, aparece ahí
          antes de que alguien la agregue acá. */}
      <a
        href={BUSCADOR_TIENDAS}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 bg-swu-surface border border-swu-border rounded-xl px-3 py-2.5 active:scale-[0.99] transition-transform"
      >
        <MapPin size={16} className="text-swu-cyan flex-shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-swu-text">Buscador de tiendas de FFG</p>
          <p className="text-[10px] text-swu-muted">starwarsunlimited.com</p>
        </div>
        <ExternalLink size={12} className="text-swu-muted flex-shrink-0" aria-hidden />
      </a>
    </section>
  )
}
