/**
 * BANCO DEL CARRITO — la burbuja y su hoja, sin sesión y sin mercado.
 *
 * La burbuja solo aparece con cartas de verdad en el carrito, o sea detrás del
 * login, de la puerta de instalación y de haber agregado algo. Sin esto se
 * subiría sin que nadie la viera — que es exactamente cómo se colaron un
 * encabezado duplicado y un texto a 2,02:1 en el álbum.
 *
 * Los datos son de mentira PERO con los casos que rompen: dos vendedores (que
 * son dos pedidos distintos), una carta sin ficha en Dexie, y un total con
 * decimales que no redondea bonito.
 */

import { useState } from 'react'
import { CarritoFlotante } from './CarritoFlotante'
import type { Pedido } from '../../services/mercadoPedidos'
import type { Card } from '../../types'

function carta(id: string, name: string): Card {
  return {
    id, name, subtitle: null, type: 'Unit', rarity: 'Common', cost: 2, power: 2, hp: 2,
    aspects: [], traits: [], keywords: [], arena: 'Ground', text: '', deployBox: null,
    epicAction: null, setCode: 'ASH', setNumber: 1, artist: '', imageUrl: '',
    backImageUrl: null, isUnique: false, isLeader: false, isBase: false,
  }
}

const CARRITOS: Pedido[] = [
  {
    id: 'p1', compradorId: 'yo', vendedorId: 'v1', estado: 'carrito', venueId: null,
    enviadoEn: null, respondidoEn: null, cerradoEn: null, motivo: null,
    otro: { id: 'v1', name: 'ElDaigo', avatar: null },
    lineas: [
      { cardId: 'c1', cantidad: 2, precioUnitario: 0.85 },
      { cardId: 'c2', cantidad: 1, precioUnitario: 1.33 },
    ],
  },
  {
    id: 'p2', compradorId: 'yo', vendedorId: 'v2', estado: 'carrito', venueId: null,
    enviadoEn: null, respondidoEn: null, cerradoEn: null, motivo: null,
    otro: { id: 'v2', name: 'Vara', avatar: null },
    // `c3` NO está en el mapa: es una carta que Dexie todavía no bajó.
    lineas: [{ cardId: 'c3', cantidad: 3, precioUnitario: 0.5 }],
  },
]

const CARTAS = new Map<string, Card>([
  ['c1', carta('c1', 'Rogue Squadron Skirmisher')],
  ['c2', carta('c2', 'Cad Bane')],
])

export function BancoCarrito() {
  const [vacio, setVacio] = useState(false)

  return (
    <div className="mx-auto max-w-2xl space-y-3 px-4 py-6">
      <h1 className="text-xl font-black text-swu-text">Banco del carrito</h1>
      <p className="text-sm text-swu-muted">
        Solo en desarrollo. La burbuja aparece abajo a la derecha; tocala para
        ver la hoja. Los botones de cantidad no hacen nada acá: no hay servidor.
      </p>
      <button
        type="button"
        onClick={() => setVacio(v => !v)}
        className="rounded-lg border border-swu-border bg-swu-surface px-3 py-2.5 text-sm text-swu-text"
      >
        {vacio ? 'Poner dos carritos' : 'Vaciar (la burbuja debe DESAPARECER)'}
      </button>
      <p className="text-[11px] text-swu-muted">
        Total esperado: 2×0,85 + 1×1,33 + 3×0,50 = <strong>$4,53</strong> · 6 cartas
      </p>

      <CarritoFlotante
        carritos={vacio ? [] : CARRITOS}
        cartas={CARTAS}
        alCambiar={() => {}}
      />
    </div>
  )
}
