-- Privacidad: `profiles.email` deja de ser legible por CUALQUIER cuenta
--
-- ⚠️  NO APLICADA TODAVÍA. Ver «Orden de aplicación» al final: esta migración
--     tiene que ir DESPUÉS del deploy que la acompaña, no antes.
--
-- ── Qué se encontró ──────────────────────────────────────────────────
--
-- La migración anterior (privacy-close-email-and-honor-is-public.sql, aplicada
-- el 2026-07-31) cerró `email` al rol `anon` y lo dejó abierto a
-- `authenticated` con este razonamiento escrito:
--
--   «Entre los 16 miembros, que se conocen en persona, esa exposición es de
--    otro orden que dejarlo abierto a internet entero.»
--
-- La premisa ya no se cumple: **el registro en swusv.com es abierto**. «Estar
-- autenticado» no es «ser uno de los 16», es «haberse creado una cuenta».
--
-- Medido contra la base de producción, simulando el rol y los claims exactos
-- que usa PostgREST y con un `sub` INVENTADO (ni siquiera un usuario real):
--
--   set local role authenticated;
--   select set_config('request.jwt.claims',
--     json_build_object('sub','13fcf49f-1111-2222-3333-444444444444',
--                       'role','authenticated')::text, true);
--   select count(*) ... from public.profiles;
--
--   filas | con_correo | con_whatsapp | admins_visibles
--      19 |         19 |            3 |               3
--
-- O sea: los 19 correos de la comunidad, los 3 WhatsApp y quiénes son los tres
-- admins. La combinación que lo permite son las dos capas a la vez:
--
--   · grant a nivel de TABLA: `authenticated` tiene SELECT sobre
--     `public.profiles` entero — todas las columnas, presentes y futuras. Es
--     el gotcha 2j, que se aplicó a `anon` y no a `authenticated`.
--   · política RLS `profiles_read_all_authenticated` con
--     `USING (auth.uid() IS NOT NULL)` → todas las filas.
--
-- La Galaxia NO es la culpable: `getGalaxyPlayers()` pide `id, name, avatar,
-- settings` + `player_stats!inner(...)` y no toca `email` ni `whatsapp`. El
-- agujero es el grant, no la consulta.
--
-- ── Qué se cierra y qué NO ───────────────────────────────────────────
--
-- **`email` se cierra.** Ninguna pantalla lee el correo de otra persona: el
-- propio sale de `auth.users` vía `user.email`, no de esta tabla.
--
-- **`whatsapp` se queda.** No es un descuido: es una decisión de producto que
-- ya estaba tomada. `tradeService.ts:364` y `collectionService.ts:619/658` lo
-- leen a propósito para abrir el chat con quien vende o cambia una carta, y la
-- nota 2i dice que el contacto se resuelve por WhatsApp justamente para no
-- guardar teléfonos en ningún otro lado. Cerrarlo rompería el cruce de
-- intercambios sin que nadie lo haya pedido. Si algún día se quiere cerrar,
-- hay que mover esa lectura a una RPC que devuelva el número solo cuando hay
-- un intercambio de por medio — es otro trabajo, no un `revoke`.
--
-- ── Orden de aplicación (IMPORTANTE) ─────────────────────────────────
--
-- Aplicar esto ANTES de desplegar el código que lo acompaña **rompe el login
-- de todo el mundo**: con un grant por columnas, un `select('*')` pide TODAS
-- las columnas y PostgREST responde «permission denied for table profiles».
-- El código desplegado hoy hace exactamente eso en `useAuth.ts` al crear el
-- perfil local. El commit que trae este archivo ya lo cambia a
-- `select('name, avatar')` y arregla los dos conteos de `adminService.ts`.
--
--   1. push a main → Vercel despliega
--   2. comprobar que se puede entrar (login normal) y que /admin carga
--   3. RECIÉN ENTONCES correr este SQL en el editor de Supabase
--
-- ── Comprobación después de aplicar ──────────────────────────────────
--
--   set local role authenticated;
--   select set_config('request.jwt.claims',
--     json_build_object('sub','13fcf49f-1111-2222-3333-444444444444',
--                       'role','authenticated')::text, true);
--   select email from public.profiles limit 1;   -- debe dar 42501
--   select id, name, avatar from public.profiles limit 1;  -- debe funcionar

revoke select on public.profiles from authenticated;

-- La lista es la de `anon` MÁS las columnas que la app sí necesita con sesión.
-- `email` queda fuera a propósito. Si se agrega una columna que el cliente
-- deba leer, hay que añadirla acá o dará «permission denied» (gotcha 2j).
grant select (
  id, name, avatar, role, settings, is_public, bio,
  accent, banner_card_id, favorite_aspects, showcase_cards,
  melee_username, melee_verified, whatsapp,
  created_at, updated_at
) on public.profiles to authenticated;

comment on column public.profiles.email is
  'PII. Sin grant de SELECT para anon NI para authenticated: el registro es '
  'abierto, así que «autenticado» no acota a nadie. El correo propio sale de '
  'auth.users (user.email), no de acá.';
