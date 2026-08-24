-- PERSONALIZACIÓN TOTAL: acabado POR PIEZA, cristal a la vista y 3 cristales.
--
-- Nel: «aumenta la forma de colores, que empuñaduras puedan combinar colores,
-- que los otros elementos también se puedan personalizar, que el cristal pueda
-- estar visto en medio de la empuñadura, ¡aumenta todo!»
--
-- ── El acabado global NO se retira ────────────────────────────────────
-- `acabado` (una columna) fue la primera versión: repintaba las tres piezas.
-- Las tres columnas nuevas la superan pero no la reemplazan: una PWA sin
-- actualizar sigue guardando el global, y la cadena de resolución del cliente
-- es por-pieza → global → material propio de la pieza. Retirar la columna
-- rompería a los rezagados (§2g) por prolijidad.
--
-- ── El cristal a la vista es un BOOLEANO, no una pieza ────────────────
-- Las ventanas al kyber las dibuja el cliente como herrajes sintéticos del
-- cuerpo (partesSable.piezasDeSable): la base solo guarda la decisión. Gratis,
-- como todo cosmético: el sumidero de créditos son las piezas.

alter table public.sable_diseno
  add column if not exists acabado_emisor text references public.sable_acabados(id),
  add column if not exists acabado_cuerpo text references public.sable_acabados(id),
  add column if not exists acabado_pomo   text references public.sable_acabados(id),
  add column if not exists cristal_visto  boolean not null default false;

comment on column public.sable_diseno.acabado_emisor is
  'Acabado SOLO del emisor. NULL = usar el global; global NULL = el material propio.';
comment on column public.sable_diseno.cristal_visto is
  'Dos ventanas al kyber en el centro de la empuñadura. Cosmético y gratis.';

-- ── Tres cristales nuevos («aumenta la forma de colores») ─────────────
-- Épicos: azul/verde de fábrica siguen siendo la puerta de entrada. Ninguno se
-- arrima al ROJO, que se gana sangrando: cian es hielo, naranja es fragua (hay
-- hojas naranjas en el canon y nadie las confunde con una sith), magenta es
-- rosa franco. El COLOR vive en partesSable.ts; acá el id y el precio.
insert into public.sable_partes (id, tipo, nombre, precio_xp, orden, rareza, potencia, control, energia, oculta) values
  ('col_cian',    'color', 'HIELO',        950, 7, 'epico',  4, 12,  6, false),
  ('col_naranja', 'color', 'FRAGUA',      1050, 8, 'epico', 12,  4,  6, false),
  ('col_magenta', 'color', 'AURORA ROSA', 1150, 9, 'epico',  6,  6, 10, false)
on conflict (id) do update
  set nombre = excluded.nombre, precio_xp = excluded.precio_xp,
      orden = excluded.orden, rareza = excluded.rareza,
      potencia = excluded.potencia, control = excluded.control,
      energia = excluded.energia, oculta = excluded.oculta;

-- ── `guardar_sable` con todo — y UNA sola sobrecarga (§4f) ────────────
-- La lección de HOY: agregar argumentos con default crea una sobrecarga y la
-- vieja se queda con el cuerpo viejo. Se suelta la de 6 y se crea la de 10: un
-- cliente viejo que mande 6 argumentos con nombre cae acá y el resto toma su
-- default, que es exactamente lo que quiere decir.
drop function if exists public.guardar_sable(text, text, text, text, text, text);

create function public.guardar_sable(
  p_emisor text, p_cuerpo text, p_pomo text, p_color text,
  p_nombre text default null, p_acabado text default null,
  p_acabado_emisor text default null, p_acabado_cuerpo text default null,
  p_acabado_pomo text default null, p_cristal_visto boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_yo uuid := auth.uid(); v_falta text;
        v_g text; v_e text; v_c text; v_p text;
begin
  if v_yo is null then
    return jsonb_build_object('ok', false, 'error', 'Sin sesion.');
  end if;
  if not public.sable_abierto() then
    return jsonb_build_object('ok', false, 'error', 'El taller no esta disponible.');
  end if;

  -- SE COMPRUEBA QUE CADA PIEZA SEA TUYA, y que sea del tipo que dice ser.
  select string_agg(x.id, ', ') into v_falta
  from (values (p_emisor,'emisor'), (p_cuerpo,'cuerpo'), (p_pomo,'pomo'), (p_color,'color')) as x(id, tipo)
  where not exists (
    select 1 from public.sable_partes p
     where p.id = x.id and p.tipo = x.tipo
       and (p.precio_xp = 0 or exists (
            select 1 from public.sable_inventario i
             where i.user_id = v_yo and i.parte_id = p.id)));

  if v_falta is not null then
    return jsonb_build_object('ok', false, 'error',
      'No tenes (o no encajan) estas partes: ' || v_falta);
  end if;

  -- Un acabado que no existe cae a NULL en vez de reventar (§2g): perder el
  -- sable entero por un color retirado seria el peor cambio posible.
  select case when exists (select 1 from public.sable_acabados a where a.id = nullif(btrim(coalesce(p_acabado,'')),''))
              then nullif(btrim(coalesce(p_acabado,'')),'') end,
         case when exists (select 1 from public.sable_acabados a where a.id = nullif(btrim(coalesce(p_acabado_emisor,'')),''))
              then nullif(btrim(coalesce(p_acabado_emisor,'')),'') end,
         case when exists (select 1 from public.sable_acabados a where a.id = nullif(btrim(coalesce(p_acabado_cuerpo,'')),''))
              then nullif(btrim(coalesce(p_acabado_cuerpo,'')),'') end,
         case when exists (select 1 from public.sable_acabados a where a.id = nullif(btrim(coalesce(p_acabado_pomo,'')),''))
              then nullif(btrim(coalesce(p_acabado_pomo,'')),'') end
    into v_g, v_e, v_c, v_p;

  insert into public.sable_diseno
    (user_id, emisor, cuerpo, pomo, color, nombre, acabado,
     acabado_emisor, acabado_cuerpo, acabado_pomo, cristal_visto, actualizado)
  values
    (v_yo, p_emisor, p_cuerpo, p_pomo, p_color,
     nullif(btrim(coalesce(p_nombre,'')),''), v_g, v_e, v_c, v_p,
     coalesce(p_cristal_visto, false), now())
  on conflict (user_id) do update
    set emisor = excluded.emisor, cuerpo = excluded.cuerpo, pomo = excluded.pomo,
        color = excluded.color, nombre = excluded.nombre,
        acabado = excluded.acabado,
        acabado_emisor = excluded.acabado_emisor,
        acabado_cuerpo = excluded.acabado_cuerpo,
        acabado_pomo = excluded.acabado_pomo,
        cristal_visto = excluded.cristal_visto,
        actualizado = now();

  return jsonb_build_object('ok', true);
end;
$function$;

-- §4e: revocar de anon Y de public — Supabase concede a anon DIRECTO.
revoke all on function public.guardar_sable(text, text, text, text, text, text, text, text, text, boolean) from anon, public;
grant execute on function public.guardar_sable(text, text, text, text, text, text, text, text, text, boolean) to authenticated;

-- ── `sable_taller` devuelve el diseño completo ────────────────────────
-- (Recreada entera; el cuerpo es el de sable-abierto-y-acabados.sql más los
-- campos nuevos del diseño.)
create or replace function public.sable_taller()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare v_yo uuid := auth.uid(); v_res jsonb;
begin
  if v_yo is null then
    return jsonb_build_object('ok', false, 'error', 'Sin sesion.');
  end if;
  if not public.sable_abierto() then
    return jsonb_build_object('ok', false, 'error', 'El taller no esta disponible.');
  end if;

  select jsonb_build_object(
    'ok', true,
    'saldo', public.sable_saldo_xp(),
    'xpTotal', coalesce((select xp from public.player_stats where user_id = v_yo), 0),
    'nivel', coalesce((select level from public.player_stats where user_id = v_yo), 1),
    'partes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'tipo', p.tipo, 'nombre', p.nombre,
        'precio', p.precio_xp, 'orden', p.orden, 'rareza', p.rareza,
        'potencia', p.potencia, 'control', p.control, 'energia', p.energia,
        'tengo', (p.precio_xp = 0 or exists (
          select 1 from public.sable_inventario i
           where i.user_id = v_yo and i.parte_id = p.id))
      ) order by p.tipo, p.orden)
      from public.sable_partes p
      where not p.oculta or exists (
        select 1 from public.sable_inventario i
         where i.user_id = v_yo and i.parte_id = p.id)), '[]'::jsonb),
    'acabados', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'nombre', a.nombre) order by a.orden)
        from public.sable_acabados a), '[]'::jsonb),
    'diseno', (
      select jsonb_build_object('emisor', d.emisor, 'cuerpo', d.cuerpo,
                                'pomo', d.pomo, 'color', d.color,
                                'acabado', d.acabado,
                                'acabadoEmisor', d.acabado_emisor,
                                'acabadoCuerpo', d.acabado_cuerpo,
                                'acabadoPomo', d.acabado_pomo,
                                'cristalVisto', d.cristal_visto,
                                'nombre', d.nombre)
        from public.sable_diseno d where d.user_id = v_yo),
    'cuantasTengo', (select count(*) from public.sable_inventario where user_id = v_yo),
    'cuantasHay', (select count(*) from public.sable_partes where precio_xp > 0 and not oculta)
  ) into v_res;

  return v_res;
end;
$function$;

revoke all on function public.sable_taller() from anon, public;
grant execute on function public.sable_taller() to authenticated;

-- Verificado en producción, revertido, con una cuenta normal:
--   llamada vieja de 6 args → ok:true (cae en la de 10, defaults)
--   combinado laton/cuero/negro + cristal_visto → guardado tal cual
--   acabado por pieza inventado → NULL, sin reventar
--   col_cian comprable; sable_taller lista 39 partes y devuelve cristalVisto
