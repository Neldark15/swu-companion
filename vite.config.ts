import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          db: ['dexie', '@supabase/supabase-js'],
          ui: ['lucide-react'],
          /**
           * three.js va en SU PROPIO chunk, compartido.
           *
           * Medido antes de separarlo: three quedaba dentro de
           * `UtilitiesPage` (508 KB de chunk para una pantalla de dados y una
           * moneda). Rollup mete la librería en el chunk de quien la importa,
           * así que con TRES pantallas 3D —Utilidades, la Galaxia y la mesa de
           * partidas— habría bajado tres copias de ~450 KB, una por pantalla.
           *
           * Separado, se descarga UNA vez y las tres lo comparten: quien ya
           * tiró un dado entra a la Galaxia sin descargar nada nuevo del motor
           * 3D. Y sigue sin costarle un byte a quien nunca abre una pantalla
           * 3D, porque el chunk solo se pide cuando alguna lo importa.
           */
          three: ['three'],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt' y no 'autoUpdate': la app AVISA que hay versión nueva y el
      // usuario decide cuándo recargar. Con autoUpdate el cambio entraba solo
      // y en silencio — y peor, podía recargar en medio de un torneo.
      registerType: 'prompt',
      strategies: 'injectManifest',
      srcDir: 'src',
      // Se registra a mano desde UpdatePrompt para poder engancharse a los
      // callbacks de "hay una versión esperando".
      injectRegister: null,
      includeAssets: ['favicon.svg', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'HOLOCRON SWU',
        short_name: 'HOLOCRON',
        description: 'Star Wars: Unlimited Companion App — Trackers, Events, Cards & Decks',
        // Tiene que coincidir con --color-swu-bg del CSS: con #0F172A la barra
        // de estado de la PWA instalada quedaba de otro color que el fondo.
        theme_color: '#181825',
        background_color: '#181825',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        /* `id` fija la identidad de la app. Sin él, Chrome la deduce de
           `start_url`: el día que eso cambie, Android trataría la app como
           OTRA y la instalada quedaría huérfana en vez de actualizarse. */
        id: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      devOptions: {
        enabled: false,
        type: 'module',
      },
    }),
  ],
})
