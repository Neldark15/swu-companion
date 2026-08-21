-- CALENDARIO DE EVENTOS. Aplicado 2026-08-21.
--
-- ── No hay tabla nueva, y es lo importante ───────────────────────────
--
-- El calendario es una VISTA sobre `official_events`, que ya tenía fecha, sede
-- (`venue_id`), formato, estado y organizador. Una tabla propia habría sido un
-- segundo sitio donde existe «el torneo del sábado», y en cuanto alguien editara
-- uno de los dos la comunidad tendría dos respuestas a la misma pregunta. Es
-- literalmente la historia de §3c: 14 tablas de posiciones que no se hablaban.
--
-- Lo único que faltaba: `official_events.image_url` (el afiche) y que las sedes
-- existieran.
--
-- ── Se cayó `unique(owner_id)` de venues ─────────────────────────────
--
-- Modelaba «cada admin registra LA SUYA»: una tienda, su dueño. Lo que hace
-- falta es una lista curada de sedes mantenida entre los admins. Con la regla
-- puesta, las dos sedes habrían tenido que colgar de dos personas distintas
-- elegidas al azar — una mentira sobre quién las administra.
--
-- Sin riesgo: `venues` estaba en CERO filas. `SedesPage` ya listaba todas; las
-- dos pantallas que asumían una sola son de admin.
--
-- Ojo: `venues.accent` NO es un hex. Un CHECK solo acepta
-- cyan/amber/green/red/purple, el vocabulario de tonos del HUD.
--
-- ── Y `anon` pasó a ver los eventos que VIENEN ───────────────────────
--
-- Estaba asimétrico: `authenticated` leía todo y `anon` solo los `finished`.
-- Medido en el navegador: agosto salía con los sábados 8 y 15 y SIN los del 22
-- y 29. Un calendario público que solo enseña el pasado no sirve para lo único
-- que sirve un calendario, que es invitar.
--
-- El `code` queda expuesto, y no es un problema: conocerlo no da acceso a nada
-- —inscribirse exige sesión y `event_registrations` es `auth.uid() = user_id`—,
-- /torneos/:code ya era pública, y la policy vieja ya exponía el code de todos
-- los terminados.

alter table official_events add column if not exists image_url text;

alter table venues drop constraint if exists venues_owner_id_key;
create index if not exists venues_owner_id_idx on venues (owner_id);
create unique index if not exists venues_nombre_key on venues (lower(trim(name)));

drop policy if exists events_public_finished on official_events;
create policy events_publicos on official_events for select to anon using (true);

-- Las dos sedes y los sábados: ver las migraciones
-- `calendario_sedes_y_foto_de_evento` y `calendario_sembrar_sabados`.
-- `sembrar_sabados(n)` es idempotente por `code` y solo la puede llamar
-- service_role; cada fila que crea se edita después por separado.
