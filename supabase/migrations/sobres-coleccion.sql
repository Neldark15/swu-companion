-- ══════════════════════════════════════════════════════════════════════
-- SOBRES — el mini-juego de coleccionar impresiones especiales
-- ══════════════════════════════════════════════════════════════════════
--
-- Este archivo es el estado consolidado de cinco migraciones aplicadas el
-- 2026-08-19: sobres_tablas, sobres_pool_minimo_y_siembra, sobres_motor,
-- sobres_revocar_escritura_cliente y sobres_motor_fix_duplicado_y_respaldo.
--
-- ── La regla que manda sobre todo lo demás ────────────────────────────
--
-- El cliente NO ESCRIBE. Ni una fila, en ninguna de las cinco tablas. Todo
-- pasa por funciones SECURITY DEFINER. La razón concreta: las serializadas
-- son de UNA persona en toda la comunidad, y los sobres son la moneda del
-- juego. Si `authenticated` pudiera hacer un INSERT, cualquiera con la
-- consola del navegador se regalaría las dos cosas.
--
-- Ojo con la trampa de Supabase: el proyecto trae
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO
--   anon, authenticated, service_role
-- así que TODA tabla nueva de `public` nace con INSERT/UPDATE/DELETE para el
-- cliente. Conceder SELECT no basta — hay que REVOCAR el resto a mano. La
-- primera versión de esto no lo hacía y solo lo tapaba el RLS, que es una
-- sola política mal escrita de distancia del desastre.
--
-- Comprobado contra la base real:
--   · update sobres_saldo set disponibles=999 como authenticated
--       → permission denied for table sobres_saldo
--   · un segundo dueño para la misma serializada
--       → rechazado por la llave primaria
--   · 400 aperturas seguidas → ninguna falló; el premio salió
--     63 / 16,8 / 10 / 8 / 2,3 % (esperado 62 / 16 / 11 / 8 / 3)

-- ── 1. El pool: qué impresiones existen ───────────────────────────────
--
-- Solo las ESPECIALES (6.132 filas): Hyperspace, los foils, las Prestige y
-- las Showcase. La Standard no entra: esa se consigue jugando, no en sobres.
--
-- La llave es el uuid del API, no `set_code`+`set_number`: medido sobre estas
-- mismas 6.132 filas, esa pareja choca 701 veces (cada serie de variantes
-- numera desde 1) mientras que el uuid es único 6.132 de 6.132.
--
-- No se copian nombre ni arte: el catálogo completo ya vive en el teléfono
-- (Dexie) y el cliente resuelve la ficha por uuid.
create table if not exists public.sobres_pool (
  card_id    uuid primary key,
  set_code   text not null,
  set_number integer not null,
  variante   text not null
);
create index if not exists sobres_pool_variante_idx on public.sobres_pool (variante);

-- ── 2. Saldo de sobres sin abrir ──────────────────────────────────────
create table if not exists public.sobres_saldo (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  disponibles    integer not null default 0 check (disponibles >= 0),
  abiertos_total integer not null default 0,
  updated_at     timestamptz not null default now()
);

-- ── 3. El binder digital ──────────────────────────────────────────────
create table if not exists public.cartas_desbloqueadas (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  card_id     uuid not null references public.sobres_pool(card_id) on delete cascade,
  cantidad    integer not null default 1 check (cantidad > 0),
  primera_vez timestamptz not null default now(),
  primary key (user_id, card_id)
);
create index if not exists cartas_desbloqueadas_user_idx on public.cartas_desbloqueadas (user_id);

-- ── 4. El árbitro de las serializadas ─────────────────────────────────
--
-- `card_id` es la llave primaria, y ESO es toda la garantía: no hay forma de
-- que dos filas compartan carta. Reclamar una serializada es intentar el
-- INSERT; si otro llegó primero, Postgres devuelve 23505 y el motor vuelve a
-- sortear. No hay ventana de carrera porque no hay «leer y después escribir».
create table if not exists public.serializadas_dueno (
  card_id   uuid primary key references public.sobres_pool(card_id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  sacada_at timestamptz not null default now()
);
create index if not exists serializadas_dueno_user_idx on public.serializadas_dueno (user_id);

-- ── 5. Bitácora de aperturas ──────────────────────────────────────────
create table if not exists public.sobres_aperturas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  abierto_at timestamptz not null default now(),
  cartas     jsonb not null,
  motivo     text
);
create index if not exists sobres_aperturas_user_idx on public.sobres_aperturas (user_id, abierto_at desc);

-- ── 6. RLS: solo lectura, y de lo que corresponde ─────────────────────
alter table public.sobres_pool           enable row level security;
alter table public.sobres_saldo          enable row level security;
alter table public.cartas_desbloqueadas  enable row level security;
alter table public.serializadas_dueno    enable row level security;
alter table public.sobres_aperturas      enable row level security;

drop policy if exists pool_lee            on public.sobres_pool;
drop policy if exists saldo_lee           on public.sobres_saldo;
drop policy if exists desbloqueadas_lee   on public.cartas_desbloqueadas;
drop policy if exists serializadas_lee    on public.serializadas_dueno;
drop policy if exists aperturas_lee       on public.sobres_aperturas;

-- El pool y los binders son públicos A PROPÓSITO: la gracia de coleccionar es
-- que se vea. Quién tiene cada serializada también — es el salón de la fama.
create policy pool_lee          on public.sobres_pool          for select using (true);
create policy desbloqueadas_lee on public.cartas_desbloqueadas for select using (true);
create policy serializadas_lee  on public.serializadas_dueno   for select using (true);
-- El saldo y la bitácora sí son privados: son la cartera de cada quien.
create policy saldo_lee     on public.sobres_saldo     for select using (auth.uid() = user_id);
create policy aperturas_lee on public.sobres_aperturas for select using (auth.uid() = user_id);

-- ── 7. QUITARLE la escritura al cliente (ver la nota de arriba) ───────
revoke insert, update, delete, truncate on public.sobres_pool          from anon, authenticated;
revoke insert, update, delete, truncate on public.sobres_saldo         from anon, authenticated;
revoke insert, update, delete, truncate on public.cartas_desbloqueadas from anon, authenticated;
revoke insert, update, delete, truncate on public.serializadas_dueno   from anon, authenticated;
revoke insert, update, delete, truncate on public.sobres_aperturas     from anon, authenticated;

grant select on public.sobres_pool          to anon, authenticated;
grant select on public.sobres_saldo         to authenticated;
grant select on public.cartas_desbloqueadas to anon, authenticated;
grant select on public.serializadas_dueno   to anon, authenticated;
grant select on public.sobres_aperturas     to authenticated;

-- ── 8. Acreditar sobres (interna) ─────────────────────────────────────
--
-- Sin GRANT para el cliente: solo la llaman otras funciones del servidor
-- (confirmar una amistosa, cerrar un torneo, completar una misión). Que sea
-- SECURITY DEFINER y además esté revocada es a propósito: si algún día se le
-- concede por error, al menos no está sola.
create or replace function public.acreditar_sobres(p_user uuid, p_cuantos integer, p_motivo text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if p_cuantos <= 0 then return; end if;
  insert into public.sobres_saldo (user_id, disponibles)
  values (p_user, p_cuantos)
  on conflict (user_id) do update
    set disponibles = public.sobres_saldo.disponibles + excluded.disponibles,
        updated_at = now();
end;
$$;
revoke all on function public.acreditar_sobres(uuid, integer, text) from anon, authenticated;

-- ── 9. El motor ───────────────────────────────────────────────────────
--
-- Un sobre son 5 cartas: 3 Hyperspace + 1 foil + la ranura de premio.
--
-- La cascada de `random()` del premio es CONDICIONAL a propósito — cada rama
-- solo se evalúa si falló la anterior, así que los porcentajes componen:
--   0,62                    = 62,00 %  Hyperspace Foil
--   0,38 · 0,42             = 15,96 %  Standard Prestige
--   0,38 · 0,58 · 0,50      = 11,02 %  Foil Prestige
--   0,38 · 0,58 · 0,50 · 0,73 =  8,04 %  Showcase
--   el resto                =  2,98 %  Serializada
create or replace function public.abrir_sobre()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  yo uuid := auth.uid();
  saldo int;
  premio text;
  r record;
  salida jsonb := '[]'::jsonb;
  intentos int;
  ok boolean;
  forzar_showcase boolean := false;
begin
  if yo is null then
    raise exception 'Hay que iniciar sesion' using errcode = 'insufficient_privilege';
  end if;

  -- Se COBRA antes de sortear, con la fila bloqueada por el propio UPDATE.
  -- Si se sorteara primero, dos pestañas simultáneas abrirían dos sobres
  -- pagando uno.
  update public.sobres_saldo
     set disponibles = disponibles - 1,
         abiertos_total = abiertos_total + 1,
         updated_at = now()
   where user_id = yo and disponibles > 0
  returning disponibles into saldo;

  if not found then
    raise exception 'No te quedan sobres' using errcode = 'invalid_parameter_value';
  end if;

  for r in
    select card_id, variante from public.sobres_pool
    where variante = 'Hyperspace' order by random() limit 3
  loop
    salida := salida || jsonb_build_array(jsonb_build_object('card_id', r.card_id, 'variante', r.variante));
  end loop;

  for r in
    select card_id, variante from public.sobres_pool
    where variante in ('Standard Foil','Hyperspace Foil') order by random() limit 1
  loop
    salida := salida || jsonb_build_array(jsonb_build_object('card_id', r.card_id, 'variante', r.variante));
  end loop;

  intentos := 0;
  loop
    intentos := intentos + 1;

    -- `forzar_showcase` es una variable y no `premio := 'Showcase'` porque el
    -- `continue` vuelve al re-sorteo de arriba, que pisaba la asignación: el
    -- respaldo era código muerto y el bucle no tenía tope de verdad.
    if forzar_showcase then
      premio := 'Showcase';
    else
      premio := case
        when random() < 0.62 then 'Hyperspace Foil'
        when random() < 0.42 then 'Standard Prestige'
        when random() < 0.50 then 'Foil Prestige'
        when random() < 0.73 then 'Showcase'
        else 'Serialized Prestige'
      end;
    end if;

    if premio <> 'Serialized Prestige' then
      select p.card_id, p.variante into r
      from public.sobres_pool p where p.variante = premio order by random() limit 1;
      salida := salida || jsonb_build_array(jsonb_build_object('card_id', r.card_id, 'variante', r.variante, 'premio', true));
      exit;
    end if;

    select p.card_id, p.variante into r
    from public.sobres_pool p
    where p.variante = 'Serialized Prestige'
      and not exists (select 1 from public.serializadas_dueno d where d.card_id = p.card_id)
    order by random() limit 1;

    if r.card_id is null then
      forzar_showcase := true;  -- ya no queda ninguna libre en la comunidad
      continue;
    end if;

    begin
      insert into public.serializadas_dueno (card_id, user_id) values (r.card_id, yo);
      ok := true;
    exception when unique_violation then
      ok := false;              -- otro la reclamó en este mismo instante
    end;

    if ok then
      salida := salida || jsonb_build_array(jsonb_build_object(
        'card_id', r.card_id, 'variante', r.variante, 'premio', true, 'serializada', true));
      exit;
    end if;

    if intentos >= 8 then forzar_showcase := true; end if;
  end loop;

  -- Se AGRUPA antes de insertar. Sin el group by, un sobre que trajera la
  -- misma carta dos veces (la ranura de premio saca Hyperspace Foil el 62% de
  -- las veces y la ranura 4 tira del mismo pool) hacía que ON CONFLICT tocara
  -- la misma fila dos veces → error 21000 y la apertura entera se caía. Es
  -- ~1 de cada 5.200 sobres: raro, pero llega.
  insert into public.cartas_desbloqueadas (user_id, card_id, cantidad)
  select yo, (c->>'card_id')::uuid, count(*)
    from jsonb_array_elements(salida) c
   group by (c->>'card_id')::uuid
  on conflict (user_id, card_id) do update
    set cantidad = public.cartas_desbloqueadas.cantidad + excluded.cantidad;

  insert into public.sobres_aperturas (user_id, cartas) values (yo, salida);

  return jsonb_build_object('cartas', salida, 'saldo', saldo);
end;
$$;

grant execute on function public.abrir_sobre() to authenticated;
