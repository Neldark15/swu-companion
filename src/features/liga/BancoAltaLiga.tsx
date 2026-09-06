/**
 * Banco del alta de la liga — /banco-alta-liga (solo desarrollo)
 *
 * El alta es la pantalla más importante del módulo —para mucha gente es la
 * PRIMERA de la app, porque se llega desde el video de un creador— y hasta hoy
 * **nadie la había visto nunca**: vive detrás de una liga en estado
 * `inscripcion` y de `liga_visible()`, y la liga está en borrador. Una
 * auditoría la marcó como NO COMPROBADA por eso mismo.
 *
 * Acá se ven los tres estados sueltos, sin sesión y sin liga:
 *
 *   · el paso «¿cómo te llamás?» — solo lo ve una cuenta recién creada
 *   · el paso «¿de dónde sos?»   — lo ven 3 de 42 perfiles
 *   · el formulario completo     — lo ven los otros 39
 *
 * Sin sesión el guardado FALLA a propósito, y eso también sirve: es el camino
 * de vuelta atrás, que es el único que no se comprueba tocando bonito.
 */

import { useEffect, useState } from 'react'
import { InscripcionLiga, PasoPerfil, PasoPais } from './InscripcionLiga'
import { useAuth } from '../../hooks/useAuth'
import { User } from 'lucide-react'

/**
 * UN PERFIL FALSO, y no es un detalle del banco: es lo que hace que el caso 3
 * pruebe algo.
 *
 * `InscripcionLiga` decide qué paso pinta mirando `currentProfile`. Sin sesión
 * ese perfil es null, así que el componente cae —correctamente— en el paso
 * «¿cómo te llamás?» y el banco enseñaba TRES veces la misma pantalla: cero
 * «Entrar a la liga» y ningún formulario. Medido acá mismo: 3 botones
 * «Seguir», ninguno de entrar.
 *
 * Un banco que miente sobre lo que prueba es peor que no tenerlo (§4r), así
 * que se siembra un perfil completo en el store y se repone al salir.
 */
const PERFIL_FALSO = {
  id: 'banco', name: 'Nelson Darío', avatar: 'boba-fett',
  country: 'SV', continent: 'CA', createdAt: 0,
}

/* Lo que había antes, para reponerlo al salir. Va a nivel de MÓDULO y no en un
   `useRef`: una ref no se puede escribir durante el render (la misma regla que
   obliga a la ref de ruta de `UpdatePrompt`, §2g), y el perfil hay que
   sembrarlo ANTES del primer render o `InscripcionLiga` calcula su paso con el
   perfil vacío — que es exactamente el fallo que este banco vino a arreglar. */
let perfilPrevio: ReturnType<typeof useAuth.getState>['currentProfile'] = null

export function BancoAltaLiga() {
  const [error, setError] = useState<string | null>(null)

  /* Sembrar en el inicializador y no en un efecto: un `setState` dentro de un
     efecto encadena un render de más, y acá además llegaría TARDE. Escribir la
     misma foto dos veces (modo estricto) es idempotente. */
  useState(() => {
    perfilPrevio = useAuth.getState().currentProfile
    useAuth.setState({ currentProfile: PERFIL_FALSO })
    return true
  })

  useEffect(() => () => { useAuth.setState({ currentProfile: perfilPrevio }) }, [])

  return (
    <div className="min-h-screen bg-swu-bg p-4">
      <h1 className="mb-1 text-lg font-bold text-swu-text">El alta de la liga</h1>
      <p className="mb-4 text-xs text-swu-muted">
        Los tres estados. Sin sesión: guardar falla, que es el camino que hay que ver.
      </p>

      <div className="mx-auto max-w-lg space-y-6">
        <Caso titulo="1 · Cuenta recién creada — falta el nombre">
          <PasoPerfil
            icono={User}
            titulo="¿Cómo te llamás?"
            ayuda="Es el nombre con el que vas a aparecer en la tabla de la liga y cuando presenten tu partida al aire. Podés cambiarlo después desde tu perfil."
            error={error}
            guardar={async () => { setError('Guardado solo en este aparato: iniciá sesión para que no se pierda.'); return false }}
          />
        </Caso>

        <Caso titulo="2 · Tiene nombre, falta el país (3 de 42 perfiles)">
          <PasoPais
            error={null}
            guardar={async () => { setError(null); return false }}
          />
        </Caso>

        <Caso titulo="3 · Perfil completo — el formulario (39 de 42)">
          {/* Un id inventado: con el de la liga real, tocar «Entrar» escribiría
              una inscripción de verdad desde el banco.
              Se monta DESPUÉS de sembrar el perfil: montarlo antes lo dejaría
              con el paso «nombre» calculado en el primer render. */}
          <InscripcionLiga
            ligaId="00000000-0000-0000-0000-000000000000"
            onListo={() => setError('onListo() — en la app real acá se recarga la liga')}
          />
        </Caso>
      </div>
    </div>
  )
}

function Caso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-swu-muted">{titulo}</p>
      {children}
    </div>
  )
}
