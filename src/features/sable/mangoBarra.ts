/**
 * El caché del MANGO de la barra de XP — a propósito SIN importar three.
 *
 * La barra de XP vive en el Home, el Perfil y Ajustes: meterle three (≈600 KB)
 * por un adorno de 72×22 sería pagar la Galaxia entera por una miniatura. Por
 * eso este módulo solo sabe LEER y GUARDAR el PNG ya renderizado; el que
 * renderiza (`miniaturaSable3D.ts`) se importa dinámico y únicamente cuando el
 * caché no sirve — o sea, una vez por diseño de sable, no una vez por visita.
 *
 * Se guarda UNA sola entrada (la barra enseña un solo sable: el tuyo): cambiar
 * de diseño la reemplaza, y el localStorage no acumula mangos viejos.
 */

interface EntradaMango {
  /** Qué piezas son. El COLOR no entra: el cristal va dentro del mango. */
  clave: string
  png: string
}

const LS = 'sable_minibarra_v1'

export function claveDeMango(d: { emisor: string; cuerpo: string; pomo: string }): string {
  return `${d.emisor}|${d.cuerpo}|${d.pomo}`
}

export function mangoCacheado(): EntradaMango | null {
  try {
    const crudo = localStorage.getItem(LS)
    if (!crudo) return null
    const e = JSON.parse(crudo) as EntradaMango
    // Un caché corrupto se descarta en silencio: la barra tiene el SVG de repuesto.
    if (typeof e?.clave !== 'string' || typeof e?.png !== 'string' || !e.png.startsWith('data:image/')) return null
    return e
  } catch {
    return null
  }
}

function guardarMangoCacheado(clave: string, png: string): void {
  try {
    localStorage.setItem(LS, JSON.stringify({ clave, png } satisfies EntradaMango))
  } catch {
    // Sin espacio: la próxima visita re-renderiza. Peor destino sería reventar.
  }
}

/* ── VUELO ÚNICO ──
   Medido en el banco: 20 barras montadas a la vez = 20 intentos de contexto
   WebGL simultáneos, y Chrome corta a ~16 — una foto salía y las demás barras
   se quedaban con el SVG. Con la promesa compartida renderiza UNA y todas las
   barras esperan la misma foto. Se limpia al terminar para que un fallo pueda
   reintentarse en el siguiente montaje en vez de quedar clavado en null. */
let enVuelo: Promise<string | null> | null = null

/** La foto del mango: del caché si sirve, renderizada (una sola vez) si no. */
export function fotoDelMango(
  d: { emisor: string; cuerpo: string; pomo: string; color: string },
): Promise<string | null> {
  const clave = claveDeMango(d)
  const cache = mangoCacheado()
  if (cache?.clave === clave) return Promise.resolve(cache.png)
  if (!enVuelo) {
    // El import DINÁMICO es el punto de este módulo: three entra acá y solo acá.
    enVuelo = import('./miniaturaSable3D')
      .then(m => {
        const png = m.renderizarMango(d)
        if (png) guardarMangoCacheado(clave, png)
        return png
      })
      .catch(() => null)
      .finally(() => { enVuelo = null })
  }
  return enVuelo
}
