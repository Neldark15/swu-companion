-- EL ÁLBUM — dos funciones para verlo sin bajarse las 2.669 filas al teléfono.
--
-- ── Por qué la casilla NO es el set_number ───────────────────────────
--
-- Parece lo obvio: casilla 1, casilla 2… con el número impreso. Medido sobre
-- el pool real, eso se rompe de dos maneras distintas:
--
--   · TWI Hyperspace Foil tiene 220 cartas en un rango de 515 números: 295
--     huecos. Un álbum indexado por número mostraría 295 casillas que NUNCA se
--     pueden llenar — una colección que arranca imposible. En todo el álbum
--     serían 2.930 casillas para 2.669 cartas, 305 de ellas inalcanzables.
--   · SEC Serialized Prestige repite CADA número tres veces (1125 ×3, 1128 ×3,
--     1133 ×3…): son tiradas distintas de la misma carta. En total 22 tripletas
--     (set, variante, número) tienen 2 o 3 cartas peleando por una casilla.
--
-- Así que la casilla es la POSICIÓN ORDINAL dentro del bloque (set, variante),
-- ordenada por número, y el número real va de etiqueta. En 29 de las 33
-- secciones las dos cosas coinciden exactamente, así que no se pierde nada.
--
-- La posición la calcula Postgres con `row_number()` y NO el cliente: que
-- dependiera del orden en que llegaron las filas sería un álbum que se
-- reordena solo.

create or replace function public.album_secciones()
returns table (set_code text, variante text, total integer, tenidas integer)
language sql stable security definer set search_path to 'public' as $$
  select p.set_code, p.variante, count(*)::int, count(c.card_id)::int
    from public.sobres_pool p
    left join public.cartas_desbloqueadas c
      on c.card_id = p.card_id and c.user_id = auth.uid()
   group by p.set_code, p.variante
   order by p.set_code, p.variante;
$$;

-- Una sección entera: TODAS sus casillas, tengas la carta o no.
create or replace function public.album_seccion(p_set text, p_variante text)
returns table (
  posicion integer, numero integer, card_id uuid,
  cantidad integer, tenida boolean, serializada boolean
)
language sql stable security definer set search_path to 'public' as $$
  select row_number() over (order by p.set_number, p.card_id)::int,
         p.set_number, p.card_id,
         coalesce(c.cantidad, 0)::int,
         (c.card_id is not null),
         (d.card_id is not null)
    from public.sobres_pool p
    left join public.cartas_desbloqueadas c
      on c.card_id = p.card_id and c.user_id = auth.uid()
    left join public.serializadas_dueno d
      on d.card_id = p.card_id and d.user_id = auth.uid()
   where p.set_code = p_set and p.variante = p_variante
   order by p.set_number, p.card_id;
$$;

-- Ojo: `revoke ... from anon` NO alcanza — hay que revocarle a PUBLIC.
-- Ver `album-rpc-cerrar-public.sql`.
revoke all on function public.album_secciones() from public, anon, authenticated;
revoke all on function public.album_seccion(text, text) from public, anon, authenticated;
grant execute on function public.album_secciones() to authenticated;
grant execute on function public.album_seccion(text, text) to authenticated;
