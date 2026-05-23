import { Bell, Construction, KeyRound, Database, Server, Smartphone } from 'lucide-react'

export function AdminPushPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-swu-text">Notificaciones Push</h1>
        <p className="text-sm text-swu-muted mt-1">Enviar transmisiones a usuarios con la PWA instalada</p>
      </header>

      <div className="bg-swu-amber/5 border border-swu-amber/30 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Construction size={24} className="text-swu-amber" />
          <div>
            <h2 className="text-base font-bold text-swu-text">Próximamente — Fase C</h2>
            <p className="text-[11px] text-swu-muted">Esta función necesita configuración inicial</p>
          </div>
        </div>

        <p className="text-sm text-swu-text/80">
          La infraestructura de notificaciones push requiere setup en partes que no pueden hacerse solo con código:
        </p>

        <ul className="space-y-2 text-[12px] text-swu-muted">
          <li className="flex items-start gap-2">
            <KeyRound size={14} className="text-swu-accent flex-shrink-0 mt-0.5" />
            <span>
              <strong className="text-swu-text">Generar VAPID keys</strong> — par de claves públicas/privadas
              que firman cada envío de push. Una vez, comando local.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Database size={14} className="text-swu-accent flex-shrink-0 mt-0.5" />
            <span>
              <strong className="text-swu-text">Tabla push_subscriptions</strong> — almacena los endpoints
              de cada device. Migración SQL a aplicar en Supabase.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Server size={14} className="text-swu-accent flex-shrink-0 mt-0.5" />
            <span>
              <strong className="text-swu-text">Vercel Serverless Function</strong> — endpoint
              <code className="font-mono bg-black/30 px-1 rounded ml-1 text-[11px]">/api/send-push</code>
              que firma y envía las notificaciones desde el server.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Smartphone size={14} className="text-swu-accent flex-shrink-0 mt-0.5" />
            <span>
              <strong className="text-swu-text">Service Worker custom</strong> — switchear de
              <code className="font-mono bg-black/30 px-1 rounded ml-1 text-[11px]">generateSW</code> a
              <code className="font-mono bg-black/30 px-1 rounded ml-1 text-[11px]">injectManifest</code>
              en vite-plugin-pwa para poder agregar el handler de
              <code className="font-mono bg-black/30 px-1 rounded ml-1 text-[11px]">push</code> + click.
            </span>
          </li>
        </ul>

        <div className="border-t border-swu-amber/20 pt-3 mt-2">
          <p className="text-[11px] text-swu-muted leading-relaxed">
            <Bell size={12} className="inline text-swu-accent mr-1" />
            <strong className="text-swu-text">Mientras tanto:</strong> las notificaciones in-app
            (toast + campanita) siguen funcionando para usuarios con la app abierta.
            Ver <code className="font-mono bg-black/30 px-1 rounded">notificationService.ts</code>.
          </p>
        </div>
      </div>
    </div>
  )
}
