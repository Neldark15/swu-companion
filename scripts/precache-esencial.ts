import type { Manifest } from 'vite'

/** El grafo de Vite resuelve dependencias reales: excluir chunks por nombre
 * puede dejar un import compartido sin conexión. Las rutas opcionales se
 * guardan al abrirlas, no se descargan para todas las instalaciones. */
export const RUTAS_ESENCIALES = [
  'src/features/home/HomePage.tsx',
  'src/features/calculadora/CalculadoraPage.tsx',
  'src/features/calculadora/SelectorBaseCalculadora.tsx',
  'src/features/cards/CardsPage.tsx',
  'src/features/cards/CardDetailPage.tsx',
  'src/features/collection/CollectionPage.tsx',
  'src/features/rulings/RulingsPage.tsx',
  'src/features/contador/ContadorPage.tsx',
  'src/features/play/PlayPage.tsx',
  'src/features/play/TrackerPage.tsx',
]

export function archivosPrecacheEsencial(grafo: Manifest): Set<string> {
  const archivos = new Set(['index.html', 'favicon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'manifest.webmanifest', 'robots.txt'])
  const vistos = new Set<string>()
  const visitar = (id: string) => {
    if (vistos.has(id)) return
    vistos.add(id)
    const entrada = grafo[id]
    if (!entrada) throw new Error(`Falta una dependencia del precache: ${id}`)
    archivos.add(entrada.file)
    for (const archivo of [...(entrada.css ?? []), ...(entrada.assets ?? [])]) archivos.add(archivo)
    for (const dependencia of entrada.imports ?? []) visitar(dependencia)
  }
  for (const [id, entrada] of Object.entries(grafo)) if (entrada.isEntry) visitar(id)
  for (const ruta of RUTAS_ESENCIALES) visitar(ruta)
  return archivos
}
