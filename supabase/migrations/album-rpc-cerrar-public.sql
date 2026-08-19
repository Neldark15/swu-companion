-- Las dos funciones del álbum quedaron ejecutables por `anon` pese a que su
-- migración decía `revoke all ... from anon, authenticated`.
--
-- ── La causa NO es la misma que la de las tablas ─────────────────────
--
-- En las tablas el problema es Supabase, que concede ALL por defecto a
-- anon/authenticated en toda tabla nueva de `public` (ver §2j de CLAUDE.md).
--
-- Acá es Postgres: TODA función nueva nace con EXECUTE concedido a **PUBLIC**,
-- y `anon` es miembro de PUBLIC. Revocarle a `anon` no toca esa concesión. Se
-- ve en el ACL como una entrada con el beneficiario VACÍO:
--
--   album_seccion -> "=X/postgres | postgres=X/postgres | ..."
--                     ^ este es PUBLIC
--
-- No había fuga —`sobres_pool` es de lectura pública y con `auth.uid()` nulo
-- las dos funciones devuelven todo en cero— pero contradice la regla del
-- módulo, y una función futura que sí toque datos privados heredaría el mismo
-- agujero por copiar este patrón.
revoke all on function public.album_secciones() from public;
revoke all on function public.album_seccion(text, text) from public;
grant execute on function public.album_secciones() to authenticated;
grant execute on function public.album_seccion(text, text) to authenticated;
