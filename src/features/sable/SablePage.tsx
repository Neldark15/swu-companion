/**
 * TALLER KYBER — armá tu sable de luz. `/sable`
 *
 * ── Abierto a la comunidad (2026-08-24) ───────────────────────────────
 *
 * Nació cerrado a una cuenta para probarlo. Nel: «que sea accesible para la
 * comunidad el poder editar el sable». La puerta ahora es tener sesión, y el
 * guardia sigue DENTRO de cada RPC (`sable_abierto()`), no acá — un gate de
 * cliente se salta con la consola, y esa lección ya costó una prueba en el
 * Centro de Temporada (§3i-bis).
 *
 * Lo que sigue cerrado son las piezas con `oculta`: los cinco legendarios,
 * guardados para su estreno, y el cristal rojo, que se gana sangrando. Abrir
 * el taller no fue estrenar el catálogo.
 *
 * ── Se paga con CRÉDITOS, que son tu XP ───────────────────────────────
 *
 * Medido: el XP no tenía sumidero en toda la app. Solo entraba —misiones,
 * torneos, 50 por sobre abierto— y lo único que hacía era subir el nivel. Acá
 * sirve para algo. Se llama «créditos» en pantalla porque en una tienda del
 * universo la moneda no se llama «puntos de experiencia», pero es el MISMO
 * número: no hay dos economías.
 *
 * Y pagar con SOBRES estaba descartado: competiría con abrirlos, y con 333
 * sobres sin abrir eso es lo último que hace falta.
 *
 * ── Gastar NO baja de nivel ───────────────────────────────────────────
 *
 * `player_stats.level` se deriva de `xp`, así que restar de ahí degradaría al
 * que compra. El saldo es `total − gastado`, derivado en el servidor de los
 * recibos del inventario; `xp` nunca baja.
 *
 * ── Cuatro pasos, y el orden importa ──────────────────────────────────
 *
 * Piezas → Cristal → Color → Prueba. El cristal va ANTES del color porque el
 * cristal decide de qué colores se puede elegir; al revés, uno elige un color y
 * después descubre que no tiene el cristal.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { TallerKyber } from './TallerKyber'
import { POR_DEFECTO, type Diseno } from './partesSable'
import {
  abrirTaller, comprarParte, guardarSable,
  type ParteTaller, type Taller,
} from '../../services/sableService'

export function SablePage() {
  const [taller, setTaller] = useState<Taller | null>(null)
  const [cargando, setCargando] = useState(true)
  const [diseno, setDiseno] = useState<Diseno>(POR_DEFECTO)
  const [nombre, setNombre] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [avisoDatos, setAvisoDatos] = useState<string | null>(null)
  const [refrescando, setRefrescando] = useState(true)
  const [saldoPendiente, setSaldoPendiente] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [recarga, setRecarga] = useState(0)
  const hidratado = useRef(false)
  const operacionEnCurso = useRef(false)
  const recargar = useCallback(() => {
    setRefrescando(true)
    setSaldoPendiente(true)
    setAvisoDatos(null)
    setRecarga(n => n + 1)
  }, [])

  useEffect(() => {
    let vivo = true
    void (async () => {
      try {
        const t = await abrirTaller()
        if (!vivo) return
        // La recarga confirma saldo e inventario. Solo la primera lectura
        // hidrata el editor: el diseño guardado puede ser anterior a la pieza
        // recién comprada y no debe borrar la selección ni el nombre editado.
        if (t) {
          setTaller(t)
          setSaldoPendiente(false)
          setAvisoDatos(null)
          if (!hidratado.current) {
            if (t.diseno) {
              const { nombre: nombreGuardado, ...disenoGuardado } = t.diseno
              setDiseno(disenoGuardado)
              setNombre(nombreGuardado ?? '')
            }
            hidratado.current = true
          }
        } else {
          setAvisoDatos(hidratado.current
            ? 'No se pudo actualizar el saldo y el inventario. Tus compras confirmadas se conservan. Actualizá para seguir comprando.'
            : 'No se pudo abrir el taller. Revisá tu conexión y volvé a intentar.')
        }
      } catch {
        if (vivo) setAvisoDatos(hidratado.current
          ? 'No se pudo actualizar el saldo y el inventario. Tus compras confirmadas se conservan. Actualizá para seguir comprando.'
          : 'No se pudo abrir el taller. Revisá tu conexión y volvé a intentar.')
      } finally {
        if (vivo) { setCargando(false); setRefrescando(false) }
      }
    })()
    return () => { vivo = false }
  }, [recarga])

  const tocar = useCallback(async (p: ParteTaller) => {
    if (operacionEnCurso.current) return
    setAviso(null)
    if (p.tengo) {
      setDiseno(d => ({ ...d, [p.tipo]: p.id }))
      return
    }
    if (saldoPendiente) return
    operacionEnCurso.current = true
    setOcupado(true)
    try {
      const r = await comprarParte(p.id)
      if (!r.ok) {
        setAviso(r.mensaje ?? 'No se pudo comprar')
        // También reconcilia «ya la tenés» si se compró desde otra pestaña.
        recargar()
        return
      }
      // Esto es una compra CONFIRMADA por la RPC, no un anticipo optimista.
      // Si la lectura siguiente falla, la pieza sigue disponible para equipar.
      // El saldo y los contadores esperan siempre a la respuesta del servidor.
      setTaller(actual => actual ? {
        ...actual, partes: actual.partes.map(parte => parte.id === p.id ? { ...parte, tengo: true } : parte),
      } : actual)
      // El saldo se relee del servidor: nunca se resta un precio en cliente.
      recargar()
      setDiseno(d => ({ ...d, [p.tipo]: p.id }))
      setAviso(`${p.nombre} es tuya`)
    } catch {
      setAviso('No se pudo confirmar la compra. Revisá tu conexión.')
      // Una respuesta perdida puede haber cobrado: releer antes de otra compra.
      recargar()
    } finally {
      operacionEnCurso.current = false
      setOcupado(false)
    }
  }, [recargar, saldoPendiente])

  const guardar = useCallback(async () => {
    if (operacionEnCurso.current) return
    operacionEnCurso.current = true
    setOcupado(true)
    setAviso(null)
    try {
      const r = await guardarSable(diseno, nombre)
      setAviso(r.ok ? 'Sable forjado' : (r.mensaje ?? 'No se pudo guardar'))
    } catch {
      setAviso('No se pudo guardar. Revisá tu conexión y volvé a intentar.')
    } finally {
      operacionEnCurso.current = false
      setOcupado(false)
    }
  }, [diseno, nombre])

  if (cargando) return <div className="kyber-taller kyber-estado" role="status">Encendiendo la forja…</div>

  if (!taller) return (
    <div className="kyber-taller kyber-estado">
      <Lock size={26} aria-hidden="true" />
      <h1>Entrá con tu cuenta</h1>
      <p>El Taller Kyber usa tus créditos y guarda tu sable, así que necesita saber quién sos. Si ya entraste, revisá tu conexión.</p>
      {avisoDatos && <p role="status">{avisoDatos}</p>}
      <button type="button" className="kyber-siguiente" onClick={recargar} disabled={refrescando}>
        {refrescando ? 'Actualizando…' : 'Volver a intentar'}
      </button>
      <Link to="/">Volver a Inicio</Link>
    </div>
  )

  return <TallerKyber taller={taller} diseno={diseno} nombre={nombre} ocupado={ocupado} aviso={avisoDatos ?? aviso}
    refrescando={refrescando} comprasBloqueadas={saldoPendiente} alReintentarAviso={avisoDatos ? recargar : undefined}
    alCambiarDiseno={setDiseno} alCambiarNombre={setNombre} alElegirParte={tocar}
    alGuardar={guardar} alLimpiarAviso={() => setAviso(null)} />
}
