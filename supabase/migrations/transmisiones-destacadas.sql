-- TRANSMISIONES DESTACADAS: los directos de fuera que vale la pena mirar.
--
-- `/envivo` ya existía para NUESTRAS partidas (cámara → OBS → YouTube). Esto es
-- lo otro: un directo ajeno —el de Fantasy Flight, por ejemplo— con su hora, su
-- cuenta atrás y su aviso. Son dos cosas distintas en la misma pantalla y por
-- eso van en tablas distintas: el marcador en vivo de un torneo nuestro no
-- tiene nada que ver con la hora de un estreno de FFG.
--
-- ES PÚBLICA para LEER, igual que /envivo: un espectador no se loguea para
-- mirar. Y NADIE escribe por policy — las carga el service role (el cron y yo).
-- Un cliente que pudiera insertar acá podría anunciarle a la comunidad
-- cualquier video con el nombre de Fantasy Flight encima.

create table if not exists public.transmisiones (
  id          text primary key,
  titulo      text not null,
  canal       text not null,
  -- Id de YouTube o URL completa: el cliente ya sabe normalizar las dos formas.
  youtube     text not null,
  empieza_en  timestamptz not null,
  -- Para saber cuándo dejar de anunciarla como «en vivo». Estimado, no exacto:
  -- YouTube no dice cuánto va a durar y esperar a que termine de verdad pediría
  -- una llamada a su API por cada visita.
  dura_min    int not null default 150,
  activa      boolean not null default true,
  -- Sellos de aviso: existen para que el cron sea IDEMPOTENTE. Sin ellos, cada
  -- corrida volvería a avisar y la gente recibiría el mismo push cada 5 minutos.
  aviso_previo_en timestamptz,
  aviso_inicio_en timestamptz,
  creada_en   timestamptz not null default now()
);

create index if not exists transmisiones_cuando on public.transmisiones (empieza_en desc)
  where activa;

-- §2j: Supabase concede ALL por defecto en toda tabla nueva de `public`.
revoke all on public.transmisiones from anon, authenticated;
grant select on public.transmisiones to anon, authenticated;

alter table public.transmisiones enable row level security;

drop policy if exists transmisiones_leer on public.transmisiones;
-- Cualquiera lee las ACTIVAS. Apagar una es la forma de retirarla sin borrar su
-- historia (y sin que el cron la vuelva a mirar).
create policy transmisiones_leer on public.transmisiones
  for select to anon, authenticated using (activa);

-- La primera: el «Meta Check-In» de Fantasy Flight. Los datos NO se supusieron:
-- salieron de leer la propia página de YouTube (`meta[itemprop="startDate"]` y
-- `scheduledStartTime`). El id lleva la fecha para que el próximo directo sea
-- una fila nueva y no una edición de esta.
insert into public.transmisiones (id, titulo, canal, youtube, empieza_en, dura_min)
values (
  'ffg-meta-check-in-2026-08-24',
  'Star Wars: Unlimited – Meta Check-In',
  'Fantasy Flight Games',
  'qE7uswmnYTg',
  '2026-08-24T18:00:00Z',   -- 12:00 del mediodía en El Salvador (UTC-6)
  120
)
on conflict (id) do update
  set titulo = excluded.titulo, canal = excluded.canal,
      youtube = excluded.youtube, empieza_en = excluded.empieza_en,
      dura_min = excluded.dura_min, activa = true;

-- ── Para cargar la siguiente ──
-- insert into public.transmisiones (id, titulo, canal, youtube, empieza_en, dura_min)
-- values ('ffg-lo-que-sea-2026-09-01', 'Título', 'Fantasy Flight Games',
--         '<id de youtube>', '2026-09-01T18:00:00Z', 120);
