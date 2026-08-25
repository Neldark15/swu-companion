-- ANILLOS COMPRABLES, sin quitarle a nadie los que ya tenía.
--
-- Pedido de Nel: «falta el cosmético de comprarle anillos al planeta». Venían
-- de la semilla y se elegían gratis. Ahora ELEGIRLOS cuesta, pero lo que la
-- semilla te dio sigue siendo tuyo:
--
--   planet_rings = NULL  → lo que te tocó por semilla. Siempre permitido.
--   planet_rings = 0     → apagarlos. Siempre permitido: apagar algo es gratis.
--   planet_rings = 1..3  → un estilo ELEGIDO. Pide haberlo comprado.
--
-- Misma línea que el resto de la terraformación: la geología que te tocó es
-- tuya, DECIDIRLA es lo que se paga.
--
-- La rama de anillos del trigger es distinta de las otras tres porque
-- `planet_rings` es ANULABLE y el NULL significa algo. El detalle que importa:
-- si alguien sin anillos comprados pide un estilo, `least(x, 0)` daría 0 y lo
-- dejaría con los anillos APAGADOS —peor que antes de tocar nada—. Por eso
-- vuelve a NULL, que le devuelve los suyos.

alter table public.planeta_mejoras drop constraint if exists planeta_mejoras_tipo_check;
alter table public.planeta_mejoras
  add constraint planeta_mejoras_tipo_check
  check (tipo in ('ciudades','auroras','nubes','anillos'));

insert into public.planeta_mejoras (id, tipo, nombre, grado, precio_xp, rareza, orden) values
  ('ani_fino',   'anillos', 'ANILLO FINO',  1,  500, 'raro',       9),
  ('ani_doble',  'anillos', 'ANILLO DOBLE', 2, 1100, 'epico',     10),
  ('ani_corona', 'anillos', 'CORONA',       3, 1900, 'legendario',11)
on conflict (id) do update
  set tipo = excluded.tipo, nombre = excluded.nombre, grado = excluded.grado,
      precio_xp = excluded.precio_xp, rareza = excluded.rareza, orden = excluded.orden;

create or replace function public.planeta_clampar_mejoras()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_max smallint;
begin
  select coalesce(max(m.grado), 0) into v_max
    from public.planeta_inventario i
    join public.planeta_mejoras m on m.id = i.mejora_id
   where i.user_id = new.id and m.tipo = 'ciudades';
  new.planet_cities := least(coalesce(new.planet_cities, 0), v_max);

  select coalesce(max(m.grado), 0) into v_max
    from public.planeta_inventario i
    join public.planeta_mejoras m on m.id = i.mejora_id
   where i.user_id = new.id and m.tipo = 'nubes';
  new.planet_clouds := least(coalesce(new.planet_clouds, 0), v_max);

  select coalesce(max(m.grado), 0) into v_max
    from public.planeta_inventario i
    join public.planeta_mejoras m on m.id = i.mejora_id
   where i.user_id = new.id and m.tipo = 'auroras';
  new.planet_auroras := least(coalesce(new.planet_auroras, 0), v_max);

  if new.planet_rings is not null and new.planet_rings > 0 then
    select coalesce(max(m.grado), 0) into v_max
      from public.planeta_inventario i
      join public.planeta_mejoras m on m.id = i.mejora_id
     where i.user_id = new.id and m.tipo = 'anillos';
    new.planet_rings := least(new.planet_rings, v_max);
    if new.planet_rings = 0 then new.planet_rings := null; end if;
  end if;

  return new;
end;
$$;

drop trigger if exists planeta_clampar on public.profiles;
create trigger planeta_clampar
  before insert or update of planet_cities, planet_clouds, planet_auroras, planet_rings
  on public.profiles
  for each row execute function public.planeta_clampar_mejoras();

-- Verificado en producción, revertido, con una cuenta normal:
--   sin comprar, pide CORONA (3) → NULO (le devuelve los de su semilla)
--   apagar (0)                    → 0, siempre permitido
--   compra ANILLO FINO            → ok
--   con grado 1, pide 3           → 1 (clampado)
--   pide 1                        → 1
