-- Wishlist: qué carta BUSCA cada persona.
-- Aplicada en producción el 2026-07-31.
--
-- Sin esto no existe el cruce "esa persona tiene lo que buscás": la app sabía
-- qué tiene cada uno (`collection`) pero nunca qué quiere.
--
-- Por qué tabla nueva y no reciclar `favorite_cards`: son intenciones
-- distintas. "Me gusta" no es "la quiero". Los 53 favoritos actuales son de
-- 2 usuarios y pasarían a leerse como demanda falsa desde el día uno.
--
-- Existe un stub muerto `wishlist` en Dexie desde la v1 del esquema local,
-- sin una sola lectura ni escritura en todo el código. Esta tabla es la
-- contraparte en la nube que le faltaba.

create table if not exists public.wishlist (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  card_id    text not null,
  -- 1 = la busco mucho. Ordena el cruce cuando hay varias coincidencias.
  priority   smallint not null default 2 check (priority between 1 and 3),
  -- Tope opcional que el usuario está dispuesto a pagar.
  max_price  numeric(10,2),
  note       text,
  created_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

-- El cruce va POR CARTA ("¿quién busca esta?"), así que el índice por card_id
-- no es opcional: sin él cada coincidencia sería un scan de la tabla.
create index if not exists idx_wishlist_card on public.wishlist (card_id);
create index if not exists idx_wishlist_user on public.wishlist (user_id);

-- `favorite_cards` tampoco tenía índice por card_id y el cruce inverso lo
-- necesita por el mismo motivo.
create index if not exists idx_favorite_cards_card on public.favorite_cards (card_id);

alter table public.wishlist enable row level security;

-- Escribir: solo lo propio.
create policy "wishlist_insert_own" on public.wishlist
  for insert with check (auth.uid() = user_id);
create policy "wishlist_update_own" on public.wishlist
  for update using (auth.uid() = user_id);
create policy "wishlist_delete_own" on public.wishlist
  for delete using (auth.uid() = user_id);

-- Leer: lo propio SIEMPRE, y lo ajeno solo si esa persona tiene el perfil
-- público. Respeta el mismo toggle que ahora sí significa algo para
-- `collection`; si alguien se pone en privado, desaparece del cruce entero
-- y no solo a medias.
create policy "wishlist_read_own" on public.wishlist
  for select using (auth.uid() = user_id);

-- La de otros exige SESIÓN además del perfil público. Sin el
-- `auth.uid() is not null`, `anon` podía volcar la lista de deseos de todos
-- con la anon key que va en el bundle; para el cruce no hace falta, porque el
-- Mercado ya requiere cuenta.
--
-- `collection` se deja como está a propósito: su política equivalente es
-- anterior y la vista de perfil público depende de ella. Cambiarla es una
-- decisión aparte, no un efecto colateral de esto.
create policy "wishlist_read_public" on public.wishlist
  for select using (
    auth.uid() is not null
    and exists (
      select 1 from public.profiles p
      where p.id = wishlist.user_id and p.is_public = true
    )
  );

comment on table public.wishlist is
  'Cartas que cada usuario BUSCA. Alimenta el cruce de intercambios. Distinta de favorite_cards, que es estética.';
