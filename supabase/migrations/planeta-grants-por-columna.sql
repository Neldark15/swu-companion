-- LOS GRANTS DE `profiles` SON POR COLUMNA, y las nuevas no estaban.
--
-- Descubierto probando la terraformación: `update profiles set planet_cities`
-- daba «permission denied for table profiles» pese a existir la policy de
-- UPDATE. La policy dice QUÉ FILAS podés tocar; el grant dice QUÉ COLUMNAS.
-- Hacen falta las dos — y el mensaje de Postgres habla de la TABLA, que es lo
-- que despista.
--
-- CONSECUENCIA REAL: `planet_rings` y `planet_moons` se habían desplegado sin
-- estos grants y NO GUARDABAN. Y había una segunda razón, del lado del cliente:
-- `guardarPersonalizacion` tiene una LISTA BLANCA de campos y tampoco estaban
-- ahí. La pantalla dejaba elegir, la vista previa cambiaba y nada llegaba a la
-- base. El fallo más caro es el que se ve bien.
--
-- Se conceden SOLO las columnas del planeta. Nada de `grant update on profiles`:
-- la lista acotada es lo que impide que un cliente se escriba `is_public`.

grant update (planet_rings, planet_moons, planet_cities, planet_clouds, planet_auroras)
  on public.profiles to authenticated;

-- El SELECT también, y también para `anon`: los planetas de la Galaxia se ven
-- sin sesión, igual que el resto de las columnas `planet_*`.
grant select (planet_rings, planet_moons, planet_cities, planet_clouds, planet_auroras)
  on public.profiles to authenticated, anon;
