-- Lo que alguien publica en venta lo ve toda la comunidad.
--
-- ── El problema ───────────────────────────────────────────────────────
--
-- Ver la carta de OTRA persona dependía de una sola política:
--
--     "Public read collection"
--       USING (EXISTS (SELECT 1 FROM profiles
--                      WHERE profiles.id = collection.user_id
--                        AND profiles.is_public = true))
--
-- O sea que una publicación de venta se veía si el PERFIL del vendedor era
-- público. Son dos cosas distintas: `is_public` responde «¿dejo que vean mi
-- colección y mi progreso?», y publicar en Contrabando responde «quiero vender
-- esto». Atarlas significa que quien pone su perfil en privado —algo que la
-- app ofrece y que es legítimo— desaparece del mercado sin enterarse: sus
-- cartas siguen marcadas `for_sale`, el vendedor las ve en «Mis publicaciones»
-- y nadie más las ve nunca.
--
-- Hoy no hay nadie afectado: los 19 perfiles están públicos y las 37 cartas en
-- venta se ven. Pero eso es la población de hoy, no la regla. El fallo aparece
-- con la primera persona que use una función que ya existe.
--
-- ── El arreglo ────────────────────────────────────────────────────────
--
-- Una política nueva y ADITIVA: las políticas de PostgreSQL se combinan con OR,
-- así que esto no le quita visibilidad a nada de lo que hoy se ve. Solo agrega
-- la regla correcta: si está publicado en venta, se ve.
--
-- Se exige sesión iniciada (`auth.uid() IS NOT NULL`), igual que
-- `profiles_read_all_authenticated`: el mercado es de la comunidad, no de la
-- internet abierta, y para escribirle a alguien hay que estar dentro.
--
-- Y se limita a las filas `for_sale`: el resto de la colección de una persona
-- sigue gobernado por su `is_public`, que es exactamente para lo que existe.

create policy "Lo publicado en venta lo ve la comunidad"
  on public.collection
  for select
  using (for_sale is true and auth.uid() is not null);

comment on policy "Lo publicado en venta lo ve la comunidad" on public.collection is
  'Publicar en venta es un acto público explícito: la fila se ve por estar publicada, '
  'no por el is_public del perfil del vendedor. Aditiva — no restringe nada.';
