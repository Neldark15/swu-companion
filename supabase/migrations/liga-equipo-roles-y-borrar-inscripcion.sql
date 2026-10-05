-- LIGA — EL EQUIPO: organizadores y árbitros, y borrar una inscripción.
-- Pedido de Nel (2026-10-05): «trabaja eso de agregar organizadores o árbitros,
-- si él necesita puede agregarlos» y «permitile también borrar una inscripción
-- del todo».
--
-- ── ANTES DE DEJAR AGREGAR A NADIE HABÍA QUE SEPARAR LAS PUERTAS ─────
--
-- Medido: las 20 funciones de la liga preguntaban lo mismo, `liga_es_staff()` =
-- creador O CUALQUIER fila en `liga_staff`, sin mirar el rol. La columna `rol`
-- ('organizador' | 'arbitro') existía y no la leía nadie. O sea que un árbitro
-- de UN grupo podía cambiar las fechas de la temporada, deshacer todos los
-- grupos, cambiar el emblema o vetar gente. Dar a Alejo un botón para sumar
-- árbitros sin esto era regalarle a cada árbitro la liga entera.
--
-- Ahora hay dos puertas:
--   · `liga_es_organizador()` — creador u organizador. Configura, arma, cierra.
--   · `liga_puede_arbitrar(liga, grupo)` — organizador, o árbitro de toda la
--     liga, o árbitro de ESE grupo. Resuelve partidas y mueve plazos.
-- `liga_es_staff()` queda para lo que de verdad es «ser del equipo»: ver el
-- panel y la cola. `liga_corregir` ya acotaba por grupo con su propia lógica.

-- Un organizador lo es de toda la liga: acotarlo a un grupo no significa nada.
alter table public.liga_staff drop constraint if exists liga_staff_grupo_solo_arbitro;
alter table public.liga_staff add constraint liga_staff_grupo_solo_arbitro
  check (rol = 'arbitro' or grupo_id is null);

-- Si se deshacen los grupos, el árbitro de un grupo SE VA del equipo en vez de
-- quedar con `grupo_id` en null — que con estas puertas significa «árbitro de
-- toda la liga». Con SET NULL, deshacer los grupos le AGRANDABA el poder a
-- alguien sin que nadie lo decidiera. Ante la duda, menos permiso.
alter table public.liga_staff drop constraint if exists liga_staff_grupo_id_fkey;
alter table public.liga_staff add constraint liga_staff_grupo_id_fkey
  foreign key (grupo_id) references public.liga_grupos(id) on delete cascade;

create or replace function public.liga_es_organizador(p_liga uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (select 1 from public.ligas l where l.id = p_liga and l.creador_id = auth.uid())
      or exists (select 1 from public.liga_staff s
                  where s.liga_id = p_liga and s.user_id = auth.uid() and s.rol = 'organizador')
$function$;

create or replace function public.liga_puede_arbitrar(p_liga uuid, p_grupo uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.liga_es_organizador(p_liga)
      or exists (select 1 from public.liga_staff s
                  where s.liga_id = p_liga and s.user_id = auth.uid() and s.rol = 'arbitro'
                    and (s.grupo_id is null or s.grupo_id = p_grupo))
$function$;

revoke all on function public.liga_es_organizador(uuid) from anon, public;
revoke all on function public.liga_puede_arbitrar(uuid, uuid) from anon, public;
grant execute on function public.liga_es_organizador(uuid) to authenticated;
grant execute on function public.liga_puede_arbitrar(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- Las 15 funciones de ORGANIZAR pasan a la puerta de organizador.
--
-- Se reescriben desde su PROPIA definición (`pg_get_functiondef`) cambiando
-- solo la llamada a la puerta, igual que se hizo con `liga_panel` (§4x): copiar
-- quince cuerpos a mano para cambiar una palabra es invitar una diferencia
-- silenciosa. Y se planta si alguna no tenía la llamada: eso significaría que
-- la lista está mal, no que haya que seguir.
-- ─────────────────────────────────────────────────────────────────────
do $$
declare
  f record; def text; nuevo text; hechas int := 0;
  nombres text[] := array[
    'liga_abrir_temporada','liga_anunciar','liga_armar_grupos','liga_borrar_anuncio',
    'liga_cerrar_inscripcion','liga_cerrar_temporada','liga_configurar','liga_deshacer_grupos',
    'liga_editar_anuncio','liga_editar_inscripcion','liga_editar_temporada','liga_mover_plaza',
    'liga_plan_grupos','liga_sembrar_grupo','liga_staff_de_carpeta'];
begin
  for f in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = any(nombres)
  loop
    def := pg_get_functiondef(f.oid);
    nuevo := replace(def, 'liga_es_staff(', 'liga_es_organizador(');
    if nuevo = def then
      raise exception 'La funcion % no llamaba a liga_es_staff: la lista esta mal, no se sigue', f.proname;
    end if;
    execute nuevo;
    hechas := hechas + 1;
  end loop;
  if hechas <> array_length(nombres, 1) then
    raise exception 'Se esperaban % funciones y se reescribieron %', array_length(nombres, 1), hechas;
  end if;
end $$;

-- Mover un plazo es cosa de árbitro: puede hacerlo quien arbitra ESE grupo.
do $$
declare def text; nuevo text;
begin
  select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'liga_prorrogar_partida';
  nuevo := replace(def, 'public.liga_es_staff(m.liga_id)', 'public.liga_puede_arbitrar(m.liga_id, m.grupo_id)');
  if nuevo = def then raise exception 'liga_prorrogar_partida no tenia la puerta esperada'; end if;
  execute nuevo;
end $$;

-- El lobby le dice al panel si quien mira ORGANIZA o solo arbitra, para que no
-- le ofrezca botones que el servidor le va a rechazar.
do $$
declare def text; nuevo text;
begin
  select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'liga_ver';
  nuevo := replace(def, $q$'esStaff', public.liga_es_staff(l.id))$q$,
                        $q$'esStaff', public.liga_es_staff(l.id), 'esOrganizador', public.liga_es_organizador(l.id))$q$);
  if nuevo = def then raise exception 'liga_ver no tenia el campo esStaff esperado'; end if;
  execute nuevo;
end $$;

-- «Abrir la inscripción» desde la casa del creador pedía ser EL creador: un
-- organizador —Nel— no podía, aunque desde el panel sí. Una sola regla.
create or replace function public.liga_abrir_inscripcion(p_liga uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.liga_es_organizador(p_liga) then
    return jsonb_build_object('ok', false, 'error', 'Esa liga no es tuya.');
  end if;
  update public.ligas set estado = 'inscripcion', publica = true
   where id = p_liga and estado = 'borrador';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Esa liga no esta en borrador.');
  end if;
  return jsonb_build_object('ok', true);
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────
-- EL EQUIPO
-- ─────────────────────────────────────────────────────────────────────

-- Quién está. Lo ve todo el equipo (un árbitro tiene que saber a quién
-- escribirle); gestionarlo, solo quien organiza.
create or replace function public.liga_staff_listar(p_liga uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not public.liga_es_staff(p_liga) then
    return jsonb_build_object('ok', false, 'error', 'Solo el equipo de la liga ve esto.');
  end if;
  return jsonb_build_object('ok', true,
    'puedoGestionar', public.liga_es_organizador(p_liga),
    'yo', auth.uid(),
    'creador', (select jsonb_build_object('userId', l.creador_id, 'nombre', p.name, 'avatar', p.avatar)
                  from public.ligas l left join public.profiles p on p.id = l.creador_id
                 where l.id = p_liga),
    'equipo', coalesce((
      select jsonb_agg(jsonb_build_object(
               'userId', s.user_id, 'nombre', p.name, 'avatar', p.avatar, 'rol', s.rol,
               'grupoId', s.grupo_id,
               'grupo', case when g.id is null then null
                             else initcap(replace(g.tier, 'comun', 'común')) || ' ' || g.orden end)
             order by (s.rol = 'organizador') desc, p.name)
        from public.liga_staff s
        left join public.profiles p on p.id = s.user_id
        left join public.liga_grupos g on g.id = s.grupo_id
       where s.liga_id = p_liga), '[]'::jsonb));
end;
$function$;

-- Buscar a quién sumar, por nombre. Solo quien organiza, y el texto se busca
-- con `position()` y no con ILIKE: un `%` o un `_` tecleado no tiene que
-- convertirse en comodín y devolver media comunidad.
create or replace function public.liga_buscar_persona(p_liga uuid, p_texto text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare v_t text := lower(btrim(coalesce(p_texto, '')));
begin
  if not public.liga_es_organizador(p_liga) then
    return jsonb_build_object('ok', false, 'error', 'Solo quien organiza la liga puede sumar gente al equipo.');
  end if;
  if length(v_t) < 2 then
    return jsonb_build_object('ok', true, 'personas', '[]'::jsonb);
  end if;
  return jsonb_build_object('ok', true, 'personas', coalesce((
    select jsonb_agg(x order by x.exacto desc, x.nombre) from (
      select p.id as "userId", p.name as nombre, p.avatar,
             (lower(p.name) = v_t) as exacto,
             exists (select 1 from public.ligas l where l.id = p_liga and l.creador_id = p.id) as "esCreador",
             (select s.rol from public.liga_staff s where s.liga_id = p_liga and s.user_id = p.id) as rol
        from public.profiles p
       where p.name is not null and position(v_t in lower(p.name)) > 0
       order by (lower(p.name) = v_t) desc, p.name
       limit 10) x), '[]'::jsonb));
end;
$function$;

create or replace function public.liga_staff_agregar(
  p_liga uuid, p_user uuid, p_rol text, p_grupo uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_existia boolean;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'Sin sesion.'); end if;
  if not public.liga_es_organizador(p_liga) then
    return jsonb_build_object('ok', false, 'error', 'Solo quien organiza la liga puede sumar gente al equipo.');
  end if;
  if p_rol not in ('organizador','arbitro') then
    return jsonb_build_object('ok', false, 'error', 'El rol es organizador o arbitro.', 'falta', 'rol');
  end if;
  if p_rol = 'organizador' and p_grupo is not null then
    return jsonb_build_object('ok', false, 'error', 'Un organizador lo es de toda la liga: no se acota a un grupo.', 'falta', 'grupo');
  end if;
  if p_grupo is not null and not exists (select 1 from public.liga_grupos where id = p_grupo and liga_id = p_liga) then
    return jsonb_build_object('ok', false, 'error', 'Ese grupo no es de esta liga.', 'falta', 'grupo');
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    return jsonb_build_object('ok', false, 'error', 'Esa persona no tiene cuenta en la app.');
  end if;
  if exists (select 1 from public.ligas where id = p_liga and creador_id = p_user) then
    return jsonb_build_object('ok', false, 'error', 'Es quien creo la liga: ya puede todo.');
  end if;

  select exists (select 1 from public.liga_staff where liga_id = p_liga and user_id = p_user) into v_existia;
  insert into public.liga_staff (liga_id, user_id, rol, grupo_id)
  values (p_liga, p_user, p_rol, p_grupo)
  on conflict (liga_id, user_id) do update set rol = excluded.rol, grupo_id = excluded.grupo_id;

  return jsonb_build_object('ok', true, 'accion', case when v_existia then 'actualizado' else 'agregado' end);
end;
$function$;

create or replace function public.liga_staff_quitar(p_liga uuid, p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'Sin sesion.'); end if;
  if not public.liga_es_organizador(p_liga) then
    return jsonb_build_object('ok', false, 'error', 'Solo quien organiza la liga puede quitar gente del equipo.');
  end if;
  if exists (select 1 from public.ligas where id = p_liga and creador_id = p_user) then
    return jsonb_build_object('ok', false, 'error', 'No se puede quitar a quien creo la liga.');
  end if;
  delete from public.liga_staff where liga_id = p_liga and user_id = p_user;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Esa persona no esta en el equipo.');
  end if;
  return jsonb_build_object('ok', true);
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────
-- BORRAR UNA INSCRIPCIÓN DEL TODO
--
-- Distinto de vetar: un vetado sigue existiendo y por eso NO puede volver a
-- inscribirse (la inscripción es única por persona). Borrar la deja
-- inscribirse de nuevo. Sirve para la inscripción de prueba, el duplicado, el
-- que se anotó por error.
--
-- Solo si nadie más pierde nada. Si esa persona tiene plaza en un grupo con
-- calendario o en una temporada cerrada, sus partidas son también las de sus
-- rivales: `liga_partidas` cae en cascada con la plaza y les borraría
-- resultados jugados a otros. Ahí la respuesta es retirarla o vetarla.
-- En un grupo SIN calendario sí se puede, si el grupo no queda por debajo de 4.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.liga_borrar_inscripcion(p_inscripcion uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
-- La variable NO se llama `g`: en PL/pgSQL chocaba con el alias `g` de la
-- consulta de abajo y la función reventaba al primer uso («record "g" is not
-- assigned yet»). Lo cazó la prueba en transacción revertida.
declare i public.liga_inscripciones%rowtype; v_atada int; v_grupo record; v_n int;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'Sin sesion.'); end if;
  select * into i from public.liga_inscripciones where id = p_inscripcion;
  if i.id is null then return jsonb_build_object('ok', false, 'error', 'Esa inscripcion no existe.'); end if;
  if not public.liga_es_organizador(i.liga_id) then
    return jsonb_build_object('ok', false, 'error', 'Solo quien organiza la liga puede borrar una inscripcion.');
  end if;

  select count(*) into v_atada
    from public.liga_plazas p join public.liga_grupos g on g.id = p.grupo_id
   where p.inscripcion_id = i.id and (g.sembrado_en is not null or g.estado = 'cerrado');
  if v_atada > 0 then
    return jsonb_build_object('ok', false, 'falta', 'jugo',
      'error', 'Ya tiene grupo con calendario o temporadas jugadas: borrarla les borraria partidas a sus rivales. Retirala o vetala.');
  end if;

  for v_grupo in select gr.id, gr.tier, gr.orden from public.liga_plazas p
             join public.liga_grupos gr on gr.id = p.grupo_id
            where p.inscripcion_id = i.id
  loop
    select count(*) into v_n from public.liga_plazas where grupo_id = v_grupo.id;
    if v_n - 1 < 4 then
      return jsonb_build_object('ok', false, 'falta', 'grupo',
        'error', format('Su grupo (%s %s) quedaria con %s y el minimo son 4: movela a otro grupo o deshace los grupos primero.',
                        v_grupo.tier, v_grupo.orden, v_n - 1));
    end if;
  end loop;

  update public.liga_grupos gr set tamano = gr.tamano - 1
   where gr.id in (select grupo_id from public.liga_plazas where inscripcion_id = i.id);
  delete from public.liga_plazas where inscripcion_id = i.id;
  delete from public.liga_inscripciones where id = i.id;

  return jsonb_build_object('ok', true, 'nombre', i.nombre_visible);
end;
$function$;

revoke all on function public.liga_staff_listar(uuid) from anon, public;
revoke all on function public.liga_buscar_persona(uuid, text) from anon, public;
revoke all on function public.liga_staff_agregar(uuid, uuid, text, uuid) from anon, public;
revoke all on function public.liga_staff_quitar(uuid, uuid) from anon, public;
revoke all on function public.liga_borrar_inscripcion(uuid) from anon, public;
grant execute on function public.liga_staff_listar(uuid) to authenticated;
grant execute on function public.liga_buscar_persona(uuid, text) to authenticated;
grant execute on function public.liga_staff_agregar(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.liga_staff_quitar(uuid, uuid) to authenticated;
grant execute on function public.liga_borrar_inscripcion(uuid) to authenticated;

-- El mensaje para un árbitro de OTRO grupo decía «solo quien organiza»: también
-- puede quien arbitra ese grupo, y el mensaje tiene que decir la regla real.
do $$
declare def text; nuevo text;
begin
  select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'liga_prorrogar_partida';
  nuevo := replace(def, 'Solo quien organiza la liga puede mover un plazo.',
                        'Solo quien organiza la liga o arbitra ese grupo puede mover el plazo.');
  if nuevo = def then raise exception 'liga_prorrogar_partida no tenia el mensaje esperado'; end if;
  execute nuevo;
end $$;
