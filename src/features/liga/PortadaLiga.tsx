/** El afiche solo se carga una vez que la consulta confirma el acceso a la liga. */
import { Loader2 } from 'lucide-react'

export function PortadaLiga(
  { mensaje = 'Entrando a la liga…', ms = 0, portada }:
  { mensaje?: string; ms?: number; portada?: string | null },
) {
  if (!portada) {
    return (
      <div role="status" className="flex min-h-48 items-center justify-center gap-2 p-6 text-sm text-swu-muted">
        <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden />
        {mensaje}
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-[#05050A]"
      style={{
        backgroundImage: `url("${portada}")`,
        backgroundSize: 'cover',
        // Anclado ARRIBA, no al centro: el rótulo «LIGA INTERNACIONAL» es lo
        // primero que tiene que leerse, y en una pantalla más alta que el
        // afiche el centrado se lo come por arriba.
        backgroundPosition: 'top center',
        backgroundRepeat: 'no-repeat',
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex-1" />

      {/* La barra va PEGADA arriba de la franja, del ancho entero: es lo único
          que se mueve en la pantalla y ahí no le pisa nada al afiche. */}
      {ms > 0 && (
        <div className="h-[3px] w-full overflow-hidden bg-white/10" aria-hidden>
          <div
            className="portada-barra h-full w-full origin-left"
            style={{ background: 'var(--liga-acento, #3B82F6)', animationDuration: `${ms}ms` }}
          />
        </div>
      )}

      {/* Franja sólida: el logo de PUENTE 3 vive en el tercio inferior del
          afiche y cualquier texto flotando ahí se le monta encima. */}
      <p
        className="flex items-center justify-center gap-2 border-t border-white/10 bg-[#05050A]
                   py-3 font-mono text-[10px] uppercase tracking-[0.3em] text-white/60"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <Loader2 size={12} className="animate-spin motion-reduce:animate-none" aria-hidden />
        {mensaje}
      </p>
    </div>
  )
}
