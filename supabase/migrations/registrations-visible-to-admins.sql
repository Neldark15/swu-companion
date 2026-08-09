-- Los admins ven las inscripciones de CUALQUIER evento
--
-- La política era `user_id = auth.uid() OR organizer_id = auth.uid()`: sin
-- rama de admin. Medido sobre el evento de Sonsonate, que tiene 4 inscritos:
--
--   Rodorigo (admin Y organizador) → ve 4
--   Nelson   (admin, no organizador) → ve 0
--
-- `initializeTournament()` lee esta tabla DESDE EL CLIENTE para armar la
-- clasificación, y corta con «Se necesitan al menos 2 jugadores registrados».
-- O sea: cualquier admin que no fuera el creador del evento NO PODÍA arrancar
-- el torneo — y el mensaje culpaba a los inscritos, no al permiso. Peor que
-- fallar: con inscritos parcialmente visibles habría armado un torneo al que
-- le faltan jugadores, sin avisar a nadie.
--
-- En esta comunidad los organizadores SON los administradores, y no por
-- costumbre: crear un evento ya exige admin (`events_insert`), y las rondas,
-- los emparejamientos y la clasificación también. La lectura tiene que seguir
-- la misma regla que el resto de las capas.
--
-- El jugador normal NO gana visibilidad: sigue viendo solo la suya.
-- Comprobado tras aplicar: Nelson 4, Naun2000 1.

drop policy if exists reg_select on public.event_registrations;

create policy reg_select on public.event_registrations
for select using (
  user_id = auth.uid()
  or exists (select 1 from public.official_events oe
              where oe.id = event_registrations.event_id
                and oe.organizer_id = auth.uid())
  or exists (select 1 from public.profiles p
              where p.id = auth.uid() and p.role = 'admin')
);
