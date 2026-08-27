-- ═══ LIGA INTERNACIONAL — el esquema para 80-120+ personas ═══
--
-- Aplicada en producción el 2026-08-27. Las tres tablas de liga estaban en
-- CERO filas, así que no hubo backfill y la forma se rehízo limpia. Si alguna
-- vez hay datos, este archivo NO se puede repetir tal cual: los
-- `drop column local_insc / visita_insc` borrarían la llave de los pareos.
--
-- LA IDEA DE LA QUE CUELGA TODO: 120 personas todas contra todas son 7.140
-- partidas y 119 por jugador. En grupos de 8 son 420 en total y **7 por
-- jugador**, y ese 7 no cambia si la liga crece a 500. Los grupos no son una
-- forma de ordenar: son la única razón por la que esta liga puede existir.
--
-- El texto completo del diseño —con lo que se descartó y por qué— está en
-- `public/planes/liga-puente3.html`.

-- ─────────────────────────────────────────────────────────────────────
-- Debajo, TAL CUAL, el SQL que se aplicó
-- (migración 20260827144754_liga_internacional_esquema).

-- ═══ LIGA INTERNACIONAL — el esquema para 80-120+ personas ═══
--
-- Las tres tablas de liga estaban en CERO filas cuando se aplicó esto, así
-- que no hay backfill y la forma se rehace limpia. Si alguna vez hay datos,
-- este archivo NO se puede repetir tal cual.
--
-- La idea de la que cuelga todo: 120 personas todas contra todas son 7.140
-- partidas y 119 por jugador. En grupos de 8 son 420 en total y **7 por
-- jugador**, y ese 7 no cambia si la liga crece a 500.

-- ── LA PUERTA: por ahora la ve una sola persona ──────────────────────
--
-- Mismo patrón que `sable_probadores` (§4c): allowlist explícita, y el
-- guardia vive DENTRO de cada RPC, no solo en la pantalla. Y a propósito NO
-- hay escotilla de admin — un admin que pueda darse la llave vuelve la
-- restricción decorativa (§3i-bis). Se reparte insertando la fila.
create table if not exists public.liga_probadores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  creado_en timestamptz not null default now()
);
alter table public.liga_probadores enable row level security;
revoke all on public.liga_probadores from anon, authenticated;

create or replace function public.liga_visible()
returns boolean language sql stable security definer set search_path to 'public'
as $$ select exists (select 1 from public.liga_probadores where user_id = auth.uid()) $$;
revoke all on function public.liga_visible() from anon, public;
grant execute on function public.liga_visible() to authenticated;

insert into public.liga_probadores (user_id)
values ('4a7167d2-ffef-4607-8426-d3cfbcfa4c2d')          -- Nelson
on conflict do nothing;


-- ── FASE 0 · quitar lo que hace imposible una liga de 120 ────────────
alter table public.ligas drop constraint if exists ligas_cupo_check;
alter table public.ligas alter column cupo drop not null;
alter table public.ligas
  add column if not exists publica boolean not null default false,
  add column if not exists tamano_grupo int not null default 8;
do $$ begin
  alter table public.ligas add constraint ligas_tamano_grupo_check
    check (tamano_grupo between 4 and 12);
exception when duplicate_object then null; end $$;


-- ── EL CARNÉ: una fila por persona y liga, para siempre ──────────────
alter table public.liga_inscripciones
  add column if not exists estado text not null default 'activo',
  add column if not exists tier text not null default 'comun',
  add column if not exists consiente_perfil boolean not null default false,
  add column if not exists abandonos int not null default 0,
  add column if not exists temporadas_jugadas int not null default 0;
do $$ begin
  alter table public.liga_inscripciones add constraint liga_insc_estado_check
    check (estado in ('activo','pausa','retirado','vetado'));
  alter table public.liga_inscripciones add constraint liga_insc_tier_check
    check (tier in ('comun','infrecuente','raro','legendario'));
exception when duplicate_object then null; end $$;


-- ── TEMPORADA · GRUPO · PLAZA ────────────────────────────────────────
create table if not exists public.liga_temporadas (
  id uuid primary key default gen_random_uuid(),
  liga_id uuid not null references public.ligas(id) on delete cascade,
  numero int not null,
  nombre text not null,
  estado text not null default 'inscripcion'
         check (estado in ('inscripcion','en_curso','cerrada')),
  arranca date not null,
  cierra  date not null,
  -- La semilla se PUBLICA: el barajado se hace con md5(semilla || plaza_id),
  -- que es puro, estable entre versiones de Postgres y comprobable por
  -- cualquiera con una calculadora de md5. `setseed()+random()` depende del
  -- PRNG de la versión mayor, y Supabase las actualiza.
  semilla text not null default encode(gen_random_bytes(8), 'hex'),
  creada_en timestamptz not null default now(),
  cerrada_en timestamptz,
  unique (liga_id, numero),
  check (cierra > arranca)
);
create unique index if not exists liga_una_temporada_viva
  on public.liga_temporadas (liga_id) where estado <> 'cerrada';

create table if not exists public.liga_grupos (
  id uuid primary key default gen_random_uuid(),
  temporada_id uuid not null references public.liga_temporadas(id) on delete cascade,
  tier text not null check (tier in ('comun','infrecuente','raro','legendario')),
  -- SIN techo: un check de 1..4 sería el `cupo between 4 and 24` otra vez.
  orden int not null check (orden >= 1),
  tamano int not null check (tamano between 4 and 12),
  estado text not null default 'armado' check (estado in ('armado','en_curso','cerrado')),
  -- RELOJ PROPIO: un grupo que arranca en la semana 6 no molesta a nadie.
  arranca date not null,
  cierra  date not null,
  sembrado_en timestamptz,
  unique (temporada_id, tier, orden)
);

-- LA IDENTIDAD DENTRO DE LA COMPETENCIA (§3q). No es la cuenta: la cuenta es
-- el PERMISO. `inscripcion_id` puede apuntar a un carné sin `user_id` — así
-- entra un invitado sin que el motor invente byes ni empates.
create table if not exists public.liga_plazas (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.liga_grupos(id) on delete cascade,
  inscripcion_id uuid not null references public.liga_inscripciones(id) on delete restrict,
  nombre_visible text not null,
  lider_card_id text,
  base_card_id  text,
  deck_id text references public.decks(id) on delete set null,   -- decks.id es TEXT (§3a)
  estado text not null default 'activa' check (estado in ('activa','abandonada','anulada')),
  sentada_en timestamptz not null default now(),
  unique (grupo_id, inscripcion_id)
);

-- ── DISPONIBILIDAD · tabla APARTE, nunca columna del carné ───────────
-- `liga_inscripciones` tiene `grant select` a nivel de TABLA, y un grant así
-- cubre todas las columnas presentes y FUTURAS (§2j). Meter la agenda ahí la
-- publica a toda cuenta logueada.
create table if not exists public.liga_disponibilidad (
  insc_id uuid primary key references public.liga_inscripciones(id) on delete cascade,
  liga_id uuid not null references public.ligas(id) on delete cascade,
  -- IANA. Se valida DENTRO de la RPC: un CHECK no puede llevar subconsulta.
  zona text not null,
  -- 7 días x 24 h en HORA LOCAL DE PARED. Una máscara semanal recurrente no
  -- tiene representación UTC estable: SV↔España pasa de 6 a 4 horas en común
  -- solo por el horario de verano español. Viaja como TEXT y el cast a bit
  -- vive en la RPC: Postgres rellena y trunca en silencio al castear a bit(n).
  franjas text not null check (franjas ~ '^[01]{168}$'),
  nota text check (length(nota) <= 140),
  declarada_en timestamptz not null default now(),
  -- Vacío NO es «siempre»: sin fila es SIN DECLARAR.
  check (franjas <> repeat('0', 168))
);

create table if not exists public.liga_staff (
  liga_id uuid not null references public.ligas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rol text not null check (rol in ('organizador','arbitro')),
  grupo_id uuid references public.liga_grupos(id) on delete cascade,
  primary key (liga_id, user_id)
);

-- Rastro PÚBLICO de cada corrección. `audit_logs` es de admin; acá la
-- comunidad tiene que poder ver que a una partida la tocó una persona y por qué.
create table if not exists public.liga_correcciones (
  id uuid primary key default gen_random_uuid(),
  liga_id uuid not null references public.ligas(id) on delete cascade,
  partida_id uuid not null references public.liga_partidas(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  antes jsonb not null,
  despues jsonb not null,
  motivo text not null check (btrim(motivo) <> ''),
  creado_en timestamptz not null default now()
);


-- ── LAS PARTIDAS: cuelgan del GRUPO y apuntan a PLAZAS ───────────────
alter table public.liga_partidas
  add column if not exists grupo_id uuid references public.liga_grupos(id) on delete cascade,
  add column if not exists local_plaza  uuid references public.liga_plazas(id) on delete cascade,
  add column if not exists visita_plaza uuid references public.liga_plazas(id) on delete cascade,
  add column if not exists reportada_por  uuid references public.liga_plazas(id),
  add column if not exists confirmada_por uuid references public.liga_plazas(id),
  add column if not exists reportada_en timestamptz,
  add column if not exists confirmada_en timestamptz,
  add column if not exists origen text,
  add column if not exists vence_el date,
  add column if not exists aviso_en timestamptz,
  add column if not exists recordatorio_en timestamptz,
  add column if not exists disputa_motivo text,
  add column if not exists resuelta_por uuid references auth.users(id),
  add column if not exists motivo text,
  -- NO EXISTÍA. Una RPC copiada de `confirmar_amistosa` revienta con 42703 en
  -- la PRIMERA confirmación.
  add column if not exists updated_at timestamptz not null default now();

-- Las columnas viejas se van: dos llaves de jugador para la misma pregunta es
-- la forma exacta del bug del 8/8 (§3q). Sin filas, no hay backfill.
alter table public.liga_partidas drop column if exists local_insc;
alter table public.liga_partidas drop column if exists visita_insc;
alter table public.liga_partidas
  alter column local_plaza set not null,
  alter column visita_plaza set not null,
  alter column grupo_id set not null;

alter table public.liga_partidas drop constraint if exists liga_partidas_estado_check;
alter table public.liga_partidas drop constraint if exists liga_partidas_check;
alter table public.liga_partidas add constraint liga_partidas_estado_check check (estado in (
  'programada','reportada','confirmada','disputada','vencida',
  'wo_local','wo_visita','anulada'));
alter table public.liga_partidas add constraint liga_plazas_distintas
  check (local_plaza <> visita_plaza);
alter table public.liga_partidas add constraint liga_origen_check
  check (origen is null or origen in ('acuerdo','silencio','laudo'));

-- Tres orígenes, y sin esto el árbitro NO PUEDE resolver una vencida.
alter table public.liga_partidas add constraint liga_confirmacion_coherente check (
  estado <> 'confirmada' or (
     (origen = 'acuerdo'  and confirmada_por is not null and confirmada_por <> reportada_por)
  or (origen = 'silencio' and reportada_por is not null)
  or (origen = 'laudo'    and resuelta_por is not null)));

-- Un encuentro por par: mata el doble reporte Y la doble siembra de un saque.
create unique index if not exists liga_un_encuentro_por_par on public.liga_partidas
  (grupo_id, least(local_plaza, visita_plaza), greatest(local_plaza, visita_plaza));
create index if not exists liga_partidas_pendientes on public.liga_partidas (liga_id, estado)
  where estado in ('programada','reportada','vencida','disputada');


-- ── GRANTS: revocar ANTES de conceder (§2j). Cero escritura directa ──
revoke all on public.liga_temporadas, public.liga_grupos, public.liga_plazas,
              public.liga_disponibilidad, public.liga_staff, public.liga_correcciones
  from anon, authenticated;

alter table public.liga_temporadas     enable row level security;
alter table public.liga_grupos         enable row level security;
alter table public.liga_plazas         enable row level security;
alter table public.liga_disponibilidad enable row level security;
alter table public.liga_staff          enable row level security;
alter table public.liga_correcciones   enable row level security;

grant select on public.liga_temporadas, public.liga_grupos, public.liga_correcciones
  to authenticated;
grant select (id, grupo_id, inscripcion_id, nombre_visible, lider_card_id,
              base_card_id, estado, sentada_en)
  on public.liga_plazas to authenticated;
-- liga_disponibilidad y liga_staff: SIN grant de select. Solo por RPC.

-- Mientras dure el demo cerrado, TODO se lee por la misma puerta.
drop policy if exists liga_temporadas_ver on public.liga_temporadas;
create policy liga_temporadas_ver on public.liga_temporadas
  for select to authenticated using (public.liga_visible());
drop policy if exists liga_grupos_ver on public.liga_grupos;
create policy liga_grupos_ver on public.liga_grupos
  for select to authenticated using (public.liga_visible());
drop policy if exists liga_plazas_ver on public.liga_plazas;
create policy liga_plazas_ver on public.liga_plazas
  for select to authenticated using (public.liga_visible());
drop policy if exists liga_correcciones_ver on public.liga_correcciones;
create policy liga_correcciones_ver on public.liga_correcciones
  for select to authenticated using (public.liga_visible());

-- Y las cuatro de antes pasan a la misma puerta, o la liga se ve a medias.
drop policy if exists ligas_ver on public.ligas;
create policy ligas_ver on public.ligas
  for select to authenticated using (public.puede_ver_creadores() or public.liga_visible());
drop policy if exists liga_insc_ver on public.liga_inscripciones;
create policy liga_insc_ver on public.liga_inscripciones
  for select to authenticated using (public.puede_ver_creadores() or public.liga_visible());
drop policy if exists liga_partidas_ver on public.liga_partidas;
create policy liga_partidas_ver on public.liga_partidas
  for select to authenticated using (public.puede_ver_creadores() or public.liga_visible());
