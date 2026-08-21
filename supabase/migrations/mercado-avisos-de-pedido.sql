-- AVISOS DE PEDIDO. Aplicado 2026-08-23.
--
-- Un pedido dispara DOS avisos en direcciones opuestas: la solicitud va al
-- VENDEDOR y la respuesta vuelve al COMPRADOR. Por eso hay dos marcas y no una:
-- con una sola, avisar de la respuesta seria imposible porque ya estaria puesta
-- por la solicitud.
--
-- Cada marca es el arbitro de que su aviso se mande UNA vez, con la condicion
-- DENTRO del WHERE del UPDATE — mismo patron que `aviso_en` de las amistosas,
-- `bienvenida_en` y `diario_en`. Sin eso, quien mando el pedido podria llamar
-- al endpoint en bucle y bombardear al vendedor, que es justo lo que invita a
-- hacer un endpoint cuyo destinatario es OTRA persona.
--
-- ── El push NO puede ser el unico camino ─────────────────────────────
--
-- Medido: 7 de 27 perfiles tienen suscripcion. El aviso alcanza a uno de cada
-- cuatro. Por eso existe ademas `pedidos_pendientes()`, que alimenta la franja
-- de Inicio y llega a todos: sin ella, un vendedor sin avisos activados no se
-- entera NUNCA de que le compraron, y la carta se queda bloqueada 48 h.
--
-- Probado contra la base en transaccion revertida:
--   carrito                    -> no se avisa
--   enviado                    -> avisa al VENDEDOR, con nombre y cantidad
--   segunda llamada            -> nada (no repite)
--   un tercero lo intenta      -> nada (rechazado)
--   el vendedor responde       -> avisa al COMPRADOR, con acepto=true
--   segunda llamada            -> nada
--   pedidos_pendientes()       -> cuenta bien por responder y por cerrar

alter table pedidos add column if not exists aviso_en timestamptz;
alter table pedidos add column if not exists aviso_respuesta_en timestamptz;

-- Los cuerpos de `tomar_aviso_pedido`, `tomar_aviso_respuesta` y
-- `pedidos_pendientes` estan en la migracion `mercado_avisos_de_pedido`.
-- Las dos primeras son solo service_role (las llama /api/avisar-pedido);
-- la tercera la llama el cliente y por eso va a `authenticated`.
