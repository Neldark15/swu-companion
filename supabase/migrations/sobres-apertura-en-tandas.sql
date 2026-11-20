begin;

create table if not exists public.sobres_tandas (
  user_id uuid not null references public.profiles(id) on delete cascade,
  solicitud uuid not null,
  cantidad integer not null check (cantidad in (1, 5, 10)),
  cartas jsonb not null check (jsonb_array_length(cartas) = cantidad * 5),
  xp_ganado integer not null,
  misiones_entregadas boolean not null default false,
  primary key (user_id, solicitud)
);
alter table public.sobres_tandas enable row level security;
revoke all on table public.sobres_tandas from public, anon, authenticated, service_role;

create or replace function public.abrir_tanda_sobres(
  p_cantidad integer, p_solicitud uuid, p_usuario uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := auth.uid();
  recibo public.sobres_tandas%rowtype;
  sobre jsonb;
  cartas jsonb := '[]'::jsonb;
  ganado integer := 0;
  saldo integer;
  xp_actual integer;
  nivel_actual integer;
begin
  if yo is null or p_usuario is distinct from yo then
    raise exception 'La cuenta de esta apertura cambió.' using errcode = '42501';
  end if;
  if p_solicitud is null or p_cantidad is null or p_cantidad not in (1, 5, 10) then
    raise exception 'Elegí una tanda de 1, 5 o 10 sobres.' using errcode = '22023';
  end if;

  -- El motor individual, la tienda y las tandas comparten esta fila. Una segunda
  -- pestaña espera al primer commit antes de buscar el recibo o gastar saldo.
  select s.disponibles into saldo from public.sobres_saldo s where s.user_id = yo for update;
  select * into recibo from public.sobres_tandas t where t.user_id = yo and t.solicitud = p_solicitud;
  if found then
    if recibo.cantidad <> p_cantidad then
      raise exception 'Esta solicitud corresponde a otra cantidad de sobres.' using errcode = '22023';
    end if;
    cartas := recibo.cartas;
    ganado := recibo.xp_ganado;
  else
    if coalesce(saldo, 0) < p_cantidad then
      raise exception 'No tenés suficientes sobres para esa tanda.' using errcode = '22023';
    end if;
    for i in 1..p_cantidad loop
      sobre := public.abrir_sobre();
      if jsonb_typeof(sobre->'cartas') is distinct from 'array'
         or jsonb_array_length(sobre->'cartas') is distinct from 5 then
        raise exception 'El sorteo no devolvió las cinco cartas del sobre.';
      end if;
      cartas := cartas || (sobre->'cartas');
      ganado := ganado + coalesce((sobre->>'xp_ganado')::integer, 0);
      saldo := (sobre->>'saldo')::integer;
    end loop;
    insert into public.sobres_tandas (user_id, solicitud, cantidad, cartas, xp_ganado)
    values (yo, p_solicitud, p_cantidad, cartas, ganado);
  end if;
  -- Un reintento conserva el sorteo; los totales reflejan compras y cobros posteriores.
  select ps.xp, ps.level into xp_actual, nivel_actual from public.player_stats ps where ps.user_id = yo;
  return jsonb_build_object('cartas', cartas, 'saldo', coalesce(saldo, 0), 'xp', xp_actual,
                            'nivel', nivel_actual, 'xp_ganado', ganado);
end;
$$;

-- El gesto de misión se entrega al cliente una vez, incluso si recibió el
-- sobre recién al reintentar. Su avance y el cobro usan el catálogo de Misiones.
create or replace function public.tomar_misiones_tanda_sobres(p_solicitud uuid, p_usuario uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  yo uuid := auth.uid();
  abiertas integer;
begin
  if yo is null or p_usuario is distinct from yo then
    raise exception 'La cuenta de esta apertura cambió.' using errcode = '42501';
  end if;
  update public.sobres_tandas set misiones_entregadas = true
    where user_id = yo and solicitud = p_solicitud and not misiones_entregadas
    returning cantidad into abiertas;
  return coalesce(abiertas, 0);
end;
$$;
revoke all on function public.abrir_tanda_sobres(integer,uuid,uuid) from public, anon, authenticated, service_role;
revoke all on function public.tomar_misiones_tanda_sobres(uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function public.abrir_tanda_sobres(integer,uuid,uuid) to authenticated;
grant execute on function public.tomar_misiones_tanda_sobres(uuid,uuid) to authenticated;

commit;
