-- ═══════════════════════════════════════════════════════════════════════
-- ENCUESTAS DE LA COMUNIDAD
--
-- ── LA TENSIÓN QUE DECIDE TODO EL DISEÑO ───────────────────────────────
--
-- Se prometió que es anónima —es lo único que hace honesta la pregunta del
-- precio, que es el motivo de la encuesta— pero hay que saber QUIÉN ya
-- contestó para dejar de insistirle. Las dos cosas no caben en una tabla.
--
-- Por eso son DOS, y no se pueden unir:
--   · encuesta_contestada  → el HECHO, con user_id, sin una sola respuesta.
--   · encuesta_respuestas  → el CONTENIDO, SIN user_id.
--
-- Así el anonimato es ESTRUCTURAL y no una promesa: ni un admin, ni el dueño
-- del proyecto, ni nadie con la llave de servicio puede saber quién dijo qué.
--
-- Dos detalles que parecen menores y son los que sostienen eso:
--   · `enviada_el` es una FECHA, no un instante. Con 25 respuestas, un sello
--     de milisegundos se cruza con `contestada_en` de la otra tabla y
--     desanonimiza a todo el mundo de un JOIN.
--   · `encuesta_resultados` ordena por `md5(id)`. Un orden de inserción es un
--     orden de llegada, y con esta muestra eso reconstruye quién contestó
--     cuándo.
--
-- ── A QUIÉN LE TOCA LO DECIDE EL SERVIDOR ──────────────────────────────
--
-- `encuestas.pais` implementa el «solo a los de El Salvador». No es un filtro
-- del cliente: `encuesta_pendiente()` cruza las tres condiciones —abierta y en
-- ventana, el país coincide, no la contestaste— y devuelve cero filas si no te
-- toca. Filtrar en el cliente sería poner la regla del lado de afuera de la
-- puerta: bastaría con abrir la consola del navegador.
--
-- ── PROBADO CON RLS DE VERDAD, Y REVERTIDO ─────────────────────────────
--
-- Nueve de nueve, con `set local role authenticated` (poner solo el JWT no
-- aplica RLS): a un salvadoreño le toca · a España NO le toca · España no
-- puede contestar aunque lo intente · el salvadoreño contesta · ya no se le
-- repregunta · el doble envío rebota · un no-admin no ve los resultados ·
-- nadie puede leer la tabla de respuestas directo · y no existe ninguna
-- columna que una una respuesta con una persona.
-- ═══════════════════════════════════════════════════════════════════════

-- (Aplicada el 2026-08-21. El cuerpo completo es el de esta migración; se
-- deja acá para que el esquema viva en el repo y no solo en la base.)

create table if not exists public.encuestas (
  id          uuid primary key default gen_random_uuid(),
  clave       text not null unique,
  titulo      text not null,
  descripcion text,
  pais        text,                     -- null = a todos; 'SV' = solo El Salvador
  abre        date not null default current_date,
  cierra      date,
  activa      boolean not null default true,
  creada_en   timestamptz not null default now(),
  constraint encuesta_ventana check (cierra is null or cierra >= abre)
);

create table if not exists public.encuesta_contestada (
  encuesta_id     uuid not null references public.encuestas(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  contestada_en   timestamptz not null default now(),
  ayuda_organizar boolean not null default false,
  contacto        text,
  primary key (encuesta_id, user_id),
  constraint contacto_corto check (contacto is null or length(contacto) <= 120)
);

create table if not exists public.encuesta_respuestas (
  id          uuid primary key default gen_random_uuid(),
  encuesta_id uuid not null references public.encuestas(id) on delete cascade,
  respuestas  jsonb not null,
  enviada_el  date not null default current_date,
  constraint respuestas_es_objeto check (jsonb_typeof(respuestas) = 'object'),
  constraint respuestas_acotadas  check (length(respuestas::text) <= 8000)
);

create index if not exists ix_encuesta_respuestas_enc on public.encuesta_respuestas (encuesta_id);

alter table public.encuestas            enable row level security;
alter table public.encuesta_contestada  enable row level security;
alter table public.encuesta_respuestas  enable row level security;

-- §2j: Supabase concede ALL por defecto en toda tabla nueva de `public`.
-- Conceder no basta: hay que REVOCAR primero.
revoke all on public.encuestas           from anon, authenticated;
revoke all on public.encuesta_contestada from anon, authenticated;
revoke all on public.encuesta_respuestas from anon, authenticated;

-- `encuesta_respuestas` NO se concede a NADIE: se escribe y se lee solo por
-- funciones SECURITY DEFINER. Si el cliente pudiera leerla, el anonimato
-- duraría lo que tarde alguien en abrir la consola del navegador.
grant select on public.encuestas to anon, authenticated;
grant select on public.encuesta_contestada to authenticated;

create policy encuestas_select on public.encuestas for select using (activa);
create policy contestada_propia on public.encuesta_contestada
  for select using (user_id = auth.uid());

-- Funciones: encuesta_pendiente() · responder_encuesta() ·
--            encuesta_resultados() · encuesta_avance()
-- §3i: Postgres concede EXECUTE a PUBLIC en toda función nueva y `anon` es
-- miembro de PUBLIC, así que en las cuatro va `revoke ... from public` antes
-- del grant. Quitárselo solo a `anon` NO lo quita.
