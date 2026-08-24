-- LA TANDA BRILLANTE: seis piezas épicas que emiten luz.
--
-- Pedido de Nel: «crea más piezas más locas que emitan brillos destellos».
-- La GEOMETRÍA vive en partesSable.ts (§2y: la base no guarda datos de
-- presentación); acá va lo que la tienda necesita: precio, rareza, stats.
--
-- Las seis salieron de un enjambre de diseño con tres direcciones (reactor
-- expuesto / reliquia viva / tormenta contenida) y tres lentes de crítica
-- (geometría, legibilidad, coherencia). Lo que la crítica tumbó vale tanto
-- como lo que entró:
--   · nada que cuente «cristal roto que ventea» — es el lenguaje visual del
--     sable sangrado, la puerta de atrás al rojo;
--   · plasma (toma el color del cristal) SOLO en masas chicas: con cristal
--     rojo un aro gordo de plasma es una empuñadura sith de manual;
--   · brasa ámbar nunca sobre cobre/bronce/hueso (cálido sobre cálido no se
--     lee como incandescencia, se lee como mancha);
--   · destellos GRANDES (radio 0,20) y pocos: los de 0,13 no llegan al píxel
--     de la tarjeta y la pieza se vendería sin su luz;
--   · nombres sin liturgia real ni copy de arma (LETANÍA, URNA y «el arma del
--     otro extremo» no pasaron).
--
-- Todas épicas y a la VISTA (no ocultas): los legendarios guardados son otra
-- cosa. Los precios (1400–1860) quedan por encima de los épicos de la primera
-- tanda (800–1200): brillan, y eso se nota también en la etiqueta.

insert into public.sable_partes (id, tipo, nombre, precio_xp, orden, rareza, potencia, control, energia, oculta) values
  ('emi_vigilia', 'emisor', 'VIGILIA',  1620, 11, 'epico', 4, 8, 10, false),
  ('emi_candil',  'emisor', 'CANDIL',   1780, 12, 'epico', 6, 6, 10, false),
  ('cue_caldera', 'cuerpo', 'CALDERA',  1860, 11, 'epico', 10, 4, 8, false),
  ('cue_espina',  'cuerpo', 'ESPINA',   1550, 12, 'epico', 8, 10, 4, false),
  ('pom_ascua',   'pomo',   'ASCUA',    1700, 10, 'epico', 6, 8, 8, false),
  ('pom_semilla', 'pomo',   'SEMILLA',  1400, 11, 'epico', 4, 10, 8, false)
on conflict (id) do update
  set nombre = excluded.nombre, precio_xp = excluded.precio_xp,
      orden = excluded.orden, rareza = excluded.rareza,
      potencia = excluded.potencia, control = excluded.control,
      energia = excluded.energia, oculta = excluded.oculta;
