-- LA FIRMA VIEJA DE `guardar_sable` SE SUELTA, y no es limpieza: era un bug.
--
-- Al agregar `p_acabado` quedaron DOS funciones: la de 5 argumentos (con el
-- cuerpo viejo, que todavía exige `es_probador_sable()`) y la de 6. PostgREST
-- resuelve por NOMBRE de argumento, así que un cliente que no haya actualizado
-- la PWA —manda 5— caía en la vieja y recibía «El taller todavia no esta
-- abierto», justo el día que se abrió. Podía entrar y comprar (esas dos RPC no
-- cambiaron de firma) pero NO guardar su sable: el peor final posible de una
-- sesión de armado.
--
-- Soltando la de 5, PostgREST cae en la de 6: los argumentos que faltan tienen
-- valor por defecto y `p_acabado` queda en NULL, que es exactamente lo que un
-- cliente viejo quiere decir.
--
-- ── La lección, que no es obvia ───────────────────────────────────────
--
-- **Agregar un argumento con default a una RPC NO es compatible hacia atrás por
-- sí solo.** Crea una SOBRECARGA, y la vieja se queda con el cuerpo viejo
-- mientras la PWA instalada tarda en actualizarse (§2g). O se suelta la vieja,
-- o se la reescribe para que delegue en la nueva. Dejar las dos con cuerpos
-- distintos es tener dos verdades, y la que le toca a cada quien depende de
-- cuándo actualizó.

drop function if exists public.guardar_sable(text, text, text, text, text);

-- Verificado en producción, en transacción revertida, con una cuenta normal:
--   llamada de 5 argumentos (cliente viejo) → ok:true
--   llamada de 6 argumentos (cliente nuevo) → ok:true, acabado guardado
--   sobrecargas de `guardar_sable` que quedan: 1
