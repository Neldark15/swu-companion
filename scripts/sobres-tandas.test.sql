-- Ejecutar tras cargar la migración. Toda apertura, saldo y XP de prueba se revierten.
begin;
do $prueba$
declare
  cuenta uuid;
  otra uuid := gen_random_uuid();
  solicitud uuid := gen_random_uuid();
  respuesta jsonb;
  cinco jsonb;
  recibos bigint;
  antes bigint;
  xp_antes integer;
  xp_esperado integer;
  i integer;
begin
  if has_function_privilege('anon', 'public.abrir_tanda_sobres(integer,uuid,uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.abrir_tanda_sobres(integer,uuid,uuid)', 'execute')
     or has_function_privilege('anon', 'public.tomar_misiones_tanda_sobres(uuid,uuid)', 'execute')
     or has_table_privilege('authenticated', 'public.sobres_tandas', 'select,insert,update,delete')
     or has_table_privilege('anon', 'public.sobres_tandas', 'select,insert,update,delete')
     or not (select relrowsecurity from pg_class where oid = 'public.sobres_tandas'::regclass)
  then raise exception 'Permisos de las tandas incorrectos'; end if;

  select p.id, ps.xp into strict cuenta, xp_antes from public.profiles p
    join public.player_stats ps on ps.user_id = p.id where ps.xp is not null order by p.id limit 1;
  perform set_config('request.jwt.claim.sub', cuenta::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', cuenta, 'role','authenticated')::text, true);
  begin
    perform public.abrir_tanda_sobres(1, solicitud, otra);
    raise exception 'Aceptó una cuenta distinta';
  exception when insufficient_privilege then null; end;
  begin
    perform public.abrir_tanda_sobres(2, solicitud, cuenta);
    raise exception 'Aceptó una cantidad inválida';
  exception when invalid_parameter_value then null; end;

  insert into public.sobres_saldo(user_id, disponibles) values (cuenta, 16)
    on conflict(user_id) do update set disponibles = excluded.disponibles;
  select count(*) into antes from public.sobres_aperturas a where a.user_id = cuenta;
  select count(*) into recibos from public.sobres_tandas t where t.user_id = cuenta;
  cinco := public.abrir_tanda_sobres(5, solicitud, cuenta);
  if jsonb_array_length(cinco->'cartas') <> 25 or (cinco->>'saldo')::integer <> 11
     or (cinco->>'xp_ganado')::integer <> 250 then raise exception 'Falló tanda de cinco'; end if;
  for i in 0..24 loop
    if ((cinco->'cartas'->i)->>'card_id') is null
       or coalesce(((cinco->'cartas'->i)->>'premio')::boolean, false) <> ((i % 5) = 4)
    then raise exception 'Orden o premio incorrecto en carta %', i; end if;
  end loop;
  if public.tomar_misiones_tanda_sobres(solicitud, cuenta) <> 5
     or public.tomar_misiones_tanda_sobres(solicitud, cuenta) <> 0 then
    raise exception 'El acuse de misiones no es de una sola entrega';
  end if;
  begin
    perform public.abrir_tanda_sobres(10, solicitud, cuenta);
    raise exception 'Reutilizó UUID con otra cantidad';
  exception when invalid_parameter_value then null; end;
  respuesta := public.abrir_tanda_sobres(10, gen_random_uuid(), cuenta);
  if jsonb_array_length(respuesta->'cartas') <> 50 or (respuesta->>'xp_ganado')::integer <> 500 then
    raise exception 'Falló tanda de diez';
  end if;
  begin
    perform public.abrir_tanda_sobres(5, gen_random_uuid(), cuenta);
    raise exception 'Autorizó más sobres que el saldo';
  exception when invalid_parameter_value then null; end;
  respuesta := public.abrir_tanda_sobres(1, gen_random_uuid(), cuenta);
  if jsonb_array_length(respuesta->'cartas') <> 5 or (respuesta->>'xp_ganado')::integer <> 50
    then raise exception 'Falló la apertura individual'; end if;

  -- Reintentar una apertura vieja devuelve las cartas originales y los totales actuales.
  respuesta := public.abrir_tanda_sobres(5, solicitud, cuenta);
  select ps.xp into xp_esperado from public.player_stats ps where ps.user_id = cuenta;
  if respuesta->'cartas' <> cinco->'cartas' or (respuesta->>'xp_ganado')::integer <> 250
     or (respuesta->>'saldo')::integer <> 0 or (respuesta->>'xp')::integer <> xp_esperado
     or xp_esperado <> xp_antes + 800 then raise exception 'El reintento cambió el resultado'; end if;
  if (select count(*) from public.sobres_aperturas a where a.user_id = cuenta) <> antes + 16
     or (select count(*) from public.sobres_tandas t where t.user_id = cuenta) <> recibos + 3 then
    raise exception 'Cantidad incorrecta de aperturas o recibos';
  end if;
end;
$prueba$;
rollback;
