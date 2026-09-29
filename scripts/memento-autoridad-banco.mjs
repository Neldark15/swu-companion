// Banco local aislado: UI real con Auth simulado, sin red de producción.
// Abrir por CUA http://127.0.0.1:5189. Ctrl+C elimina el bundle temporal.
import { build } from 'esbuild'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:http'
const cliente = '22222222-2222-4222-8222-222222222222'
const callback = 'https://mementohobby.com/cuenta/conectar'
const carpeta = await mkdtemp(join(tmpdir(), 'autoridad-memento-'))
const falsa = `
 const p = window.__prueba;
 const cuenta = () => ({id:'cuenta-a',email:'cuenta-a@example.test',user_metadata:{}});
 const evento = (event) => { for (const fn of p.listeners) fn(event,{user:p.user}) };
 export const supabase = { auth: {
  getSession: async () => ({data:{session:p.user?{access_token:"token-cuenta-a",user:p.user}:null},error:null}),
  getUser: async token => {
   if(p.demoraUsuario) await new Promise(r=>setTimeout(r,p.demoraUsuario));
   return (token || p.user) ? {data:{user:token?cuenta():p.user},error:null} : {data:{user:null},error:{name:'AuthSessionMissingError'}};
  },
  onAuthStateChange: fn => {p.listeners.push(fn);queueMicrotask(()=>{if(p.listeners.includes(fn))fn('INITIAL_SESSION',p.user?{user:p.user}:null)});return {data:{subscription:{unsubscribe:()=>{p.listeners=p.listeners.filter(f=>f!==fn)}}}}},
  signInWithPassword: async () => {p.calls.push('login');p.user=cuenta();evento('SIGNED_IN');return {data:{user:p.user},error:null}},
  signUp: async args => {p.signup=args;p.calls.push('signup');p.user=cuenta();evento('SIGNED_IN');return {data:{user:p.user,session:{user:p.user}},error:null}},
  signOut: async () => {p.calls.push('logout');p.user=null;evento('SIGNED_OUT');return {error:null}},
  resetPasswordForEmail: async (email,options) => {p.calls.push('recovery');p.recovery={email,options};return {error:null}},
  verifyOtp: async args => {p.calls.push('verify');p.verify=args;p.user=cuenta();evento('PASSWORD_RECOVERY');return {data:{user:p.user,session:{access_token:'token-verificado-a'}},error:null}},
  oauth: {
   getAuthorizationDetails: async authorization_id => {
    p.calls.push('details');const usuario=p.user;
    if(p.demoraDetalles) await new Promise(r=>setTimeout(r,p.demoraDetalles));
    if(p.redirect) return {data:{redirect_url:p.redirect},error:null};
    return {data:{authorization_id,redirect_uri:p.callback||'${callback}',client:{id:p.client||'${cliente}'},user:usuario,scope:p.scope||'email profile'},error:null};
   },
   approveAuthorization: async (_id,options) => {p.calls.push('approve');p.approve=options;return {data:{redirect_url:p.approveRedirect||'http://localhost/retorno-simulado'},error:null}},
  },
 }};
 `
  await build({ stdin: {
    contents: `import React from 'react';import{createRoot}from'react-dom/client';import{AutorizarMementoPage,RecuperarMementoPage}from'./src/features/cuenta/CuentaMementoPage';createRoot(document.getElementById('root')).render(<React.StrictMode>{location.pathname.includes('recuperar')?<RecuperarMementoPage/>:<AutorizarMementoPage/>}</React.StrictMode>);`,
    resolveDir: process.cwd(), loader: 'tsx',
  }, outfile: join(carpeta, 'app.js'), bundle: true, format: 'esm', jsx: 'automatic',
  define: { 'import.meta.env.VITE_MEMENTO_OAUTH_CLIENT_ID': JSON.stringify(cliente), 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:5189'), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('public-test') },
  plugins: [{ name: 'auth-simulado', setup(builder) {
    builder.onResolve({ filter: /services\/supabase$/ }, () => ({ path: 'auth', namespace: 'simulado' }))
    builder.onLoad({ filter: /.*/, namespace: 'simulado' }, () => ({ contents: falsa, loader: 'js' }))
    builder.onResolve({ filter: /^\/cuenta-memento\// }, args => ({ path: args.path, external: true }))
  } }],
  })
const servidor = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    const pathname = url.pathname
    if (pathname === '/auth/v1/verify' && req.method === 'POST') {
      res.setHeader('Content-Type','application/json')
      res.end(JSON.stringify({access_token:'token-verificado-a',user:{id:'cuenta-a',email:'cuenta-a@example.test'}}));return
    }
    if (pathname.includes('/auth/v1/oauth/authorizations/')) {
      res.setHeader('Content-Type','application/json')
      res.end(JSON.stringify(req.method === 'POST' ? {redirect_url:'http://localhost/retorno-simulado'} : {authorization_id:'11111111-1111-4111-8111-111111111111',redirect_uri:callback,client:{id:cliente},user:{id:'cuenta-a'},scope:'email profile'}));return
    }
    if (pathname === '/auth/v1/user' && req.method === 'PUT') {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ id: 'cuenta-a' })); return
    }
    if (pathname.startsWith('/cuenta-memento/')) {
      const path = resolve('public', `.${pathname}`)
      if (!path.startsWith(resolve('public') + '/')) throw new Error('ruta')
      res.setHeader('Content-Type', pathname.endsWith('.svg') ? 'image/svg+xml' : 'font/ttf')
      res.end(await readFile(path)); return
    }
    if (pathname === '/app.js' || pathname === '/app.css') {
      res.setHeader('Content-Type', pathname.endsWith('.js') ? 'text/javascript' : 'text/css')
      res.end(await readFile(join(carpeta, pathname.slice(1)))); return
    }
    const escenario = url.searchParams.get('escenario')
    const user = escenario ? {id:'cuenta-a',email:'cuenta-a@example.test',user_metadata:{}} : null
    const datos = {user,calls:[],listeners:[],...(escenario === 'tercero' ? {client:'33333333-3333-4333-8333-333333333333'} : {}),...(escenario === 'tardio' ? {demoraDetalles:6000} : {})}
    res.setHeader('Content-Type','text/html; charset=utf-8')
    res.end(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><style>body{margin:0}*{box-sizing:border-box}.fixture{position:fixed;bottom:0;z-index:20;padding:8px;background:white;color:black;font:12px sans-serif;display:flex;gap:14px}.fixture a,.fixture button{color:black}.mm-cuenta{padding-bottom:90px}</style></head><body><div id="root"></div><aside class="fixture"><b>SIMULACIÓN LOCAL</b><a href="/cuenta/autorizar?authorization_id=11111111-1111-4111-8111-111111111111">Acceso</a><a href="/cuenta/autorizar?authorization_id=11111111-1111-4111-8111-111111111111&escenario=consentir">Consentir</a><a href="/cuenta/autorizar?authorization_id=11111111-1111-4111-8111-111111111111&escenario=tercero">Cliente ajeno</a><a href="/cuenta/recuperar#token_hash=${'a'.repeat(64)}&type=recovery">Recuperar</a><button id="refocus-fixture">Simular volver a pestaña</button><button id="cambiar-fixture">Simular otra cuenta</button><output id="llamadas-fixture"></output></aside><script>window.__prueba=${JSON.stringify(datos)};document.querySelector('#refocus-fixture').onclick=()=>{for(const fn of window.__prueba.listeners)fn('SIGNED_IN',window.__prueba.user?{user:window.__prueba.user}:null)};document.querySelector('#cambiar-fixture').onclick=()=>{window.__prueba.user={id:'cuenta-b',email:'cuenta-b@example.test'};for(const fn of window.__prueba.listeners)fn('SIGNED_IN',{user:window.__prueba.user})};setInterval(()=>{document.querySelector('#llamadas-fixture').textContent=window.__prueba.calls.join(', ')},300)</script><script type="module" src="/app.js"></script></body></html>`)
  } catch { res.writeHead(404);res.end() }
})
await new Promise(r=>servidor.listen(5189,'127.0.0.1',r))
console.log('Banco aislado: http://127.0.0.1:5189/cuenta/autorizar?authorization_id=11111111-1111-4111-8111-111111111111')
console.log('Auth y cambio de contraseña simulados. Continuar a MEMENTO produce un error de destino de prueba; no navega a producción.')
const limpiar=()=>servidor.close(async()=>{await rm(carpeta,{recursive:true,force:true});process.exit(0)})
process.on('SIGINT',limpiar)
process.on('SIGTERM',limpiar)
