-- TERRAFORMACIÓN: lo que le HACÉS a tu mundo, y se paga con créditos.
--
-- Nel eligió esto sobre construir otro taller, y la medición lo respalda:
-- 19 de 39 cuentas ya habían tocado su planeta —casi la mitad de la comunidad—
-- contra 2 que habían forjado un sable. Ampliar lo que la gente ya usa vale
-- más que estrenar un módulo y esperar que prenda.
--
-- ── La línea entre gratis y pago no es el precio: es el relato ────────
--   GEOLOGÍA (gratis): familia, mares, cráteres, anillos, lunas. Es lo que tu
--     mundo ES. Salió de la semilla de tu id y siempre fue tuyo.
--   TERRAFORMACIÓN (se paga): ciudades, nubes, auroras. Es lo que le HACÉS.
-- Nada de lo que ya era gratis pasó a costar: eso sería quitarle a alguien lo
-- suyo, mismo criterio que dejó visibles las piezas legendarias ya compradas
-- el día que se ocultaron las demás.
--
-- ── UNA SOLA BILLETERA ───────────────────────────────────────────────
-- `creditos_saldo()` resta lo gastado en piezas de sable Y en el planeta. Si
-- cada pantalla llevara su cuenta, alguien podría gastar los mismos créditos
-- dos veces y las dos cuadrarían por separado. `sable_saldo_xp()` queda como
-- nombre viejo que delega: lo llaman tres RPC del taller y renombrarlo en todas
-- es una migración con riesgo y cero ganancia.
--
-- ── EL GUARDIA VA EN UN TRIGGER, no en la pantalla ───────────────────
-- El perfil se escribe DIRECTO desde el cliente (hay policy de UPDATE), así que
-- sin esto cualquiera se pone METRÓPOLIS desde la consola. Y CLAMPA en vez de
-- rechazar: devolver el valor al grado que sí se posee deja pasar el resto del
-- guardado. Rechazar tumbaría la grabación entera del perfil —vitrina,
-- aspectos, acento— por un campo cosmético.

create table if not exists public.planeta_mejoras (
  id        text primary key,
  tipo      text not null check (tipo in ('ciudades','auroras','nubes')),
  nombre    text not null,
  -- El GRADO dentro de su tipo: comprar CIUDADES no te quita ALDEAS, pero solo
  -- una está puesta. El grado es el valor que va a `profiles.planet_*`.
  grado     smallint not null check (grado between 1 and 3),
  precio_xp int not null check (precio_xp > 0),
  rareza    text not null,
  orden     int not null default 0
);

create table if not exists public.planeta_inventario (
  user_id    uuid not null references auth.users(id) on delete cascade,
  mejora_id  text not null references public.planeta_mejoras(id) on delete cascade,
  pagado_xp  int not null default 0,
  comprado_en timestamptz not null default now(),
  primary key (user_id, mejora_id)
);

-- §2j: revocar primero. Supabase concede ALL por defecto en toda tabla nueva.
revoke all on public.planeta_mejoras, public.planeta_inventario from anon, authenticated;
grant select on public.planeta_mejoras to authenticated;
grant select on public.planeta_inventario to authenticated;

alter table public.planeta_mejoras enable row level security;
alter table public.planeta_inventario enable row level security;

drop policy if exists planeta_mejoras_leer on public.planeta_mejoras;
create policy planeta_mejoras_leer on public.planeta_mejoras
  for select to authenticated using (true);

drop policy if exists planeta_inventario_yo on public.planeta_inventario;
-- Nada de INSERT por policy: comprar va por RPC o el cliente elegiría su precio.
create policy planeta_inventario_yo on public.planeta_inventario
  for select to authenticated using (user_id = auth.uid());

insert into public.planeta_mejoras (id, tipo, nombre, grado, precio_xp, rareza, orden) values
  ('ciu_aldeas',   'ciudades', 'ALDEAS',      1,  400, 'raro',        1),
  ('ciu_ciudades', 'ciudades', 'CIUDADES',    2,  900, 'epico',       2),
  ('ciu_metropoli','ciudades', 'METRÓPOLIS',  3, 1800, 'legendario',  3),
  ('nub_velo',     'nubes',    'VELO',        1,  350, 'raro',        4),
  ('nub_manto',    'nubes',    'MANTO',       2,  800, 'epico',       5),
  ('nub_tormenta', 'nubes',    'TORMENTA',    3, 1500, 'legendario',  6),
  ('aur_tenue',    'auroras',  'AURORA',      1,  600, 'raro',        7),
  ('aur_corona',   'auroras',  'CORONA POLAR',2, 1400, 'epico',       8)
on conflict (id) do update
  set tipo = excluded.tipo, nombre = excluded.nombre, grado = excluded.grado,
      precio_xp = excluded.precio_xp, rareza = excluded.rareza, orden = excluded.orden;

alter table public.profiles
  add column if not exists planet_cities  smallint not null default 0,
  add column if not exists planet_clouds  smallint not null default 0,
  add column if not exists planet_auroras smallint not null default 0;

-- Los grants de `profiles` son POR COLUMNA (ver planeta-grants-por-columna.sql).
grant select (planet_cities, planet_clouds, planet_auroras) on public.profiles to authenticated, anon;
grant update (planet_cities, planet_clouds, planet_auroras) on public.profiles to authenticated;

-- El resto (creditos_saldo, el trigger planeta_clampar_mejoras, planeta_taller
-- y comprar_mejora_planeta) se aplicó por MCP tal como está en el historial de
-- migraciones de Supabase, con el nombre `planeta_terraformacion`.
--
-- Verificado en producción, en transacción revertida, con una cuenta normal:
--   poner METRÓPOLIS sin comprarla        → quedó en 0 (el trigger la baja)
--   comprar ALDEAS y volver a intentar 3  → quedó en 1 (el grado que posee)
--   creditos_saldo() = sable_saldo_xp()   → 3567 = 3567, una sola billetera
--   comprar dos veces la misma            → «Ya la tenes.»
