-- «Fijar clasificación» tiene que conocer la ESTRUCTURA del torneo.
--
-- ── Lo que hacía y por qué estaba mal ────────────────────────────────
--
-- Ordenaba por `points desc, match_wins desc, player_name asc`. Eso es
-- correcto en un suizo, donde los puntos SON la clasificación. En un torneo de
-- mesas no: ahí hay una MESA FINAL, y quien gana esa mesa es el campeón
-- aunque otro haya sumado más puntos en las rondas previas.
--
-- Medido contra el TWIN SUNS (SWUXF2W, 11 jugadores, 2 rondas), que es el
-- único torneo de mesas cerrado que existe:
--
--     puesto real   1 Jbeltramirez(5pts)  2 iNelo(5)  3 Viaud(4)  4 Nelson(3)
--     por puntos    los tres de 4 puntos —Vara, Lemaster89, Winnie— quedaban
--                   por ENCIMA de Nelson, que fue 4º en la mesa final
--
-- Y no es cosmético: `_repartir_premios` reparte por `coalesce(puesto, 32767)`
-- y la escala de sobres es por posición, así que un puesto mal fijado son
-- sobres y XP a la persona equivocada. En el torneo de agosto hubo que
-- corregir los once puestos a mano antes de cerrar.
--
-- ── La estructura, leída de los datos reales ─────────────────────────
--
-- La ronda final del TWIN SUNS quedó así, y los puestos que declaró el
-- organizador caen en un patrón exacto:
--
--     mesa 1  →  puestos 1, 2, 3, 4        LA FINAL, en bloque
--     los 1º de las otras mesas  →  5, 6
--     los 2º de las otras mesas  →  7, 8
--     los 3º de las otras mesas  →  9, 10
--     el 4º                      →  11
--
-- O sea DOS reglas:
--
--   1. LA MESA 1 DE LA ÚLTIMA RONDA ES LA FINAL y se lleva las primeras
--      posiciones en bloque, en su propio orden. Es como se armó: «el ganador
--      de cada mesa pasa a la final».
--   2. El resto va INTERLINEADO por el puesto que sacó DENTRO de su mesa:
--      ganar tu mesa vale más que quedar segundo en otra. Si no se
--      interlineara, el último de la mesa 2 quedaría por encima del ganador de
--      la mesa 3, que es justo lo contrario de lo que se jugó.
--
-- ── Lo que NO se pudo derivar, y por eso se dice ─────────────────────
--
-- El orden DENTRO de cada bloque (Vara antes que Lemaster89, isuraji antes
-- que Winnie) no lo explica ningún criterio: no es por mesa, ni por puntos, ni
-- por vida — se probaron los tres y cada uno falla en al menos un caso. Esos
-- los tecleó una persona con la hoja delante.
--
-- Acá se desempata por PUNTOS y después por VIDA, que es el criterio que el
-- propio torneo ya usa para elegir al «mejor segundo» que entra a la final.
-- Queda dicho porque es una elección, no un hallazgo: el organizador ve el
-- resultado y puede corregirlo antes de cerrar.
--
-- ── Lo que NO cambia ─────────────────────────────────────────────────
--
-- Suizo y eliminación siguen ordenando por puntos. Ahí los puntos sí son la
-- clasificación y tocarlo sería romper lo que funciona.

create or replace function public.fijar_puestos_finales(p_evento uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int; v_tipo text; v_sin int; v_mesas int; v_ronda uuid;
begin
  if not public.puede_operar_torneo() then
    return jsonb_build_object('ok', false, 'error', 'No tenes permiso para operar este torneo.');
  end if;

  select tournament_type into v_tipo from public.official_events where id = p_evento;
  if v_tipo is null then
    return jsonb_build_object('ok', false, 'error', 'El torneo no existe.');
  end if;

  if v_tipo <> 'mesas' then
    -- Suizo y eliminación: los puntos SON la clasificación.
    with orden as (
      select id, row_number() over (order by points desc, match_wins desc, player_name asc) as pos
        from public.tournament_standings
       where event_id = p_evento and coalesce(dropped, false) = false
    )
    update public.tournament_standings s set puesto = o.pos
      from orden o where o.id = s.id;
    get diagnostics v_n = row_count;
    return jsonb_build_object('ok', true, 'jugadores', v_n, 'criterio', 'puntos');
  end if;

  -- ── De acá para abajo, torneo de MESAS ──────────────────────────────

  select count(*), count(*) filter (where puesto is null)
    into v_mesas, v_sin
    from public.tournament_mesas where event_id = p_evento;

  if v_mesas = 0 then
    return jsonb_build_object('ok', false, 'error',
      'Todavia no hay mesas armadas: no hay de donde sacar la clasificacion.');
  end if;
  if v_sin > 0 then
    return jsonb_build_object('ok', false, 'error',
      format('Faltan %s puesto(s) por anotar. Sin eso la clasificacion saldria inventada.', v_sin));
  end if;

  -- La ÚLTIMA ronda es la que decide. Las anteriores ya se jugaron.
  select r.id into v_ronda
    from public.tournament_rounds r
   where r.event_id = p_evento
     and exists (select 1 from public.tournament_mesas m where m.round_id = r.id)
   order by r.round_number desc
   limit 1;

  if v_ronda is null then
    return jsonb_build_object('ok', false, 'error', 'No se encontro la ronda final.');
  end if;

  with asientos as (
    select
      coalesce(m.user_id::text, 'n:' || lower(trim(m.player_name))) as llave,
      m.mesa, m.puesto, m.vida
    from public.tournament_mesas m
    where m.round_id = v_ronda
  ),
  jugando as (
    select s.id, s.points,
           coalesce(s.user_id::text, 'n:' || lower(trim(s.player_name))) as llave,
           s.player_name
      from public.tournament_standings s
     where s.event_id = p_evento and coalesce(s.dropped, false) = false
  ),
  orden as (
    select j.id,
           row_number() over (
             order by
               -- Quien no se sentó en la ronda final va al fondo: no compitió
               -- por la clasificación, así que no puede colarse entre quienes sí.
               (a.llave is null),
               -- 1. LA FINAL EN BLOQUE. La mesa 1 de la última ronda se lleva
               --    las primeras posiciones, en su propio orden.
               (case when a.mesa = 1 then 0 else 1 end),
               (case when a.mesa = 1 then a.puesto else 0 end),
               -- 2. EL RESTO, INTERLINEADO: todos los 1º de mesa, después
               --    todos los 2º, y así. Ganar tu mesa vale más que quedar
               --    segundo en otra.
               a.puesto,
               -- 3. Desempate declarado: puntos, después vida. Es el mismo
               --    criterio con el que el torneo elige al «mejor segundo».
               j.points desc,
               a.vida desc nulls last,
               j.player_name
           ) as pos
      from jugando j
      left join asientos a on a.llave = j.llave
  )
  update public.tournament_standings s set puesto = o.pos
    from orden o where o.id = s.id;

  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'jugadores', v_n, 'criterio', 'mesa final');
end;
$$;
