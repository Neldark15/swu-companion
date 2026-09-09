export class ErrorJuego extends Error {
  constructor(status, codigo, mensaje, detalles) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}
export function exigir(condicion, status, codigo, mensaje) {
  if (!condicion) throw new ErrorJuego(status, codigo, mensaje);
}
export function objeto(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}
export function clavesExactas(valor, permitidas) {
  return objeto(valor) && Object.keys(valor).every((clave) => permitidas.includes(clave));
}
