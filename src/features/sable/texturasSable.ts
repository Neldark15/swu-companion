import * as THREE from 'three'

export type SuperficieSable = 'cepillado' | 'moleteado' | 'cuero' | 'anodizado'
export const TAMANO_SUPERFICIE = 128

function ruido(x: number, y: number, periodo: number): number {
  const ix = ((x % periodo) + periodo) % periodo
  const iy = ((y % periodo) + periodo) % periodo
  let n = Math.imul(ix + 31, 374761393) ^ Math.imul(iy + 17, 668265263)
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295
}

function grano(x: number, y: number, periodo: number): number {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy)
  const a = ruido(ix, iy, periodo) * (1 - sx) + ruido(ix + 1, iy, periodo) * sx
  const b = ruido(ix, iy + 1, periodo) * (1 - sx) + ruido(ix + 1, iy + 1, periodo) * sx
  return a * (1 - sy) + b * sy
}

/** Distancia a la arista entre dos celdas irregulares del grano de piel.
 * Las semillas envuelven en los dos ejes para no marcar la junta del UV. */
function bordeDePiel(u: number, v: number): number {
  const celdas = 11
  const x = u * celdas, y = v * celdas
  const ix = Math.floor(x), iy = Math.floor(y)
  let primera = Infinity, segunda = Infinity
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx, cy = iy + dy
      const xx = cx + 0.17 + 0.66 * ruido(cx, cy, celdas) - x
      const yy = cy + 0.17 + 0.66 * ruido(cx + 97, cy, celdas) - y
      const distancia = xx * xx + yy * yy
      if (distancia < primera) { segunda = primera; primera = distancia }
      else if (distancia < segunda) segunda = distancia
    }
  }
  return Math.min(1, (Math.sqrt(segunda) - Math.sqrt(primera)) * 5)
}

/** Datos puros y periódicos: la misma pieza siempre tiene la misma superficie. */
export function datosDeSuperficie(tipo: SuperficieSable): { relieve: Uint8Array; rugosidad: Uint8Array } {
  const s = TAMANO_SUPERFICIE
  const relieve = new Uint8Array(s * s * 4), rugosidad = new Uint8Array(s * s * 4)
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const u = x / s, v = y / s, fino = ruido(x, y, s) - 0.5
      let altura: number, rugoso: number
      if (tipo === 'cepillado') {
        // El cepillado pierde fuerza a lo largo de cada pasada. Las marcas
        // cortas atraviesan varias hebras y dispersan el reflejo localmente.
        const veta = ruido(0, y, s) - 0.5
        const desgaste = grano(u * 8, v * 8, 8)
        const pasada = grano(u * 4, v * 32, 4)
        const raya = pasada > 0.80 ? (pasada - 0.80) * 1.7 : 0
        altura = 0.48 + veta * (0.15 + 0.19 * desgaste) + fino * 0.04 - raya
        rugoso = 0.88 + veta * 0.11 + desgaste * 0.055 + raya * 0.23
      } else if (tipo === 'moleteado') {
        // Dos ranuras diagonales delimitan cada rombo. La meseta produce un
        // reflejo ancho y el borde un destello estrecho al rotar el agarre.
        const costadoA = Math.abs(Math.sin((u + v) * Math.PI * 5))
        const costadoB = Math.abs(Math.sin((u - v) * Math.PI * 5))
        const meseta = Math.min(1, Math.min(costadoA, costadoB) * 2.4)
        altura = 0.26 + meseta * 0.46 + fino * 0.026
        rugoso = 0.96 - meseta * 0.115 + fino * 0.028
      } else if (tipo === 'cuero') {
        const piel = bordeDePiel(u, v)
        const poro = grano(u * 32, v * 32, 32)
        altura = 0.31 + piel * 0.32 + poro * 0.12 + fino * 0.08
        rugoso = 0.98 - piel * 0.089 - poro * 0.028 + fino * 0.02
      } else {
        const satinado = grano(u * 12, v * 12, 12)
        altura = 0.46 + fino * 0.12 + satinado * 0.075
        rugoso = 0.89 + fino * 0.07 + satinado * 0.045
      }
      const offset = (y * s + x) * 4
      for (let canal = 0; canal < 3; canal++) {
        relieve[offset + canal] = Math.round(altura * 255)
        rugosidad[offset + canal] = Math.round(rugoso * 255)
      }
      relieve[offset + 3] = rugosidad[offset + 3] = 255
    }
  }
  return { relieve, rugosidad }
}

export function crearTexturasSuperficie(tipo: SuperficieSable): { relieve: THREE.DataTexture; rugosidad: THREE.DataTexture } {
  const datos = datosDeSuperficie(tipo)
  function textura(bytes: Uint8Array): THREE.DataTexture {
    const t = new THREE.DataTexture(bytes, TAMANO_SUPERFICIE, TAMANO_SUPERFICIE, THREE.RGBAFormat)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.magFilter = THREE.LinearFilter
    t.minFilter = THREE.LinearMipmapLinearFilter
    t.generateMipmaps = true
    t.needsUpdate = true
    return t
  }
  return { relieve: textura(datos.relieve), rugosidad: textura(datos.rugosidad) }
}
