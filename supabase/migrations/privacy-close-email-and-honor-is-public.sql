-- Privacidad: cerrar la fuga de correos y hacer real el toggle "perfil público"
-- Aplicada en producción el 2026-07-31.
--
-- ── 1. Fuga de correos a internet ────────────────────────────────────
--
-- `Public profiles viewable USING (true)` + un grant de SELECT a nivel de
-- TABLA dejaban que el rol `anon` leyera los 16 perfiles completos, incluida
-- la columna `email`. La anon key viaja dentro del bundle JS, así que es
-- pública por diseño: cualquiera en internet podía sacar los correos sin
-- autenticarse. Verificado con curl antes y después del cambio.
--
-- OJO — el primer intento fue `revoke select (email) ... from anon` y NO
-- funcionó: un grant a nivel de tabla cubre todas las columnas, presentes y
-- futuras, y un revoke por columna no lo anula. Hay que quitar el grant de
-- tabla y otorgar explícitamente la lista de columnas permitidas.

drop policy if exists "Public profiles viewable" on public.profiles;

revoke select on public.profiles from anon;

grant select (id, name, avatar, role, settings, is_public, bio, created_at, updated_at)
  on public.profiles to anon;

-- `authenticated` conserva el acceso de tabla: useAuth hace select('*') sobre
-- el PROPIO perfil (después del login, ya autenticado) y Mi Perfil muestra el
-- correo. Entre los 16 miembros, que se conocen en persona, esa exposición es
-- de otro orden que dejarlo abierto a internet entero.

comment on column public.profiles.email is
  'PII. Revocada para anon: solo la leen usuarios autenticados.';

-- ── 2. Que "perfil público" signifique algo ───────────────────────────
--
-- `collection_read_authenticated USING (auth.uid() IS NOT NULL)` hacía que
-- CUALQUIER usuario logueado viera la colección de CUALQUIER otro, ignorando
-- por completo el toggle. La app le prometía privacidad al usuario y no se la
-- daba. Al aplicar esto los 16 perfiles eran públicos, así que no cambió nada
-- visible — pero a partir de ahora apagar el toggle sí esconde la colección.

drop policy if exists "collection_read_authenticated" on public.collection;

-- ── 3. Limpiar políticas duplicadas de `collection` ───────────────────
-- Eran 10 políticas para 4 operaciones. Las duplicadas exactas solo hacen más
-- lento el planner y más difícil razonar sobre quién ve qué.
-- Quedan: "Public read collection" (is_public), "Users can view own
-- collection", y las de insert/update/delete propias.

drop policy if exists "View own collection"   on public.collection;
drop policy if exists "Delete own collection" on public.collection;
drop policy if exists "Insert own collection" on public.collection;
drop policy if exists "Update own collection" on public.collection;
