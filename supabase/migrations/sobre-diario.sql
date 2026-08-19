-- SOBRE DIARIO — uno para todos, todos los días a las 8:00 de la mañana.
--
-- ── Por qué el día lo decide la función y no quien la llama ──────────
--
-- La firma no lleva parámetro de fecha A PROPÓSITO. Si el día viniera de
-- afuera, cualquiera con la llave del cron podría pasar el de ayer y repartir
-- otra tanda; y un reintento automático con la fecha de la petición anterior
-- haría lo mismo sin que nadie lo pidiera. Acá el día es
-- `(now() at time zone 'America/El_Salvador')::date` calculado adentro: no hay
-- forma de pedir «el sobre de ayer».
--
-- Y es la fecha de EL SALVADOR, no la de UTC. El cron dispara 14:00 UTC, que
-- son las 8:00 acá; con la fecha de UTC el corte del día caería a las 6 de la
-- tarde y la corrida de la mañana quedaría del lado equivocado dos veces al
-- año si alguna vez se mueve el horario.
--
-- ── Idempotente por construcción, no por cuidado ─────────────────────
--
-- El árbitro es `diario_en` dentro del WHERE del ON CONFLICT: decide Postgres
-- en la misma sentencia, así que no hay ventana entre leer y escribir. Es el
-- mismo patrón que `bienvenida_en` (ver `sobres-bienvenida.sql`), y por eso el
-- cron puede reintentar, correr dos veces o dispararse a mano sin regalar nada.
--
-- Vercel no promete UNA sola invocación por horario, así que esto no es
-- prolijidad: es lo que impide que un reintento duplique el reparto.
--
-- Comprobado contra la base real, en transacción revertida (26 perfiles):
--   · 25 filas de saldo + 1 perfil sin fila  -> reparte 26 (crea la que falta)
--   · segunda corrida el MISMO día           -> 0
--   · tercera corrida el mismo día           -> 0
--   · saldo total                            -> +26 exacto, una sola vez
--   · con `diario_en` retrocedido un día     -> reparte 26 otra vez
--
-- ── El revoke va a PUBLIC, no solo a `anon` ──────────────────────────
--
-- Postgres concede EXECUTE a PUBLIC en toda función nueva y `anon` es miembro
-- de PUBLIC: revocarle solo a `anon` no quita nada. Ya pasó con los dos RPC del
-- álbum (`album-rpc-cerrar-public.sql`). Esta función reparte moneda del juego
-- a los 26 perfiles de golpe; abierta al navegador sería el juego regalado.

alter table sobres_saldo add column if not exists diario_en date;

comment on column sobres_saldo.diario_en is
  'Día (fecha de El Salvador) en que se cobró el último sobre diario. Es el
   árbitro de la idempotencia: vive en el WHERE del ON CONFLICT.';

create or replace function dar_sobre_diario()
returns table (dia date, repartidos integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dia date := (now() at time zone 'America/El_Salvador')::date;
  v_n   integer;
begin
  insert into sobres_saldo (user_id, disponibles, diario_en)
  select p.id, 1, v_dia from profiles p
  on conflict (user_id) do update
     set disponibles = sobres_saldo.disponibles + 1,
         diario_en   = excluded.diario_en,
         updated_at  = now()
   where sobres_saldo.diario_en is distinct from excluded.diario_en;

  -- Las filas saltadas por el WHERE no cuentan acá: por eso una segunda
  -- corrida del mismo día devuelve 0 y no 26. Verificado, no supuesto.
  get diagnostics v_n = row_count;
  return query select v_dia, v_n;
end;
$$;

comment on function dar_sobre_diario() is
  'Reparte un sobre a cada perfil, una vez por día de El Salvador. Idempotente.
   Solo service_role: la llama el cron /api/sobre-diario a las 14:00 UTC.';

revoke all on function dar_sobre_diario() from public;
revoke all on function dar_sobre_diario() from anon;
revoke all on function dar_sobre_diario() from authenticated;
grant execute on function dar_sobre_diario() to service_role;
