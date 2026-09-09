import { defineConfig, mergeConfig } from 'vite'
import base from '../vite.config'

// Vite no ejecuta las funciones api/ de Vercel. El banco necesita el mismo
// proxy público de imágenes que producción; no reenvía Auth ni otras rutas.
export default mergeConfig(base, defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/img': { target: 'https://www.swusv.com', changeOrigin: true },
    },
  },
}))
