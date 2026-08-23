-- PRESTAMOS DE CARTAS ENTRE JUGADORES. Aplicado 2026-08-23.
--
-- ── Que ES y que NO es ───────────────────────────────────────────────
--
-- Es un RECORDATORIO de quien tiene que, no un cambio de dueño. NO toca
-- `collection`: la carta sigue siendo del que la presto. Si lo hiciera, una
-- devolucion mal hecha borraria cartas de la coleccion de alguien.
--
-- ── Lo anota el que PRESTA, y no hace falta que el otro confirme ─────
--
-- Es su carta y su memoria. Pero un prestamo dice algo sobre OTRA persona
-- —«fulano tiene mi carta»— asi que el que recibe lo VE y puede DISPUTARLO.
--
-- No se exige confirmacion para que exista, y es una decision medida: en las
-- amistosas, que si la exigen, 3 de 4 llevaban semanas sin confirmar. Un
-- recordatorio que necesita el visto bueno del otro para servirte a VOS no es
-- un recordatorio, es un tramite.
--
-- ── Permisos asimetricos, a proposito ────────────────────────────────
--
--   cancelar  -> SOLO quien presto (es deshacer una anotacion propia)
--   disputar  -> SOLO quien recibe (es decir «eso no me lo prestaste»)
--   devuelto  -> LOS DOS (se ven el sabado, se devuelven la carta, lo marca
--                el que se acuerde; si solo pudiera uno, el otro se queda con
--                un recordatorio que no puede apagar)
--
-- ── Y quien recibe puede NO tener cuenta ─────────────────────────────
--
-- `recibe_id` es nullable y siempre hay `recibe_nombre`. En una comunidad de 27
-- que se conocen en persona, prestarle una carta a alguien que todavia no se
-- registro es normal, no un borde.
--
-- Probado en transaccion revertida con `set local role authenticated`:
--   A presta 2 a B                 -> ok, los dos lo ven
--   contadores                     -> A «me deben 1, vencidos 1»; B «le debo 1»
--   un TERCERO lo ve               -> 0
--   un TERCERO lo cierra           -> rechazado
--   quien PRESTA lo disputa        -> rechazado
--   quien RECIBE lo cancela        -> rechazado
--   quien RECIBE lo marca devuelto -> devuelto
--   cerrarlo dos veces             -> rechazado
--   contadores tras devolver       -> 0 y 0

-- ═══════════════════════════════════════════════════════════════════════
--  SEGUNDA PARTE (2026-08-23): faltaba poder PRESTAR
-- ═══════════════════════════════════════════════════════════════════════
--
--  La primera parte dejó la tabla, `cerrar_prestamo` y `prestamos_pendientes`
--  aplicados y probados… y `prestamos` con UNA sola policy, la de SELECT. O
--  sea que se podía leer, cerrar y contar préstamos que nadie podía crear.
--  Tampoco había una línea de frontend: ni servicio, ni pantalla, ni ruta.
--  Medido: 0 filas en toda la vida de la tabla, y no por falta de uso.
--
--  Este archivo también arrastraba el problema de fondo: era 100% comentario.
--  El DDL de la primera parte se aplicó por MCP y nunca se escribió acá, así
--  que el repo describía un módulo cuyo esquema no estaba en ningún lado.
--  Queda abajo, además del pedazo nuevo.
--
--  ── Por qué prestar va por RPC y no por una policy de INSERT ──────────
--
--  Un `insert` con policy dejaría al cliente elegir `estado`, `prestado_en`,
--  `cerrado_en` y `cerrado_por`. Con `estado` en la mano se puede escribir un
--  préstamo ya «devuelto» —o «disputado» en nombre del otro—, que es
--  exactamente lo que `cerrar_prestamo` cuida con sus permisos asimétricos.
--  El RPC fija esos cuatro campos y solo acepta los que son datos.
--
--  ── No se exige tener la carta registrada ─────────────────────────────
--
--  El Mercado sí lo exige (`markCardForSale` pide quantity > 0) porque
--  publicar es ofrecer algo. Esto es un RECORDATORIO: si prestaste una carta
--  que nunca registraste, el sistema no tiene por qué llamarte mentiroso. La
--  pantalla ofrece tu colección primero, que resuelve el caso normal sin
--  convertir el caso raro en un muro.
-- ═══════════════════════════════════════════════════════════════════════

-- Por si la primera parte solo vive en la base y no en este archivo.
create table if not exists public.prestamos (
  id            uuid primary key default gen_random_uuid(),
  presta_id     uuid not null references public.profiles(id) on delete cascade,
  recibe_id     uuid references public.profiles(id) on delete set null,
  recibe_nombre text not null,
  card_id       text not null,
  cantidad      int  not null check (cantidad > 0),
  nota          text,
  estado        text not null default 'activo'
                check (estado in ('activo','devuelto','disputado','cancelado')),
  prestado_en   timestamptz not null default now(),
  devolver_en   date,
  cerrado_en    timestamptz,
  cerrado_por   uuid,
  aviso_en      timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint prestamo_no_a_uno_mismo check (recibe_id is null or recibe_id <> presta_id)
);

alter table public.prestamos enable row level security;

-- §2j: Supabase concede ALL en toda tabla nueva de `public`. Se revoca y se
-- concede lo justo: leer sí (la RLS decide cuáles), escribir NUNCA — todo
-- pasa por los dos RPC.
revoke all on public.prestamos from anon, authenticated;
grant select on public.prestamos to authenticated;

drop policy if exists prestamos_mios on public.prestamos;
create policy prestamos_mios on public.prestamos
  for select to authenticated
  using (presta_id = auth.uid() or recibe_id = auth.uid());

create index if not exists ix_prestamos_presta on public.prestamos (presta_id, estado);
create index if not exists ix_prestamos_recibe on public.prestamos (recibe_id, estado);

-- ── Prestar ──────────────────────────────────────────────────────────────
create or replace function public.prestar_carta(
  p_card_id       text,
  p_cantidad      int,
  p_recibe_nombre text,
  p_recibe_id     uuid default null,
  p_devolver_en   date default null,
  p_nota          text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_yo uuid := auth.uid();
  v_id uuid;
  v_nombre text := btrim(coalesce(p_recibe_nombre, ''));
begin
  if v_yo is null then raise exception 'Hay que iniciar sesion'; end if;
  if coalesce(btrim(p_card_id), '') = '' then raise exception 'Falta la carta'; end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 99 then
    raise exception 'La cantidad tiene que estar entre 1 y 99';
  end if;

  -- Si el que recibe TIENE cuenta, el nombre sale de su perfil y no de lo que
  -- teclee el que presta. Es un dato sobre OTRA persona: dejarlo escribir a
  -- mano permitiría anotar «Fulano me debe» con el nombre cambiado, y esa fila
  -- la ve Fulano.
  if p_recibe_id is not null then
    if p_recibe_id = v_yo then raise exception 'No podes prestarte a vos mismo'; end if;
    select name into v_nombre from profiles where id = p_recibe_id;
    if v_nombre is null then raise exception 'Esa persona no existe'; end if;
  elsif v_nombre = '' then
    raise exception 'Decime a quien se la prestaste';
  end if;

  -- La fecha de devolución no puede ser pasado: un préstamo que nace vencido
  -- ensucia el contador de vencidos desde el minuto cero.
  if p_devolver_en is not null and p_devolver_en < current_date then
    raise exception 'Esa fecha ya paso';
  end if;

  insert into prestamos (presta_id, recibe_id, recibe_nombre, card_id, cantidad,
                         nota, devolver_en)
  values (v_yo, p_recibe_id, left(v_nombre, 60), btrim(p_card_id), p_cantidad,
          nullif(btrim(coalesce(p_nota, '')), ''), p_devolver_en)
  returning id into v_id;

  return v_id;
end $$;

-- §3i: Postgres concede EXECUTE a PUBLIC en toda función nueva, y `anon` es
-- miembro de PUBLIC. Un `revoke ... from anon` NO lo quita.
revoke all on function public.prestar_carta(text, int, text, uuid, date, text) from public, anon;
grant execute on function public.prestar_carta(text, int, text, uuid, date, text) to authenticated;
revoke all on function public.cerrar_prestamo(uuid, text) from public, anon;
grant execute on function public.cerrar_prestamo(uuid, text) to authenticated;
revoke all on function public.prestamos_pendientes() from public, anon;
grant execute on function public.prestamos_pendientes() to authenticated;
