-- ═══════════════════════════════════════════════════════════════════
-- Meta nacional: ingesta de clasificaciones finales de melee.gg
-- ═══════════════════════════════════════════════════════════════════
--
-- Hoy el perfil muestra el historial de UNA persona (api/melee-profile.ts).
-- Esto es lo otro: guardar la clasificación FINAL de torneos enteros para
-- poder decir qué se está jugando. Sin una tabla propia no hay agregado
-- posible — cada consulta sería un viaje a melee, y melee pide 5 s entre
-- petición y petición.
--
-- ── Por qué el prefijo `meta_` ────────────────────────────────────────
--
-- Ya existe `melee_tournaments`, que es OTRA COSA: el registro manual que
-- cada usuario carga de sus propios torneos. Reusarla mezclaría un dato que
-- la persona escribió con uno que bajamos de un tercero, y no habría forma
-- de distinguirlos después. Todo lo de acá va con `meta_` y no toca nada de
-- lo existente.
--
-- ── Por qué existe `meta_fetch_lease` (la decisión menos obvia) ───────
--
-- Vercel empaqueta CADA archivo de api/ como una lambda separada, con su
-- PROPIO estado de módulo. `api/melee-profile.ts` ya lleva su `ultimaDescarga`
-- en memoria para respetar el `Crawl-Delay: 5` de melee. Una segunda función
-- con su propio reloj no sabría nada de la primera: cada una esperaría sus
-- 5 s y ENTRE LAS DOS le pegaríamos a melee cada 2,5 s. Estaríamos
-- incumpliendo el crawl-delay sin que ningún archivo, leído solo, se vea mal.
--
-- Peor todavía: la doc de Vercel advierte que una misma invocación puede
-- ejecutarse dos veces, y el escalado horizontal levanta N instancias con N
-- relojes en cero.
--
-- La base es lo ÚNICO compartido entre todas esas lambdas. Por eso el turno
-- se pide con `meta_tomar_turno()`, que es un `update ... returning` de una
-- sola sentencia (atómico por definición) sobre una fila única: cada llamador
-- se lleva un instante distinto, separado 5 s del anterior, y espera hasta
-- ese instante antes de descargar. No hay dos descargas simultáneas ni aunque
-- corran en máquinas distintas.
--
-- El corolario es fácil de dejar a medias, así que queda escrito: el turno solo
-- sirve si lo toman TODOS los que le pegan a melee. Mientras `melee-profile.ts`
-- conserve su reloj en memoria y no llame a `meta_tomar_turno()`, esta tabla
-- coordina a una sola de las dos lambdas y el problema que la justifica —una
-- descarga cada 2,5 s— sigue ocurriendo exactamente igual. Un turno que la
-- mitad de los descargadores ignora no es un turno.
--
-- ── Por qué la PK de `meta_standings` incluye `round_id` ──────────────
--
-- Medido contra melee: `Rank` es único POR RONDA, no por torneo. El mismo
-- torneo tiene un puesto 1 en la Ronda 3, otro en la Ronda 11 y otro en
-- Finals. Una PK `(torneo, rank)` haría que guardar dos rondas del mismo
-- torneo pisara filas en silencio, y la clasificación quedaría siendo una
-- mezcla de dos momentos distintos — que es exactamente el dato que arruina
-- un agregado sin dar error.
--
-- Con `round_id` en la clave, cada ronda es un conjunto completo y coherente.
-- Cuál de todas es LA clasificación que cuenta lo dice
-- `meta_tournaments.final_round_id`, y no se deduce del id: los `roundId` de
-- melee NO son monotónicos (medido: Round 11 = 1420227 > Finals = 1419188).
-- Tampoco se deduce del nombre: los torneos locales terminan en «Round 3», no
-- en «Finals». Se resuelve al descargar, con (PhaseSortOrder, RoundNumber), y
-- se deja escrito acá para no volver a adivinarlo en cada consulta.
--
-- ── Por qué el arquetipo NO es una columna ────────────────────────────
--
-- Hubo tres columnas para esto —`leader_card_id`, `base_card_id` y
-- `archetype_confidence`— y se quitaron antes de aplicar nada: el ingestor las
-- escribía SIEMPRE en null y ninguna consulta las leía. Una columna que existe
-- y siempre miente es peor que no tenerla, porque promete un dato que no hay y
-- el que abre la tabla asume que el arquetipo ya está resuelto acá.
--
-- Lo que se guarda es `decklist_name`, el nombre CRUDO tal como lo manda melee.
-- El líder y la base los parsea el cliente al mostrar. Así, cuando el parser
-- mejora, mejora el histórico entero sin re-ingerir nada; materializado habría
-- quedado congelado el criterio del día en que se bajó cada torneo, y un
-- arquetipo mal parseado ensucia el agregado para siempre.
--
-- Muchas filas ni siquiera traen mazo (en un torneo local de 8, los 8 sin
-- lista): eso es `decklist_name` en null, y el agregado las cuenta aparte como
-- «sin lista» en vez de inventarles un arquetipo.
--
-- ── Por qué los grants van explícitos ─────────────────────────────────
--
-- Supabase trae `alter default privileges` que concede TODO sobre cada tabla
-- nueva de `public` a `anon` y a `authenticated`. O sea: si solo se crea la
-- tabla y se prende RLS, el permiso de INSERT/UPDATE/DELETE está concedido y
-- lo único que frena una escritura es la política. Es la misma trampa del
-- GOTCHA 2j de CLAUDE.md. Acá se revoca todo primero y se concede SELECT a
-- mano, tabla por tabla.
--
-- ── El «meta nacional» son dos ámbitos, y no se mezclan ───────────────
--
-- 1. «Acá»          — torneos con `is_local = true`. Cuenta la sala ENTERA.
-- 2. «Los nuestros» — filas cuyo `player_name` coincide con el
--                     `melee_username` de un perfil enlazado, en CUALQUIER
--                     torneo. Solo esas filas.
--
-- Dos salvadoreños metidos en un Galactic Open de 1022 no convierten a esos
-- 1022 en el meta nacional. Los índices de abajo están puestos para que las
-- dos consultas se puedan hacer por separado y ninguna tiente a juntarlas.

-- ── Tablas ───────────────────────────────────────────────────────────

-- Un torneo de melee que nos interesa.
create table if not exists public.meta_tournaments (
  melee_tournament_id  text primary key,
  name                 text not null,
  organizer            text,
  date                 timestamptz,
  player_count         integer,
  format               text,
  status               text,
  -- Se deriva de meta_sv_organizers al ingerir. Se guarda materializado
  -- porque es el filtro de la vista «Acá» y no queremos un join en cada
  -- consulta del meta.
  is_local             boolean not null default false,
  final_round_id       text,
  standings_fetched_at timestamptz,
  discovered_from      uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.meta_tournaments is
  'Torneos de melee.gg cuya clasificación final guardamos. Distinta de melee_tournaments, que es el registro manual de cada usuario.';
comment on column public.meta_tournaments.melee_tournament_id is
  'El torneoId de melee, tal cual, como texto. Es la clave natural: si melee lo repite, es el mismo torneo.';
comment on column public.meta_tournaments.status is
  'El estado tal cual lo manda melee (''Ended'', etc.). No se normaliza: si cambian sus valores, prefiero verlo crudo antes que perderlo en una traducción.';
comment on column public.meta_tournaments.is_local is
  'El organizador está en meta_sv_organizers. Es lo que define el ámbito «Acá»: la sala entera cuenta como meta nacional.';
comment on column public.meta_tournaments.final_round_id is
  'La ronda que ES la clasificación final. Se resuelve al descargar con (PhaseSortOrder, RoundNumber): los roundId de melee NO son monotónicos y los torneos locales terminan en «Round 3», no en «Finals».';
comment on column public.meta_tournaments.player_count is
  'Cuántos jugaron. Sin esto el puesto miente: un 399 de 1022 es mejor que media sala y un 3 de 4 no es nada.';
comment on column public.meta_tournaments.standings_fetched_at is
  'Cuándo se bajó la clasificación. Null = el torneo se conoce pero todavía no se ingirió.';
comment on column public.meta_tournaments.discovered_from is
  'Qué perfil nos hizo enterarnos del torneo (salió de su historial de melee). Informativo; si se borra el perfil, el torneo se queda.';

-- Una fila de la clasificación. Rank es único POR RONDA, no por torneo.
create table if not exists public.meta_standings (
  melee_tournament_id  text not null
    references public.meta_tournaments(melee_tournament_id) on delete cascade,
  round_id             text not null,
  rank                 integer not null,
  player_name          text not null,
  player_melee_id      text,
  record               text,
  wins                 integer,
  losses               integer,
  draws                integer,
  decklist_name        text,
  decklist_id          text,
  created_at           timestamptz not null default now(),
  primary key (melee_tournament_id, round_id, rank)
);

comment on table public.meta_standings is
  'Filas de clasificación bajadas de melee. La PK lleva round_id porque Rank es único por RONDA: sin él, dos rondas del mismo torneo se pisarían en silencio.';
comment on column public.meta_standings.round_id is
  'La ronda de la que salió esta fila. La que cuenta como clasificación final es meta_tournaments.final_round_id.';
comment on column public.meta_standings.rank is
  'Puesto dentro de la ronda. Melee desempata hasta TeamId, así que no hay empates. NO ordenar por Points: en playoffs el campeón puede tener menos.';
comment on column public.meta_standings.player_name is
  'El DisplayName de melee, tal cual. Contra esto se cruza profiles.melee_username para el ámbito «Los nuestros».';
comment on column public.meta_standings.decklist_name is
  'El nombre del mazo tal cual lo manda melee, sin normalizar. De acá sale el arquetipo, pero el parseo vive en el cliente: guardar líder y base ya resueltos congelaría el criterio del día de la ingesta. Null = jugó sin lista publicada, y se cuenta como «sin lista».';
comment on column public.meta_standings.decklist_id is
  'Solo para ENLAZAR. El robots.txt de melee prohíbe /Decklist/View/ y /Decklist/Index/: la lista no se descarga.';

-- Cola de ingesta. La clave natural ES la idempotencia.
create table if not exists public.meta_ingest_queue (
  melee_tournament_id text primary key,
  status      text not null default 'pendiente'
              check (status in ('pendiente','en_curso','listo','fallido','descartado')),
  intentos    smallint not null default 0,
  claimed_at  timestamptz,
  last_error  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.meta_ingest_queue is
  'Qué torneos faltan bajar. El id de melee es la PK, así que encolar dos veces el mismo torneo es un no-op: la idempotencia sale de la clave natural, no de chequear antes.';
comment on column public.meta_ingest_queue.intentos is
  'Cuántas veces se RECLAMÓ (se incrementa al reclamar, no al fallar). El corte vive en un solo lugar: la barrida de meta_reclamar_lote() manda a ''fallido'' lo que llegó a 5. El worker NO debe llevar su propio tope: dos políticas en dos idiomas se desincronizan. Si una lambda devuelve la fila a la cola sin haber gastado el intento, tiene que restarlo.';
comment on column public.meta_ingest_queue.claimed_at is
  'Cuándo lo tomó una lambda. Si sigue ''en_curso'' 15 min después, se da por muerta y se vuelve a reclamar.';
comment on column public.meta_ingest_queue.last_error is
  'Último error, en texto. Es lo único que se ve cuando algo queda en ''fallido''.';

-- Qué organizadores son de El Salvador. Lo cura un admin.
create table if not exists public.meta_sv_organizers (
  organizer  text primary key,
  note       text,
  added_by   uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.meta_sv_organizers is
  'Lista curada a mano de organizadores salvadoreños. Es lo que decide is_local. No se adivina por nombre: melee no publica país del torneo.';
comment on column public.meta_sv_organizers.organizer is
  'El nombre del organizador tal cual lo manda melee. Si melee lo escribe distinto, es otra fila: preferible eso a un match difuso que meta torneos ajenos al meta nacional.';

-- Turno GLOBAL de descarga contra melee. Fila única.
create table if not exists public.meta_fetch_lease (
  id            smallint primary key default 1 check (id = 1),
  next_allowed  timestamptz not null default now()
);

comment on table public.meta_fetch_lease is
  'El turno compartido para pegarle a melee. Existe porque cada archivo de api/ es una lambda con su propio estado de módulo: dos relojes en memoria = una descarga cada 2,5 s en vez de cada 5, incumpliendo el Crawl-Delay: 5. La base es lo único compartido.';
comment on column public.meta_fetch_lease.id is
  'Siempre 1. El check lo obliga: dos filas serían dos turnos y el turno tiene que ser uno solo.';
comment on column public.meta_fetch_lease.next_allowed is
  'A partir de cuándo se puede volver a descargar. Lo mueven dos funciones y ninguna más: meta_tomar_turno() lo empuja 5 s hacia adelante y meta_devolver_turno() lo trae de vuelta cuando el turno tomado no se usó.';

-- La fila tiene que existir desde ya: meta_tomar_turno() actualiza, no inserta.
-- Sin ella devolvería null y el llamador descargaría sin esperar.
insert into public.meta_fetch_lease (id, next_allowed)
values (1, now())
on conflict (id) do nothing;

-- ── Índices ──────────────────────────────────────────────────────────

-- «Acá»: los torneos locales, del más nuevo al más viejo. Parcial porque los
-- locales son un puñado entre cientos de torneos del mundo, y un índice que
-- solo indexa lo que se consulta entra en caché entero.
create index if not exists idx_meta_tournaments_locales
  on public.meta_tournaments (date desc nulls last)
  where is_local;

-- Listado general por fecha (el meta global, «últimos 3 meses», etc.).
create index if not exists idx_meta_tournaments_fecha
  on public.meta_tournaments (date desc nulls last);

-- Cuando un admin marca un organizador nuevo como salvadoreño hay que
-- recalcular is_local de todos sus torneos. Sin esto es un scan completo.
create index if not exists idx_meta_tournaments_organizador
  on public.meta_tournaments (organizer);

-- Falta bajar la clasificación de este torneo.
create index if not exists idx_meta_tournaments_sin_bajar
  on public.meta_tournaments (date desc nulls last)
  where standings_fetched_at is null;

-- NO hay índice de arquetipo. Existió uno, `idx_meta_standings_lider`, sobre
-- (leader_card_id, base_card_id): se fue junto con esas columnas. Indexar algo
-- que siempre vale null es pagar escritura en cada insert para nunca leerlo.
-- El conteo por líder se arma en el cliente sobre `decklist_name`.

-- «Los nuestros»: cruce contra profiles.melee_username, SIN distinguir
-- mayúsculas. Melee devuelve el DisplayName con el capitalizado que cada uno
-- eligió, que casi nunca es idéntico a lo que la persona tipeó en su perfil,
-- así que la comparación case-sensitive no es una opción.
--
-- Tampoco hay un índice plano sobre `player_name`: existió y se quitó porque
-- ninguna consulta compara ese nombre respetando mayúsculas, y un índice que
-- nadie usa igual se mantiene en cada insert de una ingesta de miles de filas.
--
-- OJO con el que SÍ queda: sirve para `lower(player_name) = <valor>`. El
-- servicio hoy pre-filtra con `ilike` sin comodines, y `ilike` NO puede usar un
-- btree —ni éste ni uno plano—, así que hoy ese cruce es un scan. El índice
-- está puesto para la forma correcta de la consulta; el día que el cruce pase a
-- igualdad en minúsculas (una RPC, por ejemplo), pasa a usarse sin migrar nada.
create index if not exists idx_meta_standings_jugador_min
  on public.meta_standings (lower(player_name));

-- La cola: qué hay para reclamar, lo más viejo primero.
create index if not exists idx_meta_ingest_pendientes
  on public.meta_ingest_queue (created_at)
  where status in ('pendiente', 'en_curso');

-- ── Un usuario de melee pertenece a UNA sola cuenta ──────────────────
--
-- Esto no es una optimización, es la integridad de la que depende el ámbito
-- «Los nuestros». Hasta acá no había NINGUNA restricción de unicidad sobre
-- `profiles.melee_username` (verificado sobre la base): cualquiera podía
-- escribir el usuario de otro y, desde ese momento, los resultados de ese otro
-- entraban al meta nacional como si fueran suyos. El cruce es por nombre, así
-- que reclamar el nombre es reclamar el historial.
--
-- Va en minúsculas por el mismo motivo que el índice de arriba: melee no
-- distingue mayúsculas al identificar a una persona, y si acá sí distinguiera,
-- «Nel15» y «nel15» serían dos filas y la restricción no restringiría nada.
--
-- Verificado antes de escribir esto: 1 perfil enlazado, 0 duplicados. El índice
-- construye sin conflicto. Si alguna vez fallara al aplicarse, es que hay dos
-- perfiles peleándose un usuario y hay que resolver ESO, no aflojar el índice.
--
-- NO se exige `melee_verified` para contar en el meta: hoy hay 0 verificados
-- (la verificación la pone un admin a mano) y exigirla dejaría el módulo vacío.
-- La unicidad es lo que impide el robo; la insignia es lo que la vista muestra.
--
-- Efecto en el cliente: enlazar un usuario ya tomado ahora falla con 23505 en
-- vez de pisar el enlace ajeno. Quien llame a ese update tiene que traducir ese
-- código a «ese usuario de melee ya está enlazado a otra cuenta».
create unique index if not exists ux_profiles_melee_username
  on public.profiles (lower(melee_username))
  where melee_username is not null;

-- ── updated_at que de verdad se actualiza ────────────────────────────
--
-- Un `default now()` solo se aplica al insertar. Sin esto, updated_at sería
-- para siempre igual a created_at: un campo que miente es peor que no tenerlo.
--
-- Sobre el `set search_path = ''` que llevan ésta y las tres funciones de más
-- abajo: va VACÍO, no `= public`. Con `public` en el camino, un esquema que
-- alguien logre crear antes en la resolución puede sombrear una función o un
-- operador y quedarse ejecutando dentro de una función `security definer`. Con
-- el camino vacío no se busca en ningún esquema del usuario, así que cada
-- referencia a algo nuestro va calificada con `public.` — si falta una, la
-- función revienta al crearse o al primer uso, que es justo el momento en que
-- uno quiere enterarse. Lo de pg_catalog (now(), least, greatest, los tipos,
-- los operadores) sigue resolviendo solo: Postgres lo busca implícitamente
-- primero SIEMPRE, y eso es precisamente lo que ya no se puede sombrear.

create or replace function public.meta_marcar_actualizado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_meta_tournaments_actualizado on public.meta_tournaments;
create trigger trg_meta_tournaments_actualizado
  before update on public.meta_tournaments
  for each row execute function public.meta_marcar_actualizado();

drop trigger if exists trg_meta_ingest_queue_actualizado on public.meta_ingest_queue;
create trigger trg_meta_ingest_queue_actualizado
  before update on public.meta_ingest_queue
  for each row execute function public.meta_marcar_actualizado();

-- ── RLS ──────────────────────────────────────────────────────────────

alter table public.meta_tournaments   enable row level security;
alter table public.meta_standings     enable row level security;
alter table public.meta_sv_organizers enable row level security;
alter table public.meta_ingest_queue  enable row level security;
alter table public.meta_fetch_lease   enable row level security;

-- Lo que se puede leer: solo con sesión. Son datos públicos de melee, pero el
-- valor de haberlos juntado es de la comunidad; que no se los lleve cualquiera
-- con la anon key que va en el bundle.

drop policy if exists "meta_torneos_lectura" on public.meta_tournaments;
create policy "meta_torneos_lectura" on public.meta_tournaments
  for select to authenticated using (true);

drop policy if exists "meta_clasificacion_lectura" on public.meta_standings;
create policy "meta_clasificacion_lectura" on public.meta_standings
  for select to authenticated using (true);

drop policy if exists "meta_organizadores_lectura" on public.meta_sv_organizers;
create policy "meta_organizadores_lectura" on public.meta_sv_organizers
  for select to authenticated using (true);

-- `meta_ingest_queue` y `meta_fetch_lease` quedan con RLS activa y CERO
-- políticas a propósito. Sin política no pasa nadie; el único que entra es
-- `service_role`, que salta RLS por atributo del rol. No es un olvido: si
-- alguien agrega una política acá, está abriendo la cola de trabajo y el
-- turno de descarga al cliente.

-- ── Grants ───────────────────────────────────────────────────────────
--
-- Se revoca TODO antes de conceder. Supabase concede todos los privilegios
-- sobre cada tabla nueva de `public` a `anon` y `authenticated` por default
-- privileges: sin este revoke, el INSERT/UPDATE/DELETE estaría concedido y lo
-- único que lo frenaría serían las políticas de arriba. Un grant de tabla
-- cubre todas las columnas, presentes y futuras (GOTCHA 2j).

revoke all on table public.meta_tournaments   from anon, authenticated;
revoke all on table public.meta_standings     from anon, authenticated;
revoke all on table public.meta_sv_organizers from anon, authenticated;
revoke all on table public.meta_ingest_queue  from anon, authenticated;
revoke all on table public.meta_fetch_lease   from anon, authenticated;

-- Solo lectura, y solo con sesión. Ninguna de estas tablas tiene columnas
-- sensibles, así que alcanza el grant a nivel de tabla.
grant select on table public.meta_tournaments   to authenticated;
grant select on table public.meta_standings     to authenticated;
grant select on table public.meta_sv_organizers to authenticated;

-- El worker escribe con service_role, que ya salta RLS. Se conceden igual de
-- forma explícita para no depender de los default privileges del proyecto.
grant select, insert, update, delete on table public.meta_tournaments   to service_role;
grant select, insert, update, delete on table public.meta_standings     to service_role;
grant select, insert, update, delete on table public.meta_sv_organizers to service_role;
grant select, insert, update, delete on table public.meta_ingest_queue  to service_role;
grant select, update                on table public.meta_fetch_lease    to service_role;

-- ── RPC: reclamar un lote de la cola ─────────────────────────────────
--
-- Las TRES funciones de abajo se cierran igual que las tablas, y por el mismo
-- motivo: Supabase también tiene default privileges que conceden EXECUTE
-- sobre cada función nueva a `anon` y `authenticated`. Con `revoke ... from
-- public` NO alcanza —eso quita el permiso implícito, no el concedido a esos
-- roles por nombre—, así que van revocados explícitamente. Si alguna queda
-- abierta, cualquiera con la anon key del bundle puede vaciarle la cola al
-- worker, correr el turno de descarga hacia adelante y dejarnos sin ingesta
-- sin que se caiga nada, o tirar el turno para atrás en un bucle y usarnos de
-- ariete contra melee.

create or replace function public.meta_reclamar_lote(cuantos int)
returns setof public.meta_ingest_queue
language plpgsql
security definer
set search_path = ''
as $$
declare
  lote int := least(greatest(coalesce(cuantos, 0), 0), 50);
begin
  -- ── LA política de reintentos. La única. ──
  --
  -- Lo que ya se intentó de más deja de ser cola y pasa a ser un problema
  -- visible. Sin este corte, un torneo que melee nunca va a devolver bien se
  -- reclama para siempre y se come el turno de descarga de los que sí sirven.
  --
  -- El corte vive ACÁ y en ningún otro lado. El worker no lleva su propio tope:
  -- dos políticas —una en SQL y otra en TypeScript— se desincronizan a la
  -- primera vez que alguien toca un número, y entonces nadie sabe cuál manda.
  -- Y como `intentos` se incrementa al RECLAMAR (unas líneas más abajo), el que
  -- devuelve una fila a la cola sin haberla llegado a procesar tiene que restar
  -- ese incremento: si no, un corte por falta de tiempo gasta reintentos que
  -- nunca le pegaron a melee y termina marcando 'fallido' un torneo sano.
  --
  -- El `where` es el MISMO predicado que el del reclamo de abajo, a propósito:
  -- se falla exactamente lo que volvería a reclamarse. Una fila 'en_curso'
  -- todavía viva (reclamada hace menos de 15 min) no se toca aunque llegue a 5,
  -- porque hay una lambda trabajándola en este momento y su resultado —bueno o
  -- malo— es el que tiene que quedar escrito.
  --
  -- Para reintentar a mano un torneo ya fallido:
  --   update public.meta_ingest_queue
  --      set status = 'pendiente', intentos = 0, last_error = null
  --    where melee_tournament_id = '...';
  update public.meta_ingest_queue q
     set status = 'fallido',
         last_error = coalesce(q.last_error, 'se agotaron los intentos')
   where q.intentos >= 5
     and (q.status = 'pendiente'
          or (q.status = 'en_curso'
              and q.claimed_at is not null
              and q.claimed_at < now() - interval '15 minutes'));

  -- El reclamo en sí. `for update skip locked` es lo que hace que dos
  -- invocaciones simultáneas —la doble ejecución que la doc de Vercel avisa
  -- que puede pasar, más el escalado horizontal— se lleven lotes DISTINTOS en
  -- vez de pelearse por las mismas filas o bloquearse una a la otra.
  return query
  with elegidos as (
    select q.melee_tournament_id
      from public.meta_ingest_queue q
     where q.status = 'pendiente'
        -- Una lambda que murió a mitad deja la fila en 'en_curso' para
        -- siempre. Pasados 15 min se da por muerta. Reingerir es seguro: las
        -- dos tablas se escriben por clave natural.
        or (q.status = 'en_curso'
            and q.claimed_at is not null
            and q.claimed_at < now() - interval '15 minutes')
     order by q.created_at
     limit lote
     for update skip locked
  ),
  tomados as (
    update public.meta_ingest_queue q
       set status     = 'en_curso',
           intentos   = q.intentos + 1,
           claimed_at = now()
      from elegidos e
     where q.melee_tournament_id = e.melee_tournament_id
    returning q.*
  )
  select * from tomados;
end;
$$;

comment on function public.meta_reclamar_lote(int) is
  'Reclama hasta `cuantos` torneos (tope 50) de la cola, atómicamente. Recupera lo que quedó ''en_curso'' más de 15 min y manda a ''fallido'' lo reclamable que llegó a 5 intentos: ése es el ÚNICO corte de reintentos del sistema, el worker no debe tener otro. Solo service_role.';

revoke all on function public.meta_reclamar_lote(int) from public;
revoke all on function public.meta_reclamar_lote(int) from anon, authenticated;
grant execute on function public.meta_reclamar_lote(int) to service_role;

-- ── RPC: tomar el turno de descarga ──────────────────────────────────
--
-- Una sola sentencia, y por eso es correcta: el `update` toma el lock de la
-- fila y nadie más puede leer un next_allowed viejo entremedio. Cada llamador
-- se lleva el turno anterior y deja el próximo 5 s más adelante.
--
-- `greatest(now(), next_allowed)` es lo que evita que la cola se hunda en el
-- pasado: si nadie descargó en una hora, el próximo turno es AHORA, no la
-- suma de todas las esperas que nadie usó.
--
-- El llamador tiene que esperar hasta el instante devuelto ANTES de descargar.
-- Devolverlo en vez de dormir acá es a propósito: dormir dentro de la base
-- retiene una conexión del pool por cada descarga.

create or replace function public.meta_tomar_turno()
returns timestamptz
language sql
security definer
set search_path = ''
as $$
  update public.meta_fetch_lease
     set next_allowed = greatest(now(), next_allowed) + interval '5 seconds'
   where id = 1
  returning next_allowed - interval '5 seconds';
$$;

comment on function public.meta_tomar_turno() is
  'Toma el turno GLOBAL de descarga contra melee y devuelve a partir de cuándo se puede descargar. El llamador espera hasta ese instante. Es el reemplazo compartido del reloj en memoria de api/melee-profile.ts. El que toma un turno y no lo usa tiene que devolverlo con meta_devolver_turno(). Solo service_role.';

revoke all on function public.meta_tomar_turno() from public;
revoke all on function public.meta_tomar_turno() from anon, authenticated;
grant execute on function public.meta_tomar_turno() to service_role;

-- ── RPC: devolver el turno que no se usó ─────────────────────────────
--
-- Tomar el turno es un efecto secundario: mueve `next_allowed` 5 s hacia
-- adelante ANTES de saber si de verdad se va a descargar. El llamador que mira
-- el instante que le tocó, ve que está demasiado lejos y decide no esperar,
-- deja el reloj corrido igual. Con dos o tres lambdas haciendo eso, cada
-- abandono empuja el turno 5 s más, cada nuevo llamador lo ve todavía más lejos
-- y abandona también: el turno se aleja solo, se realimenta, y se llega al
-- estado absurdo de que NADIE descarga nunca aunque melee esté ocioso. Un
-- semáforo que se pone en rojo cuando nadie pasa.
--
-- Por eso el abandono se declara. `least` es lo único que hace falta: mueve el
-- reloj para atrás únicamente si el turno devuelto es más temprano que el que
-- ya está anotado. Si mientras tanto otro tomó un turno posterior, el suyo
-- manda y esta llamada no hace nada.
--
-- El piso en `now()` es la garantía de que esto solo puede DEVOLVER un turno,
-- nunca regalar permiso retroactivo: por más pasado que venga `cuando`, el
-- reloj no baja de este instante y el Crawl-Delay: 5 sigue en pie. Y un
-- `cuando` nulo no reinicia nada — `coalesce` lo manda a 'infinity' y el
-- `least` lo ignora—, porque un argumento perdido no puede abrir la canilla.

create or replace function public.meta_devolver_turno(cuando timestamptz)
returns timestamptz
language sql
security definer
set search_path = ''
as $$
  update public.meta_fetch_lease
     set next_allowed = least(
           next_allowed,
           greatest(coalesce(cuando, 'infinity'::timestamptz), now())
         )
   where id = 1
  returning next_allowed;
$$;

comment on function public.meta_devolver_turno(timestamptz) is
  'Devuelve un turno de descarga que se tomó y no se usó, para que el próximo no tenga que esperar de gusto. Solo mueve next_allowed hacia atrás (least) y nunca antes de now(): no puede saltearse el Crawl-Delay: 5. Sin esto, cada abandono corre el turno +5 s y se realimenta hasta que nadie descarga nunca. Solo service_role.';

revoke all on function public.meta_devolver_turno(timestamptz) from public;
revoke all on function public.meta_devolver_turno(timestamptz) from anon, authenticated;
grant execute on function public.meta_devolver_turno(timestamptz) to service_role;
