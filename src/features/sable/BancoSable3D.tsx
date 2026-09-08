/** Banco DEV del mismo editor de producción. Sin sesión ni llamadas de red.
 * Los nombres, rarezas y stats de prueba no representan la tienda real. */
import { useState } from 'react'
import type { ParteTaller, Taller } from '../../services/sableService'
import { IDS_CONOCIDOS, POR_DEFECTO, type Diseno } from './partesSable'
import { TallerKyber } from './TallerKyber'

const NOMBRES: Record<string, string> = {
  emi_estandar: 'Estándar', emi_faro: 'Faro', cue_liso: 'Liso', cue_placas: 'Blindaje', pom_plano: 'Plano',
  col_azul: 'Kyber azul', col_verde: 'Kyber verde', col_blanco: 'Kyber purificado',
  col_cian: 'Hielo', col_naranja: 'Fragua', col_magenta: 'Aurora rosa',
  col_menta: 'Aliento', col_lima: 'Savia', col_turquesa: 'Marea', col_lavanda: 'Ceniza',
  col_oro: 'Reliquia', col_indigo: 'Abismo', col_violeta: 'Vértice',
}

const PARTES_DEMO: ParteTaller[] = (Object.keys(IDS_CONOCIDOS) as ParteTaller['tipo'][]).flatMap(tipo =>
  IDS_CONOCIDOS[tipo].map((id, i) => ({
    id, tipo, nombre: NOMBRES[id] ?? id.replace(/^[a-z]+_/, '').replaceAll('_', ' '),
    precio: 0, orden: i + 1, tengo: true,
    rareza: i < 3 ? 'comun' : i < 6 ? 'raro' : i < 9 ? 'epico' : 'legendario',
    potencia: 6 + (i % 4) * 2, control: 6 + ((i + 1) % 4) * 2, energia: 6 + ((i + 2) % 4) * 2,
  })),
)

const TALLER_DEMO: Taller = {
  saldo: 0, xpTotal: 0, nivel: 1, cuantasTengo: PARTES_DEMO.length,
  cuantasHay: PARTES_DEMO.length, partes: PARTES_DEMO, diseno: null,
  acabados: [
    { id: 'acero', nombre: 'Acero' }, { id: 'grafito', nombre: 'Grafito' },
    { id: 'negro', nombre: 'Cromo negro' }, { id: 'laton', nombre: 'Latón' },
    { id: 'cobre', nombre: 'Cobre' }, { id: 'bronce', nombre: 'Bronce' },
    { id: 'cuero', nombre: 'Cuero' }, { id: 'hueso', nombre: 'Hueso' },
    { id: 'esmalte', nombre: 'Esmalte' }, { id: 'jade', nombre: 'Jade' },
  ],
}

export function BancoSable3D() {
  const [diseno, setDiseno] = useState<Diseno>({
    ...POR_DEFECTO, emisor: 'emi_faro', cuerpo: 'cue_placas', pomo: 'pom_plano',
    color: 'col_cian', cristalVisto: true,
  })
  const [nombre, setNombre] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)

  function guardarLocal() {
    try {
      localStorage.setItem('kyber-banco-diseno', JSON.stringify({ diseno, nombre: nombre.trim() }))
      setAviso('Prueba guardada en este navegador. Tu sable de la cuenta no cambia.')
    } catch {
      setAviso('Este navegador no permite guardar la prueba local.')
    }
  }

  return <TallerKyber demo pasoInicial="prueba" taller={TALLER_DEMO} diseno={diseno} nombre={nombre} aviso={aviso} ocupado={false}
    alCambiarDiseno={setDiseno} alCambiarNombre={setNombre} alLimpiarAviso={() => setAviso(null)}
    alElegirParte={parte => { setDiseno(d => ({ ...d, [parte.tipo]: parte.id })); setAviso(null) }}
    alGuardar={guardarLocal} />
}
