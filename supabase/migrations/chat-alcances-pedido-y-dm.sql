-- EL CHAT DEL PEDIDO ESTABA ROTO. Aplicado 2026-08-23.
--
-- Cuando se agrego el alcance `pedido` a `galaxia_pertenece` se probo la
-- PERTENENCIA —entran los dos, un tercero no, una sala inventada tampoco— pero
-- nunca se inserto un mensaje de verdad. Y hay un CHECK que la pertenencia no ve:
--
--   galaxia_mensajes_alcance_check -> alcance IN (global, continente, pais, tienda)
--
-- O sea que la sala dejaba entrar a las dos partes y despues rebotaba el primer
-- mensaje con un 23514. LA LECCION: probar la funcion de permisos NO es probar
-- la funcion. Hay que INSERTAR.
--
-- Agregar un alcance necesita SIEMPRE las dos cosas:
--   1. su rama en `galaxia_pertenece` (o la sala queda cerrada: termina en
--      `else false`)
--   2. su valor en este CHECK (o entra y rebota)
--
-- ── El segundo, que iba a morder al chat de a dos ────────────────────
--
--   ambito_coherente -> length(ambito) between 2 and 64
--
-- Un par de uuids con separador son 73 caracteres: NO entra. Por eso el chat
-- personal no puede identificarse con «uuidA|uuidB» y necesita una fila propia
-- con su uuid (36) — que ademas es donde va a colgar el bloqueo.
--
-- ── Y una cosa que SI estaba bien, medida ────────────────────────────
--
-- Un admin que NO es parte de una sala privada NO puede leerla: la policy de
-- SELECT es `galaxia_pertenece` y no tiene rama de admin. Comprobado con
-- `set local role authenticated` de verdad — la primera medicion mentia porque
-- solo se habia puesto el JWT sin cambiar de rol, y como dueño de la tabla la
-- RLS ni se aplica (la misma trampa que ya documenta CLAUDE.md).
--
-- El admin SI puede borrar (suave) un mensaje que no puede leer. Eso es
-- moderar sin espiar, y esta bien asi.

alter table galaxia_mensajes drop constraint if exists galaxia_mensajes_alcance_check;
alter table galaxia_mensajes add constraint galaxia_mensajes_alcance_check
  check (alcance = any (array['global','continente','pais','tienda','pedido','dm']));
