/**
 * BancoConsola — banco de pruebas de las bahías de Inicio. **Solo desarrollo.**
 *
 * Existe por la misma razón que los otros bancos: la puerta de instalación tapa
 * Inicio en un navegador normal (§3d), así que no hay forma de MIRAR cómo queda
 * la consola sin instalar la app. Y monta las piezas de verdad —`BahiaModulos`
 * y `MosaicoModulo`— con los módulos reales; un banco que dibuja su propia
 * imitación no prueba nada.
 *
 * Además mide lo que esta pantalla vino a arreglar: cuánto alto ocupa la
 * cuadrícula de módulos abierta contra cerrada. Ese número es el argumento.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import {
  MandoTrophyIcon, CargoIcon, DeckCardsIcon, StarfighterIcon, DatapadIcon,
  BountyIcon, DeathStarIcon, BeskarIcon, HolonetIcon, ChanceCubeIcon,
  KyberIcon, LabIcon, HolocronIcon, SaberIcon, BlasterIcon, AgendaIcon, MetaHoloIcon, EmisionIcon, SobreIcon, BinderIcon, PedidoIcon,
  SalasIcon, CredencialIcon, TransmisionIcon, RebelIcon, ArticuloIcon,
} from '../../components/SWIcons'
import type { HudTone } from '../../components/hudTones'
import { BahiaModulos } from './BahiaModulos'
import { MosaicoModulo, type ModuloVisible } from './MosaicoModulo'

type Cat = 'jugar' | 'competir' | 'construir' | 'coleccion' | 'comunidad'

const BAHIAS: {
  id: Cat; titulo: string; icono: typeof DatapadIcon; tono: HudTone; modulos: ModuloVisible[]
}[] = [
  {
    id: 'jugar', titulo: 'Jugar', icono: SaberIcon, tono: 'green',
    modulos: [
      { icon: ChanceCubeIcon,  label: 'Contador de daños', tone: 'purple', to: '#' },
      { icon: BlasterIcon,     label: 'Amistosas',         tone: 'green',  to: '#' },
      { icon: SaberIcon,       label: 'Duelo',             tone: 'green',  to: '#' },
      { icon: DeathStarIcon,   label: 'Misiones',          tone: 'amber',  to: '#' },
    ],
  },
  {
    id: 'competir', titulo: 'Competir', icono: MandoTrophyIcon, tono: 'amber',
    modulos: [
      { icon: MandoTrophyIcon, label: 'Torneos',    tone: 'amber', to: '#' },
      { icon: AgendaIcon,      label: 'Calendario', tone: 'cyan',  to: '#' },
      { icon: MetaHoloIcon,    label: 'Meta',       tone: 'cyan',  to: '#' },
      { icon: BeskarIcon,      label: 'Ranking',    tone: 'amber', to: '#' },
      { icon: EmisionIcon,     label: 'En Vivo',    tone: 'red',   to: '#' },
    ],
  },
  {
    id: 'construir', titulo: 'Construir', icono: DeckCardsIcon, tono: 'cyan',
    modulos: [
      { icon: DeckCardsIcon, label: 'Mis Decks',     tone: 'green', to: '#' },
      { icon: LabIcon,       label: 'Laboratorio',   tone: 'cyan',  to: '#' },
      { icon: HolonetIcon,   label: 'Buscar Cartas', tone: 'cyan',  to: '#' },
      { icon: HolocronIcon,  label: 'Rulings',       tone: 'cyan',  to: '#' },
    ],
  },
  {
    id: 'coleccion', titulo: 'Colección', icono: CargoIcon, tono: 'purple',
    modulos: [
      { icon: CargoIcon,     label: 'Mi Botín',       tone: 'green', to: '#' },
      { icon: SobreIcon,     label: 'Sobredosis',     tone: 'amber', to: '#' },
      { icon: BinderIcon,    label: 'Binder digital', tone: 'cyan',  to: '#' },
      { icon: BountyIcon,    label: 'Contrabando',    tone: 'red',   to: '#' },
      { icon: KyberIcon,     label: 'Mercancía',      tone: 'amber', to: '#' },
      { icon: PedidoIcon,    label: 'Pedidos',        tone: 'green', to: '#' },
    ],
  },
  {
    id: 'comunidad', titulo: 'Comunidad', icono: StarfighterIcon, tono: 'red',
    modulos: [
      { icon: StarfighterIcon, label: 'La Galaxia',    tone: 'cyan',  to: '#' },
      { icon: SalasIcon,       label: 'Salas',         tone: 'cyan',  to: '#' },
      { icon: CredencialIcon,  label: 'Mi Credencial', tone: 'amber', to: '#' },
      { icon: TransmisionIcon, label: 'Mensajes',      tone: 'green', to: '#' },
      { icon: RebelIcon,       label: 'Comunidades',   tone: 'green', to: '#' },
      { icon: ArticuloIcon,    label: 'Blog',          tone: 'cyan',  to: '#' },
    ],
  },
]

export function BancoConsola() {
  const [abiertas, setAbiertas] = useState<Set<Cat>>(new Set(['jugar']))
  const [medida, setMedida] = useState<{ alto: number; abiertas: number } | null>(null)
  const zona = useRef<HTMLDivElement>(null)

  const medir = useCallback(() => {
    if (!zona.current) return
    setMedida({
      alto: Math.round(zona.current.getBoundingClientRect().height),
      abiertas: abiertas.size,
    })
  }, [abiertas])

  // Se mide DESPUÉS de que termine la animación de alto: medir en el mismo
  // cuadro del clic devuelve el alto de partida y el número miente.
  useEffect(() => {
    const t = setTimeout(medir, 400)
    return () => clearTimeout(t)
  }, [medir])

  const alternar = (id: Cat) => setAbiertas(p => {
    const n = new Set(p)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })

  const todas = () => setAbiertas(new Set(BAHIAS.map(b => b.id)))
  const ninguna = () => setAbiertas(new Set())

  return (
    <div className="min-h-screen bg-swu-bg pb-16">
      <div className="px-4 pt-4 space-y-2" data-banco-consola="1">
        <p className="font-mono text-[11px] text-swu-muted">
          Banco de la consola · {BAHIAS.length} bahías ·{' '}
          {BAHIAS.reduce((s, b) => s + b.modulos.length, 0)} módulos ·{' '}
          {medida ? `${medida.alto} px con ${medida.abiertas} abierta(s)` : 'midiendo…'}
        </p>
        <div className="flex gap-2">
          <button onClick={todas}
            className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-swu-border
                       px-3 text-[11px] font-bold text-swu-muted">
            <ChevronsUpDown size={13} /> Abrir todas
          </button>
          <button onClick={ninguna}
            className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-swu-border
                       px-3 text-[11px] font-bold text-swu-muted">
            <ChevronsDownUp size={13} /> Cerrar todas
          </button>
        </div>
      </div>

      <div ref={zona}>
        {BAHIAS.map(({ id, titulo, icono: Icono, tono, modulos }) => (
          <BahiaModulos
            key={id}
            titulo={titulo}
            icono={<Icono size={15} />}
            tono={tono}
            cantidad={modulos.length}
            abierta={abiertas.has(id)}
            onAlternar={() => alternar(id)}
          >
            {modulos.map(m => <MosaicoModulo key={m.label} sys={m} />)}
          </BahiaModulos>
        ))}
      </div>

      <p className="px-4 pt-6 font-mono text-[10px] leading-relaxed text-swu-muted">
        Cerrá todas y abrí una: el alto de arriba es lo que esta pantalla vino a
        arreglar. Con las cinco abiertas es lo que hay hoy en Inicio.
      </p>
    </div>
  )
}
