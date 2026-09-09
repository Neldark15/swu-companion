// Mazos exclusivos de pruebas locales. 50 cartas, 1 líder y 1 base; Premier Current del motor fijado.
const cartas = [255, 256, 247, 246, 211, 212, 214, 196, 197, 198, 145, 146, 147, 148, 149, 158, 159];
const principal = cartas.map((numero, indice) => ({ id: `JTL_${numero}`, count: indice === cartas.length - 1 ? 2 : 3 }));
export const mazosEjemplo = [
  { id: 'han-local', nombre: 'Han · Escuadrón de prueba', mazo: { leader: { id: 'JTL_017', count: 1 }, base: { id: 'JTL_026', count: 1 }, deck: principal.map((carta) => ({ ...carta })), sideboard: [] } },
  { id: 'luke-local', nombre: 'Luke · Escuadrón de prueba', mazo: { leader: { id: 'JTL_012', count: 1 }, base: { id: 'JTL_029', count: 1 }, deck: principal.map((carta) => ({ ...carta })), sideboard: [] } },
];
