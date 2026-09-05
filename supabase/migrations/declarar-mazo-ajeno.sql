-- Que quien organiza pueda cargar el mazo de otro.
--
-- Nel: «que los que no hayan puesto su deck salgan que falta, para que lo
-- agreguen ellos o los administradores».
--
-- La policy `reg_update` deja tocar SOLO la fila propia, y eso esta bien: si
-- un jugador cualquiera pudiera escribir el mazo de otro, el dato dejaria de
-- valer. Pero en la mesa real media sala no abre la app hasta que empieza, y
-- el organizador necesita poder anotar «este juega Vader / Mos Eisley» sin
-- perseguir a nadie.
--
-- Por eso va por funcion con el guardia ADENTRO (§3i-bis) y no relajando la
-- policy: la regla queda en un solo lugar y no se le abre la puerta a nadie mas.
create or replace function public.declarar_mazo_de(
  p_evento uuid, p_persona uuid,
  p_leader_1 text default null, p_leader_2 text default null,
  p_base text default null, p_nombre text default null
)
returns boolean language plpgsql security definer set search_path to 'public'
as $$
declare v_n int;
begin
  if not exists (select 1 from public.official_events oe
                  where oe.id = p_evento and oe.organizer_id = auth.uid())
     and not public.puede_operar_torneo() then
    raise exception 'Solo quien organiza puede cargar el mazo de otra persona.';
  end if;

  update public.event_registrations
     set leader_1 = p_leader_1, leader_2 = p_leader_2,
         base_carta = p_base, deck_nombre = p_nombre
   where event_id = p_evento and user_id = p_persona;

  get diagnostics v_n = row_count;
  -- Cero filas no es exito: esa persona no esta inscrita en este torneo.
  if v_n = 0 then raise exception 'Esa persona no esta inscrita en este torneo.'; end if;
  return true;
end;
$$;

revoke all on function public.declarar_mazo_de(uuid, uuid, text, text, text, text) from public, anon;
grant execute on function public.declarar_mazo_de(uuid, uuid, text, text, text, text) to authenticated;
