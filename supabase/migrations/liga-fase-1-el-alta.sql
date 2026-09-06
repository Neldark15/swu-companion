-- LIGA — FASE 1: el alta.
--
-- El documento de diseño llama a esta fase «ESTE ES EL MÓDULO», y no es una
-- exageración: la liga se anuncia en YouTube y se entra por un enlace, así que
-- el alta es la primera pantalla de la app para gente que no la conoce. Hoy el
-- embudo desde ese enlace convierte 0%.
--
-- Esta migración es la mitad del servidor. La otra mitad es el cliente.
--
-- Todo es `create or replace` sobre la MISMA firma: no se crea ninguna
-- sobrecarga (§3s / §4f) y una PWA sin actualizar sigue llamando lo mismo.

-- ─────────────────────────────────────────────────────────────────────
-- 1. UNA LIGA DE 128 NACÍA CAPADA A 10
--
-- `ligas.cupo` tiene DEFAULT 10 en la columna. `liga_crear` inserta lo que le
-- pasen y, si le pasan null, entra el 10 — o sea que el «sin límite» era
-- imposible de expresar. Sin default, NULL vuelve a significar lo único que
-- puede significar: sin tope.
-- ─────────────────────────────────────────────────────────────────────
alter table public.ligas alter column cupo drop default;

-- ─────────────────────────────────────────────────────────────────────
-- 2. INSCRIBIRSE: NOMBRE, PAÍS, CUPO Y LA PROMESA DEL NOMBRE PÚBLICO
--
-- Cuatro cosas, y la última es la que más pesa.
--
-- (a) NOMBRE Y PAÍS OBLIGATORIOS, con la clave `falta`.
--     El país de la liga sale del usuario registrado —decisión de Nel— así
--     que sin país no hay ranking por países ni banderas. Se exige ACÁ y no en
--     la pantalla (§4l), pero devolviendo `falta` para que el asistente pueda
--     abrir el paso que corresponde en vez de mostrar un error crudo. Un
--     «poné tu país» sin decir dónde es una pared.
--
-- (b) EL CUPO SE APLICA. `ligas.cupo` existía y la única función que lo
--     mencionaba era la que lo escribe: la liga no se llenaba nunca. NULL =
--     sin tope; se cuentan solo los `activo`, porque un retirado devolvió su
--     silla.
--
-- (c) EL PAÍS SE COPIA AL CARNÉ. No se une contra `profiles` en cada lectura:
--     `liga_inscripciones.pais` es «dónde estoy» y sigue al perfil; el de la
--     plaza es «dónde estaba cuando arrancó la temporada». Un join vivo
--     reescribiría el ranking de una temporada ya cerrada.
--
-- (d) `consiente_perfil` SE CUMPLE. Esto era un bug de privacidad en vivo: la
--     pantalla del alta muestra tus iniciales y dice, textual, «si lo dejás
--     sin marcar, en la tabla vas a salir como N. D.» — y el servidor
--     guardaba el nombre real SIEMPRE. Ninguna de las 22 funciones de liga
--     leía esa columna: solo la que la escribe. Y `nombre_visible` es
--     justamente lo que `liga_ver` le devuelve a cualquiera que pase
--     `liga_visible()`.
--
--     Hay MENORES en esta comunidad y las partidas se publican en YouTube.
--     Una promesa de anonimato que no se cumple no es un detalle de
--     implementación: es la única del formulario que no se puede deshacer
--     después.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.liga_inscribirse(
  p_liga uuid, p_lider text, p_base text, p_zona text, p_franjas text,
  p_consiente_transmision boolean, p_consiente_perfil boolean
) returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_yo uuid := auth.uid();
  v_nombre text; v_pais text; v_ini text; v_publico text;
  v_insc uuid; v_zona text; v_cupo int; v_hay int;
begin
  if v_yo is null then return jsonb_build_object('ok', false, 'error', 'Sin sesion.'); end if;
  if not public.liga_visible() then
    return jsonb_build_object('ok', false, 'error', 'La liga todavia no esta abierta.');
  end if;

  -- Hay MENORES y las partidas se transmiten: se exige acá, no en la UI (§4l).
  if p_consiente_transmision is distinct from true then
    return jsonb_build_object('ok', false, 'error',
      'Para jugar la liga tenes que aceptar que tus partidas se transmitan y publiquen.',
      'falta', 'transmision');
  end if;

  -- El cupo se lee junto con el estado, en la misma vuelta.
  select cupo into v_cupo from public.ligas where id = p_liga and estado = 'inscripcion';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Esa liga no esta en inscripcion.',
                              'falta', 'cerrada');
  end if;

  if p_franjas !~ '^[01]{168}$' then
    return jsonb_build_object('ok', false, 'error', 'La disponibilidad llego mal formada.',
                              'falta', 'horarios');
  end if;
  -- 6 horas semanales en CUALQUIER reparto. Una regla mas dura empuja a
  -- marcar casillas falsas, y eso envenena el unico calculo del que cuelga
  -- el armado de grupos.
  if length(replace(p_franjas, '0', '')) < 6 then
    return jsonb_build_object('ok', false, 'error',
      'Marca al menos 6 horas por semana en las que puedas jugar.', 'falta', 'horarios');
  end if;

  -- El nombre y el país salen del PERFIL, nunca de lo que teclee el cliente:
  -- son datos sobre una persona que después se publican en una tabla.
  select nullif(btrim(p.name), ''),
         upper(nullif(btrim(p.settings->>'country'), ''))
    into v_nombre, v_pais
    from public.profiles p where p.id = v_yo;

  if v_nombre is null then
    return jsonb_build_object('ok', false, 'error',
      'Antes de entrar, poné tu nombre de jugador.', 'falta', 'nombre');
  end if;
  if v_pais is null or v_pais !~ '^[A-Z]{2}$' then
    return jsonb_build_object('ok', false, 'error',
      'Antes de entrar, elegí tu país.', 'falta', 'pais');
  end if;

  -- El cupo, DESPUÉS de las validaciones baratas: no tiene sentido decirle
  -- «está llena» a alguien a quien igual le falta el país.
  if v_cupo is not null then
    select count(*) into v_hay from public.liga_inscripciones
     where liga_id = p_liga and estado = 'activo';
    if v_hay >= v_cupo then
      return jsonb_build_object('ok', false, 'error', 'La liga ya esta llena.', 'falta', 'cupo');
    end if;
  end if;

  -- Una zona desconocida NO rechaza: un desfase de tzdata (Europe/Kyiv vs
  -- Kiev) no puede dejar a alguien fuera de la liga.
  v_zona := case when exists (select 1 from pg_timezone_names where name = p_zona)
                 then p_zona else 'zona_desconocida' end;

  -- Las iniciales de las DOS primeras palabras: «Nelson Darío Morales» → «N. D.».
  -- Es exactamente lo que la pantalla del alta le enseña a la persona antes de
  -- decidir; si acá saliera otra cosa, la vista previa sería una mentira.
  select string_agg(upper(left(w, 1)) || '.', ' ' order by n)
    into v_ini
    from (select w, row_number() over () as n
            from regexp_split_to_table(v_nombre, '\s+') as w) s
   where s.n <= 2 and s.w <> '';

  v_publico := case when coalesce(p_consiente_perfil, false)
                    then v_nombre
                    else coalesce(nullif(v_ini, ''), 'Jugador') end;

  insert into public.liga_inscripciones
    (liga_id, user_id, nombre_visible, lider, base, pais,
     consiente_aparecer, consiente_perfil)
  values (p_liga, v_yo, v_publico,
          nullif(btrim(coalesce(p_lider,'')),''), nullif(btrim(coalesce(p_base,'')),''),
          v_pais, true, coalesce(p_consiente_perfil, false))
  returning id into v_insc;

  -- MISMA transacción: dos llamadas dejarían gente inscrita con cero franjas,
  -- y el armador no puede trabajar con eso.
  insert into public.liga_disponibilidad (insc_id, liga_id, zona, franjas)
  values (v_insc, p_liga, v_zona, p_franjas);

  return jsonb_build_object('ok', true, 'inscripcion', v_insc, 'zona', v_zona,
                            'nombreVisible', v_publico, 'pais', v_pais);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'Ya estas inscrito en esta liga.',
                            'falta', 'repetida');
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────
-- 3. EL NOMBRE PÚBLICO SE PUEDE CAMBIAR DE OPINIÓN
--
-- Sin esto, `consiente_perfil` sería una decisión de una sola vez tomada en un
-- formulario, sobre el dato más expuesto de la liga. Y no es simétrica: quien
-- se escondió puede querer mostrarse cuando gane, y quien se mostró puede
-- querer esconderse — esto último es el que de verdad no puede esperar.
--
-- Toca TAMBIÉN las plazas vivas: `liga_armar_grupos` copia `nombre_visible` a
-- la plaza, así que sin esta segunda escritura el cambio no se vería en la
-- tabla, que es el único sitio donde importa.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.liga_nombre_publico(p_liga uuid, p_consiente boolean)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_yo uuid := auth.uid();
  v_nombre text; v_ini text; v_publico text; v_insc uuid; v_n int;
begin
  if v_yo is null then return jsonb_build_object('ok', false, 'error', 'Sin sesion.'); end if;

  select i.id into v_insc from public.liga_inscripciones i
   where i.liga_id = p_liga and i.user_id = v_yo;
  if v_insc is null then
    return jsonb_build_object('ok', false, 'error', 'No estas inscrito en esta liga.');
  end if;

  select nullif(btrim(p.name), '') into v_nombre from public.profiles p where p.id = v_yo;
  if v_nombre is null then
    return jsonb_build_object('ok', false, 'error', 'Tu perfil no tiene nombre.');
  end if;

  select string_agg(upper(left(w, 1)) || '.', ' ' order by n)
    into v_ini
    from (select w, row_number() over () as n
            from regexp_split_to_table(v_nombre, '\s+') as w) s
   where s.n <= 2 and s.w <> '';

  v_publico := case when coalesce(p_consiente, false)
                    then v_nombre else coalesce(nullif(v_ini, ''), 'Jugador') end;

  update public.liga_inscripciones
     set consiente_perfil = coalesce(p_consiente, false), nombre_visible = v_publico
   where id = v_insc;
  -- Una escritura frenada por RLS afecta 0 filas SIN error (§2u): se cuenta.
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'error', 'No se pudo guardar.');
  end if;

  update public.liga_plazas set nombre_visible = v_publico
   where inscripcion_id = v_insc;

  return jsonb_build_object('ok', true, 'nombreVisible', v_publico);
end;
$function$;

revoke all on function public.liga_nombre_publico(uuid, boolean) from anon, public;
grant execute on function public.liga_nombre_publico(uuid, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 4. `mi_liga()` DEVUELVE EL CARNÉ AUNQUE TODAVÍA NO HAYA PLAZA
--
-- Este es el paso que mata la retención: te inscribís y tu perfil sigue
-- vacío durante SEMANAS, hasta que el organizador arma los grupos. La app no
-- tiene forma de decirte «estás dentro», y no hay ningún mecanismo para
-- traerte de vuelta.
--
-- EL CAMBIO ES PURAMENTE ADITIVO Y ESO NO ES CASUALIDAD. `getMiLiga()` corta
-- con `if (!r?.ok || !r.grupo) return null`, así que una PWA sin actualizar
-- sigue viendo exactamente lo de antes. La cicatriz que documenta
-- `ligaService.ts:267` —«así fue exactamente como esta tarjeta desapareció
-- para todos sin que nadie lo notara»— es el motivo de no tocar la firma ni
-- la rama que ya existía.
--
-- El carné trae TU zona y TUS franjas: es tu propio dato, y sin un camino de
-- lectura la pantalla de editar horarios arrancaría en blanco y guardar
-- borraría lo anterior sin avisar.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.mi_liga()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v_yo uuid := auth.uid();
  v_plaza uuid; v_grupo uuid; v_liga uuid;
  v_insc uuid; v_liga_c uuid;
begin
  if v_yo is null then
    return jsonb_build_object('ok', false, 'error', 'Sin sesion.');
  end if;

  -- La plaza viva más reciente. La identidad dentro de la competencia es la
  -- PLAZA, no la cuenta (§3q).
  select p.id, p.grupo_id, t.liga_id
    into v_plaza, v_grupo, v_liga
    from public.liga_plazas p
    join public.liga_grupos g on g.id = p.grupo_id
    join public.liga_temporadas t on t.id = g.temporada_id
    join public.liga_inscripciones i on i.id = p.inscripcion_id
   where i.user_id = v_yo and p.estado = 'activa' and t.estado <> 'cerrada'
   order by p.sentada_en desc
   limit 1;

  if v_plaza is null then
    -- Sin plaza no es un error: es el caso normal de casi todo el mundo.
    -- Pero SÍ puede haber carné, y esa es toda la diferencia entre «no jugás
    -- ninguna liga» y «estás anotado y falta que armen los grupos».
    select i.id, i.liga_id into v_insc, v_liga_c
      from public.liga_inscripciones i
     where i.user_id = v_yo and i.estado = 'activo'
     order by i.inscrito_en desc
     limit 1;

    if v_insc is null then
      return jsonb_build_object('ok', true, 'liga', null);
    end if;

    return jsonb_build_object(
      'ok', true,
      'liga', null,          -- la rama vieja intacta: el cliente viejo sigue viendo null
      'carne', (
        select jsonb_build_object(
          'inscripcion', i.id,
          'nombreVisible', i.nombre_visible,
          'consientePerfil', i.consiente_perfil,
          'pais', i.pais,
          'lider', i.lider,
          'base', i.base,
          'tier', i.tier,
          'inscritoEn', i.inscrito_en,
          'zona', d.zona,
          'franjas', d.franjas,
          -- «Sos el 34 de 128»: el puesto en la cola por antigüedad y cuántos
          -- van. Las dos cifras juntas, o un «34» suelto no dice nada.
          'puesto', (select count(*) from public.liga_inscripciones o
                      where o.liga_id = i.liga_id and o.estado = 'activo'
                        and (o.inscrito_en, o.id) <= (i.inscrito_en, i.id)),
          'total', (select count(*) from public.liga_inscripciones o
                     where o.liga_id = i.liga_id and o.estado = 'activo'),
          'cupo', l.cupo,
          'ligaId', l.id, 'code', l.code, 'nombre', l.nombre, 'estado', l.estado
        )
        from public.liga_inscripciones i
        join public.ligas l on l.id = i.liga_id
        left join public.liga_disponibilidad d on d.insc_id = i.id
       where i.id = v_insc
      )
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'miPlaza', v_plaza,
    'liga', (select jsonb_build_object('id', l.id, 'code', l.code, 'nombre', l.nombre,
                                       'estado', l.estado)
               from public.ligas l where l.id = v_liga),
    'grupo', (select jsonb_build_object('id', g.id, 'tier', g.tier, 'orden', g.orden,
                                        'estado', g.estado, 'cierra', g.cierra)
                from public.liga_grupos g where g.id = v_grupo),
    'plazas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'grupoId', p.grupo_id, 'nombre', p.nombre_visible,
        'lider', p.lider_card_id, 'base', p.base_card_id, 'estado', p.estado,
        'esMia', p.id = v_plaza) order by p.sentada_en)
        from public.liga_plazas p where p.grupo_id = v_grupo), '[]'::jsonb),
    'partidas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'grupoId', m.grupo_id, 'jornada', m.jornada,
        'localPlaza', m.local_plaza, 'visitaPlaza', m.visita_plaza,
        'vl', m.victorias_local, 'vv', m.victorias_visita,
        'estado', m.estado, 'origen', m.origen, 'venceEl', m.vence_el,
        'vod', m.vod_youtube_id, 'reportadaPor', m.reportada_por) order by m.jornada)
        from public.liga_partidas m where m.grupo_id = v_grupo), '[]'::jsonb)
  );
end;
$function$;
