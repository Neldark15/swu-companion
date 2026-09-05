-- Las mesas, en vivo.
--
-- La rifa de mesas se guarda en `tournament_mesas`, pero esa tabla NO estaba
-- en la publicacion de tiempo real: quien estuviera mirando el lobby no se
-- enteraba de que le habia tocado mesa hasta recargar. Para una rifa que se
-- mira en grupo —que es EL momento del torneo— eso la mata.
--
-- La tabla ya es de lectura publica (`mesas_public_select`), asi que
-- publicarla no expone nada nuevo: viaja lo mismo que cualquiera puede pedir.
--
-- REPLICA IDENTITY FULL porque «Volver a repartir» BORRA las mesas y las
-- vuelve a crear. Sin esto el payload de un DELETE trae solo la llave
-- primaria, el filtro `event_id=eq.X` del cliente no puede evaluarse, y la
-- pantalla se quedaria mostrando la rifa vieja al lado de la nueva.
alter table public.tournament_mesas replica identity full;

do $pub$
begin
  if not exists (select 1 from pg_publication_rel pr
                  join pg_class c on c.oid = pr.prrelid
                  join pg_publication p on p.oid = pr.prpubid
                 where p.pubname = 'supabase_realtime' and c.relname = 'tournament_mesas') then
    alter publication supabase_realtime add table public.tournament_mesas;
  end if;
end $pub$;
