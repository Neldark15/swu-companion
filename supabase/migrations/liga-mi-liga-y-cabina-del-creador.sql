-- «MI LIGA» EN EL PERFIL + LA CABINA DE TRANSMISIÓN DEL CREADOR
--
-- Fases 2 y 3 del espacio de creadores (§4l). Aplicada en producción el
-- 2026-08-27 en cuatro pasos (`liga_mi_liga_rpc`, `creador_cabina_transmision`
-- y dos correcciones); acá va el estado FINAL, que es lo que hay desplegado.
--
-- Las dos correcciones valen como advertencia y por eso quedan anotadas:
--   1. `is_admin()` NO EXISTE en esta base. La comprobación de admin se
--      escribe siempre como el exists sobre `profiles` (igual que
--      `liga_premiar`, `set_user_role` y `puede_ver_creadores`).
--   2. El fallo va en la clave `error`, no `mensaje`: el ayudante `rpc()` de
--      `ligaService` lee ESA. Con `mensaje`, todo fallo se habría leído en
--      pantalla como el genérico «No se pudo» — el servidor explicando el
--      motivo y la persona sin verlo nunca.


-- ── 1. «MI LIGA»: lo que ve un jugador inscrito, en su propio perfil ──
--
-- Pedido literal de Nel: «al inscribirse en la liga, el perfil tenga un
-- espacio de cómo van sus stats, contra quién le tocaría jugar, e incluso
-- dónde estarían colgados los videos de YouTube de cada partida».
--
-- Por qué una RPC y no cuatro SELECT desde el cliente: el perfil es la
-- pantalla que más se abre, y armar esto en el cliente serían cuatro viajes
-- (liga, inscripciones, partidas, creador) para pintar una tarjeta. Acá es
-- UNO, y además devuelve lo del jugador SIN que el demo cerrado le tape su
-- propia liga: si estás inscrito, tu tarjeta es tuya aunque el espacio
-- todavía no sea público.
--
-- La tabla NO se calcula acá: se devuelven las partidas y el cliente ya sabe
-- computar posiciones con `tablaDe()` — un solo algoritmo, en un solo lado
-- (§2y). Lo que sí se resuelve en el servidor es QUIÉN es cada inscripción,
-- porque el cliente no puede leer `liga_inscripciones` ajenas durante el demo.

create or replace function public.mi_liga()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_yo uuid := auth.uid();
  v_insc record;
  v_res jsonb;
begin
  if v_yo is null then
    return jsonb_build_object('ok', false, 'error', 'Sin sesion.');
  end if;

  -- La inscripción viva más reciente. Con una liga por creador y pocas ligas,
  -- «la última» es la que a alguien le interesa ver en su perfil.
  select i.id, i.liga_id, i.nombre_visible
    into v_insc
    from public.liga_inscripciones i
    join public.ligas l on l.id = i.liga_id
   where i.user_id = v_yo and not i.retirado
     and l.estado in ('inscripcion', 'activa', 'cerrada')
   order by case l.estado when 'activa' then 0 when 'inscripcion' then 1 else 2 end,
            i.inscrito_en desc
   limit 1;

  if v_insc.id is null then
    -- Sin liga no es un error: es el caso normal de casi todo el mundo.
    return jsonb_build_object('ok', true, 'liga', null);
  end if;

  select jsonb_build_object(
    'ok', true,
    'miInscripcion', v_insc.id,
    'liga', (
      select jsonb_build_object(
        'id', l.id, 'code', l.code, 'nombre', l.nombre, 'estado', l.estado,
        'creadorNombre', c.nombre_publico, 'creadorCode', c.code, 'creadorLogo', c.logo)
        from public.ligas l
        join public.creadores c on c.user_id = l.creador_id
       where l.id = v_insc.liga_id),
    'inscripciones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'userId', i.user_id, 'nombre', i.nombre_visible,
        'lider', i.lider, 'retirado', i.retirado) order by i.inscrito_en)
        from public.liga_inscripciones i where i.liga_id = v_insc.liga_id), '[]'::jsonb),
    'partidas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'jornada', p.jornada,
        'localInsc', p.local_insc, 'visitaInsc', p.visita_insc,
        'victoriasLocal', p.victorias_local, 'victoriasVisita', p.victorias_visita,
        'estado', p.estado, 'programadaPara', p.programada_para,
        'vodYoutubeId', p.vod_youtube_id, 'vodT', p.vod_t) order by p.jornada)
        from public.liga_partidas p where p.liga_id = v_insc.liga_id), '[]'::jsonb)
  ) into v_res;

  return v_res;
end;
$function$;

revoke all on function public.mi_liga() from anon, public;
grant execute on function public.mi_liga() to authenticated;


-- ── 2. LA CABINA DE TRANSMISIÓN DEL CREADOR ──────────────────────────
--
-- Alejo pidió poder transmitir con su marca. El motor de transmisión YA
-- existe entero —`/estudio/:code` para operar, `/overlay/:code` para OBS,
-- marca configurable, música, marcador, VOD— y lo que faltaba era el ALTA:
-- las tres filas (sesión + overlay + operador) que hacen que una cabina
-- exista y que hasta hoy solo se insertaban desde el SQL Editor.
--
-- Por qué una RPC de admin y no una policy de INSERT: el `code` de una cabina
-- es su dirección pública (`/overlay/PUENTE3` es lo que el creador pega en
-- OBS y lo que la app enseña en `/envivo`). Con una policy de INSERT, un
-- creador podría darse de alta con el code de otro —o con `SV01`, el de los
-- torneos nacionales— y quedarse operando la cabina ajena. No es hipotético:
-- `stream_operadores` es exactamente la tabla que decide quién puede escribir
-- el marcador que sale al aire.
--
-- Así que el alta la hace un admin, igual que `canal_youtube` (§4l): lo que
-- identifica a alguien de cara al público no se lo pone esa misma persona.
-- Una vez creada, el creador opera SU cabina sin pedir permiso a nadie.

create or replace function public.creador_abrir_cabina(
  p_creador_code text,
  p_cabina_code  text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_creador record;
  v_code text;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    return jsonb_build_object('ok', false, 'error', 'Solo un administrador abre cabinas.');
  end if;

  select user_id, nombre_publico, code into v_creador
    from public.creadores where code = p_creador_code and activo;
  if v_creador.user_id is null then
    return jsonb_build_object('ok', false, 'error', 'No existe ese creador.');
  end if;

  -- El code por defecto sale del creador y NO se pide dos veces: escribirlo
  -- a mano es la ocasión de equivocarse y pisar la cabina de otro.
  v_code := upper(regexp_replace(coalesce(nullif(trim(p_cabina_code), ''), v_creador.code), '[^A-Za-z0-9]', '', 'g'));
  if length(v_code) < 3 or length(v_code) > 16 then
    return jsonb_build_object('ok', false, 'error', 'El codigo va de 3 a 16 letras o numeros.');
  end if;

  -- Si la cabina ya es de OTRO, esto para acá. Sin esta comprobación, abrir
  -- la cabina de un creador dos veces le regalaría el mando a quien la abra
  -- de último — y ese mando escribe el marcador que sale al aire.
  if exists (
    select 1 from public.stream_operadores
     where code = v_code and user_id <> v_creador.user_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'Ese codigo ya tiene otro operador.');
  end if;

  insert into public.stream_sesiones (code, nombre, activa)
  values (v_code, v_creador.nombre_publico, true)
  on conflict (code) do update set nombre = excluded.nombre, activa = true;

  -- El overlay nace vacío: `{}` lo normaliza el cliente al estado inicial.
  -- Sembrarlo con un estado escrito acá sería una segunda copia del
  -- ESTADO_INICIAL de TypeScript, y las dos se separarían al primer campo
  -- nuevo — como acaba de pasar con `ficha`.
  insert into public.stream_overlay (code, estado)
  values (v_code, '{}'::jsonb)
  on conflict (code) do nothing;

  insert into public.stream_operadores (code, user_id)
  values (v_code, v_creador.user_id)
  on conflict (code, user_id) do nothing;

  return jsonb_build_object('ok', true, 'code', v_code,
    'mensaje', 'Cabina ' || v_code || ' lista para ' || v_creador.nombre_publico || '.');
end;
$function$;

revoke all on function public.creador_abrir_cabina(text, text) from anon, public;
grant execute on function public.creador_abrir_cabina(text, text) to authenticated;


-- ── 3. «EN VIVO ahora» en la casa del creador ────────────────────────
--
-- La página del creador tiene que poder decir si está transmitiendo AHORA.
-- El dato ya existe: `stream_overlay.estado->>'envivo'`, que el operador
-- enciende desde el estudio y que `/envivo` ya usa para toda la comunidad —
-- no hay un segundo sitio donde decir «estoy transmitiendo» que se pueda
-- quedar viejo (§3c).
--
-- Se lee por RPC y no abriendo `stream_overlay` a `anon`: esa fila lleva el
-- marcador completo en vivo —vidas, recursos, cartas en mano— y publicarlo
-- entero sería regalar información de una partida en curso a quien la está
-- jugando. Acá salen tres campos: si está al aire, el enlace y el rótulo.

create or replace function public.creador_en_vivo(p_creador_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid;
  v_fila record;
begin
  select user_id into v_uid from public.creadores where code = p_creador_code and activo;
  if v_uid is null then
    return jsonb_build_object('envivo', false);
  end if;

  select o.code,
         coalesce((o.estado->>'envivo')::boolean, false) as envivo,
         coalesce(o.estado->>'youtube', '') as youtube,
         coalesce(o.estado->>'etiquetaRonda', '') as ronda,
         s.nombre
    into v_fila
    from public.stream_operadores op
    join public.stream_overlay o on o.code = op.code
    join public.stream_sesiones s on s.code = op.code
   where op.user_id = v_uid and s.activa
   order by o.updated_at desc
   limit 1;

  if v_fila.code is null or not v_fila.envivo then
    return jsonb_build_object('envivo', false);
  end if;

  return jsonb_build_object(
    'envivo', true, 'code', v_fila.code, 'youtube', v_fila.youtube,
    'ronda', v_fila.ronda, 'nombre', v_fila.nombre);
end;
$function$;

revoke all on function public.creador_en_vivo(text) from public;
grant execute on function public.creador_en_vivo(text) to anon, authenticated;
