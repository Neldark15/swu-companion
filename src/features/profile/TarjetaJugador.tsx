/**
 * TarjetaJugador — quién sos, de un vistazo. AHORA ES LA CREDENCIAL.
 *
 * Vive acá y no dentro de ProfilePage porque la usan DOS pantallas: el perfil
 * y el inicio. Tenerla duplicada garantizaba que se fueran separando —una
 * ganaría la bandera del país, la otra el nivel— y que la app se contradijera
 * consigo misma según por dónde entrás.
 *
 * POR QUÉ CAMBIÓ
 * Antes era una fila: avatar en un marco, nombre, rango, país. Correcta y
 * olvidable. Al mismo tiempo existía /credencial —la placa galáctica, con su
 * emblema, su Aurebesh y su acabado ganado por nivel— escondida en una pantalla
 * a la que había que ir a propósito. Eran dos identidades distintas de la misma
 * persona compitiendo entre ellas. Ganó la que se puede imprimir.
 *
 * Lo que NO se fue: la barra de experiencia. La placa dice en qué rango estás;
 * el sable dice cuánto falta para el siguiente, y ese dato no está en ninguna
 * otra parte de Inicio.
 */

import { useNavigate } from 'react-router-dom'
import { LightsaberXpBar } from './components/LightsaberXpBar'
import { useSettings } from '../../hooks/useSettings'
import { CredencialInteractiva } from '../credencial/CredencialInteractiva'
import { useDatosCredencial } from '../credencial/useDatosCredencial'
import { temaCredencial } from '../credencial/credencialTemas'
import type { PlayerStats } from '../../services/gamification'
import type { UserProfile } from '../../services/db'

interface Props {
  perfil: UserProfile
  stats: PlayerStats | null
  /** Hay sesión en la nube: se muestra «Online». */
  enLinea?: boolean
  /** En Inicio la tarjeta lleva al perfil; dentro del perfil no lleva a ningún lado. */
  alTocar?: 'perfil' | 'nada'
  size?: number
}

export function TarjetaJugador({ perfil, stats, enLinea = false, alTocar = 'nada' }: Props) {
  const navigate = useNavigate()
  const credencialTema = useSettings((s) => s.credencialTema)
  const credencialEmblema = useSettings((s) => s.credencialEmblema)
  const { datos, acabado } = useDatosCredencial(perfil, stats)

  return (
    <div className="flex flex-col items-center">
      <CredencialInteractiva
        datos={datos}
        tema={temaCredencial(credencialTema)}
        emblema={credencialEmblema}
        acabado={acabado}
        // La pista de arrastre se muestra donde la placa es el tema (el
        // perfil). En Inicio, rodeada de otros seis módulos, sería una línea
        // de instrucciones más que nadie pidió.
        conPista={alTocar === 'nada'}
        // Un toque SIN arrastre lleva al perfil. El envoltorio distingue las
        // dos cosas: girar la placa no puede terminar en un cambio de pantalla.
        onTocar={alTocar === 'perfil' ? () => navigate('/profile') : undefined}
        etiquetaToque="Ver mi perfil"
      />

      {/* El sable, debajo de la placa y a su mismo ancho. */}
      {stats && (
        <div className="mt-3 w-full" style={{ maxWidth: '36rem' }}>
          <LightsaberXpBar xp={stats.xp} />
        </div>
      )}

      {enLinea && (
        <span className="mt-2 text-[9px] bg-swu-green/20 text-swu-green px-2 py-0.5 rounded-full font-bold">
          Online
        </span>
      )}
    </div>
  )
}
