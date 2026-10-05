-- LIGA PERSONALIZABLE DESDE EL PANEL — pedido de Nel (2026-10-05):
-- «que sea completamente personalizada para el administrador Alejo y yo, que
-- se pueda cambiar desde ahí las fechas y todo».
--
-- Medido antes de escribir: el panel solo dejaba editar nombre, cupo, formato,
-- tamaño de grupo y estado. Las FECHAS de una temporada no se podían tocar
-- después de crearla (la Edición 6 nació sin cierre de inscripción y no había
-- forma de ponérselo), los plazos de cada partida tampoco, el nivel y el estado
-- de un inscrito solo se cambiaban desde el SQL Editor (`pausa`, `retirado` y
-- `vetado` existían en el CHECK sin una sola función que los escribiera), y el
-- emblema, la portada y el banner eran archivos fijos de PUENTE 3 en `public/`.
--
-- Todo pasa por RPC con la misma puerta de siempre: `liga_es_staff()` — creador
-- o fila en `liga_staff`. Alejo es el creador y Nel está en `liga_staff`.

-- ─────────────────────────────────────────────────────────────────────
-- 1 · Lo que la liga puede decidir de sí misma
-- ─────────────────────────────────────────────────────────────────────
alter table public.ligas
  add column if not exists emblema_url text,
  add column if not exists portada_url text,
  add column if not exists banner_url  text,
  add column if not exists reglas      text,
  add column if not exists suben_por_grupo int not null default 1,
  add column if not exists bajan_por_grupo int not null default 1;

-- Cuántos suben y bajan. La suma topa en 4 porque 4 es el grupo más chico
-- posible: con 2 y 2 en un grupo de 4 nadie se queda, y con más se pisarían
-- (el 2.º subiría y bajaría a la vez).
alter table public.ligas drop constraint if exists ligas_movimiento_check;
alter table public.ligas add constraint ligas_movimiento_check
  check (suben_por_grupo between 0 and 3
     and bajan_por_grupo between 0 and 3
     and suben_por_grupo + bajan_por_grupo <= 4);

alter table public.ligas drop constraint if exists ligas_reglas_largo;
alter table public.ligas add constraint ligas_reglas_largo
  check (reglas is null or length(reglas) <= 4000);

-- ─────────────────────────────────────────────────────────────────────
-- 2 · `liga_configurar` — ahora también reglas, movimiento y apariencia
--
-- §3s/§4f: agregar parámetros con default CREA UNA SEGUNDA FUNCIÓN y una PWA
-- sin actualizar caería en la vieja. Se suelta la firma anterior ANTES del
-- create. Barrido de llamadores en SQL: ninguno.
--
-- Convención de los campos nuevos: `null` = no lo toques; '' = vaciar. Es la
-- misma que ya usa el cupo con 0: sin un valor para «vaciar», no habría forma
-- de quitar un banner subido por error.
-- ─────────────────────────────────────────────────────────────────────
drop function if exists public.liga_configurar(uuid, text, text, integer, text, integer, text, boolean);

create or replace function public.liga_configurar(
  p_liga uuid,
  p_nombre text default null,
  p_descripcion text default null,
  p_cupo integer default null,
  p_formato text default null,
  p_tamano_grupo integer default null,
  p_estado text default null,
  p_publica boolean default null,
  p_reglas text default null,
  p_suben integer default null,
  p_bajan integer default null,
  p_emblema_url text default null,
  p_portada_url text default null,
  p_banner_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_grupos int; v_actual public.ligas%rowtype;
  v_suben int; v_bajan int;
  -- Una imagen de liga solo puede venir del bucket de ESTA liga. Sin esto, el
  -- banner podría apuntar a cualquier sitio — un píxel de rastreo o algo que
  -- no tiene que ver una comunidad con menores.
  v_patron text := '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/ligas/'
                   || p_liga::text || '/[A-Za-z0-9._-]+$';
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'Sin sesion.'); end if;
  if not public.liga_es_staff(p_liga) then
    return jsonb_build_object('ok', false, 'error', 'Solo quien organiza la liga puede configurarla.');
  end if;
  select * into v_actual from public.ligas where id = p_liga;
  if v_actual.id is null then return jsonb_build_object('ok', false, 'error', 'Esa liga no existe.'); end if;

  if p_formato is not null and p_formato not in ('premier','twin_suns','draft','sealed','libre') then
    return jsonb_build_object('ok', false, 'error', 'Ese formato no existe.', 'falta', 'formato');
  end if;
  if p_estado is not null and p_estado not in ('borrador','inscripcion','activa','cerrada') then
    return jsonb_build_object('ok', false, 'error', 'Ese estado no existe.', 'falta', 'estado');
  end if;
  if p_nombre is not null and btrim(p_nombre) = '' then
    return jsonb_build_object('ok', false, 'error', 'La liga necesita un nombre.', 'falta', 'nombre');
  end if;
  -- 0 = sin tope. Cualquier otro valor menor a 2 no es un cupo.
  if p_cupo is not null and p_cupo <> 0 and p_cupo < 2 then
    return jsonb_build_object('ok', false, 'error', 'El cupo tiene que ser 2 o mas (o 0 para sin tope).', 'falta', 'cupo');
  end if;

  select count(*) into v_grupos from public.liga_grupos g
    join public.liga_temporadas t on t.id = g.temporada_id
   where t.liga_id = p_liga and t.estado <> 'cerrada';
  if p_tamano_grupo is not null and p_tamano_grupo <> v_actual.tamano_grupo and v_grupos > 0 then
    return jsonb_build_object('ok', false,
      'error', 'Ya hay grupos armados: el tamano de grupo no se puede cambiar en esta temporada.',
      'falta', 'tamano_grupo');
  end if;
  if p_tamano_grupo is not null and (p_tamano_grupo < 4 or p_tamano_grupo > 12) then
    return jsonb_build_object('ok', false, 'error', 'El grupo va de 4 a 12.', 'falta', 'tamano_grupo');
  end if;

  v_suben := coalesce(p_suben, v_actual.suben_por_grupo);
  v_bajan := coalesce(p_bajan, v_actual.bajan_por_grupo);
  if v_suben not between 0 and 3 or v_bajan not between 0 and 3 or v_suben + v_bajan > 4 then
    return jsonb_build_object('ok', false,
      'error', 'Suben y bajan van de 0 a 3 por grupo, y entre los dos no pueden pasar de 4 (el grupo mas chico).',
      'falta', 'movimiento');
  end if;

  if p_reglas is not null and length(btrim(p_reglas)) > 4000 then
    return jsonb_build_object('ok', false, 'error', 'Las reglas van hasta 4000 caracteres.', 'falta', 'reglas');
  end if;

  if (p_emblema_url is not null and p_emblema_url <> '' and p_emblema_url !~ v_patron)
  or (p_portada_url is not null and p_portada_url <> '' and p_portada_url !~ v_patron)
  or (p_banner_url  is not null and p_banner_url  <> '' and p_banner_url  !~ v_patron) then
    return jsonb_build_object('ok', false,
      'error', 'La imagen tiene que estar subida desde el panel de esta liga.', 'falta', 'imagen');
  end if;

  update public.ligas set
    nombre       = coalesce(nullif(btrim(p_nombre), ''), nombre),
    descripcion  = case when p_descripcion is null then descripcion
                        else nullif(btrim(p_descripcion), '') end,
    cupo         = case when p_cupo is null then cupo
                        when p_cupo = 0 then null
                        else p_cupo end,
    formato      = coalesce(p_formato, formato),
    tamano_grupo = coalesce(p_tamano_grupo, tamano_grupo),
    estado       = coalesce(p_estado, estado),
    publica      = coalesce(p_publica, publica),
    reglas       = case when p_reglas is null then reglas else nullif(btrim(p_reglas), '') end,
    suben_por_grupo = v_suben,
    bajan_por_grupo = v_bajan,
    emblema_url  = case when p_emblema_url is null then emblema_url else nullif(p_emblema_url, '') end,
    portada_url  = case when p_portada_url is null then portada_url else nullif(p_portada_url, '') end,
    banner_url   = case when p_banner_url  is null then banner_url  else nullif(p_banner_url,  '') end
  where id = p_liga;

  return jsonb_build_object('ok', true,
    'liga', (select jsonb_build_object('nombre', l.nombre, 'descripcion', l.descripcion,
                                       'cupo', l.cupo, 'formato', l.formato,
                                       'tamanoGrupo', l.tamano_grupo, 'estado', l.estado,
                                       'publica', l.publica, 'reglas', l.reglas,
                                       'subenPorGrupo', l.suben_por_grupo,
                                       'bajanPorGrupo', l.bajan_por_grupo,
                                       'emblemaUrl', l.emblema_url, 'portadaUrl', l.portada_url,
                                       'bannerUrl', l.banner_url)
               from public.ligas l where l.id = p_liga));
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────
-- 3 · Las FECHAS de la temporada
--
-- Los grupos COPIAN las fechas de la temporada al armarse, y los plazos de cada
-- jornada se calculan al sembrar. Cambiar solo la temporada dejaría la tabla
-- diciendo una cosa y el calendario otra. Por eso esta función mueve las tres
-- capas juntas, y el recálculo de plazos usa la MISMA fórmula que
-- `liga_sembrar_grupo`: un calendario reprogramado queda idéntico al que se
-- habría sembrado con estas fechas.
--
-- Solo se mueve lo que todavía se puede jugar: `programada`, `reportada` y
-- `vencida`. Una vencida cuyo plazo nuevo cae hoy o después vuelve a
-- `programada` — alargar la temporada es justamente devolverle la partida a
-- quien no llegó. Lo que ya está confirmado o laudado no se toca.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.liga_editar_temporada(
  p_temporada uuid,
  p_nombre text default null,
  p_inscripcion_cierra date default null,
  p_arranca date default null,
  p_cierra date default null,
  p_sin_cierre_inscripcion boolean default false,
  p_reprogramar boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  t public.liga_temporadas%rowtype;
  v_hoy date := (now() at time zone 'America/El_Salvador')::date;
  v_arranca date; v_cierra date; v_insc date;
  v_grupos int := 0; v_partidas int := 0; v_reabiertas int := 0; v_pasado int := 0; v_n int;
  v_respetadas int := 0;
  g record; v_max int; v_dias int;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'Sin sesion.'); end if;
  select * into t from public.liga_temporadas where id = p_temporada;
  if t.id is null then return jsonb_build_object('ok', false, 'error', 'Esa temporada no existe.'); end if;
  if not public.liga_es_staff(t.liga_id) then
    return jsonb_build_object('ok', false, 'error', 'Solo quien organiza la liga puede cambiar la temporada.');
  end if;
  if t.estado = 'cerrada' then
    return jsonb_build_object('ok', false, 'error', 'Esa temporada ya cerro: sus fechas son historia.');
  end if;
  if p_nombre is not null and btrim(p_nombre) = '' then
    return jsonb_build_object('ok', false, 'error', 'La temporada necesita un nombre.', 'falta', 'nombre');
  end if;

  v_arranca := coalesce(p_arranca, t.arranca);
  v_cierra  := coalesce(p_cierra, t.cierra);
  v_insc    := case when p_sin_cierre_inscripcion then null
                    else coalesce(p_inscripcion_cierra, t.inscripcion_cierra) end;

  if v_arranca is null or v_cierra is null then
    return jsonb_build_object('ok', false, 'error', 'La temporada necesita fecha de arranque y de cierre.', 'falta', 'fechas');
  end if;
  if v_cierra <= v_arranca then
    return jsonb_build_object('ok', false, 'error', 'El cierre tiene que ir despues del arranque.', 'falta', 'cierra');
  end if;
  if v_insc is not null and v_insc > v_arranca then
    return jsonb_build_object('ok', false,
      'error', 'La inscripcion tiene que cerrar antes del arranque, o el mismo dia.', 'falta', 'inscripcion');
  end if;

  update public.liga_temporadas set
    nombre = coalesce(nullif(btrim(p_nombre), ''), nombre),
    arranca = v_arranca, cierra = v_cierra, inscripcion_cierra = v_insc
  where id = p_temporada;

  update public.liga_grupos set arranca = v_arranca, cierra = v_cierra
   where temporada_id = p_temporada and estado <> 'cerrado';
  get diagnostics v_grupos = row_count;

  if p_reprogramar and (v_arranca is distinct from t.arranca or v_cierra is distinct from t.cierra) then
    for g in select gr.id from public.liga_grupos gr
              where gr.temporada_id = p_temporada and gr.sembrado_en is not null and gr.estado <> 'cerrado'
    loop
      select max(jornada) into v_max from public.liga_partidas where grupo_id = g.id;
      if v_max is null or v_max < 1 then continue; end if;
      v_dias := greatest(1, ((v_cierra - v_arranca) / v_max)::int);

      -- Una PRÓRROGA MANUAL es una decisión explícita sobre esa partida: el
      -- recálculo general no la pisa. Medido en la prueba: sin esta guarda, una
      -- partida prorrogada al 30/11 volvía al 16/11 al mover la temporada.
      create temporary table if not exists _prorrogadas (id uuid primary key) on commit drop;
      delete from _prorrogadas;
      insert into _prorrogadas
      select m.id from public.liga_partidas m
       where m.grupo_id = g.id and m.estado in ('programada','reportada','vencida')
         and exists (select 1 from public.liga_correcciones c
                      where c.partida_id = m.id and c.despues ? 'vence_el'
                        and (c.despues->>'vence_el') is distinct from (c.antes->>'vence_el'));
      get diagnostics v_n = row_count;
      v_respetadas := v_respetadas + v_n;

      -- Se cuenta ANTES del update, que es cuando todavía se sabe cuáles eran vencidas.
      select count(*) into v_n from public.liga_partidas m
       where m.grupo_id = g.id and m.estado = 'vencida' and v_arranca + v_dias * m.jornada >= v_hoy
         and m.id not in (select id from _prorrogadas);
      v_reabiertas := v_reabiertas + v_n;
      select count(*) into v_n from public.liga_partidas m
       where m.grupo_id = g.id and m.estado in ('programada','reportada')
         and v_arranca + v_dias * m.jornada < v_hoy
         and m.id not in (select id from _prorrogadas);
      v_pasado := v_pasado + v_n;

      update public.liga_partidas m set
        vence_el = v_arranca + v_dias * m.jornada,
        -- El recordatorio de «última llamada» era para el plazo VIEJO: si queda
        -- sellado, el plazo nuevo vence sin que nadie avise.
        recordatorio_en = null,
        estado = case when m.estado = 'vencida' and v_arranca + v_dias * m.jornada >= v_hoy
                      then 'programada' else m.estado end,
        updated_at = now()
      where m.grupo_id = g.id and m.estado in ('programada','reportada','vencida')
        and m.id not in (select id from _prorrogadas);
      get diagnostics v_n = row_count;
      v_partidas := v_partidas + v_n;
    end loop;
  end if;

  return jsonb_build_object('ok', true,
    'grupos', v_grupos, 'partidas', v_partidas, 'reabiertas', v_reabiertas,
    -- Lo que quedó con el plazo ya vencido: mañana el reloj lo va a sellar.
    -- Se informa para que nadie se entere por la cola del árbitro.
    'enElPasado', v_pasado,
    'respetadas', v_respetadas,
    'temporada', (select jsonb_build_object('id', x.id, 'nombre', x.nombre, 'numero', x.numero,
                                            'estado', x.estado, 'arranca', x.arranca, 'cierra', x.cierra,
                                            'inscripcionCierra', x.inscripcion_cierra)
                    from public.liga_temporadas x where x.id = p_temporada));
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────
-- 4 · El plazo de UNA partida, con huella
--
-- Mover un plazo es una decisión administrativa sobre dos personas, y queda en
-- `liga_correcciones` igual que un laudo: lo contrario es un plazo que cambió
-- sin que nadie pueda decir quién ni por qué.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.liga_prorrogar_partida(
  p_partida uuid, p_vence date, p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  m public.liga_partidas%rowtype;
  v_hoy date := (now() at time zone 'America/El_Salvador')::date;
  v_estado text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'Sin sesion.'); end if;
  select * into m from public.liga_partidas where id = p_partida;
  if m.id is null then return jsonb_build_object('ok', false, 'error', 'Esa partida no existe.'); end if;
  if not public.liga_es_staff(m.liga_id) then
    return jsonb_build_object('ok', false, 'error', 'Solo quien organiza la liga puede mover un plazo.');
  end if;
  if m.estado not in ('programada','reportada','vencida') then
    return jsonb_build_object('ok', false, 'error', 'Esa partida ya esta resuelta: no tiene plazo que mover.');
  end if;
  if p_vence is null or p_vence < v_hoy then
    return jsonb_build_object('ok', false, 'error', 'El plazo nuevo tiene que ser hoy o despues.', 'falta', 'vence');
  end if;

  v_estado := case when m.estado = 'vencida' then 'programada' else m.estado end;
  update public.liga_partidas
     set vence_el = p_vence, recordatorio_en = null, estado = v_estado, updated_at = now()
   where id = p_partida;

  insert into public.liga_correcciones (liga_id, partida_id, actor_id, antes, despues, motivo)
  values (m.liga_id, p_partida, auth.uid(),
          jsonb_build_object('estado', m.estado, 'vence_el', m.vence_el),
          jsonb_build_object('estado', v_estado, 'vence_el', p_vence),
          coalesce(nullif(btrim(p_motivo), ''), 'Prorroga del plazo'));

  return jsonb_build_object('ok', true, 'estado', v_estado, 'venceEl', p_vence);
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────
-- 5 · El nivel y el estado de un inscrito
--
-- El nivel es la otra mitad del problema de arranque: todo el mundo entra en
-- `comun` (default de la columna, y `liga_inscribirse` no lo toca), así que sin
-- esta función la primera temporada tiene UN solo nivel y «legendario» tarda
-- tres temporadas en tener a alguien.
--
-- Retirar o vetar a alguien en plena temporada marca su plaza viva como
-- `abandonada`: es lo que la tabla y el cierre ya saben leer (se filtra al
-- pintar, sus partidas jugadas siguen contando para los demás, y al cierre baja
-- y suma un abandono). Reactivarlo la devuelve a `activa`. `pausa` solo afecta
-- al armado de grupos siguiente: el plan cuenta únicamente a los `activo`.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.liga_editar_inscripcion(
  p_inscripcion uuid, p_tier text default null, p_estado text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare i public.liga_inscripciones%rowtype; v_plazas int := 0;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'Sin sesion.'); end if;
  select * into i from public.liga_inscripciones where id = p_inscripcion;
  if i.id is null then return jsonb_build_object('ok', false, 'error', 'Esa inscripcion no existe.'); end if;
  if not public.liga_es_staff(i.liga_id) then
    return jsonb_build_object('ok', false, 'error', 'Solo quien organiza la liga puede cambiar a un inscrito.');
  end if;
  if p_tier is not null and p_tier not in ('comun','infrecuente','raro','legendario') then
    return jsonb_build_object('ok', false, 'error', 'Ese nivel no existe.', 'falta', 'tier');
  end if;
  if p_estado is not null and p_estado not in ('activo','pausa','retirado','vetado') then
    return jsonb_build_object('ok', false, 'error', 'Ese estado no existe.', 'falta', 'estado');
  end if;

  update public.liga_inscripciones set
    tier = coalesce(p_tier, tier),
    estado = coalesce(p_estado, estado),
    retirado = (coalesce(p_estado, estado) = 'retirado')
  where id = p_inscripcion;

  if p_estado in ('retirado','vetado') then
    update public.liga_plazas p set estado = 'abandonada'
      from public.liga_grupos g join public.liga_temporadas t on t.id = g.temporada_id
     where p.grupo_id = g.id and p.inscripcion_id = p_inscripcion
       and p.estado = 'activa' and t.estado <> 'cerrada';
    get diagnostics v_plazas = row_count;
  elsif p_estado = 'activo' then
    update public.liga_plazas p set estado = 'activa'
      from public.liga_grupos g join public.liga_temporadas t on t.id = g.temporada_id
     where p.grupo_id = g.id and p.inscripcion_id = p_inscripcion
       and p.estado = 'abandonada' and t.estado <> 'cerrada';
    get diagnostics v_plazas = row_count;
  end if;

  return jsonb_build_object('ok', true,
    'tier', (select tier from public.liga_inscripciones where id = p_inscripcion),
    'estado', (select estado from public.liga_inscripciones where id = p_inscripcion),
    'plazasCambiadas', v_plazas);
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────
-- 6 · Mover a alguien de grupo, y deshacer los grupos
--
-- Solo ANTES del calendario: mover una plaza de un grupo ya sembrado rompería
-- el round-robin (alguien quedaría con una jornada de más y otro sin rival).
--
-- Moverla a un grupo de OTRO nivel le cambia también el nivel del carné: si no,
-- al cierre subiría o bajaría desde un nivel distinto al del grupo que jugó.
--
-- `liga_deshacer_grupos` no existía (§5e: «se destraba desde el SQL Editor»).
-- Con calendario ya sembrado solo deshace si NADIE jugó todavía y se lo pide
-- explícitamente: borrar resultados reales no es «deshacer».
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.liga_mover_plaza(p_plaza uuid, p_grupo uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  p public.liga_plazas%rowtype;
  g_orig public.liga_grupos%rowtype; g_dest public.liga_grupos%rowtype;
  n_orig int; n_dest int;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'Sin sesion.'); end if;
  select * into p from public.liga_plazas where id = p_plaza;
  if p.id is null then return jsonb_build_object('ok', false, 'error', 'Esa plaza no existe.'); end if;
  select * into g_orig from public.liga_grupos where id = p.grupo_id;
  select * into g_dest from public.liga_grupos where id = p_grupo;
  if g_dest.id is null then return jsonb_build_object('ok', false, 'error', 'Ese grupo no existe.'); end if;
  if not public.liga_es_staff(g_orig.liga_id) then
    return jsonb_build_object('ok', false, 'error', 'Solo quien organiza la liga puede mover a alguien.');
  end if;
  if g_dest.temporada_id <> g_orig.temporada_id then
    return jsonb_build_object('ok', false, 'error', 'Los dos grupos tienen que ser de la misma temporada.');
  end if;
  if g_orig.id = g_dest.id then
    return jsonb_build_object('ok', false, 'error', 'Ya esta en ese grupo.');
  end if;
  if g_orig.sembrado_en is not null or g_dest.sembrado_en is not null then
    return jsonb_build_object('ok', false,
      'error', 'Uno de los dos grupos ya tiene calendario: mover a alguien romperia el round-robin. Deshace los grupos primero.');
  end if;

  select count(*) into n_orig from public.liga_plazas where grupo_id = g_orig.id;
  select count(*) into n_dest from public.liga_plazas where grupo_id = g_dest.id;
  if n_orig - 1 < 4 then
    return jsonb_build_object('ok', false,
      'error', format('El grupo de origen quedaria con %s y el minimo son 4.', n_orig - 1));
  end if;
  if n_dest + 1 > 12 then
    return jsonb_build_object('ok', false, 'error', 'El grupo de destino ya tiene 12, que es el maximo.');
  end if;

  update public.liga_plazas set grupo_id = g_dest.id where id = p_plaza;
  update public.liga_grupos set tamano = n_orig - 1 where id = g_orig.id;
  update public.liga_grupos set tamano = n_dest + 1 where id = g_dest.id;
  if g_dest.tier <> g_orig.tier then
    update public.liga_inscripciones set tier = g_dest.tier where id = p.inscripcion_id;
  end if;

  return jsonb_build_object('ok', true, 'de', n_orig - 1, 'a', n_dest + 1);
end;
$function$;

create or replace function public.liga_deshacer_grupos(
  p_temporada uuid, p_borrar_calendario boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare t public.liga_temporadas%rowtype; v_jugadas int; v_sembrados int; v_grupos int;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'Sin sesion.'); end if;
  select * into t from public.liga_temporadas where id = p_temporada;
  if t.id is null then return jsonb_build_object('ok', false, 'error', 'Esa temporada no existe.'); end if;
  if not public.liga_es_staff(t.liga_id) then
    return jsonb_build_object('ok', false, 'error', 'Solo quien organiza la liga puede deshacer los grupos.');
  end if;
  if t.estado = 'cerrada' then
    return jsonb_build_object('ok', false, 'error', 'Esa temporada ya cerro.');
  end if;

  select count(*) into v_sembrados from public.liga_grupos
   where temporada_id = p_temporada and sembrado_en is not null;
  select count(*) into v_jugadas from public.liga_partidas m
    join public.liga_grupos g on g.id = m.grupo_id
   where g.temporada_id = p_temporada and m.estado <> 'programada';

  if v_jugadas > 0 then
    return jsonb_build_object('ok', false,
      'error', format('Ya hay %s partidas con resultado o en tramite: deshacer los grupos las borraria.', v_jugadas));
  end if;
  if v_sembrados > 0 and not p_borrar_calendario then
    return jsonb_build_object('ok', false, 'falta', 'confirmar',
      'error', 'Hay grupos con calendario. Nadie jugo todavia, asi que se puede deshacer, pero hay que confirmarlo.');
  end if;

  delete from public.liga_partidas
   where grupo_id in (select id from public.liga_grupos where temporada_id = p_temporada);
  delete from public.liga_plazas
   where grupo_id in (select id from public.liga_grupos where temporada_id = p_temporada);
  delete from public.liga_grupos where temporada_id = p_temporada;
  get diagnostics v_grupos = row_count;

  return jsonb_build_object('ok', true, 'grupos', v_grupos);
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────
-- 7 · Editar un aviso (antes solo se podía publicar o borrar)
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.liga_editar_anuncio(p_id uuid, p_titulo text, p_cuerpo text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_liga uuid;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'Sin sesion.'); end if;
  select liga_id into v_liga from public.liga_anuncios where id = p_id;
  if v_liga is null then return jsonb_build_object('ok', false, 'error', 'Ese aviso no existe.'); end if;
  if not public.liga_es_staff(v_liga) then
    return jsonb_build_object('ok', false, 'error', 'Solo quien organiza la liga puede editar avisos.');
  end if;
  if btrim(coalesce(p_titulo,'')) = '' then
    return jsonb_build_object('ok', false, 'error', 'El aviso necesita un titulo.', 'falta', 'titulo');
  end if;
  if btrim(coalesce(p_cuerpo,'')) = '' then
    return jsonb_build_object('ok', false, 'error', 'El aviso necesita un texto.', 'falta', 'cuerpo');
  end if;
  update public.liga_anuncios set titulo = left(btrim(p_titulo), 120), cuerpo = left(btrim(p_cuerpo), 2000)
   where id = p_id;
  return jsonb_build_object('ok', true);
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────
-- 8 · El cierre lee cuántos suben y bajan de la liga
--
-- Era fijo: sube el 1.º, baja el último. Mismo cuerpo que antes salvo el
-- `paso`, y la misma firma: no hay sobrecarga que soltar.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.liga_cerrar_temporada(
  p_temporada uuid, p_resultado jsonb, p_ensayo boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_liga uuid; v_estado text;
  v_esperadas int; v_recibidas int; v_malos int;
  v_sube int; v_baja int; v_sin_jugar int; v_detalle jsonb;
  v_suben int; v_bajan int;
  ESCALERA text[] := array['comun','infrecuente','raro','legendario'];
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'Sin sesion.'); end if;

  select t.liga_id, t.estado, l.suben_por_grupo, l.bajan_por_grupo
    into v_liga, v_estado, v_suben, v_bajan
    from public.liga_temporadas t join public.ligas l on l.id = t.liga_id
   where t.id = p_temporada;
  if v_liga is null then
    return jsonb_build_object('ok', false, 'error', 'Esa temporada no existe.');
  end if;
  if not public.liga_es_staff(v_liga) then
    return jsonb_build_object('ok', false, 'error', 'Solo quien organiza la liga puede cerrarla.');
  end if;
  if v_estado = 'cerrada' then
    return jsonb_build_object('ok', false, 'error', 'Esa temporada ya esta cerrada.');
  end if;

  drop table if exists _cierre;
  create temporary table _cierre on commit drop as
  select (x->>'plazaId')::uuid as plaza_id, (x->>'puesto')::int as puesto
    from jsonb_array_elements(coalesce(p_resultado, '[]'::jsonb)) x;

  select count(*) into v_esperadas
    from public.liga_plazas p join public.liga_grupos g on g.id = p.grupo_id
   where g.temporada_id = p_temporada;
  select count(*) into v_recibidas from _cierre;

  if v_esperadas > 0 and v_recibidas <> v_esperadas then
    return jsonb_build_object('ok', false,
      'error', format('La clasificacion no cuadra: %s plazas en la temporada y %s en el resultado.',
                      v_esperadas, v_recibidas));
  end if;

  select count(*) into v_malos from (
    select c.plaza_id from _cierre c group by c.plaza_id having count(*) > 1
    union all
    select c.plaza_id from _cierre c
     where not exists (select 1 from public.liga_plazas p
                        join public.liga_grupos g on g.id = p.grupo_id
                       where p.id = c.plaza_id and g.temporada_id = p_temporada)
  ) t;
  if v_malos > 0 then
    return jsonb_build_object('ok', false,
      'error', 'El resultado tiene plazas repetidas o que no son de esta temporada.');
  end if;

  drop table if exists _mov;
  create temporary table _mov on commit drop as
  select p.inscripcion_id, p.nombre_visible as nombre, c.puesto,
         case when p.estado <> 'activa' then -1
              when c.puesto <= v_suben then 1
              when c.puesto > count(*) over (partition by p.grupo_id) - v_bajan then -1
              else 0 end as paso,
         (p.estado <> 'activa')::int as abandono,
         i.tier as tier_antes,
         coalesce(array_position(ESCALERA, i.tier), 1) as pos
    from _cierre c
    join public.liga_plazas p on p.id = c.plaza_id
    join public.liga_inscripciones i on i.id = p.inscripcion_id;

  select count(*) filter (where paso > 0 and pos < array_length(ESCALERA,1)),
         count(*) filter (where paso < 0 and pos > 1)
    into v_sube, v_baja from _mov;

  select coalesce(jsonb_agg(jsonb_build_object(
           'nombre', nombre, 'puesto', puesto, 'de', tier_antes,
           'a', ESCALERA[greatest(1, least(array_length(ESCALERA,1), pos + paso))],
           'abandono', abandono = 1) order by paso desc, puesto), '[]'::jsonb)
    into v_detalle
    from _mov
   where ESCALERA[greatest(1, least(array_length(ESCALERA,1), pos + paso))] <> tier_antes;

  if p_ensayo then
    select count(*) into v_sin_jugar from public.liga_partidas m
     where m.estado = 'programada'
       and m.grupo_id in (select id from public.liga_grupos where temporada_id = p_temporada);
    return jsonb_build_object('ok', true, 'ensayo', true,
      'plazas', v_recibidas, 'suben', coalesce(v_sube,0), 'bajan', coalesce(v_baja,0),
      'sin_jugar', v_sin_jugar, 'detalle', v_detalle);
  end if;

  update public.liga_inscripciones i set
    temporadas_jugadas = i.temporadas_jugadas + 1,
    abandonos = i.abandonos + m.abandono,
    tier = ESCALERA[ greatest(1, least(array_length(ESCALERA,1), m.pos + m.paso)) ]
  from _mov m where i.id = m.inscripcion_id;

  update public.liga_partidas m set estado = 'sin_jugar'
   where m.estado = 'programada'
     and m.grupo_id in (select id from public.liga_grupos where temporada_id = p_temporada);
  get diagnostics v_sin_jugar = row_count;

  update public.liga_grupos set estado = 'cerrado' where temporada_id = p_temporada;
  update public.liga_temporadas set estado = 'cerrada', cerrada_en = now()
   where id = p_temporada;

  return jsonb_build_object('ok', true, 'ensayo', false,
    'plazas', v_recibidas, 'suben', coalesce(v_sube,0), 'bajan', coalesce(v_baja,0),
    'sin_jugar', v_sin_jugar, 'detalle', v_detalle);
end;
$function$;

-- Grants (§4e): revocar de anon y PUBLIC y DESPUÉS conceder. Todas empiezan
-- por `auth.uid()` y la puerta de staff.
revoke all on function public.liga_configurar(uuid, text, text, integer, text, integer, text, boolean, text, integer, integer, text, text, text) from anon, public;
revoke all on function public.liga_editar_temporada(uuid, text, date, date, date, boolean, boolean) from anon, public;
revoke all on function public.liga_prorrogar_partida(uuid, date, text) from anon, public;
revoke all on function public.liga_editar_inscripcion(uuid, text, text) from anon, public;
revoke all on function public.liga_mover_plaza(uuid, uuid) from anon, public;
revoke all on function public.liga_deshacer_grupos(uuid, boolean) from anon, public;
revoke all on function public.liga_editar_anuncio(uuid, text, text) from anon, public;
grant execute on function public.liga_configurar(uuid, text, text, integer, text, integer, text, boolean, text, integer, integer, text, text, text) to authenticated;
grant execute on function public.liga_editar_temporada(uuid, text, date, date, date, boolean, boolean) to authenticated;
grant execute on function public.liga_prorrogar_partida(uuid, date, text) to authenticated;
grant execute on function public.liga_editar_inscripcion(uuid, text, text) to authenticated;
grant execute on function public.liga_mover_plaza(uuid, uuid) to authenticated;
grant execute on function public.liga_deshacer_grupos(uuid, boolean) to authenticated;
grant execute on function public.liga_editar_anuncio(uuid, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 9 · El lobby y el botón de Inicio leen lo personalizado
--
-- Mismo cuerpo y misma firma; solo se agregan campos al objeto de la liga.
-- Las imágenes viajan como URL de Storage —no como data URI— porque `liga_ver`
-- se pide en cada visita al lobby y `liga_para_inicio` en cada apertura de
-- Inicio: un data URI dentro de un JSON no lo cachea el navegador (§4m).
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.liga_ver(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare v_liga uuid; v_temp uuid;
begin
  select id into v_liga from public.ligas where code = p_code;
  if v_liga is null then return jsonb_build_object('ok', true, 'liga', null); end if;
  if not public.liga_visible(v_liga) then
    return jsonb_build_object('ok', true, 'liga', null, 'aviso', 'todavia no esta abierta');
  end if;
  select id into v_temp from public.liga_temporadas
   where liga_id = v_liga and estado <> 'cerrada' limit 1;

  return jsonb_build_object(
    'ok', true,
    'liga', (select jsonb_build_object('id', l.id, 'code', l.code, 'nombre', l.nombre,
                                       'estado', l.estado, 'descripcion', l.descripcion,
                                       'tamanoGrupo', l.tamano_grupo,
                                       'formato', l.formato, 'cupo', l.cupo,
                                       'publica', l.publica,
                                       'reglas', l.reglas,
                                       'subenPorGrupo', l.suben_por_grupo,
                                       'bajanPorGrupo', l.bajan_por_grupo,
                                       'emblemaUrl', l.emblema_url,
                                       'portadaUrl', l.portada_url,
                                       'bannerUrl', l.banner_url,
                                       'esStaff', public.liga_es_staff(l.id))
               from public.ligas l where l.id = v_liga),
    'temporada', (select jsonb_build_object('id', t.id, 'nombre', t.nombre, 'numero', t.numero,
                                            'estado', t.estado, 'arranca', t.arranca, 'cierra', t.cierra,
                                            'inscripcionCierra', t.inscripcion_cierra)
                    from public.liga_temporadas t where t.id = v_temp),
    'miInscripcion', (select i.id from public.liga_inscripciones i
                       where i.liga_id = v_liga and i.user_id = auth.uid()),
    'cifras', (select jsonb_build_object(
                 'inscritos', count(*) filter (where i.estado = 'activo'),
                 'paises', count(distinct i.pais) filter (where i.estado = 'activo' and i.pais is not null))
                 from public.liga_inscripciones i where i.liga_id = v_liga),
    'padron', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id, 'nombre', a.nombre_visible, 'pais', a.pais,
               'lider', a.lider, 'base', a.base) order by a.inscrito_en)
        from (select id, nombre_visible, pais, lider, base, inscrito_en
                from public.liga_inscripciones
               where liga_id = v_liga and estado = 'activo'
               order by inscrito_en limit 200) a), '[]'::jsonb),
    'anuncios', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'titulo', a.titulo,
                                          'cuerpo', a.cuerpo, 'creadoEn', a.creado_en)
             order by a.creado_en desc)
        from (select * from public.liga_anuncios where liga_id = v_liga
               order by creado_en desc limit 8) a), '[]'::jsonb),
    'grupos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'tier', g.tier, 'orden', g.orden, 'estado', g.estado,
        'arranca', g.arranca, 'cierra', g.cierra,
        'sembrado', g.sembrado_en is not null,
        'plazas', (select coalesce(jsonb_agg(jsonb_build_object(
              'id', p.id, 'grupoId', p.grupo_id, 'nombre', p.nombre_visible,
              'lider', p.lider_card_id, 'base', p.base_card_id, 'estado', p.estado,
              'pais', p.pais,
              'esMia', exists (select 1 from public.liga_inscripciones ii
                                where ii.id = p.inscripcion_id and ii.user_id = auth.uid()))
              order by p.sentada_en), '[]'::jsonb)
            from public.liga_plazas p where p.grupo_id = g.id),
        'partidas', (select coalesce(jsonb_agg(jsonb_build_object(
              'id', m.id, 'grupoId', m.grupo_id, 'jornada', m.jornada,
              'localPlaza', m.local_plaza, 'visitaPlaza', m.visita_plaza,
              'vl', m.victorias_local, 'vv', m.victorias_visita,
              'estado', m.estado, 'origen', m.origen, 'venceEl', m.vence_el,
              'vod', m.vod_youtube_id, 'reportadaPor', m.reportada_por)
              order by m.jornada), '[]'::jsonb)
            from public.liga_partidas m where m.grupo_id = g.id))
        order by case g.tier when 'legendario' then 0 when 'raro' then 1
                             when 'infrecuente' then 2 else 3 end, g.orden)
        from public.liga_grupos g where g.temporada_id = v_temp), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.liga_para_inicio()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(
    (select jsonb_build_object(
       'code', l.code,
       'nombre', l.nombre,
       'estado', l.estado,
       'emblemaUrl', l.emblema_url,
       'esStaff', public.liga_es_staff(l.id),
       'inscrito', exists (select 1 from public.liga_inscripciones i
                            where i.liga_id = l.id and i.user_id = auth.uid()),
       'temporada', (select jsonb_build_object('estado', t.estado,
                                               'inscripcionCierra', t.inscripcion_cierra,
                                               'arranca', t.arranca)
                       from public.liga_temporadas t
                      where t.liga_id = l.id and t.estado <> 'cerrada' limit 1))
       from public.ligas l
      where l.estado in ('borrador','inscripcion','activa')
        and (
          public.liga_es_staff(l.id)
          or exists (select 1 from public.liga_inscripciones i
                      where i.liga_id = l.id and i.user_id = auth.uid())
          or l.publica
          or exists (select 1 from public.liga_probadores p where p.user_id = auth.uid())
        )
      order by (public.liga_es_staff(l.id)) desc,
               (exists (select 1 from public.liga_inscripciones i
                         where i.liga_id = l.id and i.user_id = auth.uid())) desc,
               l.creado_en
      limit 1),
    jsonb_build_object('code', null));
$function$;
