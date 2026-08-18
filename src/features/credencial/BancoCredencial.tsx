/**
 * BancoCredencial — banco de pruebas de la credencial (SOLO desarrollo).
 *
 * Renderiza la credencial con DATOS FALSOS fijos, una fila por cada tema y
 * con emblemas variados, sin sesión: para verificar a ojo silueta, muescas,
 * recorte del agujero, glifos, contraste de cada paleta y el caso emoji del
 * avatar. Se poda del bundle de producción por el guardia
 * `import.meta.env.DEV` de App.tsx (mismo patrón que BancoMarcos).
 */

import { CredencialSVG, type DatosCredencial } from './CredencialSVG'
import { SublineaAurebesh } from './aurebesh'
import { TEMAS_CREDENCIAL, EMBLEMAS_CREDENCIAL_IDS } from './credencialTemas'

/** Datos fijos: cambiarlos rompería la comparación visual entre corridas. */
const DATOS_FALSOS: DatosCredencial = {
  nombre: 'Vara Antillos',
  apodo: 'La Centinela',
  ubicacion: 'El Salvador',
  rango: 'Comandante del Sector',
  desplegado: '04 MAR 2026',
  avatar: 'boba-fett', // id de ícono del juego: ejercita la rama urlAvatarSW
  mazo: 'Grand Admiral Thrawn',
}

/** Variantes que ejercitan las otras dos ramas del avatar y textos largos. */
const DATOS_EMOJI: DatosCredencial = {
  nombre: 'Kal Dun',
  apodo: 'As',
  ubicacion: 'Tatooine',
  rango: 'Iniciado del Borde Exterior',
  desplegado: '17 AGO 2026',
  avatar: '🎯', // emoji suelto: la ventana lo pinta como texto, nunca crudo
  mazo: null,
}

const DATOS_LARGOS: DatosCredencial = {
  nombre: 'Maximiliano Buenaventura',
  apodo: 'El Archivista Imperial',
  ubicacion: 'Ciudad Nube, Bespin',
  rango: 'Gran Maestro Galáctico',
  desplegado: '28 DIC 2025',
  avatar: 'darth-vader',
  mazo: 'Doctor Aphra, Rogue Archaeologist',
}

/**
 * Muestrario del alfabeto: una casilla por carácter con su glifo Aurebesh
 * arriba y la letra latina debajo, igual que la lámina de referencia
 * (https://aurebesh.org/images/aurebesh-3.png). Es el único sitio donde se ve
 * un glifo AISLADO y grande: en la credencial van a 4-6 px y cualquier trazo
 * torcido pasa desapercibido. Si alguien retoca `aurebesh.tsx`, se compara acá
 * contra la lámina antes de dar por bueno el cambio.
 */
const ABECEDARIO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')

function MuestrarioAurebesh() {
  return (
    <div>
      <p className="text-xs font-mono tracking-wider text-swu-muted mb-2">ALFABETO AUREBESH (comparar con la lámina)</p>
      <div className="grid grid-cols-9 gap-1 rounded-lg bg-black/40 p-3">
        {ABECEDARIO.map(c => (
          <div key={c} className="flex flex-col items-center gap-1">
            <svg viewBox="0 0 32 34" className="w-full" role="img" aria-label={`Glifo Aurebesh de ${c}`}>
              <SublineaAurebesh texto={c} x={3} y={4} alto={26} color="#e8b53a" opacidad={1} />
            </svg>
            <span className="text-[10px] font-mono text-swu-muted">{c}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function BancoCredencial() {
  return (
    <div className="p-4 lg:p-6 pb-24 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-lg font-bold text-swu-text">Banco de credenciales</h1>
        <p className="text-xs text-swu-muted">
          Solo desarrollo. Una fila por tema con datos fijos; al final, los casos emoji y textos largos.
        </p>
      </div>

      <MuestrarioAurebesh />

      {TEMAS_CREDENCIAL.map((tema, i) => (
        <div key={tema.id}>
          <p className="text-xs font-mono tracking-wider text-swu-muted mb-2">{tema.id.toUpperCase()}</p>
          <CredencialSVG
            datos={DATOS_FALSOS}
            tema={tema}
            // Un emblema distinto por fila: así una pasada por el banco
            // también revisa que todos los íconos se graben bien.
            emblema={EMBLEMAS_CREDENCIAL_IDS[i % EMBLEMAS_CREDENCIAL_IDS.length]}
            className="w-full max-w-xl drop-shadow-[0_12px_28px_rgba(0,0,0,0.55)]"
          />
        </div>
      ))}

      <div>
        <p className="text-xs font-mono tracking-wider text-swu-muted mb-2">CASO EMOJI + SIN MAZO</p>
        <CredencialSVG datos={DATOS_EMOJI} tema={TEMAS_CREDENCIAL[0]} emblema="dado" className="w-full max-w-xl" />
      </div>
      <div>
        <p className="text-xs font-mono tracking-wider text-swu-muted mb-2">CASO TEXTOS LARGOS</p>
        <CredencialSVG datos={DATOS_LARGOS} tema={TEMAS_CREDENCIAL[5]} emblema="datapad" className="w-full max-w-xl" />
      </div>
    </div>
  )
}
