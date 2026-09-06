/**
 * Banco del lobby de la liga — /banco-lobby-liga (solo desarrollo)
 *
 * La Fase 3 es la fase VISUAL: la paleta azul acotada al módulo, el carrusel
 * de cifras, la cuenta atrás, las banderas, la tira de anuncios y el bloque de
 * reglas. Nada de eso se puede juzgar leyendo el código, y el lobby de verdad
 * vive detrás de una liga en `inscripcion` con sesión de alguien inscrito —
 * o sea que, otra vez, no hay forma de verlo (§4o, §4u).
 *
 * Acá están las piezas nuevas con datos de mentira, dentro de un
 * `data-modulo="liga"` para que las variables de la paleta existan. Si el azul
 * no aparece, es que ese atributo se perdió: fuera de él, `--liga-acento` no
 * está definida y los bordes salen transparentes.
 */

import { useState } from 'react'
import { Trophy, Swords, CalendarClock, BookOpen, Megaphone, Settings2, Users, Globe2, Layers, Star, CalendarDays, Timer, ChevronRight, Zap } from 'lucide-react'
import { Bandera, TarjetaCifra, ContadorPlazo } from './componentes/piezas'
import { Atajo, AnunciosLiga, ComoFunciona, TopOcho, Padron } from './LigaSeccion'
import { PortadaLiga } from './PortadaLiga'
import { BotonLiga } from './BotonLigaInicio'
import { useActualizacion } from '../../services/actualizacion'
import type { AnuncioLiga, InscritoPanel } from '../../services/ligaService'
import { FichaInscrito, FilaDia } from './PanelLiga'

const hoyMas = (d: number) => {
  const f = new Date()
  f.setDate(f.getDate() + d)
  return f.toISOString().slice(0, 10)
}

const ANUNCIOS: AnuncioLiga[] = [
  { id: '1', titulo: 'Se sembró la jornada 4', cuerpo: 'Ya están los emparejamientos. Tienen hasta el domingo para jugarla y anotarla.', creadoEn: new Date().toISOString() },
  { id: '2', titulo: 'Cambio de horario del directo', cuerpo: 'La transmisión del sábado se corre una hora: 8pm hora de El Salvador.', creadoEn: new Date().toISOString() },
]

const P = (id: string, nombre: string, pais: string | null, esMia = false) => ({
  id, grupoId: 'g', nombre, lider: 'Orbe Negro', base: null,
  estado: 'activa' as const, esMia, pais,
})
const M = (l: string, v: string, vl: number, vv: number, j: number) => ({
  id: `${l}-${v}`, grupoId: 'g', jornada: j, localPlaza: l, visitaPlaza: v,
  vl, vv, estado: 'confirmada' as const, origen: 'acuerdo' as const,
  venceEl: null, vod: null, reportadaPor: null,
})
const PLAZAS = [
  P('1', 'KaelSor', 'BR'), P('2', 'NovaShard', 'AR'), P('3', 'Zenith', 'ES'),
  P('4', 'Nelson Morales', 'SV', true), P('5', 'PlayerOmega', 'MX'),
  P('6', 'CardMaster', 'CO'), P('7', 'Lumen', 'PE'), P('8', 'Sin país', null),
]
const GRUPO = {
  id: 'g', tier: 'legendario', orden: 1, estado: 'en_curso' as const,
  arranca: '2026-09-01', cierra: '2026-10-01',
  plazas: PLAZAS,
  partidas: [
    M('1', '2', 2, 0, 1), M('1', '3', 2, 1, 2), M('1', '4', 2, 0, 3),
    M('2', '3', 2, 0, 1), M('2', '4', 2, 1, 2), M('3', '5', 2, 0, 1),
    M('4', '5', 2, 0, 1), M('6', '7', 2, 0, 1), M('7', '8', 0, 2, 2),
  ],
} as never
/** El día 1: todos en cero. Sin medallas, o el oro lo gana el abecedario. */
const GRUPO_DIA1 = { ...(GRUPO as never as Record<string, unknown>), partidas: [] } as never

/** Una semana declarada: 168 caracteres, índice = día×24 + hora, lunes primero. */
const semana = (tramos: Array<[number, number, number]>) => {
  const a = Array(168).fill('0')
  for (const [d, desde, hasta] of tramos) for (let h = desde; h < hasta; h++) a[d * 24 + h] = '1'
  return a.join('')
}
const INSCRITOS: InscritoPanel[] = [
  { inscId: '1', nombre: 'Nelson Morales', tier: 'legendario', estado: 'activo',
    lider: 'Krennic', base: 'Command', pais: 'SV', zona: 'America/El_Salvador',
    franjas: semana([[1, 20, 23], [3, 20, 23], [5, 14, 20]]), horas: 12, inscritoEn: '' },
  { inscId: '2', nombre: 'Rodrigo con un nombre bien largo', tier: 'raro', estado: 'activo',
    lider: 'Sabine', base: null, pais: 'ES', zona: 'Europe/Madrid',
    franjas: semana([[5, 10, 14]]), horas: 4, inscritoEn: '' },
  { inscId: '3', nombre: 'Sin horas ni país', tier: 'comun', estado: 'activo',
    lider: null, base: null, pais: null, zona: null, franjas: null, horas: 0, inscritoEn: '' },
  { inscId: '4', nombre: 'Se retiró', tier: 'infrecuente', estado: 'retirado',
    lider: 'Vader', base: 'Yellow', pais: 'MX', zona: 'America/Mexico_City',
    franjas: semana([[6, 18, 22]]), horas: 4, inscritoEn: '' },
]
/** El calor global, con la forma que arma el propio panel. */
const CALOR = (() => {
  const cuenta = Array(168).fill(0)
  for (const i of INSCRITOS) {
    const f = i.franjas ?? ''
    for (let k = 0; k < f.length; k++) if (f[k] === '1') cuenta[k]++
  }
  return { cuenta, conFranjas: 3, sinZona: 1 }
})() as never

export function BancoLobbyLiga() {
  const [portada, setPortada] = useState(false)
  const [reglas, setReglas] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  return (
    <div data-modulo="liga" className="min-h-screen bg-swu-bg p-4">
      <h1 className="mb-1 text-lg font-bold text-swu-text">El lobby de la liga</h1>
      <p className="mb-4 text-xs text-swu-muted">
        Las piezas de la Fase 3 con datos de mentira. Sin sesión, publicar y borrar fallan
        a propósito.
      </p>
      {aviso && (
        <p className="mb-3 rounded-xl border border-swu-border bg-swu-surface px-3 py-2 text-center text-[12px] text-swu-text">
          {aviso}
        </p>
      )}

      {/* La portada tapa TODO (fixed z-[60]), así que se monta a pedido y se
          va sola a los 2 s — igual que en la liga de verdad. */}
      {portada && <PortadaLiga ms={2000} />}

      <div className="mx-auto max-w-2xl space-y-6">
        {/* EL BOTÓN DE ACTUALIZAR vive en el ENCABEZADO de la app, arriba de
            esta página. En desarrollo no hay service worker, así que sus
            funciones nunca llegan y el botón —correctamente— no se dibuja.
            Acá se las inyecta al store para poder mirarlo: es el mismo seam
            que usa Ajustes, no una copia del componente. */}
        <Caso titulo="Botón de actualizar (mirá el ENCABEZADO, arriba)">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => useActualizacion.getState()._setFunciones({
                aplicar: async () => { setAviso('aplicar() → recargaría con la versión nueva') },
                comprobar: async () => { await new Promise(r => setTimeout(r, 900)) },
              })}
              className="min-h-11 rounded-xl border px-3 text-[12px] font-bold text-swu-text"
              style={{ borderColor: 'var(--liga-borde)' }}
            >
              1 · Encender el botón
            </button>
            <button
              onClick={() => useActualizacion.getState()._setVersionNueva(true)}
              className="min-h-11 rounded-xl border px-3 text-[12px] font-bold text-swu-text"
              style={{ borderColor: 'var(--liga-borde)' }}
            >
              2 · Simular versión nueva
            </button>
            <button
              onClick={() => useActualizacion.getState()._setVersionNueva(false)}
              className="min-h-11 rounded-xl border px-3 text-[12px] font-bold text-swu-text"
              style={{ borderColor: 'var(--liga-borde)' }}
            >
              3 · Volver a «al día»
            </button>
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-swu-muted">
            Con (1) aparece al lado de la campana. Con (2) se pinta en acento y con punto.
            Sin versión nueva, tocarlo comprueba y responde «Al día» — un botón que no acusa
            recibo se toca cinco veces.
          </p>
        </Caso>

        <Caso titulo="El botón de Inicio — sus tres estados">
          {[
            { code: 'x', nombre: 'Liga Internacional PUENTE', estado: 'inscripcion', esStaff: true, inscrito: false,
              temporada: { estado: 'inscripcion', inscripcionCierra: hoyMas(21), arranca: hoyMas(35) } },
            { code: 'x', nombre: 'Liga Internacional PUENTE', estado: 'activa', esStaff: false, inscrito: true,
              temporada: { estado: 'en_curso', inscripcionCierra: null, arranca: hoyMas(35) } },
            { code: 'x', nombre: 'Liga Internacional PUENTE', estado: 'borrador', esStaff: true, inscrito: false,
              temporada: null },
          ].map((l, i) => <div key={i} className="-mx-4"><BotonLiga liga={l} /></div>)}
          <p className="mt-1 text-[10px] leading-snug text-swu-muted">
            La segunda línea dice el PLAZO, no el estado: «en curso» no le pide nada a nadie.
          </p>
        </Caso>

        <Caso titulo="La portada, con su piso de 2 segundos">
          <button
            onClick={() => { setPortada(true); setTimeout(() => setPortada(false), 2000) }}
            className="min-h-11 w-full rounded-xl border px-3 text-[12px] font-bold text-swu-text"
            style={{ borderColor: 'var(--liga-borde)', background: 'var(--liga-acento-suave)' }}
          >
            Ver la portada (2 s)
          </button>
          <p className="mt-1.5 text-[10px] leading-snug text-swu-muted">
            La barra mide los 2 segundos —un plazo real y nuestro—, no la consulta.
            Si el servidor tarda más, llega al final y espera ahí.
          </p>
        </Caso>

        <Caso titulo="Cabecera sobre la portada + carrusel de cifras">
          <header className="relative overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--liga-borde)' }}>
            <div aria-hidden className="absolute inset-0 bg-cover bg-center opacity-25 blur-[2px]"
                 style={{ backgroundImage: 'url(/liga/portada.webp)' }} />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-swu-bg via-swu-bg/85 to-swu-bg/55" />
            <div className="relative flex items-center gap-2 px-3 py-3">
              <img src="/liga/emblema.webp" alt="" aria-hidden className="h-9 w-9 shrink-0 object-contain" />
              <div className="min-w-0 flex-1">
                <h2 className="line-clamp-2 text-[15px] font-black leading-tight tracking-tight text-swu-text">
                  Liga Internacional PUENTE
                </h2>
                <p className="truncate text-[9px] font-bold uppercase tracking-[0.14em] text-swu-muted">
                  Temporada 1 · Companion de liga
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-swu-green/50 bg-swu-green/10 px-2.5 py-1 text-[10px] font-bold text-swu-green">
                En curso
              </span>
              <span className="flex min-h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-swu-border bg-swu-bg/70 text-swu-text">
                <Settings2 size={14} />
              </span>
            </div>
            <div className="liga-carrusel relative px-3 pb-3">
              <TarjetaCifra icono={<Users size={13} />} valor="120/120" rotulo="jugadores" />
              <TarjetaCifra icono={<Globe2 size={13} />} valor={12} rotulo="países" />
              <TarjetaCifra icono={<Layers size={13} />} valor="J4" rotulo={<>de 8</>} />
              <TarjetaCifra icono={<Star size={13} />} valor="Premier" rotulo="formato" />
              <TarjetaCifra icono={<CalendarDays size={13} />} valor="2026" rotulo="temporada" />
            </div>
          </header>
        </Caso>

        <Caso titulo="Cuenta atrás — tres plazos distintos">
          {[
            { d: hoyMas(2), u: false, t: 'Para jugar y anotar tu partida.' },
            { d: hoyMas(0), u: true, t: 'Para responder el resultado que te reportaron.' },
            { d: hoyMas(-1), u: true, t: 'Ya pasó: el reloj lo selló por silencio.' },
          ].map(c => (
            <div key={c.d} className="mb-2 rounded-2xl border px-4 py-3"
                 style={{ borderColor: 'var(--liga-borde)', background: 'var(--liga-acento-suave)' }}>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-swu-muted">
                Tu próxima fecha límite
              </p>
              <p className="mt-1 text-[22px] leading-none"><ContadorPlazo hasta={c.d} urgente={c.u} /></p>
              <p className="mt-1.5 text-[11px] leading-snug text-swu-muted">{c.t}</p>
            </div>
          ))}
        </Caso>

        <Caso titulo="El banner, en sus TRES estados">
          {[
            { r: 'Cierra la inscripción', h: hoyMas(21), p: 'Después de esta fecha ya no se puede entrar a la temporada.', u: true },
            { r: 'Arranca la liga', h: hoyMas(35), p: 'Ese día se publican los grupos y el calendario.', u: false },
            { r: 'Próxima fecha límite', h: hoyMas(2), p: 'Para jugar y anotar tu partida.', u: false },
          ].map(c => (
            <button key={c.r}
              className="relative mb-2 flex w-full items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 text-left"
              style={{ borderColor: 'var(--liga-borde)', background: 'var(--liga-acento-suave)' }}>
              <span aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-cover bg-center opacity-30"
                style={{ backgroundImage: 'url(/liga/banner-liga.webp)',
                         maskImage: 'linear-gradient(to right, transparent, #000 70%)',
                         WebkitMaskImage: 'linear-gradient(to right, transparent, #000 70%)' }} />
              <Timer size={26} className="relative shrink-0" style={{ color: 'var(--liga-acento)' }} />
              <span className="relative min-w-0 flex-1">
                <span className="block text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--liga-acento)' }}>
                  {c.r}
                </span>
                <span className="mt-0.5 block text-[22px] leading-none"><ContadorPlazo hasta={c.h} urgente={c.u} /></span>
                <span className="mt-1 block text-[10px] leading-snug text-swu-muted">{c.p}</span>
                <span className="mt-1.5 block text-[8px] font-bold uppercase tracking-[0.2em] text-swu-muted/70">
                  La disciplina también gana partidas
                </span>
              </span>
              <ChevronRight size={18} className="relative shrink-0 text-swu-muted" />
            </button>
          ))}
          <p className="mt-1 text-[10px] text-swu-muted">
            El arte de fondo sale de <code>/liga/banner-liga.webp</code>. Si el archivo no está,
            no se dibuja y el banner queda igual de legible.
          </p>
        </Caso>

        <Caso titulo="Acciones rápidas">
          <section className="rounded-2xl border border-swu-border bg-swu-surface p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-black text-swu-text">
              <Zap size={13} style={{ color: 'var(--liga-acento)' }} /> Acciones rápidas
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Atajo icono={<Users size={14} />} rotulo="Mi grupo" alTocar={() => setAviso('Mi grupo')} />
              <Atajo icono={<Trophy size={14} />} rotulo="Tabla" alTocar={() => setAviso('Tabla')} />
              <Atajo icono={<Swords size={14} />} rotulo="Partidas" alTocar={() => setAviso('Mis partidas')} />
              <Atajo icono={<Megaphone size={14} />} rotulo="Anuncios" alTocar={() => setAviso('Anuncios')} />
              <Atajo icono={<BookOpen size={14} />} rotulo="Reglas" alTocar={() => setReglas(true)} />
              <Atajo icono={<CalendarClock size={14} />} rotulo="Horarios" a="/profile" />
            </div>
          </section>
        </Caso>

        <Caso titulo="Top 8 — con juego, y el día 1 sin medallas">
          <TopOcho id="t1" grupo={GRUPO} alVerTodo={() => setAviso('Ver todo')} />
          <div className="mt-2" />
          <TopOcho id="t2" grupo={GRUPO_DIA1} alVerTodo={() => setAviso('Ver todo')} />
        </Caso>

        <Caso titulo="Banderas — con país, sin país y con un código inventado">
          <div className="space-y-1 rounded-xl border border-swu-border bg-swu-surface p-3">
            {[['SV', 'Nelson'], ['ES', 'Rodrigo'], [null, 'Sin país declarado'], ['XX', 'Código inventado']]
              .map(([p, n], i) => (
                <p key={i} className="flex items-center gap-1.5 text-[13px] font-bold text-swu-text">
                  <Bandera pais={p as string | null} tam={12} />
                  <span>{n}</span>
                </p>
              ))}
          </div>
          <p className="mt-1.5 text-[10px] text-swu-muted">
            Las dos últimas NO dibujan bandera: un emoji genérico afirmaría una nacionalidad
            que nadie declaró.
          </p>
        </Caso>

        <Caso titulo="Anuncios — con avisos y siendo staff">
          <AnunciosLiga id="b1" ligaId="00000000-0000-0000-0000-000000000000"
                        anuncios={ANUNCIOS} puedoPublicar alCambiar={() => setAviso('alCambiar()')}
                        alAvisar={setAviso} />
        </Caso>

        <Caso titulo="Anuncios — staff SIN avisos todavía">
          <AnunciosLiga id="b2" ligaId="00000000-0000-0000-0000-000000000000"
                        anuncios={[]} puedoPublicar alCambiar={() => {}} alAvisar={setAviso} />
        </Caso>

        <Caso titulo="Anuncios — jugador normal y cero avisos: NO se dibuja nada">
          <div className="rounded-xl border border-dashed border-swu-border p-3 text-center text-[11px] text-swu-muted">
            (abajo de esta línea no debería aparecer nada)
            <AnunciosLiga id="b3" ligaId="x" anuncios={[]} puedoPublicar={false}
                          alCambiar={() => {}} alAvisar={setAviso} />
          </div>
        </Caso>

        <Caso titulo="Panel en teléfono — fichas apiladas, no tabla con scroll lateral">
          <div className="space-y-2">
            {INSCRITOS.map(i => <FichaInscrito key={i.inscId} i={i} />)}
          </div>
        </Caso>

        <Caso titulo="Panel en teléfono — mapa de calor por día">
          <div className="space-y-1 rounded-xl border border-swu-border bg-swu-surface p-3">
            {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map((d, i) => (
              <FilaDia key={d} dia={d} d={i} calor={CALOR} max={3} />
            ))}
          </div>
        </Caso>

        <Caso titulo="Quiénes van entrando — el lobby durante la inscripción">
          <Padron
            gente={[
              { id: '1', nombre: '[demo] Ana', pais: 'SV', lider: 'Ahsoka Tano', base: 'Yellow' },
              { id: '2', nombre: '[demo] Fran', pais: 'ES', lider: 'Darth Maul', base: 'Blue Force' },
              { id: '3', nombre: '[demo] Hugo', pais: 'AR', lider: 'Mother Talzin', base: null },
              { id: '4', nombre: 'Sin país declarado', pais: null, lider: null, base: null },
            ]}
            total={10}
            cupo={128}
            vacio="(no debería verse)"
          />
          <div className="mt-2" />
          <Padron gente={[]} total={0} cupo={null}
                  vacio="Todavía no hay nadie inscrito: cuando se armen los grupos, acá va tu calendario." />
        </Caso>

        <Caso titulo="Cómo funciona">
          <ComoFunciona id="b4" abierto={reglas} alPlegar={() => setReglas(r => !r)} porGrupo={8} />
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
