import * as esbuild from 'esbuild'
const stub = {
  name: 'stub',
  setup(b) {
    b.onResolve({ filter: /^\.\/db$/ }, () => ({ path: '/tmp/race/stub-db.mjs' }))
    b.onResolve({ filter: /^\.\/swuApi$/ }, () => ({ path: '/tmp/race/stub-swuapi.mjs' }))
  },
}
await esbuild.build({
  entryPoints: ['/Users/nelson/Claude/swu-companion/src/services/tournamentsService.ts'],
  bundle: true, platform: 'node', format: 'esm',
  outfile: '/tmp/race/svc.mjs', plugins: [stub], logLevel: 'error',
})
console.log('ok')
