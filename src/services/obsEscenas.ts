/**
 * Genera el archivo de escenas de OBS de una cabina.
 *
 * Es lo que evita el paso más frágil del montaje: que el operador escriba a
 * mano la URL del marcador y ponga la cámara en la ventana del marco con los
 * números exactos. Se importa el archivo y todo queda apuntando a SU código.
 *
 * OBS no se «liga» a la app: es un programa en la computadora del operador.
 * Lo único que necesita de acá es esta configuración; la clave de transmisión
 * la pega él en Ajustes → Emisión, y NO viaja en este archivo (es un secreto
 * de la cuenta de YouTube, no de la cabina).
 */

/** La ventana transparente del marco, medida sobre la imagen (1920×1080). */
const VENTANA = { x: 421, y: 258, ancho: 1074, alto: 602 }

function uuid(): string {
  // Cada colección necesita ids propios: si dos cabinas comparten uuid y se
  // importan en la misma máquina, OBS mezcla las fuentes.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function escenasOBS(code: string, nombre: string, origen: string): string {
  const idCamara = uuid()
  const idMarcador = uuid()
  const idEscenaVivo = uuid()
  const idEscenaSolo = uuid()

  const fuenteBase = {
    prev_ver: 520617985,
    mixers: 0,
    sync: 0,
    flags: 0,
    volume: 1.0,
    balance: 0.5,
    enabled: true,
    muted: false,
    'push-to-mute': false,
    'push-to-mute-delay': 0,
    'push-to-talk': false,
    'push-to-talk-delay': 0,
    hotkeys: {},
    deinterlace_mode: 0,
    deinterlace_field_order: 0,
    monitoring_type: 0,
    private_settings: {},
    filters: [],
  }

  const itemBase = {
    visible: true,
    locked: false,
    rot: 0.0,
    scale_ref: { x: 1920.0, y: 1080.0 },
    align: 5,
    bounds_align: 0,
    scale: { x: 1.0, y: 1.0 },
    crop_left: 0,
    crop_top: 0,
    crop_right: 0,
    crop_bottom: 0,
    group_item_backup: false,
    scale_filter: 'disable',
    blend_method: 'default',
    blend_type: 'normal',
    show_transition: { duration: 0 },
    hide_transition: { duration: 0 },
    private_settings: {},
  }

  const coleccion = {
    current_scene: `${nombre} · EN VIVO`,
    current_program_scene: `${nombre} · EN VIVO`,
    scene_order: [{ name: `${nombre} · EN VIVO` }, { name: `${nombre} · Solo marcador` }],
    name: `SWU ${nombre}`,
    groups: [],
    quick_transitions: [
      { name: 'Cut', duration: 300, hotkeys: [], id: 1, fade_to_black: false },
      { name: 'Fade', duration: 300, hotkeys: [], id: 2, fade_to_black: false },
    ],
    transitions: [],
    current_transition: 'Fade',
    transition_duration: 300,
    preview_locked: false,
    scaling_enabled: false,
    scaling_level: 0,
    scaling_off_x: 0.0,
    scaling_off_y: 0.0,
    modules: {},
    sources: [
      {
        ...fuenteBase,
        name: 'Cámara',
        uuid: idCamara,
        id: 'av_capture_input_v2',
        versioned_id: 'av_capture_input_v2',
        settings: {
          buffering: false,
          device_name: '',
          device: '',
          use_preset: true,
          preset: 'AVCaptureSessionPreset1920x1080',
        },
      },
      {
        ...fuenteBase,
        name: 'Marcador',
        uuid: idMarcador,
        id: 'browser_source',
        versioned_id: 'browser_source',
        settings: {
          url: `${origen}/overlay/${code}`,
          width: 1920,
          height: 1080,
          fps_custom: false,
          fps: 30,
          // Sin esta línea OBS pinta el fondo en BLANCO en vez de transparente.
          css: 'html, body, #root { background: transparent !important; margin: 0 !important; overflow: hidden; }',
          shutdown: false,
          restart_when_active: false,
          // La música del marcador entra a la mezcla de OBS. Sin esto el audio
          // del navegador se pierde y la música no sale al aire.
          reroute_audio: true,
          webpage_control_level: 1,
        },
      },
      {
        ...fuenteBase,
        name: `${nombre} · EN VIVO`,
        uuid: idEscenaVivo,
        id: 'scene',
        versioned_id: 'scene',
        settings: {
          custom_size: false,
          id_counter: 2,
          items: [
            {
              ...itemBase,
              name: 'Marcador',
              source_uuid: idMarcador,
              bounds_type: 2,
              bounds: { x: 1920.0, y: 1080.0 },
              pos: { x: 0.0, y: 0.0 },
              id: 2,
            },
            {
              // La cámara va DETRÁS y encajada en la ventana del marco.
              ...itemBase,
              name: 'Cámara',
              source_uuid: idCamara,
              bounds_type: 3,
              bounds: { x: VENTANA.ancho, y: VENTANA.alto },
              pos: { x: VENTANA.x, y: VENTANA.y },
              id: 1,
            },
          ],
        },
      },
      {
        ...fuenteBase,
        name: `${nombre} · Solo marcador`,
        uuid: idEscenaSolo,
        id: 'scene',
        versioned_id: 'scene',
        settings: {
          custom_size: false,
          id_counter: 1,
          items: [
            {
              ...itemBase,
              name: 'Marcador',
              source_uuid: idMarcador,
              bounds_type: 2,
              bounds: { x: 1920.0, y: 1080.0 },
              pos: { x: 0.0, y: 0.0 },
              id: 1,
            },
          ],
        },
      },
    ],
  }

  return JSON.stringify(coleccion, null, 2)
}

/** Descarga el archivo listo para importar en OBS. */
export function descargarEscenasOBS(code: string, nombre: string): void {
  const origen = window.location.origin
  const blob = new Blob([escenasOBS(code, nombre, origen)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `OBS-${code}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  // Sin esto el blob queda en memoria hasta recargar la pestaña.
  URL.revokeObjectURL(url)
}
