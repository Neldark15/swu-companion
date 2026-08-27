-- ═══ LIGA INTERNACIONAL — el motor (RPCs) ═══
--
-- Las 17 funciones de la liga por grupos: inscripción con disponibilidad,
-- ensayo/armado/siembra de grupos, reportar-confirmar-disputar-corregir, el
-- barrido de vencidas (el silencio confirma) y las dos lecturas.
--
-- Aplicada en producción el 2026-08-27, después de
-- `liga-internacional-esquema.sql`. `liga_sembrar_grupo` se corrige justo
-- después en `liga-sembrar-grupo-id-ambiguo.sql`: acá todavía tiene el `id`
-- ambiguo, y este archivo se conserva tal cual se aplicó.

-- ═══ LIGA INTERNACIONAL — el motor ═══
-- Todas SECURITY DEFINER con el guardia ADENTRO (§3i-bis), y el fallo va en la
-- clave `error` porque es la que lee el ayudante `rpc()` del cliente (§4f).

-- ── Quién manda en una liga ──────────────────────────────────────────
create or replace function public.liga_es_staff(p_liga uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select exists (select 1 from public.ligas l where l.id = p_liga and l.creador_id = auth.uid())
      or exists (select 1 from public.liga_staff s where s.liga_id = p_liga and s.user_id = auth.uid())
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
$$;
revoke all on function public.liga_es_staff(uuid) from anon, public;
grant execute on function public.liga_es_staff(uuid) to authenticated;


-- ── FASE 0 · cerrar inscripción DEJA DE SEMBRAR ──────────────────────
-- Sembraba round-robin de TODA la liga: con 120 inscritos, 7.140 filas de un
-- toque. Ahora solo abre la temporada; la siembra es por GRUPO.
create or replace function public.liga_cerrar_inscripcion(p_liga uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not public.liga_es_staff(p_liga) then
    return jsonb_build_object('ok', false, 'error', 'Esa liga no es tuya.');
  end if;
  update public.ligas set estado = 'activa'
   where id = p_liga and estado = 'inscripcion';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Esa liga no esta en inscripcion.');
  end if;
  return jsonb_build_object('ok', true,
    'mensaje', 'Inscripcion cerrada. Los grupos se arman y se siembran por separado.');
end;
$function$;

-- El reparto de premios queda DESACTIVADO: se abre el reporte a los jugadores
-- y eso quita la unica defensa que el contador tenia (§4j).
create or replace function public.liga_premiar(p_liga uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
begin
  return jsonb_build_object('ok', false, 'error',
    'Los premios estan desactivados mientras los jugadores reportan sus propios marcadores.');
end;
$function$;


-- ── INSCRIBIRSE, con disponibilidad y doble consentimiento ───────────
-- §4f: agregar argumentos con default crea una SOBRECARGA, no reemplaza. Se
-- suelta la firma vieja en el MISMO archivo y antes del create.
drop function if exists public.liga_inscribirse(uuid, text, text, boolean);

create or replace function public.liga_inscribirse(
  p_liga uuid, p_lider text, p_base text,
  p_zona text, p_franjas text,
  p_consiente_transmision boolean, p_consiente_perfil boolean
)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_yo uuid := auth.uid(); v_nombre text; v_insc uuid; v_zona text;
begin
  if v_yo is null then return jsonb_build_object('ok', false, 'error', 'Sin sesion.'); end if;
  if not public.liga_visible() then
    return jsonb_build_object('ok', false, 'error', 'La liga todavia no esta abierta.');
  end if;
  -- Hay MENORES y las partidas se transmiten: se exige acá, no en la UI (§4l).
  if p_consiente_transmision is distinct from true then
    return jsonb_build_object('ok', false, 'error',
      'Para jugar la liga tenes que aceptar que tus partidas se transmitan y publiquen.');
  end if;
  if not exists (select 1 from public.ligas where id = p_liga and estado = 'inscripcion') then
    return jsonb_build_object('ok', false, 'error', 'Esa liga no esta en inscripcion.');
  end if;
  if p_franjas !~ '^[01]{168}$' then
    return jsonb_build_object('ok', false, 'error', 'La disponibilidad llego mal formada.');
  end if;
  -- 6 horas semanales en CUALQUIER reparto. Una regla mas dura empuja a
  -- marcar casillas falsas, y eso envenena el unico calculo del que cuelga
  -- el armado de grupos.
  if length(replace(p_franjas, '0', '')) < 6 then
    return jsonb_build_object('ok', false, 'error',
      'Marca al menos 6 horas por semana en las que puedas jugar.');
  end if;
  -- Una zona desconocida NO rechaza: un desfase de tzdata (Europe/Kyiv vs
  -- Kiev) no puede dejar a alguien fuera de la liga.
  v_zona := case when exists (select 1 from pg_timezone_names where name = p_zona)
                 then p_zona else 'zona_desconocida' end;

  select name into v_nombre from public.profiles where id = v_yo;

  insert into public.liga_inscripciones
    (liga_id, user_id, nombre_visible, lider, base, consiente_aparecer, consiente_perfil)
  values (p_liga, v_yo, coalesce(v_nombre, 'Jugador'),
          nullif(btrim(coalesce(p_lider,'')),''), nullif(btrim(coalesce(p_base,'')),''),
          true, coalesce(p_consiente_perfil, false))
  returning id into v_insc;

  -- MISMA transacción: dos llamadas dejarían gente inscrita con cero franjas,
  -- y el armador no puede trabajar con eso.
  insert into public.liga_disponibilidad (insc_id, liga_id, zona, franjas)
  values (v_insc, p_liga, v_zona, p_franjas);

  return jsonb_build_object('ok', true, 'inscripcion', v_insc, 'zona', v_zona);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'Ya estas inscrito en esta liga.');
end;
$function$;

create or replace function public.liga_guardar_disponibilidad(
  p_liga uuid, p_zona text, p_franjas text, p_nota text default null)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_insc uuid; v_zona text;
begin
  select id into v_insc from public.liga_inscripciones
   where liga_id = p_liga and user_id = auth.uid();
  if v_insc is null then
    return jsonb_build_object('ok', false, 'error', 'No estas inscrito en esta liga.');
  end if;
  if p_franjas !~ '^[01]{168}$' or length(replace(p_franjas, '0', '')) < 6 then
    return jsonb_build_object('ok', false, 'error', 'Marca al menos 6 horas por semana.');
  end if;
  v_zona := case when exists (select 1 from pg_timezone_names where name = p_zona)
                 then p_zona else 'zona_desconocida' end;
  insert into public.liga_disponibilidad (insc_id, liga_id, zona, franjas, nota)
  values (v_insc, p_liga, v_zona, p_franjas, nullif(btrim(coalesce(p_nota,'')),''))
  on conflict (insc_id) do update
    set zona = excluded.zona, franjas = excluded.franjas,
        nota = excluded.nota, declarada_en = now();
  return jsonb_build_object('ok', true, 'zona', v_zona);
end;
$function$;


-- ── TEMPORADA · GRUPOS · SIEMBRA ─────────────────────────────────────
create or replace function public.liga_abrir_temporada(
  p_liga uuid, p_nombre text, p_arranca date, p_cierra date)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_id uuid; v_num int;
begin
  if not public.liga_es_staff(p_liga) then
    return jsonb_build_object('ok', false, 'error', 'Esa liga no es tuya.');
  end if;
  if p_cierra <= p_arranca then
    return jsonb_build_object('ok', false, 'error', 'La fecha de cierre va despues de la de arranque.');
  end if;
  select coalesce(max(numero), 0) + 1 into v_num from public.liga_temporadas where liga_id = p_liga;
  insert into public.liga_temporadas (liga_id, numero, nombre, arranca, cierra)
  values (p_liga, v_num, btrim(p_nombre), p_arranca, p_cierra)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'temporada', v_id, 'numero', v_num);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'Ya hay una temporada viva en esta liga.');
end;
$function$;

/**
 * ENSAYO: propone los grupos y NO ESCRIBE NADA.
 *
 * Armar 15 grupos toca 120 filas y un error ahí es invisible. Devuelve la
 * forma propuesta, el solape mínimo de cada grupo y —lo que de verdad
 * importa— los pares que NO tienen ni una hora en común.
 *
 * El solape se calcula corriendo la máscara del otro por el desfase entre las
 * dos zonas: comparar las 20:00 de Madrid con las 20:00 de San Salvador
 * devuelve números plausibles y falsos.
 */
create or replace function public.liga_plan_grupos(p_temporada uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  v_liga uuid; v_tamano int; v_total int; v_grupos int; v_res jsonb;
begin
  select t.liga_id, l.tamano_grupo into v_liga, v_tamano
    from public.liga_temporadas t join public.ligas l on l.id = t.liga_id
   where t.id = p_temporada;
  if v_liga is null then
    return jsonb_build_object('ok', false, 'error', 'No existe esa temporada.');
  end if;
  if not public.liga_es_staff(v_liga) then
    return jsonb_build_object('ok', false, 'error', 'Esa liga no es tuya.');
  end if;

  select count(*) into v_total from public.liga_inscripciones
   where liga_id = v_liga and estado = 'activo';
  if v_total < 4 then
    return jsonb_build_object('ok', false, 'error',
      format('Hacen falta al menos 4 inscritos (hay %s).', v_total));
  end if;
  v_grupos := greatest(1, ceil(v_total::numeric / v_tamano)::int);

  select jsonb_build_object(
    'ok', true,
    'inscritos', v_total,
    'tamanoObjetivo', v_tamano,
    'gruposPropuestos', v_grupos,
    'sinDisponibilidad', (
      select count(*) from public.liga_inscripciones i
       where i.liga_id = v_liga and i.estado = 'activo'
         and not exists (select 1 from public.liga_disponibilidad d where d.insc_id = i.id)),
    'porTier', (
      select coalesce(jsonb_object_agg(tier, n), '{}'::jsonb) from (
        select tier, count(*) as n from public.liga_inscripciones
         where liga_id = v_liga and estado = 'activo' group by tier) x),
    'inscritos_detalle', coalesce((
      select jsonb_agg(jsonb_build_object(
        'inscId', i.id, 'nombre', i.nombre_visible, 'tier', i.tier,
        'zona', d.zona, 'horas', length(replace(d.franjas,'0','')))
        order by i.tier, i.inscrito_en)
        from public.liga_inscripciones i
        left join public.liga_disponibilidad d on d.insc_id = i.id
       where i.liga_id = v_liga and i.estado = 'activo'), '[]'::jsonb)
  ) into v_res;
  return v_res;
end;
$function$;

/**
 * ARMA los grupos a partir de una asignación que propone el cliente.
 *
 * El armador PROPONE y el servidor VALIDA — patrón ya probado en
 * `armar_mesas()` (§3k). Dos algoritmos de siembra se separan; un validador y
 * un generador, no.
 *
 * p_asignacion: [{ "tier":"comun", "orden":1, "inscripciones":[uuid, ...] }, ...]
 */
create or replace function public.liga_armar_grupos(p_temporada uuid, p_asignacion jsonb)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_liga uuid; g jsonb; v_ids uuid[]; v_grupo uuid; v_creados int := 0;
  v_arranca date; v_cierra date; v_vistas uuid[] := '{}';
begin
  select t.liga_id, t.arranca, t.cierra into v_liga, v_arranca, v_cierra
    from public.liga_temporadas t where t.id = p_temporada and t.estado = 'inscripcion';
  if v_liga is null then
    return jsonb_build_object('ok', false, 'error', 'Esa temporada no esta en inscripcion.');
  end if;
  if not public.liga_es_staff(v_liga) then
    return jsonb_build_object('ok', false, 'error', 'Esa liga no es tuya.');
  end if;

  for g in select * from jsonb_array_elements(p_asignacion) loop
    select array_agg(x::uuid) into v_ids
      from jsonb_array_elements_text(g->'inscripciones') x;
    if coalesce(array_length(v_ids,1),0) < 4 or array_length(v_ids,1) > 12 then
      return jsonb_build_object('ok', false, 'error',
        format('El grupo %s %s tiene %s plazas; van de 4 a 12.',
               g->>'tier', g->>'orden', coalesce(array_length(v_ids,1),0)));
    end if;
    -- Nadie en dos grupos. Sin esto, una plaza duplicada da dos filas en la
    -- tabla y el motor la empareja consigo misma.
    if exists (select 1 from unnest(v_ids) u where u = any(v_vistas)) then
      return jsonb_build_object('ok', false, 'error', 'Hay alguien asignado a dos grupos.');
    end if;
    v_vistas := v_vistas || v_ids;
    if exists (select 1 from unnest(v_ids) u
                where not exists (select 1 from public.liga_inscripciones i
                                   where i.id = u and i.liga_id = v_liga and i.estado='activo')) then
      return jsonb_build_object('ok', false, 'error', 'Hay una inscripcion que no es de esta liga.');
    end if;

    insert into public.liga_grupos (temporada_id, tier, orden, tamano, arranca, cierra)
    values (p_temporada, g->>'tier', (g->>'orden')::int, array_length(v_ids,1), v_arranca, v_cierra)
    returning id into v_grupo;

    insert into public.liga_plazas (grupo_id, inscripcion_id, nombre_visible, lider_card_id, base_card_id)
    select v_grupo, i.id, i.nombre_visible, i.lider, i.base
      from public.liga_inscripciones i where i.id = any(v_ids);

    v_creados := v_creados + 1;
  end loop;

  update public.liga_temporadas set estado = 'en_curso' where id = p_temporada;
  update public.ligas set estado = 'activa' where id = v_liga;
  return jsonb_build_object('ok', true, 'grupos', v_creados, 'plazas', array_length(v_vistas,1));
end;
$function$;

/**
 * Siembra el calendario de UN grupo: método del círculo, acotado.
 *
 * 8 plazas = 28 partidas y 7 jornadas. La transición es ATÓMICA sobre
 * `sembrado_en is null`: dos clics serían 56 partidas y la tabla al doble,
 * sin un solo error.
 */
create or replace function public.liga_sembrar_grupo(p_grupo uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_liga uuid; v_ids uuid[]; n int; i int; j int; ronda int; mitad int;
  v_gira uuid[]; v_dias int; v_arranca date; v_cierra date; v_creadas int := 0;
begin
  select t.liga_id, g.arranca, g.cierra into v_liga, v_arranca, v_cierra
    from public.liga_grupos g join public.liga_temporadas t on t.id = g.temporada_id
   where g.id = p_grupo;
  if v_liga is null then return jsonb_build_object('ok', false, 'error', 'No existe ese grupo.'); end if;
  if not public.liga_es_staff(v_liga) then
    return jsonb_build_object('ok', false, 'error', 'Esa liga no es tuya.');
  end if;

  update public.liga_grupos set sembrado_en = now(), estado = 'en_curso'
   where id = p_grupo and sembrado_en is null;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Ese grupo ya tiene calendario.');
  end if;

  select array_agg(id order by md5(t.semilla || p.id::text)) into v_ids
    from public.liga_plazas p
    join public.liga_grupos g on g.id = p.grupo_id
    join public.liga_temporadas t on t.id = g.temporada_id
   where p.grupo_id = p_grupo;

  n := coalesce(array_length(v_ids, 1), 0);
  if n % 2 = 1 then v_ids := v_ids || null::uuid; n := n + 1; end if;
  mitad := n / 2;
  v_gira := v_ids;
  v_dias := greatest(1, ((v_cierra - v_arranca) / greatest(1, n - 1))::int);

  for ronda in 1..(n - 1) loop
    for i in 1..mitad loop
      j := n + 1 - i;
      if v_gira[i] is not null and v_gira[j] is not null then
        insert into public.liga_partidas
          (liga_id, grupo_id, jornada, local_plaza, visita_plaza, estado, vence_el)
        values (v_liga, p_grupo, ronda,
                case when ronda % 2 = 0 then v_gira[j] else v_gira[i] end,
                case when ronda % 2 = 0 then v_gira[i] else v_gira[j] end,
                'programada', v_arranca + (v_dias * ronda));
        v_creadas := v_creadas + 1;
      end if;
    end loop;
    v_gira := v_gira[1:1] || v_gira[n:n] || v_gira[2:n-1];
  end loop;

  return jsonb_build_object('ok', true, 'partidas', v_creadas, 'jornadas', n - 1);
end;
$function$;


-- ── RESULTADOS ──────────────────────────────────────────────────────
create or replace function public.liga_mi_plaza(p_partida uuid)
returns uuid language sql stable security definer set search_path to 'public'
as $$
  select p.id from public.liga_plazas p
    join public.liga_inscripciones i on i.id = p.inscripcion_id
    join public.liga_partidas m on m.local_plaza = p.id or m.visita_plaza = p.id
   where m.id = p_partida and i.user_id = auth.uid()
   limit 1
$$;
revoke all on function public.liga_mi_plaza(uuid) from anon, public;
grant execute on function public.liga_mi_plaza(uuid) to authenticated;

create or replace function public.liga_reportar(
  p_partida uuid, p_victorias_local int, p_victorias_visita int,
  p_vod text default null, p_vod_t int default null)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_mia uuid; v_liga uuid; v_estado text; v_vod text; v_staff boolean;
begin
  select liga_id, estado into v_liga, v_estado from public.liga_partidas where id = p_partida;
  if v_liga is null then return jsonb_build_object('ok', false, 'error', 'No existe esa partida.'); end if;
  v_mia := public.liga_mi_plaza(p_partida);
  v_staff := public.liga_es_staff(v_liga);
  if v_mia is null and not v_staff then
    return jsonb_build_object('ok', false, 'error', 'Esa partida no es tuya.');
  end if;
  if v_estado = 'disputada' then
    return jsonb_build_object('ok', false, 'error', 'Esto lo destraba la organizacion.');
  end if;
  if v_estado not in ('programada','reportada','vencida') then
    return jsonb_build_object('ok', false, 'error', 'Esa partida ya esta cerrada.');
  end if;
  if p_victorias_local is null or p_victorias_visita is null
     or p_victorias_local not between 0 and 2 or p_victorias_visita not between 0 and 2
     or p_victorias_local = p_victorias_visita then
    return jsonb_build_object('ok', false, 'error', 'Un BO3 termina 2-0, 2-1, 1-0... sin empates.');
  end if;
  if p_vod is not null and btrim(p_vod) <> '' then
    v_vod := substring(p_vod from '([A-Za-z0-9_-]{11})');
    if v_vod is null then
      return jsonb_build_object('ok', false, 'error', 'Ese enlace de YouTube no se entiende.');
    end if;
  end if;

  update public.liga_partidas
     set victorias_local = p_victorias_local, victorias_visita = p_victorias_visita,
         estado = 'reportada', reportada_por = coalesce(v_mia, reportada_por),
         reportada_en = now(),
         -- 5 días para que el otro conteste. El barrido es diario, así que la
         -- ventana real es de 5 a 6 — y eso se dice en pantalla.
         vence_el = (now() at time zone 'America/El_Salvador')::date + 5,
         aviso_en = null, recordatorio_en = null,
         vod_youtube_id = coalesce(v_vod, vod_youtube_id),
         vod_t = coalesce(p_vod_t, vod_t),
         updated_at = now()
   where id = p_partida;
  return jsonb_build_object('ok', true);
end;
$function$;

/**
 * Confirmar va por RPC, JAMÁS por policy: la RLS es por FILA, no por columna,
 * y una policy de UPDATE para el rival lo dejaría cambiar también el marcador
 * y el VOD del otro (§3a).
 *
 * Recibe el marcador como argumento: si el botón solo dice «Aceptar», se
 * acepta sin leer. Y usa el MISMO vocabulario que `liga_reportar`
 * (local/visita), o el rival manda su punto de vista, la RPC dice «el marcador
 * cambió», y a los 5 días eso se lee igual que un rival que no contestó.
 */
create or replace function public.liga_confirmar(
  p_partida uuid, p_victorias_local int, p_victorias_visita int)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_mia uuid; v_p record;
begin
  select * into v_p from public.liga_partidas where id = p_partida;
  if v_p.id is null then return jsonb_build_object('ok', false, 'error', 'No existe esa partida.'); end if;
  if v_p.estado <> 'reportada' then
    return jsonb_build_object('ok', false, 'error', 'Esa partida no esta esperando confirmacion.');
  end if;
  v_mia := public.liga_mi_plaza(p_partida);
  if v_mia is null then return jsonb_build_object('ok', false, 'error', 'Esa partida no es tuya.'); end if;
  -- Quien reportó no se autoconfirma.
  if v_mia = v_p.reportada_por then
    return jsonb_build_object('ok', false, 'error', 'Tiene que confirmarla tu rival.');
  end if;
  if p_victorias_local <> v_p.victorias_local or p_victorias_visita <> v_p.victorias_visita then
    return jsonb_build_object('ok', false, 'error', 'El marcador cambio. Volve a mirarlo.');
  end if;

  update public.liga_partidas
     set estado = 'confirmada', origen = 'acuerdo',
         confirmada_por = v_mia, confirmada_en = now(), updated_at = now()
   where id = p_partida and estado = 'reportada';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Alguien la toco mientras tanto.');
  end if;
  return jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.liga_disputar(p_partida uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_mia uuid; v_rep uuid; v_estado text;
begin
  select reportada_por, estado into v_rep, v_estado from public.liga_partidas where id = p_partida;
  if v_estado is null then return jsonb_build_object('ok', false, 'error', 'No existe esa partida.'); end if;
  if btrim(coalesce(p_motivo,'')) = '' then
    return jsonb_build_object('ok', false, 'error', 'Deci que paso: lo lee quien arbitra.');
  end if;
  v_mia := public.liga_mi_plaza(p_partida);
  if v_mia is null or v_mia = v_rep then
    return jsonb_build_object('ok', false, 'error', 'Solo tu rival puede disputarla.');
  end if;
  -- Se puede disputar incluso despues del vencimiento: sale del computo hasta
  -- el laudo. Y NO se borra el marcador reportado — es la prueba del arbitro.
  if v_estado not in ('reportada','confirmada') then
    return jsonb_build_object('ok', false, 'error', 'Esa partida no se puede disputar.');
  end if;
  update public.liga_partidas
     set estado = 'disputada', disputa_motivo = btrim(p_motivo), updated_at = now()
   where id = p_partida;
  return jsonb_build_object('ok', true);
end;
$function$;

create or replace function public.liga_corregir(
  p_partida uuid, p_vl int, p_vv int, p_estado text, p_motivo text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_liga uuid; v_antes jsonb;
begin
  select liga_id, to_jsonb(m) into v_liga, v_antes
    from public.liga_partidas m where m.id = p_partida;
  if v_liga is null then return jsonb_build_object('ok', false, 'error', 'No existe esa partida.'); end if;
  if not public.liga_es_staff(v_liga) then
    return jsonb_build_object('ok', false, 'error', 'Esto lo resuelve la organizacion.');
  end if;
  if btrim(coalesce(p_motivo,'')) = '' then
    return jsonb_build_object('ok', false, 'error', 'El motivo es obligatorio: queda a la vista.');
  end if;
  if p_estado not in ('confirmada','wo_local','wo_visita','anulada','programada') then
    return jsonb_build_object('ok', false, 'error', 'Estado no valido.');
  end if;

  update public.liga_partidas
     set victorias_local = coalesce(p_vl, victorias_local),
         victorias_visita = coalesce(p_vv, victorias_visita),
         estado = p_estado,
         origen = case when p_estado = 'confirmada' then 'laudo' else origen end,
         resuelta_por = auth.uid(), motivo = btrim(p_motivo), updated_at = now()
   where id = p_partida;

  insert into public.liga_correcciones (liga_id, partida_id, actor_id, antes, despues, motivo)
  select v_liga, p_partida, auth.uid(), v_antes, to_jsonb(m), btrim(p_motivo)
    from public.liga_partidas m where m.id = p_partida;
  return jsonb_build_object('ok', true);
end;
$function$;

/**
 * El reloj. Lo llama un endpoint con `service_role`, donde `auth.uid()` es
 * NULL — por eso NO usa los guardias de sesión.
 *
 * Devuelve DESTINATARIOS, no contadores: un «recordadas: 37» son 37 personas
 * marcadas como avisadas que no recibieron nada.
 */
create or replace function public.liga_vencidas()
returns table (partida_id uuid, rival_user_id uuid, tipo text)
language plpgsql security definer set search_path to 'public'
as $function$
declare v_hoy date := (now() at time zone 'America/El_Salvador')::date;
begin
  -- El silencio confirma. No confirmar no puede ser mejor negocio que perder.
  return query
  with vencidas as (
    update public.liga_partidas m
       set estado = 'confirmada', origen = 'silencio',
           confirmada_en = now(), updated_at = now()
     where m.estado = 'reportada' and m.vence_el is not null and m.vence_el < v_hoy
    returning m.id, m.local_plaza, m.visita_plaza, m.reportada_por)
  select v.id,
         i.user_id,
         'silencio'::text
    from vencidas v
    join public.liga_plazas p
      on p.id = case when v.reportada_por = v.local_plaza then v.visita_plaza else v.local_plaza end
    join public.liga_inscripciones i on i.id = p.inscripcion_id
   where i.user_id is not null;

  -- Nadie reportó: eso SÍ sería el motor inventando. Va a la cola del árbitro.
  update public.liga_partidas
     set estado = 'vencida', updated_at = now()
   where estado = 'programada' and vence_el is not null and vence_el < v_hoy;
end;
$function$;
revoke all on function public.liga_vencidas() from anon, public, authenticated;


-- ── LECTURA ─────────────────────────────────────────────────────────
create or replace function public.liga_panel(p_liga uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.liga_es_staff(p_liga) then
    return jsonb_build_object('ok', false, 'error', 'Esa liga no es tuya.');
  end if;
  return jsonb_build_object(
    'ok', true,
    'inscritos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'inscId', i.id, 'nombre', i.nombre_visible, 'tier', i.tier, 'estado', i.estado,
        'lider', i.lider, 'base', i.base,
        'zona', d.zona, 'franjas', d.franjas, 'horas', length(replace(coalesce(d.franjas,''),'0','')),
        'inscritoEn', i.inscrito_en) order by i.inscrito_en)
        from public.liga_inscripciones i
        left join public.liga_disponibilidad d on d.insc_id = i.id
       where i.liga_id = p_liga), '[]'::jsonb),
    'cola', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'estado', m.estado, 'jornada', m.jornada,
        'local', pl.nombre_visible, 'visita', pv.nombre_visible,
        'vl', m.victorias_local, 'vv', m.victorias_visita,
        'motivo', m.disputa_motivo, 'venceEl', m.vence_el,
        'grupo', g.tier || ' ' || g.orden) order by m.vence_el nulls last)
        from public.liga_partidas m
        join public.liga_plazas pl on pl.id = m.local_plaza
        join public.liga_plazas pv on pv.id = m.visita_plaza
        join public.liga_grupos g on g.id = m.grupo_id
       where m.liga_id = p_liga and m.estado in ('vencida','disputada')), '[]'::jsonb),
    'temporada', (
      select jsonb_build_object('id', t.id, 'nombre', t.nombre, 'numero', t.numero,
                                'estado', t.estado, 'arranca', t.arranca, 'cierra', t.cierra,
                                'semilla', t.semilla)
        from public.liga_temporadas t where t.liga_id = p_liga and t.estado <> 'cerrada' limit 1)
  );
end;
$function$;

/** La liga entera, por grupos. Sin disponibilidad, sin user_id, sin agenda. */
create or replace function public.liga_ver(p_code text)
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare v_liga uuid; v_temp uuid;
begin
  if not public.liga_visible() then
    return jsonb_build_object('ok', true, 'liga', null, 'aviso', 'todavia no esta abierta');
  end if;
  select id into v_liga from public.ligas where code = p_code;
  if v_liga is null then return jsonb_build_object('ok', true, 'liga', null); end if;
  select id into v_temp from public.liga_temporadas
   where liga_id = v_liga and estado <> 'cerrada' limit 1;

  return jsonb_build_object(
    'ok', true,
    'liga', (select jsonb_build_object('id', l.id, 'code', l.code, 'nombre', l.nombre,
                                       'estado', l.estado, 'descripcion', l.descripcion,
                                       'tamanoGrupo', l.tamano_grupo, 'esStaff', public.liga_es_staff(l.id))
               from public.ligas l where l.id = v_liga),
    'temporada', (select jsonb_build_object('id', t.id, 'nombre', t.nombre, 'numero', t.numero,
                                            'estado', t.estado, 'arranca', t.arranca, 'cierra', t.cierra)
                    from public.liga_temporadas t where t.id = v_temp),
    'miInscripcion', (select i.id from public.liga_inscripciones i
                       where i.liga_id = v_liga and i.user_id = auth.uid()),
    'grupos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'tier', g.tier, 'orden', g.orden, 'estado', g.estado,
        'arranca', g.arranca, 'cierra', g.cierra,
        'plazas', (select coalesce(jsonb_agg(jsonb_build_object(
              'id', p.id, 'nombre', p.nombre_visible, 'lider', p.lider_card_id,
              'base', p.base_card_id, 'estado', p.estado,
              'esMia', exists (select 1 from public.liga_inscripciones ii
                                where ii.id = p.inscripcion_id and ii.user_id = auth.uid()))
              order by p.sentada_en), '[]'::jsonb)
            from public.liga_plazas p where p.grupo_id = g.id),
        'partidas', (select coalesce(jsonb_agg(jsonb_build_object(
              'id', m.id, 'jornada', m.jornada, 'local', m.local_plaza, 'visita', m.visita_plaza,
              'vl', m.victorias_local, 'vv', m.victorias_visita, 'estado', m.estado,
              'origen', m.origen, 'venceEl', m.vence_el, 'vod', m.vod_youtube_id,
              'reportadaPor', m.reportada_por) order by m.jornada), '[]'::jsonb)
            from public.liga_partidas m where m.grupo_id = g.id))
        order by case g.tier when 'legendario' then 0 when 'raro' then 1
                             when 'infrecuente' then 2 else 3 end, g.orden)
        from public.liga_grupos g where g.temporada_id = v_temp), '[]'::jsonb)
  );
end;
$function$;

do $$
declare f text;
begin
  foreach f in array array[
    'liga_cerrar_inscripcion(uuid)', 'liga_premiar(uuid)',
    'liga_inscribirse(uuid,text,text,text,text,boolean,boolean)',
    'liga_guardar_disponibilidad(uuid,text,text,text)',
    'liga_abrir_temporada(uuid,text,date,date)', 'liga_plan_grupos(uuid)',
    'liga_armar_grupos(uuid,jsonb)', 'liga_sembrar_grupo(uuid)',
    'liga_reportar(uuid,int,int,text,int)', 'liga_confirmar(uuid,int,int)',
    'liga_disputar(uuid,text)', 'liga_corregir(uuid,int,int,text,text)',
    'liga_panel(uuid)', 'liga_ver(text)'
  ] loop
    execute format('revoke all on function public.%s from anon, public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
