import { Link } from 'react-router-dom'
import { Newspaper, ExternalLink } from 'lucide-react'

/**
 * El gestor real de noticias vive en /news/manage (ManageNewsPage)
 * con su propio layout. Esta página linkea ahí para mantener el flujo.
 */
export function AdminNewsPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-swu-text">Noticias</h1>
        <p className="text-sm text-swu-muted mt-1">Publicación de transmisiones para el home</p>
      </header>

      <div className="bg-swu-surface rounded-xl border border-swu-border p-6 max-w-md">
        <Newspaper size={32} className="text-swu-accent mb-3" />
        <h2 className="text-lg font-bold text-swu-text mb-2">Gestor de Noticias</h2>
        <p className="text-sm text-swu-muted mb-4">
          Crea, edita, pin y borra noticias que se muestran en el home de la app a todos los usuarios.
        </p>
        <Link
          to="/news/manage"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-swu-accent text-white text-sm font-semibold hover:bg-swu-accent/90 transition-colors"
        >
          Abrir gestor <ExternalLink size={14} />
        </Link>
        <p className="text-[11px] text-swu-muted/60 mt-3">
          Al abrir saldrás del panel admin temporalmente. Usa el menú lateral para volver.
        </p>
      </div>
    </div>
  )
}
