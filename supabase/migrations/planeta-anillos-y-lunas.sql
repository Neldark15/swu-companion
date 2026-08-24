-- EL PLANETA GANA ANILLOS Y LUNAS.
--
-- Pedido de Nel («hagamos que el planeta se pueda personalizar más»), y la
-- medición lo respalda: 19 de 39 personas ya tocaron su planeta, o sea que es
-- la personalización MÁS usada de la app — casi la mitad de la comunidad.
-- Ampliar lo que la gente ya usa vale más que estrenar algo y esperar que prenda.
--
-- NULL = lo decide la semilla del id, igual que familia/mares/cráteres. Y la
-- semilla los deja en MINORÍA a propósito: un cielo donde todos tienen anillos
-- es un cielo sin anillos.
--
-- 0 es un valor con significado propio («no quiero ninguno»), DISTINTO de NULL
-- («que decida la semilla»). Por eso son smallint anulables y no un default 0:
-- con default, entrar una vez al panel te quitaría para siempre lo que te tocó.
--
-- OJO AL AGREGAR RASGOS NUEVOS: las tiradas del generador se consumen en orden
-- fijo, así que las de anillos y lunas se sacan AL FINAL de la secuencia. Una
-- tirada metida en el medio correría todas las de abajo y les cambiaría la
-- forma a los 19 mundos que ya existen — un planeta que se reescribe solo.

alter table public.profiles
  add column if not exists planet_rings smallint,
  add column if not exists planet_moons smallint;

-- El rango se cierra en la BASE y no solo en el cliente: un cliente puede
-- mandar 99 lunas y la escena crearía 99 mallas.
alter table public.profiles drop constraint if exists profiles_planet_rings_rango;
alter table public.profiles add constraint profiles_planet_rings_rango
  check (planet_rings is null or planet_rings between 0 and 3);

alter table public.profiles drop constraint if exists profiles_planet_moons_rango;
alter table public.profiles add constraint profiles_planet_moons_rango
  check (planet_moons is null or planet_moons between 0 and 3);

comment on column public.profiles.planet_rings is
  '0 = sin anillos; 1..3 = estilo. NULL = lo decide la semilla del id.';
comment on column public.profiles.planet_moons is
  'Cuántas lunas, 0..3. NULL = lo decide la semilla del id.';
