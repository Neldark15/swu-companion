-- card_prices: agregar las 3 columnas que el código ya esperaba
-- Aplicada en producción el 2026-07-31.
--
-- La caché de precios en la nube estaba 100% muerta.
--
-- El código de pricing.ts lee y escribe 9 columnas (mid_price, direct_low_price
-- y variants entre ellas) pero la tabla solo tenía 6. PostgREST respondía
-- HTTP 400 ("column card_prices.mid_price does not exist") en CADA llamada, y
-- como el código hacía `const { data } = await supabase...` sin mirar `error`,
-- supabase-js no lanza excepción: `data` quedaba null y la función devolvía un
-- Map vacío como si simplemente no hubiera precios en la nube. El console.warn
-- del catch era inalcanzable.
--
-- Resultado: 0 filas en la tabla desde su creación y cada usuario
-- re-descargando el catálogo entero de tcgcsv sin compartir nada.
--
-- La migración collection-public-migration.sql nunca se actualizó cuando el
-- código añadió midPrice/directLow/variants (commits 18c4e9e y 8761972).
--
-- Puramente aditivo y nullable: no toca datos existentes (la tabla está vacía)
-- ni rompe ningún lector.

alter table public.card_prices
  add column if not exists mid_price numeric,
  add column if not exists direct_low_price numeric,
  add column if not exists variants jsonb;

comment on column public.card_prices.mid_price is
  'Precio medio de TCGPlayer (≈ Most Recent Sale).';
comment on column public.card_prices.direct_low_price is
  'TCGPlayer Direct low.';
comment on column public.card_prices.variants is
  'Mapa subtipo → {market, low, mid, high, directLow} (Normal, Foil, Hyperspace…).';
