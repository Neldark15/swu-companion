import * as THREE from 'three'

/** Placa de agarre del Blindaje: los huecos atraviesan la cubierta y dejan
 * ver la camisa de acero del cuerpo aunque cambie su acabado. Una sola malla. */
export function placaRanurada(ancho: number, alto: number, espesor: number, ranuras: number, detalle: boolean) {
  const x = ancho / 2, y = alto / 2
  const bisel = Math.min(0.045, espesor / 8)
  const hombro = ancho * 0.2
  const placa = new THREE.Shape()
  placa.moveTo(-x + hombro, -y)
  placa.lineTo(x - hombro, -y)
  placa.lineTo(x, -y + hombro)
  placa.lineTo(x, y - hombro)
  placa.lineTo(x - hombro, y)
  placa.lineTo(-x + hombro, y)
  placa.lineTo(-x, y - hombro)
  placa.lineTo(-x, -y + hombro)
  placa.closePath()

  const zona = alto * 0.60
  const paso = zona / ranuras
  const extremo = ancho * 0.30
  const inclinacion = ancho * 0.14
  const radio = Math.min(paso * 0.19, ancho * 0.14)
  for (let i = 0; i < ranuras; i++) {
    const medio = -zona / 2 + paso * (i + 0.5)
    const hueco = new THREE.Path()
    hueco.moveTo(-extremo, medio - inclinacion - radio)
    hueco.quadraticCurveTo(-extremo - radio, medio - inclinacion, -extremo, medio - inclinacion + radio)
    hueco.lineTo(extremo, medio + inclinacion + radio)
    hueco.quadraticCurveTo(extremo + radio, medio + inclinacion, extremo, medio + inclinacion - radio)
    hueco.closePath()
    placa.holes.push(hueco)
  }
  for (const posicion of [-0.395, 0.395]) {
    const casquillo = new THREE.Path()
    casquillo.absarc(0, alto * posicion, ancho * 0.115, 0, Math.PI * 2, true)
    placa.holes.push(casquillo)
  }
  return new THREE.ExtrudeGeometry(placa, {
    depth: espesor - 2 * bisel,
    bevelEnabled: true, bevelSize: bisel, bevelThickness: bisel,
    bevelSegments: 1, curveSegments: detalle ? 4 : 2,
  }).translate(0, 0, -espesor / 2 + bisel)
}
