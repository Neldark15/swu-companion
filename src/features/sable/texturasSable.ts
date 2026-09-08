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

/** Datos puros y periódicos: la misma pieza siempre tiene la misma superficie. */
export function datosDeSuperficie(tipo: SuperficieSable): { relieve: Uint8Array; rugosidad: Uint8Array } {
  const s = TAMANO_SUPERFICIE
  const relieve = new Uint8Array(s * s * 4), rugosidad = new Uint8Array(s * s * 4)
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const u = x / s, v = y / s, fino = ruido(x, y, s) - 0.5
      let altura: number, rugoso: number
      if (tipo === 'cepillado') {
        const veta = ruido(0, y, s) - 0.5
        altura = 0.5 + veta * 0.25 + fino * 0.05
        rugoso = 0.88 + veta * 0.15 + (grano(u * 8, v * 8, 8) - 0.5) * 0.025
      } else if (tipo === 'moleteado') {
        const diagonal = Math.cos((u + v) * Math.PI * 16) * Math.cos((u - v) * Math.PI * 16)
        altura = 0.5 + diagonal * 0.24 + fino * 0.035
        rugoso = 0.93 + diagonal * 0.045 + fino * 0.035
      } else if (tipo === 'cuero') {
        // Grano irregular de piel; no comparte los rombos industriales del agarre.
        const poro = grano(u * 24, v * 24, 24)
        const pliegue = grano(u * 8, v * 8, 8)
        altura = 0.35 + poro * 0.27 + pliegue * 0.12 + fino * 0.08
        rugoso = 0.91 + poro * 0.07 + fino * 0.025
      } else {
        altura = 0.5 + fino * 0.15
        rugoso = 0.91 + fino * 0.07
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
