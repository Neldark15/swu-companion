-- ═══════════════════════════════════════════════════════════════════════
--  MISIONES — el XP se suma en el servidor, y nacen las ÚNICAS
-- ═══════════════════════════════════════════════════════════════════════
--
--  ── 1. El XP tenía DOS casas y una le pisaba a la otra ────────────────
--
--  `claimMissionReward` leía el XP de la nube, sumaba y escribía de vuelta.
--  `syncStatsToCloud` hace un upsert de la fila ENTERA de `player_stats`
--  desde el Dexie local, así que el siguiente sincronizado del aparato
--  devolvía el XP al valor viejo. §3c otra vez: dos fuentes de una verdad.
--
--  Medido antes de tocar nada: `daily_missions_completed` se escribe en el
--  MISMO update que `xp`, y 8 de 11 personas con misiones cobradas tenían el
--  contador por debajo de sus cobros reales. Nelson: 7 cobradas, 2
--  registradas → 5 pagos perdidos. Y como la misión queda `claimed`, no se
--  podían reintentar.
--
--  `sumar_xp` hace `xp = xp + n` del lado del servidor. Un upsert no puede
--  pisar lo que no envía, y `statsToSnake` dejó de mandar `xp`, `level` y los
--  dos contadores de misión.
--
--  ── 2. El CHECK que habría hecho invisible a las únicas ───────────────
--
--  `user_missions_mission_type_check` solo aceptaba 'daily' y 'weekly'. El
--  insert de una única rebota con 23514 — y `updateMissionProgress` no
--  desestructura `error` (§2f), así que el fallo se vería EXACTAMENTE igual
--  que «esta misión todavía no avanza». La función entera se habría
--  construido, desplegado y quedado muerta sin un solo mensaje.
--
--  Es el mismo par del §3h-sexies: tocar el tipo en el cliente sin ampliar el
--  CHECK del servidor no falla al entrar, falla al escribir.
--
--  Las únicas usan `period_key = 'once'`. Con el único (user_id, mission_id,
--  period_key) eso las hace irrepetibles por construcción: no hace falta una
--  columna de «ya la hizo».
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- ── 1. El tipo 'unique' es legal ─────────────────────────────────────────
alter table public.user_missions
  drop constraint if exists user_missions_mission_type_check;

alter table public.user_missions
  add constraint user_missions_mission_type_check
  check (mission_type in ('daily', 'weekly', 'unique'));

-- ── 2. Sumar XP sin poder pisar ──────────────────────────────────────────
create or replace function public.sumar_xp(p_cantidad int, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_xp    int;
  v_nivel int := 1;
  v_resto int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Sin sesion.');
  end if;
  -- Tope de cordura: ninguna accion de la app da mas que esto de una vez.
  -- Sin el, un cliente manipulado se regala el ranking entero.
  if p_cantidad is null or p_cantidad <= 0 or p_cantidad > 500 then
    return jsonb_build_object('ok', false, 'error', 'Cantidad de XP invalida.');
  end if;

  update public.player_stats
     set xp = coalesce(xp, 0) + p_cantidad
   where user_id = v_uid
  returning xp into v_xp;

  if v_xp is null then
    return jsonb_build_object('ok', false, 'error', 'Sin ficha de jugador.');
  end if;

  -- El nivel se deriva del XP; guardarlo aparte seria otra copia que se separa.
  v_resto := v_xp;
  while v_resto >= v_nivel * 100 loop
    v_resto := v_resto - v_nivel * 100;
    v_nivel := v_nivel + 1;
  end loop;

  update public.player_stats set level = v_nivel where user_id = v_uid;

  return jsonb_build_object('ok', true, 'xp', v_xp, 'nivel', v_nivel,
                            'sumado', p_cantidad, 'motivo', p_motivo);
end;
$$;

-- ── 3. El contador de misiones, tambien incremental ──────────────────────
create or replace function public.contar_mision(p_tipo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Sin sesion.');
  end if;
  if p_tipo = 'daily' then
    update public.player_stats
       set daily_missions_completed = coalesce(daily_missions_completed, 0) + 1
     where user_id = v_uid;
  elsif p_tipo = 'weekly' then
    update public.player_stats
       set weekly_missions_completed = coalesce(weekly_missions_completed, 0) + 1
     where user_id = v_uid;
  end if;
  -- 'unique' no lleva contador propio: se cuenta sola por existir la fila.
  return jsonb_build_object('ok', true);
end;
$$;

-- ── 4. Permisos ──────────────────────────────────────────────────────────
-- §3i: Postgres concede EXECUTE a PUBLIC en toda funcion nueva, y `anon` es
-- miembro de PUBLIC. Un `revoke ... from anon` NO lo quita: hay que quitarselo
-- a PUBLIC. Las dos funciones se apoyan en auth.uid() y sin sesion no harian
-- nada, pero dejarlas abiertas invita a sondearlas.
revoke all on function public.sumar_xp(int, text) from public, anon;
revoke all on function public.contar_mision(text) from public, anon;
grant execute on function public.sumar_xp(int, text) to authenticated;
grant execute on function public.contar_mision(text) to authenticated;

commit;

-- ═══════════════════════════════════════════════════════════════════════
--  5. SIEMBRA de las hazañas desde lo que la gente YA hizo
-- ═══════════════════════════════════════════════════════════════════════
--
--  Una hazaña es un hito, no una tarea: «Armá tu primer mazo» describe algo
--  que 14 personas ya hicieron. Sin sembrar, esas 14 abrirían Misiones y
--  verían «Primer mazo 0/1» — y la hazaña solo se desbloquearía al armar
--  OTRO mazo. Eso no es una misión pendiente, es un contador que miente, y
--  un 0 con muestra grande siempre delata al que cuenta, no a la gente.
--
--  Medido antes de escribir: 101 filas, 30 personas, 62 hazañas ya
--  cumplidas, 5.295 XP al alcance y como mucho 905 para una sola persona.
--
--  Tres decisiones:
--
--  · SE SIEMBRA EL PROGRESO, NO EL COBRO. `claimed` queda en false a
--    propósito. Pagar 5.295 XP en silencio es repartir premios reales sin
--    que nadie los vea llegar; así cada quien lo reclama y ve su número.
--    (Consecuencia a la vista: al reclamar, `acreditarXp` también suma al
--    ranking MENSUAL, así que agosto recibe un bulto de XP viejo.)
--
--  · `u_play10` NO SE SIEMBRA. Las partidas del Contador viven en el Dexie
--    del aparato y la nube no las conoce. Sembrarlo con `matches_played` de
--    `player_stats` seria contar de una segunda fuente que ya se sabe que
--    diverge (§3c). Arranca en 0, que es lo unico que se puede afirmar.
--
--  · Las amistosas se cuentan por CREADOR, igual que el unico llamador vivo
--    (`amistosas.ts` acredita a `miId` al registrar). Contar los dos lados
--    daria un numero que la app no vuelve a producir nunca mas.
--
--  Idempotente por el unico (user_id, mission_id, period_key): correrla dos
--  veces no duplica ni pisa el progreso que la app haya escrito despues.
-- ═══════════════════════════════════════════════════════════════════════

with hechos as (
  select user_id,     'deck_created'::text        k, count(*)::int n from public.decks              group by 1
  union all select user_id,     'sobre_abierto',       count(*)::int from public.sobres_aperturas   group by 1
  union all select creador_id,  'amistosa_registrada', count(*)::int from public.duelos_amistosos
                                                                     where estado = 'confirmada'    group by 1
  union all select user_id,     'muro_publicado',      count(*)::int from public.community_posts    group by 1
  union all select user_id,     'card_favorited',      count(*)::int from public.favorite_cards     group by 1
  union all select autor_id,    'chat_enviado',        count(*)::int from public.galaxia_mensajes   group by 1
),
plantillas(mid, k, meta) as (values
  ('u_deck1','deck_created',1),              ('u_deck5','deck_created',5),
  ('u_sobre1','sobre_abierto',1),            ('u_sobre25','sobre_abierto',25),
  ('u_amistosa1','amistosa_registrada',1),   ('u_amistosa10','amistosa_registrada',10),
  ('u_muro1','muro_publicado',1),
  ('u_fav10','card_favorited',10),
  ('u_chat10','chat_enviado',10)
)
insert into public.user_missions
  (user_id, mission_id, period_key, mission_type, progress, completed, completed_at, claimed)
select h.user_id,
       t.mid,
       'once',
       'unique',
       least(h.n, t.meta),
       h.n >= t.meta,
       case when h.n >= t.meta then now() end,
       false
from hechos h
join plantillas t on t.k = h.k
-- Sin ficha de jugador `sumar_xp` devuelve «Sin ficha» y el cobro se
-- desharia solo: mejor no ofrecer una hazaña que no se puede cobrar.
join public.player_stats ps on ps.user_id = h.user_id
where h.user_id is not null and h.n > 0
on conflict (user_id, mission_id, period_key) do nothing;
