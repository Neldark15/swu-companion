/**
 * InsertorMazo — el bloque `[[mazo:]]` sin teclear una sola línea.
 *
 * Dos caminos:
 *  - PEGAR la lista del torneo (SWUDB JSON, SWUDB CSV, texto de Melee o
 *    «3x Nombre»): `importDeckFromText` ya sabe leer los cuatro formatos y no
 *    inventa coincidencias; acá solo se le pone encima la impresión de cada
 *    carta. El artículo de Berlín tiene dos bloques de 40 y 34 líneas escritas
 *    a mano: esto los borra.
 *  - ARMARLO a mano con el selector de cartas.
 *
 * Lo que el formulario hace imposible:
 *  - dos etiquetas `lider:` (son la misma ranura y el bloque entero cae);
 *  - `3xHan Solo` sin espacio, o `1 Han Solo` estilo melee;
 *  - un nombre con subtítulo («Maul | Master of…»), que el parser rechaza;
 *  - `ASH-011` con cero a la izquierda, que se ignora en silencio;
 *  - dos filas de la misma carta, que al pintar se funden sin avisar;
 *  - pasarse de 90 líneas o de 30 copias.
 *
 * Y hace una comprobación que ningún parser puede hacer: resuelve cada
 * referencia como lo hará el artículo y avisa si alguna devuelve OTRA carta.
 */

import { useEffect, useState } from 'react'
import { Plus, Trash2, Check, AlertTriangle, Loader2, ClipboardPaste } from 'lucide-react'
import { Sheet } from '../../../components/ui/Sheet'
import { Button } from '../../../components/ui/Button'
import { SegmentedControl } from '../../../components/ui/SegmentedControl'
import { CardImage } from '../../../components/CardImage'
import { listFaceUrl, listFaceIsLandscape } from '../../../services/cardArt'
import { SelectorCarta } from './SelectorCarta'
import { verificarReferencias, type Desvio } from './resolucionCarta'
import { hidratarMazoEscrito, mazoDesdeLista } from './mazoDesdeLista'
import {
  ETIQUETA_FORMATO, FORMATOS_MAZO, MAX_COPIAS, codigoImpresion, fundirRepetidas,
  limpiarTitulo, limpiarUnaLinea, serializarMazo,
  type FormMazo, type FormatoMazo, type Problema, type RefMazoForm,
} from './sintaxisSalida'
import type { Card } from '../../../types'

type Ranura = 'lider' | 'base' | 'main' | 'banquillo'

export interface InsertorMazoProps {
  onCerrar: () => void
  onAplicar: (texto: string) => void
  /** Bloque ya escrito bajo el cursor, para editarlo. */
  inicial?: { titulo: string; fuente: string; lineas: string[] } | null
}

export function InsertorMazo({ onCerrar, onAplicar, inicial = null }: InsertorMazoProps) {
  const [pestana, setPestana] = useState<'pegar' | 'armar'>(inicial ? 'armar' : 'pegar')
  const [pegado, setPegado] = useState('')
  const [leyendo, setLeyendo] = useState(false)
  const [cargando, setCargando] = useState(inicial !== null)
  const [avisos, setAvisos] = useState<string[]>([])
  const [problemas, setProblemas] = useState<Problema[]>([])
  const [chequeo, setChequeo] = useState<{ clave: string; desvios: Desvio[] } | null>(null)
  const [eligiendo, setEligiendo] = useState<Ranura | null>(null)

  const [form, setForm] = useState<FormMazo>({
    titulo: inicial?.titulo ?? '',
    fuente: inicial?.fuente ?? '',
    formato: 'premier',
    lider: null,
    base: null,
    main: [],
    banquillo: [],
  })

  // Editar: se hidrata el bloque escrito (línea por línea, para no perder las
  // 39 buenas si una está mal).
  const lineasIniciales = inicial?.lineas
  useEffect(() => {
    if (!lineasIniciales) return
    let vivo = true
    void hidratarMazoEscrito(lineasIniciales)
      .then(r => {
        if (!vivo) return
        setForm(f => ({ ...f, ...r.campos, formato: r.formato }))
        setProblemas(r.problemas)
        if (r.sinResolver.length > 0) {
          setAvisos([`No están en la base de este dispositivo: ${r.sinResolver.join(', ')}.`])
        }
      })
      .catch(() => { /* la base local puede estar vacía: se sigue a mano */ })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [lineasIniciales])

  /*
   * Viaje de ida y vuelta de TODAS las referencias, en UNA sola consulta.
   *
   * Las dependencias son los cuatro trozos del formulario y no un array armado
   * al pintar: un array nuevo en cada render volvería a lanzar la comprobación
   * con cada tecla del título.
   */
  const cartas = [
    ...(form.lider ? [form.lider] : []),
    ...(form.base ? [form.base] : []),
    ...form.main.map(r => r.carta),
    ...form.banquillo.map(r => r.carta),
  ]
  const clave = cartas.map(c => `${c.name}|${codigoImpresion(c) ?? ''}`).join('~')
  useEffect(() => {
    let vivo = true
    const refs = [
      ...(form.lider ? [form.lider] : []),
      ...(form.base ? [form.base] : []),
      ...form.main.map(r => r.carta),
      ...form.banquillo.map(r => r.carta),
    ].map(c => ({ nombre: c.name, set: codigoImpresion(c), esperada: c }))
    void verificarReferencias(refs)
      .then(d => { if (vivo) setChequeo({ clave: refs.map(r => `${r.nombre}|${r.set ?? ''}`).join('~'), desvios: d }) })
      .catch(() => { /* sin base local no se puede comprobar */ })
    return () => { vivo = false }
  }, [form.lider, form.base, form.main, form.banquillo])

  const desvios = chequeo && chequeo.clave === clave ? chequeo.desvios : []

  const leerPegado = async () => {
    setLeyendo(true)
    const r = await mazoDesdeLista(pegado)
    setLeyendo(false)
    setAvisos([...r.errores, ...r.avisos])
    if (!r.campos) return
    setForm(f => ({ ...f, ...r.campos! }))
    setPestana('armar')
  }

  const elegir = (carta: Card) => {
    const ranura = eligiendo
    setEligiendo(null)
    if (!ranura) return
    setForm(f => {
      if (ranura === 'lider') return { ...f, lider: carta }
      if (ranura === 'base') return { ...f, base: carta }
      return { ...f, [ranura]: fundirRepetidas([...f[ranura], { carta, cantidad: 1 }]) }
    })
  }

  const cambiarCantidad = (ranura: 'main' | 'banquillo', i: number, delta: number) =>
    setForm(f => ({
      ...f,
      [ranura]: f[ranura].map((r, j) =>
        j === i ? { ...r, cantidad: Math.min(MAX_COPIAS, Math.max(1, r.cantidad + delta)) } : r),
    }))

  const quitar = (ranura: 'main' | 'banquillo', i: number) =>
    setForm(f => ({ ...f, [ranura]: f[ranura].filter((_, j) => j !== i) }))

  const resultado = serializarMazo(form)
  const copias = (l: RefMazoForm[]) => l.reduce((n, r) => n + r.cantidad, 0)

  return (
    <>
      <Sheet open onClose={onCerrar} title={inicial ? 'Editar el mazo' : 'Bloque de mazo'}>
        <div className="space-y-3 p-4">
          {cargando && (
            <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-swu-muted" aria-hidden /></div>
          )}

          {!cargando && (
            <>
              <SegmentedControl<'pegar' | 'armar'>
                label="Cómo armar el mazo"
                value={pestana}
                onChange={setPestana}
                options={[{ value: 'pegar', label: 'Pegar lista' }, { value: 'armar', label: 'Armar' }]}
              />

              {pestana === 'pegar' && (
                <>
                  <textarea
                    value={pegado}
                    onChange={e => setPegado(e.target.value)}
                    rows={8}
                    placeholder={'Pegá la lista: JSON o CSV de SWUDB, el texto de melee.gg\no «3x Nombre de la carta».'}
                    className="w-full rounded-lg border border-swu-border bg-swu-surface px-3 py-2 font-mono text-[12px]
                               text-swu-text placeholder:text-swu-muted/50 focus:outline-none focus:ring-2 focus:ring-swu-accent"
                  />
                  <Button block size="sm" loading={leyendo} onClick={() => void leerPegado()} disabled={!pegado.trim()}>
                    <ClipboardPaste size={14} aria-hidden /> Leer la lista
                  </Button>
                </>
              )}

              {pestana === 'armar' && (
                <>
                  <input
                    value={form.titulo}
                    onChange={e => setForm(f => ({ ...f, titulo: limpiarTitulo(e.target.value) }))}
                    placeholder="Título del mazo (es el nombre con el que se copia)"
                    className="w-full rounded-lg border border-swu-border bg-swu-surface px-3 py-2 text-sm text-swu-text
                               placeholder:text-swu-muted/50 focus:outline-none focus:ring-2 focus:ring-swu-accent"
                  />

                  <select
                    value={form.formato}
                    onChange={e => setForm(f => ({ ...f, formato: e.target.value as FormatoMazo }))}
                    aria-label="Formato"
                    className="w-full rounded-lg border border-swu-border bg-swu-surface px-3 py-2 text-sm text-swu-text"
                  >
                    {FORMATOS_MAZO.map(f => <option key={f} value={f}>{ETIQUETA_FORMATO[f]}</option>)}
                  </select>

                  <div className="grid grid-cols-2 gap-2">
                    <Ranurita etiqueta="Líder" carta={form.lider} onTocar={() => setEligiendo('lider')} />
                    <Ranurita etiqueta="Base" carta={form.base} onTocar={() => setEligiendo('base')} />
                  </div>

                  <Lista
                    titulo={`Mazo principal · ${copias(form.main)} copias`}
                    filas={form.main}
                    onMas={(i) => cambiarCantidad('main', i, 1)}
                    onMenos={(i) => cambiarCantidad('main', i, -1)}
                    onQuitar={(i) => quitar('main', i)}
                    onAgregar={() => setEligiendo('main')}
                  />
                  <Lista
                    titulo={`Banquillo · ${copias(form.banquillo)} copias`}
                    filas={form.banquillo}
                    onMas={(i) => cambiarCantidad('banquillo', i, 1)}
                    onMenos={(i) => cambiarCantidad('banquillo', i, -1)}
                    onQuitar={(i) => quitar('banquillo', i)}
                    onAgregar={() => setEligiendo('banquillo')}
                  />

                  <input
                    value={form.fuente}
                    onChange={e => setForm(f => ({ ...f, fuente: limpiarUnaLinea(e.target.value) }))}
                    placeholder="Fuente (opcional): melee.gg — nombre del torneo"
                    className="w-full rounded-lg border border-swu-border bg-swu-surface px-3 py-2 text-[13px] text-swu-text
                               placeholder:text-swu-muted/50 focus:outline-none focus:ring-2 focus:ring-swu-accent"
                  />
                </>
              )}

              {problemas.length > 0 && (
                <div className="rounded-lg border border-swu-amber/40 bg-swu-amber/5 p-2">
                  <p className="mb-1 text-[11px] font-bold text-swu-amber">El bloque que había estaba roto:</p>
                  <ul className="space-y-0.5 text-[11px] text-swu-text/80">
                    {problemas.slice(0, 6).map((p, i) => (
                      <li key={i}>
                        {p.linea > 0 ? <span className="font-mono">línea {p.linea}: «{p.texto}» — </span> : null}
                        {p.motivo}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {avisos.map((a, i) => (
                <p key={i} className="flex items-start gap-1.5 text-[11px] text-swu-amber">
                  <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" aria-hidden /> {a}
                </p>
              ))}

              {desvios.map((d, i) => (
                <p key={i} className="flex items-start gap-1.5 text-[11px] text-swu-amber">
                  <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" aria-hidden />
                  {d.obtenida
                    ? `«${d.referencia.nombre}» va a dibujar «${d.obtenida.name}${d.obtenida.subtitle ? `, ${d.obtenida.subtitle}` : ''}» (${d.obtenida.setCode}-${d.obtenida.setNumber}). Elegí otra impresión.`
                    : `«${d.referencia.nombre}» no resuelve contra la base de este dispositivo.`}
                </p>
              ))}

              {resultado.ok ? (
                <pre className="max-h-40 overflow-auto rounded-lg border border-swu-border bg-swu-bg px-3 py-2 font-mono text-[10px] leading-relaxed text-swu-text">
                  {resultado.texto}
                </pre>
              ) : (
                <p className="flex items-start gap-1.5 text-[12px] text-swu-red-texto">
                  <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" aria-hidden /> {resultado.error}
                </p>
              )}

              <Button block size="sm" disabled={!resultado.ok} onClick={() => { if (resultado.ok) { onAplicar(resultado.texto); onCerrar() } }}>
                <Check size={14} aria-hidden /> {inicial ? 'Reemplazar el bloque' : 'Insertar el bloque'}
              </Button>
            </>
          )}
        </div>
      </Sheet>

      <SelectorCarta
        abierto={eligiendo !== null}
        onCerrar={() => setEligiendo(null)}
        onElegir={elegir}
        titulo={eligiendo === 'lider' ? 'Elegir líder' : eligiendo === 'base' ? 'Elegir base' : 'Agregar carta'}
        tipo={eligiendo === 'lider' ? 'Leader' : eligiendo === 'base' ? 'Base' : undefined}
      />
    </>
  )
}

function Ranurita({ etiqueta, carta, onTocar }: { etiqueta: string; carta: Card | null; onTocar: () => void }) {
  return (
    <button
      onClick={onTocar}
      className="flex items-center gap-2 rounded-lg border border-swu-border bg-swu-surface p-2 text-left"
    >
      <div className="w-12 flex-shrink-0">
        {carta
          ? <CardImage src={listFaceUrl(carta)} orientacion={listFaceIsLandscape(carta) ? 'apaisada' : 'vertical'} alt={carta.name} className="w-full" />
          : <div className="aspect-[286/400] w-full rounded bg-swu-bg" aria-hidden />}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-swu-muted">{etiqueta}</p>
        <p className="truncate text-[12px] font-semibold text-swu-text">{carta?.name ?? 'Elegir…'}</p>
        {carta && <p className="truncate font-mono text-[10px] text-swu-cyan">{codigoImpresion(carta) ?? '—'}</p>}
      </div>
    </button>
  )
}

function Lista(
  { titulo, filas, onMas, onMenos, onQuitar, onAgregar }: {
    titulo: string
    filas: RefMazoForm[]
    onMas: (i: number) => void
    onMenos: (i: number) => void
    onQuitar: (i: number) => void
    onAgregar: () => void
  },
) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-swu-muted">{titulo}</span>
        <Button size="xs" variant="ghost" onClick={onAgregar}><Plus size={12} aria-hidden /> Carta</Button>
      </div>
      <div className="space-y-1">
        {filas.map((r, i) => (
          <div key={`${r.carta.id}-${i}`} className="flex items-center gap-2 rounded-lg border border-swu-border bg-swu-surface px-2 py-1.5">
            <div className="w-8 flex-shrink-0">
              <CardImage src={listFaceUrl(r.carta)} orientacion={listFaceIsLandscape(r.carta) ? 'apaisada' : 'vertical'} alt="" className="w-full" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] text-swu-text">{r.carta.name}</p>
              <p className="truncate font-mono text-[10px] text-swu-muted">{codigoImpresion(r.carta) ?? 'sin código'}</p>
            </div>
            <button onClick={() => onMenos(i)} aria-label="Una menos" className="px-2 text-swu-muted">−</button>
            <span className="w-5 text-center text-[12px] font-bold text-swu-text">{r.cantidad}</span>
            <button onClick={() => onMas(i)} aria-label="Una más" className="px-2 text-swu-muted">+</button>
            <button onClick={() => onQuitar(i)} aria-label="Quitar" className="pl-1 text-swu-red-texto">
              <Trash2 size={13} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
