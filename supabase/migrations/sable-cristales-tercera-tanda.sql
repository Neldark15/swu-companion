-- SIETE CRISTALES MÁS. «Muchos colores menos el rojo» (Nel).
--
-- Elegidos por SEPARACIÓN DE TONO, no por gusto: la prueba del repo mide la
-- distancia euclídea en RGB entre todos los pares de halos y exige 28 mínimo,
-- porque dos cristales parecidos son dos piezas que nadie distingue en una
-- miniatura de 44 px —y una de las dos es plata gastada al pedo.
--
-- No es teórico: el turquesa entró a 26 del cian y la prueba lo rechazó. Hubo
-- que correrlo hacia el verde (#14e0c8 → #0fdba0). El par más cercano que
-- quedó es amarillo vs oro, a 34.
--
-- El COLOR vive en partesSable.ts; acá el id, el nombre y el precio. Escalonados
-- por rareza para que la tienda tenga escalera: dos raros baratos, tres épicos
-- y dos legendarios que NO se ocultan — son color, no las piezas guardadas.
--
-- El rojo sigue siendo el único que no se compra: se gana sangrando.

insert into public.sable_partes (id, tipo, nombre, precio_xp, orden, rareza, potencia, control, energia, oculta) values
  ('col_menta',    'color', 'ALIENTO',   420, 10, 'raro',       4,  8,  6, false),
  ('col_lima',     'color', 'SAVIA',     480, 11, 'raro',       8,  6,  4, false),
  ('col_turquesa', 'color', 'MAREA',     900, 12, 'epico',      6, 10,  6, false),
  ('col_lavanda',  'color', 'CENIZA',   1000, 13, 'epico',      6,  8,  8, false),
  ('col_oro',      'color', 'RELIQUIA', 1200, 14, 'epico',     10,  6,  8, false),
  ('col_indigo',   'color', 'ABISMO',   1700, 15, 'legendario', 8, 12, 10, false),
  ('col_violeta',  'color', 'VÉRTICE',  1900, 16, 'legendario',12, 10,  8, false)
on conflict (id) do update
  set nombre = excluded.nombre, precio_xp = excluded.precio_xp,
      orden = excluded.orden, rareza = excluded.rareza,
      potencia = excluded.potencia, control = excluded.control,
      energia = excluded.energia, oculta = excluded.oculta;
