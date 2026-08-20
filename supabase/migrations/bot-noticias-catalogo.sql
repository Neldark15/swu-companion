-- EL BOT DE NOTICIAS: su contabilidad. Aplicada 2026-08-20.
--
-- El bot compara el catálogo de api.swuapi.com contra una foto propia y deja un
-- BORRADOR en `news` cuando aparecen cartas que nunca había visto.
--
-- ── Por qué la clave es (nombre|subtítulo) y no el uuid ──────────────
--
-- El uuid identifica una IMPRESIÓN, no una carta: son 9.185 filas para 2.189
-- cartas. Medido sobre el export de hoy, 6.996 filas son variantes (2.095
-- Hyperspace, 1.850 Hyperspace Foil, 1.368 Standard Foil, 253 serializadas…) y
-- promos de torneo. Sin filtrar por `variantType='Standard'`, el día que
-- entraron 838 variantes de cartas ya conocidas el bot habría publicado 838
-- «cartas nuevas» falsas.
--
-- ── Y por qué NO se usa ?since= del API ──────────────────────────────
--
-- Medido: `?since=ayer` devuelve 8.661 de 9.185 filas y CERO son cartas nuevas.
-- El scraper de swuapi reescribe casi todo el catálogo en cada corrida, así que
-- `updated_at` no distingue nada. Un bot que diffee por ahí publicaría 8.661
-- novedades falsas por día. La única señal fiable es esta foto propia.
--
-- ── La primera corrida siembra y NO publica ──────────────────────────
--
-- Con la tabla vacía, el diff vería 2.189 altas y el estreno del bot sería una
-- noticia diciendo que salieron 2.189 cartas de golpe. El endpoint detecta la
-- tabla vacía, siembra y se calla. Misma lección que el centinela de
-- completitud del catálogo local (CLAUDE.md §2c).

create table if not exists bot_catalogo_foto (
  clave    text primary key,   -- lower(name)|lower(subtitle)
  set_code text,
  visto_en timestamptz not null default now()
);

alter table bot_catalogo_foto enable row level security;
-- Sin policies A PROPÓSITO: solo entra service_role. Es contabilidad del bot;
-- no hay nada que el navegador necesite leer de acá.

-- `news.published` viene DEFAULT true y la tabla no tenía NINGÚN índice único
-- de contenido: un reintento de Vercel duplicaba la noticia a la vista de los 27.
alter table news add column if not exists fuente_ref text;
create unique index if not exists news_fuente_ref_key
  on news (fuente_ref) where fuente_ref is not null;

-- Bitácora: sin esto no hay forma de auditar si el bot se descarriló.
create table if not exists bot_corridas (
  id bigserial primary key,
  corrio_en timestamptz not null default now(),
  fuente text not null,
  vistos integer not null default 0,
  nuevos integer not null default 0,
  publico text,
  error text
);
alter table bot_corridas enable row level security;
create policy bot_corridas_admin_lee on bot_corridas
  for select using (exists (
    select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'
  ));
