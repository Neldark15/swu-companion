-- La vida de cada jugador en su mesa, llevada en vivo.
--
-- Nel: «si es necesario para sacar el mejor segundo, crea el contador de vida
-- para llevarlo en vivo, y que definas el que mas vida tiene cuando se
-- terminen las rondas. En cada mesa los jugadores podran colocar juntos los
-- daños».
--
-- POR QUE RESUELVE EL PROBLEMA DEL MEJOR SEGUNDO. Todos los segundos sacan los
-- MISMOS puntos en su mesa, asi que elegir al que pasa a la final pedia un
-- desempate inventado (el tamaño de la mesa, la siembra). Con la vida anotada
-- deja de ser una regla de escritorio: pasa el que quedo mas entero, que es un
-- hecho de la partida.
--
-- SE GUARDA LA VIDA, NO EL DAÑO. Las bases tienen HP distinto —30, 28, 27— asi
-- que comparar daño recibido premiaria a quien eligio la base mas grande. La
-- pregunta es «quien quedo con mas vida», y esa se guarda directo: un numero,
-- sin depender de que la persona haya declarado su base.
alter table public.tournament_mesas
  add column if not exists vida smallint;

comment on column public.tournament_mesas.vida is
  'Vida que le quedo a esa persona. NULL = todavia no se anoto.';

-- Lo anota QUIEN ESTA SENTADO EN ESA MISMA MESA —se lleva entre todos, en un
-- telefono— o quien organiza. No cualquiera: la vida decide quien pasa a la
-- final, asi que alguien de otra mesa no puede tocarla.
create or replace function public.anotar_vida(p_asiento uuid, p_vida int)
returns boolean language plpgsql security definer set search_path to 'public'
as $$
declare v_ronda uuid; v_mesa smallint; v_n int;
begin
  select round_id, mesa into v_ronda, v_mesa
    from public.tournament_mesas where id = p_asiento;
  if v_ronda is null then raise exception 'Ese asiento no existe.'; end if;

  if not public.puede_operar_torneo()
     and not exists (select 1 from public.tournament_mesas m
                      where m.round_id = v_ronda and m.mesa = v_mesa
                        and m.user_id = auth.uid()) then
    raise exception 'Solo quien juega en esa mesa puede anotar la vida.';
  end if;

  -- Un negativo no es una vida: es un error de dedo. Se corta en 0.
  update public.tournament_mesas
     set vida = greatest(0, least(p_vida, 99))
   where id = p_asiento;

  get diagnostics v_n = row_count;
  return v_n = 1;
end;
$$;

revoke all on function public.anotar_vida(uuid, int) from public, anon;
grant execute on function public.anotar_vida(uuid, int) to authenticated;
