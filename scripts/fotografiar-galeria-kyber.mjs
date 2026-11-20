// Con Chrome instalado: npm install --prefix /tmp/kyber-fotos playwright-core
// NODE_PATH=/tmp/kyber-fotos/node_modules node scripts/fotografiar-galeria-kyber.mjs
// Fotografía el mismo visor del Taller en un estudio local, sin sesión ni llamadas externas.
import { createRequire } from 'node:module'
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { createServer } from 'vite'

const raiz = fileURLToPath(new URL('../', import.meta.url))
const { chromium } = createRequire(import.meta.url)('playwright-core')
const estudio = await mkdtemp(path.join(raiz, 'estudio-kyber-'))
const destino = path.join(raiz, 'public/kyber/modelos')
let servidor, navegador

try {
  // El estudio comparte mallas, materiales, shaders y encuadre con el editor.
  // Los píxeles por fuera de la foto dan margen para que las hojas crucen el borde.
  await writeFile(path.join(estudio, 'index.html'), `<!doctype html>
    <meta charset="utf-8"><style>
      *{box-sizing:border-box} html,body{margin:0} body{overflow:hidden}
      #foto{width:512px;height:448px;position:relative;overflow:hidden;background:#11171e}
      #escena{position:absolute;inset:-15%} #foto[data-modelo="shoto"] #escena{inset:-1%}
      #escena>div{width:100%;height:100%}
    </style>
    <div id="foto"><div id="escena"></div></div><script type="module">
      import React from 'react'
      import { createRoot } from 'react-dom/client'
      import { SableEscena } from '/src/features/sable/SableEscena'
      import { MODELOS_GALERIA } from '/src/features/sable/modelosGaleria'
      import { colorDeHoja } from '/src/features/sable/partesSable'
      const modelo = MODELOS_GALERIA.find(m => m.id === new URLSearchParams(location.search).get('id'))
      const foto = document.getElementById('foto')
      foto.dataset.modelo = modelo.id
      const halo = colorDeHoja(modelo.diseno.color).halo
      foto.style.background = 'radial-gradient(ellipse at 70% 18%, '+halo+'24, transparent 58%),radial-gradient(ellipse at 24% 76%,#26313c,#11151c 72%)'
      createRoot(document.getElementById('escena')).render(React.createElement(SableEscena, {
        diseno: modelo.diseno, encendido: true, orientacion: 'horizontal', encuadre: 'detalle',
      }))
    </script>`)
  servidor = await createServer({ configFile: false, root: raiz, cacheDir: path.join(estudio, 'cache'), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' })
  await servidor.listen()
  const base = servidor.resolvedUrls.local[0] + path.basename(estudio) + '/'
  const { MODELOS_GALERIA } = await servidor.ssrLoadModule('/src/features/sable/modelosGaleria.ts')
  const { IDS_CONOCIDOS } = await servidor.ssrLoadModule('/src/features/sable/partesSable.ts')
  navegador = await chromium.launch({ channel: 'chrome', executablePath: process.env.CHROME_BIN, headless: true,
    args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const pagina = await navegador.newPage({ viewport: { width: 512, height: 448 }, reducedMotion: 'reduce' })
  pagina.on('pageerror', e => console.error(e.message))
  await mkdir(destino, { recursive: true })
  for (const modelo of MODELOS_GALERIA) {
    for (const clave of ['emisor', 'cuerpo', 'pomo', 'color']) {
      if (!IDS_CONOCIDOS[clave].includes(modelo.diseno[clave])) throw new Error('Pieza desconocida en ' + modelo.id + ': ' + clave)
    }
    await pagina.goto(base + '?id=' + encodeURIComponent(modelo.id))
    await pagina.waitForFunction(() => {
      const dato = document.querySelector('[data-kyber-metricas]')?.dataset.kyberMetricas
      return dato && JSON.parse(dato).triangulos > 0
    }, undefined, { timeout: 15_000 })
    // Rueda la vista horizontal alrededor de Z mediante el gesto de giro del visor.
    const centroX = 250, centroY = 230
    const cuarto = Math.PI / 2 / 0.011, diagonal = 0.64 / 0.011
    await pagina.mouse.move(centroX, centroY)
    await pagina.mouse.down()
    await pagina.mouse.move(centroX, centroY - cuarto)
    await pagina.mouse.move(centroX + diagonal, centroY - cuarto)
    await pagina.mouse.move(centroX + diagonal, centroY)
    await pagina.mouse.up()
    await pagina.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
    const png = await pagina.locator('#foto').screenshot()
    await sharp(png).webp({ quality: 87, effort: 6 }).toFile(path.join(estudio, modelo.id + '.webp'))
    console.log(modelo.nombre)
  }
  for (const { id } of MODELOS_GALERIA) await rename(path.join(estudio, id + '.webp'), path.join(destino, id + '.webp'))
} finally {
  await navegador?.close()
  await servidor?.close()
  await rm(estudio, { recursive: true, force: true })
}
