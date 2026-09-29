# Cuenta MEMENTO en la autoridad SWU

`/cuenta/autorizar` y `/cuenta/recuperar` usan la marca MEMENTO fuera de `AppLayout`. No llaman `initAuth`, no descargan colecciones ni crean perfiles/estadísticas SWU. El registro lleva `origin_app: memento`; la incorporación a SWU sigue ocurriendo cuando la persona abre su app. Esta marca no otorga permisos.

## Configuración antes de publicar

1. Activar OAuth Server de Supabase y fijar Authorization Path `/cuenta/autorizar`. Conservar Site URL actual, firmas y métodos de acceso existentes.
2. Registrar MEMENTO como cliente **público**, sin secreto, con callback exacto `https://mementohobby.com/cuenta/conectar`. Sin comodines ni alias `www`. El RP usa Authorization Code + PKCE S256 y scopes `email profile`; no pide `openid`.
3. Agregar el ID público en `VITE_MEMENTO_OAUTH_CLIENT_ID` de Vercel y reconstruir. Vacío o inválido bloquea autorización. No copiar claves privadas al frontend.
4. Permitir `https://swusv.com/cuenta/recuperar` como URL de correo. El template de recuperación debe usar una rama **exacta** para ese RedirectTo y entregar `https://swusv.com/cuenta/recuperar#token_hash={{ .TokenHash }}&type=recovery`. Los demás destinos conservan `.ConfirmationURL` para no romper SWU. La confirmación de signup del proyecto permanece como estaba; si se activa en el futuro, su template debe entregar el mismo fragmento con `type=signup`.
5. Publicar y verificar ambas aplicaciones antes de anunciar la conexión. Este PR no activa OAuth, cambia SMTP, registra clientes ni modifica Supabase.

## Sesiones y consentimiento

El formulario crea/restaura la sesión nativa de Supabase en **swusv.com**, con la misma contraseña de SWU. Los dominios tienen almacenamiento independiente; no se comparten JWT por URL. MEMENTO recibe un código de un solo uso y lo intercambia con su PKCE. Sus tokens OAuth necesitan su propio ciclo de refresh: no se instalan como una sesión password de `supabase-js`.

La pantalla consulta Auth autenticado, valida `authorization_id`, cliente configurado, usuario, callback exacto y scopes `email profile`. El primer consentimiento requiere **Continuar**. Su GET de comprobación y POST `/oauth/authorizations/{id}/consent` usan un único Bearer, verificado con `getUser(token)`, para que un cambio de cuenta concurrente no apruebe con otra identidad. Hay cancelación, vencimiento y protección de doble clic.

Cuando `getAuthorizationDetails` devuelve únicamente `redirect_url`, Supabase informa un grant previamente consentido. Esa respuesta **no trae client_id**: no se afirma haber comprobado uno inexistente. Solo se permite el callback canónico, parámetros únicos `code` y `state` (o error `access_denied`), sin credenciales, JWT ni fragmento. Este camino no envía un nuevo POST de consentimiento. Un cliente ajeno que aún necesita permiso siempre se rechaza.

Un enlace de correo no instala sesiones. El fragmento se guarda solo en memoria, se limpia del historial y exige **Verificar enlace** antes del POST `/verify`. Ese POST directo, cancelable, evita que una respuesta tardía del SDK reemplace a la cuenta del navegador. Se descarta el refresh token. El cambio de contraseña usa el access token verificado y confirma el ID devuelto; nunca toma una sesión global que pudo cambiar en otra pestaña. Al volver, quien no tenía sesión deberá entrar con su contraseña. Cambios de cuenta invalidan la recuperación abierta.

La solicitud pendiente se guarda como UUID y vencimiento de diez minutos en `sessionStorage`, sin correo ni tokens; se revalida en Auth al volver. Si el correo se abre en otro navegador o la solicitud venció, se reinicia desde MEMENTO. `Cache-Control: no-store`, `Referrer-Policy: no-referrer` y `noindex` protegen `/cuenta/*`; el service worker excluye esas navegaciones de su fallback. Las rutas SWU conservan la detección de enlaces implicit previa.

## Verificación local

- `node --experimental-strip-types scripts/memento-autoridad.test.mts`: callbacks falsos, otro cliente/usuario/scope, tokens y parámetros duplicados, caducidad, cancelación, verificación de correo y Bearer fijado en GET/POST/PUT.
- `node scripts/swu-auth-membership.test.mjs` y `node --experimental-strip-types scripts/swu-membership.test.mts`: regresiones de sesión/membresía; las cuentas SWU históricas no dependen de la nueva RPC.
- `npm run build` y `npm run lint`.
- `node scripts/memento-autoridad-banco.mjs`: banco local en puerto 5189 con Auth simulado y assets reales. Solo herramientas CUA para operarlo. La barra inferior permite acceso, consentimiento, cliente ajeno, recuperación y cambio de cuenta. Los retornos del consentimiento son deliberadamente inválidos para evitar navegar a producción. No crea usuarios reales.

La prueba integrada de PKCE/refresh y entrega de correo requiere configurar el proyecto y probar con una cuenta autorizada después del merge. No se presenta la simulación como una prueba de producción.

Referencias oficiales: [OAuth Server](https://supabase.com/docs/guides/auth/oauth-server), [configuración](https://supabase.com/docs/guides/auth/oauth-server/getting-started), [flujos y endpoints](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows).
