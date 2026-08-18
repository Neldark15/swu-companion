-- ─────────────────────────────────────────────────────────────────────
-- Chat de La Galaxia — salas por alcance
--
-- Depende de: profiles, venues.
-- Estado: pendiente de aplicar.
--
-- El chat vive en UNA tabla, no en cuatro. La sala es una CLAVE derivada del
-- alcance y su valor: 'global', 'continente:americas', 'pais:SV',
-- 'tienda:<uuid>'. Con cuatro tablas, «los últimos mensajes de mi país»
-- necesitaría un UNION y un índice por tabla, y agregar un quinto nivel
-- (departamento, por ejemplo) sería una migración; así es una fila más.
--
-- La sala se calcula en la BASE y no en el cliente. Si el cliente eligiera su
-- sala, cualquiera podría escribir en `pais:CO` diciendo ser de Colombia. Acá
-- la sala se compara contra el perfil de quien escribe.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.galaxia_mensajes (
  id          uuid primary key default gen_random_uuid(),
  autor_id    uuid not null references public.profiles(id) on delete cascade,

  -- El alcance y su valor, separados: filtrar «todo lo de tienda» es un
  -- `= 'tienda'`, y no un LIKE sobre una cadena compuesta.
  alcance     text not null check (alcance in ('global','continente','pais','tienda')),
  -- NULO solo para 'global', que es la única sala sin valor.
  ambito      text,

  cuerpo      text not null check (length(btrim(cuerpo)) between 1 and 1000),
  creado_en   timestamptz not null default now(),
  -- Borrado suave: un mensaje que desaparece de la nada rompe el hilo de la
  -- conversación para quien lo estaba leyendo. Se marca y se pinta «eliminado».
  borrado_en  timestamptz,
  borrado_por uuid references public.profiles(id) on delete set null,

  constraint ambito_coherente check (
    (alcance = 'global' and ambito is null)
    or (alcance <> 'global' and ambito is not null and length(ambito) between 2 and 64)
  )
);

-- El orden natural de un chat: la sala, y dentro lo más nuevo primero.
create index if not exists idx_galaxia_sala
  on public.galaxia_mensajes (alcance, ambito, creado_en desc);
-- Para el contador de no leídos, que pregunta «cuántos después de tal fecha».
create index if not exists idx_galaxia_creado
  on public.galaxia_mensajes (creado_en desc);

-- ── Quién pertenece a qué sala ──────────────────────────────────────
--
-- Una sola función, usada por las políticas de lectura Y de escritura, para
-- que no puedan separarse: si algún día se pudiera leer una sala sin poder
-- escribirla, eso sería una decisión explícita, no un descuido.
create or replace function public.galaxia_pertenece(
  p_alcance text, p_ambito text, p_uid uuid
) returns boolean
language sql stable security definer set search_path = public as $$
  select case p_alcance
    when 'global' then true
    when 'pais' then exists (
      select 1 from profiles p where p.id = p_uid and p.settings->>'country' = p_ambito)
    when 'continente' then exists (
      select 1 from profiles p where p.id = p_uid and p.settings->>'continent' = p_ambito)
    -- La tienda es la única sala con puerta: se pertenece por haber jugado un
    -- torneo ahí. Sin esto, «tienda» sería un chat global con otro nombre.
    when 'tienda' then exists (
      select 1
        from tournament_standings ts
        join official_events e on e.id = ts.event_id
       where ts.user_id = p_uid and e.venue_id::text = p_ambito)
    else false
  end
$$;

alter table public.galaxia_mensajes enable row level security;

-- Leer: hay que pertenecer a la sala.
create policy "Se lee la sala a la que se pertenece"
  on public.galaxia_mensajes for select to authenticated
  using (public.galaxia_pertenece(alcance, ambito, auth.uid()));

-- Escribir: además, en nombre propio.
create policy "Se escribe en la sala propia y como uno mismo"
  on public.galaxia_mensajes for insert to authenticated
  with check (
    autor_id = auth.uid()
    and public.galaxia_pertenece(alcance, ambito, auth.uid())
  );

-- Borrar es MARCAR, no eliminar: por eso es un UPDATE acotado.
-- Cada quien lo suyo; un admin, cualquiera (moderación).
create policy "Se retira lo propio, o lo que sea si sos admin"
  on public.galaxia_mensajes for update to authenticated
  using (
    autor_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    autor_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- §2j: un grant de tabla cubre TODA columna, presente y futura. Lista explícita.
revoke all on public.galaxia_mensajes from anon, authenticated;
grant select (id, autor_id, alcance, ambito, cuerpo, creado_en, borrado_en, borrado_por)
  on public.galaxia_mensajes to authenticated;
-- `creado_en` NO se concede: nadie fija su propia fecha para saltar al tope.
grant insert (autor_id, alcance, ambito, cuerpo)
  on public.galaxia_mensajes to authenticated;
-- Editar el cuerpo NO se concede: un mensaje ya leído no se reescribe.
grant update (borrado_en, borrado_por)
  on public.galaxia_mensajes to authenticated;
-- anon: nada. El chat es de la comunidad, no de la internet abierta.

-- ── Marca de lectura, para los no leídos ────────────────────────────
create table if not exists public.galaxia_lecturas (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  alcance   text not null,
  ambito    text not null default '',   -- '' y no NULL: entra en la clave primaria
  leido_en  timestamptz not null default now(),
  -- Silenciar por sala. Sin esto, la primera persona ruidosa hace que la gente
  -- apague TODOS los avisos de la app, no solo los del chat.
  silenciada boolean not null default false,
  primary key (user_id, alcance, ambito)
);

alter table public.galaxia_lecturas enable row level security;
create policy "Cada quien su marca de lectura"
  on public.galaxia_lecturas for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.galaxia_lecturas from anon, authenticated;
grant select (user_id, alcance, ambito, leido_en, silenciada) on public.galaxia_lecturas to authenticated;
grant insert (user_id, alcance, ambito, leido_en, silenciada) on public.galaxia_lecturas to authenticated;
grant update (leido_en, silenciada) on public.galaxia_lecturas to authenticated;
grant delete on public.galaxia_lecturas to authenticated;

-- Realtime: el chat sin esto es un botón de refrescar.
alter publication supabase_realtime add table public.galaxia_mensajes;
