-- LIGA — FASE 2: el reloj.
--
-- Esta fase tiene una fecha límite que no la pone nadie: el día de la PRIMERA
-- partida reportada, más cinco. Ese día, o el reloj existe, o el silencio no
-- confirma nada y la primera disputa se atora sin salida.
--
-- `liga_vencidas()` ya estaba escrita —sella por silencio y manda lo que nadie
-- jugó a la cola del árbitro— y **no la llamaba nadie**: cero archivos de liga
-- en `api/`, cero entradas de liga en los seis crons de `vercel.json`. El
-- `plazoTexto()` que la pantalla ya pinta era un reloj sin maquinaria.
--
-- Lo que falta acá es lo de ANTES del plazo. Sellar por silencio es correcto
-- —no confirmar no puede ser mejor negocio que perder— pero solo si a la
-- persona se le avisó. Sin aviso previo, el silencio deja de ser una decisión
-- y pasa a ser un descuido que el sistema cobra.

-- ─────────────────────────────────────────────────────────────────────
-- `liga_avisos()` — a quién hay que avisarle HOY, y de qué
--
-- Tres cosas distintas, y las tres se descubrieron mirando qué puede salir mal
-- entre que alguien reporta y que el plazo vence:
--
--   1. `confirmar` — alguien reportó y falta TU confirmación. Va apenas se
--      reporta. Es el aviso que hace que la confirmación doble exista de
--      verdad: sin él, la única forma de enterarte es abrir la app por tu
--      cuenta.
--   2. `ultima`    — eso mismo, pero el plazo ya se te viene encima. Es el
--      último momento en que todavía podés decir «no fue así»: al día
--      siguiente el silencio lo sella y ya no hay disputa posible.
--   3. `jugar`     — la jornada vence y la partida sigue sin jugarse. Acá se
--      les avisa a LOS DOS: ninguno de los dos hizo nada, así que no hay a
--      quién culpar y sí a quién recordarle.
--
-- ── EL SELLO VA DENTRO DEL `where` DEL `update`, NO ANTES ────────────
--
-- Es la cicatriz del §4d: ahí el cron de transmisiones sellaba con
-- `.is(sello, null)` y seguía derecho al envío **sin mirar si el UPDATE había
-- tocado alguna fila**. Con dos corridas simultáneas, la que perdía la carrera
-- mandaba el push igual. Acá el sello y la selección son la MISMA sentencia:
-- lo que devuelve el `returning` es, por construcción, exactamente lo que esta
-- corrida ganó. Dos corridas a la vez reparten el trabajo en vez de duplicarlo.
--
-- Y se sella ANTES de enviar, no después: el peor caso así es que alguien no
-- reciba un aviso; al revés es que todos lo reciban en cada corrida, que es
-- cómo se desinstala una app.
--
-- ── Por qué no avisa de lo ya vencido ────────────────────────────────
--
-- Las tres ramas exigen `vence_el >= hoy`. El cron corre `liga_avisos()` y
-- después `liga_vencidas()`: sin esa guarda, una partida reportada el mismo día
-- en que vence recibiría un «confirmá» y, dos líneas más abajo, quedaría
-- sellada por silencio. Un aviso para algo que ya no se puede hacer es peor
-- que ningún aviso.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.liga_avisos(p_dias_aviso int default 2)
returns table(
  partida_id uuid,
  user_id uuid,
  tipo text,
  jornada int,
  dias int,
  rival text,
  code text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_hoy date := (now() at time zone 'America/El_Salvador')::date;
begin
  -- 1 · CONFIRMAR — reportada, todavía sin avisar y con plazo de sobra.
  --
  -- El `> v_hoy + p_dias_aviso` hace que esta rama y la de «última llamada»
  -- sean EXCLUYENTES. Sin él, una partida reportada mientras el cron estaba
  -- caído —o reportada ya sobre la fecha— dispara las dos en la misma corrida:
  -- dos avisos seguidos que dicen casi lo mismo, y el segundo le quita
  -- urgencia al primero en vez de dársela. Si ya es la última llamada, se
  -- manda solo esa, que es la que dice lo que hay que hacer y cuándo.
  return query
  with avisadas as (
    update public.liga_partidas m
       set aviso_en = now()
     where m.estado = 'reportada'
       and m.aviso_en is null
       and m.vence_el is not null
       and m.vence_el > v_hoy + p_dias_aviso
    returning m.id, m.liga_id, m.jornada, m.vence_el,
              m.local_plaza, m.visita_plaza, m.reportada_por
  )
  select a.id,
         i.user_id,
         'confirmar'::text,
         a.jornada,
         (a.vence_el - v_hoy)::int,
         (select o.nombre_visible from public.liga_plazas o where o.id = a.reportada_por),
         l.code
    from avisadas a
    join public.liga_plazas p
      -- Al que NO reportó: el que reportó ya sabe lo que pasó.
      on p.id = case when a.reportada_por = a.local_plaza
                     then a.visita_plaza else a.local_plaza end
    join public.liga_inscripciones i on i.id = p.inscripcion_id
    join public.ligas l on l.id = a.liga_id
   where i.user_id is not null;

  -- 2 · ÚLTIMA LLAMADA — reportada y el plazo encima.
  return query
  with ultimas as (
    update public.liga_partidas m
       -- `aviso_en` también, con coalesce: si esta partida nunca pasó por la
       -- rama 1 (cron caído, o reportada ya sobre la fecha), dejar la columna
       -- en null diría que no se avisó — y sí se avisó, con esta.
       set recordatorio_en = now(), aviso_en = coalesce(m.aviso_en, now())
     where m.estado = 'reportada'
       and m.recordatorio_en is null
       and m.vence_el is not null
       and m.vence_el >= v_hoy
       and m.vence_el <= v_hoy + p_dias_aviso
    returning m.id, m.liga_id, m.jornada, m.vence_el,
              m.local_plaza, m.visita_plaza, m.reportada_por
  )
  select u.id,
         i.user_id,
         'ultima'::text,
         u.jornada,
         (u.vence_el - v_hoy)::int,
         (select o.nombre_visible from public.liga_plazas o where o.id = u.reportada_por),
         l.code
    from ultimas u
    join public.liga_plazas p
      on p.id = case when u.reportada_por = u.local_plaza
                     then u.visita_plaza else u.local_plaza end
    join public.liga_inscripciones i on i.id = p.inscripcion_id
    join public.ligas l on l.id = u.liga_id
   where i.user_id is not null;

  -- 3 · JUGAR — nadie la jugó y la jornada se acaba. Se avisa a LOS DOS.
  return query
  with pendientes as (
    update public.liga_partidas m
       set recordatorio_en = now()
     where m.estado = 'programada'
       and m.recordatorio_en is null
       and m.vence_el is not null
       and m.vence_el >= v_hoy
       and m.vence_el <= v_hoy + p_dias_aviso
    returning m.id, m.liga_id, m.jornada, m.vence_el, m.local_plaza, m.visita_plaza
  )
  select d.id,
         i.user_id,
         'jugar'::text,
         d.jornada,
         (d.vence_el - v_hoy)::int,
         (select o.nombre_visible from public.liga_plazas o
           where o.id = case when p.id = d.local_plaza then d.visita_plaza else d.local_plaza end),
         l.code
    from pendientes d
    -- Las DOS sillas: acá no hay uno que sepa más que el otro.
    join public.liga_plazas p on p.id in (d.local_plaza, d.visita_plaza)
    join public.liga_inscripciones i on i.id = p.inscripcion_id
    join public.ligas l on l.id = d.liga_id
   where i.user_id is not null;
end;
$function$;

-- Solo el cron. Es la misma cerradura que `liga_vencidas()`: esta función
-- ESCRIBE (sella los avisos), así que dársela a `authenticated` sería dejar
-- que cualquiera queme los sellos de toda la liga con una llamada y nadie
-- reciba nada nunca.
revoke all on function public.liga_avisos(int) from anon, authenticated, public;
grant execute on function public.liga_avisos(int) to service_role;
