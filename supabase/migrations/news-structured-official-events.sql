-- Noticias estructuradas: que un ítem pueda SER un evento oficial.
-- Aplicada en producción el 2026-07-31.
--
-- `news` era texto libre (título, resumen, etiqueta, enlace). Sirve para
-- anunciar cosas, pero no para responder "¿cuándo es el Galactic?" ni para
-- ordenar por fecha de evento, ni para saber si ya pasó.
--
-- Se extiende en vez de crear una tabla aparte porque el 90% es lo mismo
-- (título, resumen, enlace, imagen, fijado) y ya existían el servicio y el
-- editor en /news/manage. Los campos nuevos son OPCIONALES: un ítem con
-- `kind='news'` se comporta exactamente como antes.
--
-- `official_events` NO servía para esto: es el sistema de torneos organizados
-- DENTRO de la app (código de sala, rondas, emparejamientos). Estos son
-- eventos externos del programa de juego organizado.

alter table public.news
  add column if not exists kind text not null default 'news',
  add column if not exists event_type text,
  add column if not exists event_date timestamptz,
  add column if not exists event_location text,
  add column if not exists event_format text,
  add column if not exists registration_url text;

alter table public.news drop constraint if exists news_kind_check;
alter table public.news add constraint news_kind_check
  check (kind in ('news', 'event', 'release'));

-- La nomenclatura real del programa de juego organizado de SWU.
alter table public.news drop constraint if exists news_event_type_check;
alter table public.news add constraint news_event_type_check
  check (event_type is null or event_type in (
    'galactic',    -- Galactic Championship
    'planetary',   -- Planetary Qualifier
    'sector',      -- Sector Qualifier
    'regional',    -- Regional Qualifier
    'showdown',    -- Store Showdown
    'prerelease',  -- Prerelease
    'weekly',      -- Weekly Play
    'other'
  ));

-- Un evento tiene que tener fecha: sin ella no se puede ordenar ni decir si
-- ya pasó, que es la mitad de para qué sirve la sección.
alter table public.news drop constraint if exists news_event_needs_date;
alter table public.news add constraint news_event_needs_date
  check (kind <> 'event' or event_date is not null);

-- La agenda se consulta por fecha: "próximos eventos" es un rango.
create index if not exists idx_news_event_date
  on public.news (event_date) where kind = 'event' and published;

comment on column public.news.kind is
  'news = anuncio suelto · event = evento oficial con fecha · release = lanzamiento de expansión.';
comment on column public.news.event_type is
  'Nomenclatura del juego organizado: galactic, planetary, sector, regional, showdown, prerelease, weekly.';
