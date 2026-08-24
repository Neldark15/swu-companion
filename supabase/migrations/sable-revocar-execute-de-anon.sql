-- REVOCAR DE `anon` EXPLÍCITAMENTE, no solo de PUBLIC.
--
-- ── La regla del repo estaba a medias ─────────────────────────────────
--
-- El §3i decía «EXECUTE se revoca de PUBLIC y no solo de `anon`, porque
-- Postgres se lo concede a PUBLIC y `anon` es miembro de PUBLIC». Cierto, y no
-- alcanza: Supabase además tiene ALTER DEFAULT PRIVILEGES que concede EXECUTE
-- **directamente** a `anon` y `authenticated` sobre toda función nueva de
-- `public`. Un grant directo NO se quita revocando de PUBLIC — son dos
-- concesiones distintas y hay que quitar las dos.
--
-- Medido, no supuesto: las siete funciones del taller salían con
-- `anon=X/postgres` en `pg_proc.proacl` pese al `revoke ... from public` de su
-- propia migración. Y son 33 de las 94 funciones de `public` las que están así
-- —varias a propósito, porque hay pantallas públicas—, o sea que esto no se
-- arregla en masa: se revisa función por función.
--
-- ── No era una fuga ───────────────────────────────────────────────────
--
-- Las siete comprueban `auth.uid() is null` adentro y a un anónimo le
-- responden «Sin sesion». Probado antes y después. Pero defensa en profundidad
-- significa que las dos capas estén puestas, no que una tape a la otra: el día
-- que alguien agregue una RPC y se olvide del `if v_yo is null`, la capa de
-- grants es la que decide si eso es un susto o un incidente.

revoke all on function public.sable_taller() from anon, public;
revoke all on function public.comprar_parte_sable(text) from anon, public;
revoke all on function public.guardar_sable(text, text, text, text, text) from anon, public;
revoke all on function public.guardar_sable(text, text, text, text, text, text) from anon, public;
revoke all on function public.sable_abierto() from anon, public;
revoke all on function public.sable_saldo_xp() from anon, public;
revoke all on function public.es_probador_sable() from anon, public;

grant execute on function public.sable_taller() to authenticated;
grant execute on function public.comprar_parte_sable(text) to authenticated;
grant execute on function public.guardar_sable(text, text, text, text, text, text) to authenticated;
grant execute on function public.sable_abierto() to authenticated;
grant execute on function public.sable_saldo_xp() to authenticated;
grant execute on function public.es_probador_sable() to authenticated;

-- La firma vieja de 5 argumentos queda SIN grant: ya nadie la llama (el cliente
-- manda los 6) y dejarla ejecutable era una puerta de más sin dueño.
--
-- Verificado en producción, las dos caras:
--   anon         → rechazado en taller, comprar y saldo (insufficient_privilege)
--   authenticated→ abre=true, 30 piezas, 10 acabados, saldo 3967, guardar=true
