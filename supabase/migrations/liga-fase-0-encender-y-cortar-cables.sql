-- LIGA — FASE 0: encender y cortar los cables.
--
-- Nada de esto se ve en pantalla. Todo es lo que hoy hace IMPOSIBLE jugar, mas
-- los cambios que solo son gratis mientras la liga este vacia.
--
-- La liga `puente3` tiene 0 inscritos, 0 partidas y estado `borrador` (el demo
-- se borro el 2026-09-06). Cada `alter` de aca costaria una migracion bajo
-- datos vivos dentro de tres meses.

-- ─────────────────────────────────────────────────────────────────────
-- 1. ALEJO NO PUEDE VER SU PROPIA LIGA
--
-- `liga_visible()` leia SOLO `liga_probadores`, que tiene UNA fila (Nelson).
-- O sea que el creador de la liga, su staff y cualquier inscrito reciben
-- «Esta liga todavia no es publica» — incluido Alejo, que es de quien es.
--
-- Se agregan tres puertas y se conserva la de probadores, que es la que deja
-- estrenar cosas con una cuenta antes de abrir. Misma firma: las tres policies
-- que la llaman no se tocan.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.liga_visible()
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select
    -- una liga publica la ve cualquiera con sesion
    exists (select 1 from public.ligas l where l.publica)
    -- el creador ve la suya aunque no sea publica
    or exists (select 1 from public.ligas l where l.creador_id = auth.uid())
    -- el staff ve donde arbitra
    or exists (select 1 from public.liga_staff s where s.user_id = auth.uid())
    -- quien esta inscrito ve donde juega
    or exists (select 1 from public.liga_inscripciones i where i.user_id = auth.uid())
    -- y la allowlist de estreno
    or exists (select 1 from public.liga_probadores p where p.user_id = auth.uid())
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 2. LA LIGA NO SE PUEDE CERRAR
--
-- `liga_cerrar` escribe `estado = 'sin_jugar'` en las partidas que quedaron
-- sin jugar, y ese valor NO esta en el CHECK: 23514 y rollback de todo.
-- Con una sola partida sin jugar, la liga no cierra nunca.
--
-- Se agrega el valor en vez de cambiar la RPC porque el estado es correcto: el
-- motor no inventa resultados (la cicatriz de los torneos con invitados, §3q).
-- ─────────────────────────────────────────────────────────────────────
alter table public.liga_partidas drop constraint if exists liga_partidas_estado_check;
alter table public.liga_partidas add constraint liga_partidas_estado_check
  check (estado in ('programada','reportada','confirmada','disputada','vencida',
                    'wo_local','wo_visita','anulada','sin_jugar'));

-- ─────────────────────────────────────────────────────────────────────
-- 3. LOS ARBITROS SE BORRAN SOLOS AL CERRAR LA TEMPORADA
--
-- `liga_staff.grupo_id` apunta a `liga_grupos` con ON DELETE CASCADE. Un
-- arbitro asignado a un grupo desaparece de la tabla cuando ese grupo se
-- borre — sin error y sin aviso. Pierde el rol, no el grupo.
--
-- SET NULL: se queda como staff de la liga entera, que es lo que significa
-- «ya no tiene grupo asignado».
-- ─────────────────────────────────────────────────────────────────────
alter table public.liga_staff drop constraint if exists liga_staff_grupo_id_fkey;
alter table public.liga_staff add constraint liga_staff_grupo_id_fkey
  foreign key (grupo_id) references public.liga_grupos(id) on delete set null;

-- ─────────────────────────────────────────────────────────────────────
-- 4. LAS COLUMNAS QUE HOY SON GRATIS
--
-- Todas aditivas y con defaults que reproducen exactamente lo de hoy.
-- ─────────────────────────────────────────────────────────────────────

-- EL PAIS, en dos sitios y con dos significados distintos:
--   `liga_inscripciones.pais` = donde estoy AHORA. Sigue al perfil.
--   `liga_plazas.pais`        = donde estaba cuando arranco ESTA temporada.
-- Un join vivo contra `profiles` reescribiria el pasado: quien se mude entre
-- temporadas cambiaria solo el ranking por paises de la temporada cerrada.
alter table public.liga_inscripciones
  add column if not exists pais text
  check (pais is null or pais ~ '^[A-Z]{2}$');
alter table public.liga_plazas
  add column if not exists pais text
  check (pais is null or pais ~ '^[A-Z]{2}$');

-- EL FORMATO: la maqueta lo pide como cifra y no tenia de donde salir.
alter table public.ligas add column if not exists formato text not null default 'premier';
alter table public.ligas drop constraint if exists ligas_formato_check;
alter table public.ligas add constraint ligas_formato_check
  check (formato in ('premier','twin_suns','draft','sealed','libre'));

-- LA LIGA, DENORMALIZADA. Hoy son dos lineas; con datos vivos es una migracion
-- de RLS con subconsulta anidada — y una subconsulta anidada evalua la RLS de
-- la tabla de adentro, asi que puede devolver 0 filas SIN error (§2u).
alter table public.liga_grupos add column if not exists liga_id uuid
  references public.ligas(id) on delete cascade;
alter table public.liga_plazas add column if not exists liga_id uuid
  references public.ligas(id) on delete cascade;

-- ─────────────────────────────────────────────────────────────────────
-- 5. REPORTAR DEJA DE SER COSA DEL STAFF — y eso mata DOS bugs
--
-- `liga_reportar` dejaba pasar a `v_staff` sin plaza. Entonces:
--
--   reportada_por = coalesce(v_mia, reportada_por)  →  con v_mia NULL, queda NULL
--
-- y `liga_confirmar` guarda contra la autoconfirmacion asi:
--
--   if v_mia = v_p.reportada_por then ... rechazar
--
-- `algo = NULL` da NULL, que NO es TRUE: la guardia no dispara y **cualquiera
-- de los dos jugadores confirma su propio resultado**. La confirmacion doble
-- —que es toda la defensa que tiene la liga contra un marcador inventado—
-- deja de existir en cuanto el staff toca una partida.
--
-- Y hay un segundo problema de fondo: un staff reportando es una accion
-- administrativa SIN rastro, porque `liga_reportar` no escribe en
-- `liga_correcciones`. Para eso esta `liga_corregir`, que si deja huella.
--
-- Se saca `v_staff`. El staff usa `liga_corregir`, que es auditada.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.liga_reportar(
  p_partida uuid, p_victorias_local integer, p_victorias_visita integer,
  p_vod text default null, p_vod_t integer default null)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare v_mia uuid; v_liga uuid; v_estado text; v_vod text;
begin
  select liga_id, estado into v_liga, v_estado from public.liga_partidas where id = p_partida;
  if v_liga is null then return jsonb_build_object('ok', false, 'error', 'No existe esa partida.'); end if;

  v_mia := public.liga_mi_plaza(p_partida);
  -- Solo quien la jugo. El staff corrige, no reporta.
  if v_mia is null then
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
         estado = 'reportada',
         -- Ya no hace falta `coalesce`: v_mia nunca es null a esta altura.
         reportada_por = v_mia,
         reportada_en = now(),
         vence_el = (now() at time zone 'America/El_Salvador')::date + 5,
         aviso_en = null, recordatorio_en = null,
         vod_youtube_id = coalesce(v_vod, vod_youtube_id),
         vod_t = coalesce(p_vod_t, vod_t),
         updated_at = now()
   where id = p_partida;
  return jsonb_build_object('ok', true);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 6. EL LAUDO DEJA DE PUBLICAR LA FILA ENTERA, Y RESPETA EL GRUPO
--
-- Dos cosas:
--
-- (a) `liga_correcciones` guardaba `to_jsonb(m)` de la fila COMPLETA de
--     `liga_partidas` — incluido `disputa_motivo`, que es el texto libre donde
--     un jugador acusa a otro. Y esa tabla tiene grant de SELECT a nivel de
--     TABLA para `authenticated`, o sea que el laudo republica la acusacion a
--     cualquiera con sesion. Hay MENORES en la comunidad. Se guarda recortado.
--
-- (b) `liga_es_staff(liga)` no mira `grupo_id`, asi que un arbitro asignado al
--     grupo 3 puede laudar una partida del grupo 7. El rol por grupo existe en
--     la tabla desde el primer dia y no lo leia nadie.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.liga_corregir(
  p_partida uuid, p_vl integer, p_vv integer, p_estado text, p_motivo text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare v_liga uuid; v_grupo uuid; v_antes jsonb; v_acotado boolean;
begin
  select m.liga_id, m.grupo_id,
         jsonb_build_object('vl', m.victorias_local, 'vv', m.victorias_visita,
                            'estado', m.estado, 'origen', m.origen,
                            'vence_el', m.vence_el)
    into v_liga, v_grupo, v_antes
    from public.liga_partidas m where m.id = p_partida;
  if v_liga is null then return jsonb_build_object('ok', false, 'error', 'No existe esa partida.'); end if;

  if not public.liga_es_staff(v_liga) then
    return jsonb_build_object('ok', false, 'error', 'Esto lo resuelve la organizacion.');
  end if;

  -- Un arbitro CON grupo asignado solo lauda en el suyo. Sin grupo asignado
  -- —el creador, el admin, el staff general— laudan en toda la liga.
  select exists (
    select 1 from public.liga_staff s
     where s.user_id = auth.uid() and s.liga_id = v_liga and s.grupo_id is not null
  ) into v_acotado;
  if v_acotado and not exists (
    select 1 from public.liga_staff s
     where s.user_id = auth.uid() and s.liga_id = v_liga and s.grupo_id = v_grupo
  ) then
    return jsonb_build_object('ok', false, 'error', 'Esa partida no es de tu grupo.');
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
  select v_liga, p_partida, auth.uid(), v_antes,
         jsonb_build_object('vl', m.victorias_local, 'vv', m.victorias_visita,
                            'estado', m.estado, 'origen', m.origen,
                            'vence_el', m.vence_el),
         btrim(p_motivo)
    from public.liga_partidas m where m.id = p_partida;
  return jsonb_build_object('ok', true);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 7. ARMAR GRUPOS LLENA `pais` Y `liga_id`
--
-- Es el UNICO insertador de `liga_grupos` y `liga_plazas`, asi que es el unico
-- sitio donde estas columnas se pueden llenar sin un backfill.
--
-- El pais se COPIA del carne, no se une contra `profiles`: la plaza guarda
-- donde estaba la persona cuando arranco la temporada. Es el mismo patron con
-- el que `nombre_visible` ya se copia dos veces (al carne al inscribirse, y de
-- ahi a la plaza al sentarse).
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.liga_armar_grupos(p_temporada uuid, p_asignacion jsonb)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
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
    if exists (select 1 from unnest(v_ids) u where u = any(v_vistas)) then
      return jsonb_build_object('ok', false, 'error', 'Hay alguien asignado a dos grupos.');
    end if;
    v_vistas := v_vistas || v_ids;
    if exists (select 1 from unnest(v_ids) u
                where not exists (select 1 from public.liga_inscripciones i
                                   where i.id = u and i.liga_id = v_liga and i.estado='activo')) then
      return jsonb_build_object('ok', false, 'error', 'Hay una inscripcion que no es de esta liga.');
    end if;

    insert into public.liga_grupos (temporada_id, liga_id, tier, orden, tamano, arranca, cierra)
    values (p_temporada, v_liga, g->>'tier', (g->>'orden')::int, array_length(v_ids,1), v_arranca, v_cierra)
    returning id into v_grupo;

    insert into public.liga_plazas (grupo_id, liga_id, inscripcion_id, nombre_visible,
                                    lider_card_id, base_card_id, pais)
    select v_grupo, v_liga, i.id, i.nombre_visible, i.lider, i.base, i.pais
      from public.liga_inscripciones i where i.id = any(v_ids);

    v_creados := v_creados + 1;
  end loop;

  update public.liga_temporadas set estado = 'en_curso' where id = p_temporada;
  update public.ligas set estado = 'activa' where id = v_liga;
  return jsonb_build_object('ok', true, 'grupos', v_creados, 'plazas', array_length(v_vistas,1));
end;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 8. LA CERRADURA NO ESTA EN LA PANTALLA, ESTA EN POSTGREST
--
-- Medido: `liga_inscripciones`, `liga_partidas` y `liga_correcciones` tienen
-- grant de SELECT a nivel de TABLA para `authenticated`. `liga_ver()` omite
-- `user_id` a proposito — **la tabla lo entrega igual**. El dia que la liga se
-- abra, cualquier cuenta con sesion hace un GET a `/rest/v1/liga_inscripciones`
-- y se lleva de cada persona: `user_id`, `estado` (incluido un eventual veto),
-- `abandonos` y `consiente_perfil`. Y de `liga_partidas`: `disputa_motivo`, el
-- texto donde alguien acusa a otro. HAY MENORES EN LA COMUNIDAD.
--
-- Y un grant de tabla cubre las columnas FUTURAS: la `pais` que acabamos de
-- agregar se publicaria sola (§2j).
--
-- Cuesta CERO TypeScript: `grep "from('liga_inscripciones')"` en src/ da 0
-- resultados. Ninguna pantalla lee estas tablas directo, todo va por RPC.
-- ─────────────────────────────────────────────────────────────────────
revoke select on public.liga_inscripciones from authenticated;
grant select (id, liga_id, nombre_visible, lider, base, tier, estado, pais, inscrito_en, retirado)
  on public.liga_inscripciones to authenticated;

revoke select on public.liga_partidas from authenticated;
grant select (id, liga_id, grupo_id, jornada, local_plaza, visita_plaza,
              victorias_local, victorias_visita, estado, origen, vence_el,
              programada_para, vod_youtube_id, vod_t, reportada_por)
  on public.liga_partidas to authenticated;

revoke select on public.liga_correcciones from authenticated;
grant select (id, liga_id, partida_id, antes, despues, motivo, creado_en)
  on public.liga_correcciones to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 9. UN CREADOR NO LEE EL PADRON DE LAS LIGAS AJENAS
--
-- Las tres policies tienen una rama `puede_ver_creadores()`, que significa
-- «existe fila en creadores O es admin» — NO es por liga. Con dos ligas vivas,
-- cualquier creador registrado lee el padron completo de la liga del otro.
--
-- `liga_visible()` ya cubre lo que hace falta: publica, creador, staff,
-- inscrito, probador.
-- ─────────────────────────────────────────────────────────────────────
drop policy if exists ligas_ver on public.ligas;
create policy ligas_ver on public.ligas for select using (public.liga_visible());

drop policy if exists liga_insc_ver on public.liga_inscripciones;
create policy liga_insc_ver on public.liga_inscripciones for select using (public.liga_visible());

drop policy if exists liga_partidas_ver on public.liga_partidas;
create policy liga_partidas_ver on public.liga_partidas for select using (public.liga_visible());

-- ─────────────────────────────────────────────────────────────────────
-- 10. UN CREADOR PUEDE TENER MAS DE UNA LIGA
--
-- El indice unico parcial dejaba UNA liga viva por creador. Eso impide Puente 4
-- mientras Puente 3 siga abierta, y —peor— rompe en silencio: `getLigaDeCreador`
-- usa `.maybeSingle()`, que con dos filas devuelve PGRST116, y el servicio hace
-- `if (error) return null`. La segunda liga no da error: hace desaparecer la
-- primera.
--
-- Queda un tope BLANDO de 5 dentro de `liga_crear`, que es un limite con
-- mensaje en vez de un indice que miente.
-- ─────────────────────────────────────────────────────────────────────
drop index if exists public.ligas_una_viva_por_creador;

-- El tope blando, con mensaje. Y `coalesce(p_cupo, 10)` se va: un default de
-- 10 escondido en el insert es un cupo que nadie eligio — la liga de Alejo son
-- 128 personas. Sin cupo declarado, `cupo` queda NULL = sin tope.
create or replace function public.liga_crear(
  p_code text, p_nombre text, p_descripcion text, p_cupo integer)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare v_yo uuid := auth.uid(); v_id uuid; v_vivas int;
begin
  if v_yo is null then return jsonb_build_object('ok', false, 'error', 'Sin sesion.'); end if;
  if not exists (select 1 from public.creadores where user_id = v_yo and activo) then
    return jsonb_build_object('ok', false, 'error', 'No sos creador.');
  end if;

  select count(*) into v_vivas from public.ligas
   where creador_id = v_yo and estado in ('borrador','inscripcion','activa');
  if v_vivas >= 5 then
    return jsonb_build_object('ok', false, 'error',
      'Ya tenes 5 ligas en marcha. Cerra alguna antes de abrir otra.');
  end if;

  insert into public.ligas (code, creador_id, nombre, descripcion, cupo)
  values (lower(btrim(p_code)), v_yo, btrim(p_nombre),
          nullif(btrim(coalesce(p_descripcion,'')),''), p_cupo)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'Ese codigo de liga ya existe.');
end $$;
