import { useState } from 'react'
import { Sheet } from '../../components/ui/Sheet'
import { Button } from '../../components/ui/Button'

/**
 * Dos paneles apilados, que es la situación del estudio de artículos: el
 * selector de cartas se monta ENCIMA del panel del mazo. Un Escape solo puede
 * cerrar el de arriba.
 */
export function BancoPaneles() {
  const [abajo, setAbajo] = useState(false)
  const [arriba, setArriba] = useState(false)
  return (
    <div className="mx-auto max-w-lg space-y-3 px-4 py-6">
      <h1 className="text-xl font-black text-swu-text">Banco de paneles</h1>
      <p className="text-sm text-swu-muted">Solo en desarrollo. Abrí los dos y probá Escape.</p>
      <Button onClick={() => setAbajo(true)}>Abrir el de abajo</Button>
      <p data-estado className="font-mono text-xs text-swu-muted">
        abajo:{String(abajo)} arriba:{String(arriba)} overflow:{document.body.style.overflow || 'vacio'}
      </p>
      <Sheet open={abajo} onClose={() => setAbajo(false)} title="Panel de abajo">
        <Button onClick={() => setArriba(true)}>Abrir el de arriba</Button>
        <Sheet open={arriba} onClose={() => setArriba(false)} title="Panel de arriba">
          <p className="text-sm text-swu-text">Escape tiene que cerrar SOLO este.</p>
        </Sheet>
      </Sheet>
    </div>
  )
}
