/**
 * Banco de pruebas de los avatares. Solo en desarrollo (`/banco-avatares`).
 *
 * Existe por un fallo que llegó a producción y que ninguna prueba podía cazar:
 * La Galaxia y el ranking mensual pintaban `{perfil.avatar}` a pelo, como si el
 * campo siempre fuera un emoji. En la base **no hay un solo emoji**: 22 perfiles
 * guardan el id de un ícono del juego y 1 guarda una foto. O sea que las 23
 * filas se veían mal —«boba-fett» escrito en letras enormes, y para quien tiene
 * foto, un chorro de base64 desbordando la fila—, no un caso raro.
 *
 * Por eso el banco muestra las TRES formas que puede tomar el campo, a los
 * tamaños en que la app lo dibuja. Si alguna columna sale como texto, alguien
 * volvió a saltarse el componente.
 *
 * Se cae del bundle de producción: `import.meta.env.DEV` es un literal y el
 * empaquetador poda la rama entera (mismo patrón que BancoMarcos).
 */

import { Avatar } from './Avatar'
import { ProfileFrame } from '../../features/profile/components/ProfileFrame'

/** Los tamaños REALES con que la app pide avatares. */
const TAMANOS = [28, 32, 36, 40, 48, 60]

/** Nombres reales de la comunidad, para ver cómo se reparten los colores. */
const SEMILLAS = ['Nelson', 'Vara', 'Jaime', 'Christian', 'Marlin', 'Erasmo', 'Luis', 'César']

/**
 * Las tres formas del campo `avatar`, con los valores que de verdad hay en la
 * base. El emoji es el único que NO aparece en producción hoy — va igual,
 * porque el componente sigue teniendo esa rama y es la que se rompe callada.
 */
const CASOS: Array<{ etiqueta: string; valor: string }> = [
  // La foto es el caso que peor fallaba: pintada como texto era un chorro de
  // base64. Acá va un SVG mínimo, que cumple `data:image/` igual que una foto
  // subida y evita meter un PNG de verdad en el repo.
  {
    etiqueta: 'foto subida (1 perfil)',
    valor:
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8">' +
        '<rect width="8" height="8" fill="#334155"/>' +
        '<circle cx="4" cy="3" r="1.6" fill="#94a3b8"/>' +
        '<path d="M0.8 8a3.2 3.2 0 0 1 6.4 0z" fill="#94a3b8"/></svg>',
      ),
  },
  { etiqueta: 'ícono del juego (22 perfiles)', valor: 'boba-fett' },
  { etiqueta: 'otro ícono', valor: 'starfighter' },
  { etiqueta: 'ícono con guion y número', valor: 'rebel-alliance-2' },
  { etiqueta: 'emoji (0 perfiles hoy)', valor: '🎯' },
  { etiqueta: 'vacío — perfil viejo', valor: '' },
]

export function BancoAvatares() {
  return (
    <div className="min-h-screen bg-swu-bg p-6 space-y-8">
      <div>
        <h1 className="text-lg font-black text-swu-text">Banco de avatares</h1>
        <p className="text-[11px] text-swu-muted">
          Ninguna celda debe mostrar TEXTO salvo la fila del emoji. Si ves
          «boba-fett» escrito, alguien pintó el campo crudo otra vez.
        </p>
      </div>

      {CASOS.map(c => (
        <section key={c.etiqueta || 'vacio'} className="space-y-2">
          <div className="flex items-baseline gap-2">
            <h2 className="shrink-0 text-sm font-bold text-swu-text">{c.etiqueta}</h2>
            {/* El data URI mide miles de caracteres: entero, empujaba el título
                a cuatro líneas y desarmaba la página. */}
            <code className="truncate font-mono text-[10px] text-swu-muted">
              {c.valor ? `${c.valor.slice(0, 48)}${c.valor.length > 48 ? '…' : ''}` : '(cadena vacía)'}
            </code>
          </div>

          <div className="flex flex-wrap items-end gap-5">
            {TAMANOS.map(t => (
              <div key={t} className="flex flex-col items-center gap-1">
                <Avatar avatar={c.valor} size={t} caja="redondeada" />
                <span className="font-mono text-[9px] text-swu-muted">{t}</span>
              </div>
            ))}
          </div>

          {/* Las otras dos cajas que usa la app, al tamaño más común. */}
          <div className="flex items-end gap-5 pt-1">
            <div className="flex flex-col items-center gap-1">
              <Avatar avatar={c.valor} size={40} caja="circulo" />
              <span className="font-mono text-[9px] text-swu-muted">círculo</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Avatar avatar={c.valor} size={40} caja="ninguna" />
              <span className="font-mono text-[9px] text-swu-muted">ninguna</span>
            </div>
          </div>

          {/* El anillo: mismo avatar, ocho semillas distintas. Sirve para ver
              que el color se REPARTE (si salen todos iguales, el hash está
              roto) y que ninguno se pierde contra el fondo. */}
          <div className="flex flex-wrap items-end gap-4 pt-1">
            {SEMILLAS.map(sem => (
              <div key={sem} className="flex flex-col items-center gap-1">
                <Avatar avatar={c.valor} size={44} caja="redondeada" anillo={sem} />
                <span className="font-mono text-[9px] text-swu-muted">{sem}</span>
              </div>
            ))}
          </div>

          {/* Dentro del MARCO, a los tres tamaños que usa la app (Inicio 72,
              Perfil 72, Personalizar 88). Es la combinación que se veía mal: el
              avatar traía un tamaño fijo propio y el marco le comía el borde.
              Con `caja="marco"` el tamaño lo manda el marco. */}
          <div className="flex flex-wrap items-end gap-5 pt-1">
            {[56, 72, 88].map(t => (
              <div key={t} className="flex flex-col items-center gap-1">
                <ProfileFrame level={40} size={t}>
                  <Avatar avatar={c.valor} size={t} caja="marco" escalaIcono={1} />
                </ProfileFrame>
                <span className="font-mono text-[9px] text-swu-muted">marco {t}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
