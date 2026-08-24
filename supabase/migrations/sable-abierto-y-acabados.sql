-- ═══════════════════════════════════════════════════════════════════════
-- EL TALLER SE ABRE A LA COMUNIDAD, Y LA EMPUÑADURA GANA COLOR
--
-- Dos pedidos de Nel el mismo día: «que sea accesible para la comunidad el
-- poder editar el sable» y «permite colores de empuñadura».
--
-- ── Por qué la cerradura no se borra, se reemplaza ────────────────────
--
-- `es_probador_sable()` devolvía true solo para quien estuviera en
-- `sable_probadores`. Lo tentador es dejarla y hacer que devuelva true para
-- todos, pero una función que se llama «es probador» y le dice que sí a
-- cualquiera es una mentira que el próximo que la lea va a creer. Así que
-- entra `sable_abierto()`, que dice lo que hace, y las tres RPC la usan.
--
-- `sable_probadores` NO se borra: sigue siendo la puerta para estrenar cosas
-- con una sola cuenta antes de soltarlas (los legendarios de hoy, el sangrado
-- de mañana). Lo que cambió es que el TALLER dejó de estar detrás de ella.
--
-- Lo que sigue cerrado es lo que estaba pensado para seguir cerrado: las piezas
-- con `oculta` —los cinco legendarios y el cristal rojo— no se listan ni se
-- venden a nadie. Abrir el taller no es estrenar el catálogo entero.
--
-- ── Los acabados ──────────────────────────────────────────────────────
--
-- Cada pieza ya declara de qué está hecha (cuero, latón, cromo negro…), y esa
-- identidad es el valor por defecto: `acabado` nulo = cada pieza con lo suyo.
-- Elegir un acabado repinta las TRES piezas del mismo material, sin tocar los
-- herrajes — el latón de los aros y el testigo del cristal siguen contrastando.
--
-- Son GRATIS a propósito. El sumidero de XP son las piezas; el color es
-- expresión, y cobrar por expresarse en una app de una comunidad de 38 personas
-- —con menores— no vale lo que recauda.
--
-- Igual que con `sable_partes`: acá vive el id, el nombre y el orden; el COLOR
-- vive en `partesSable.ts`, porque Postgres no puede dibujar ni validar un hex
-- (§2y). El id es la bisagra entre los dos.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. La puerta ──────────────────────────────────────────────────────

create or replace function public.sable_abierto()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$ select auth.uid() is not null $$;

revoke all on function public.sable_abierto() from public;
grant execute on function public.sable_abierto() to authenticated;

-- ── 2. Los acabados ───────────────────────────────────────────────────

create table if not exists public.sable_acabados (
  id     text primary key,
  nombre text not null,
  orden  int  not null default 0
);

insert into public.sable_acabados (id, nombre, orden) values
  ('acero',   'ACERO',       1),
  ('grafito', 'GRAFITO',     2),
  ('negro',   'CROMO NEGRO', 3),
  ('laton',   'LATÓN',       4),
  ('cobre',   'COBRE',       5),
  ('bronce',  'BRONCE',      6),
  ('cuero',   'CUERO',       7),
  ('hueso',   'HUESO',       8),
  ('esmalte', 'ESMALTE',     9),
  ('jade',    'JADE',       10)
on conflict (id) do update set nombre = excluded.nombre, orden = excluded.orden;

-- §2j: Supabase concede ALL por defecto en toda tabla nueva de `public`.
-- Revocar primero; conceder no alcanza.
revoke all on public.sable_acabados from anon, authenticated;
grant select on public.sable_acabados to authenticated;

alter table public.sable_acabados enable row level security;

drop policy if exists sable_acabados_leer on public.sable_acabados;
create policy sable_acabados_leer on public.sable_acabados
  for select to authenticated using (true);

-- La clave foránea es lo que hace imposible guardar un acabado inventado, sin
-- repetir la lista dentro de la función.
alter table public.sable_diseno
  add column if not exists acabado text references public.sable_acabados(id);

comment on column public.sable_diseno.acabado is
  'Repinta las tres piezas del mismo material. NULL = cada pieza con el suyo.';

-- ── 3. Las tres RPC: puerta nueva, y `guardar_sable` acepta el acabado ─

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
      -- Una pieza oculta que YA es tuya sí se lista: el sangrado del futuro la
      -- reparte por inventario y esconderla seria quitarle a alguien lo suyo.
      where not p.oculta or exists (
        select 1 from public.sable_inventario i
         where i.user_id = v_yo and i.parte_id = p.id)), '[]'::jsonb),
    'acabados', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'nombre', a.nombre) order by a.orden)
        from public.sable_acabados a), '[]'::jsonb),
    'diseno', (
      select jsonb_build_object('emisor', d.emisor, 'cuerpo', d.cuerpo,
                                'pomo', d.pomo, 'color', d.color,
                                'acabado', d.acabado, 'nombre', d.nombre)
        from public.sable_diseno d where d.user_id = v_yo),
    'cuantasTengo', (select count(*) from public.sable_inventario where user_id = v_yo),
    'cuantasHay', (select count(*) from public.sable_partes where precio_xp > 0 and not oculta)
  ) into v_res;

  return v_res;
end;
$function$;

create or replace function public.comprar_parte_sable(p_parte text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_yo uuid := auth.uid(); v_precio int; v_oculta boolean; v_saldo int;
begin
  if v_yo is null then
    return jsonb_build_object('ok', false, 'error', 'Sin sesion.');
  end if;
  if not public.sable_abierto() then
    return jsonb_build_object('ok', false, 'error', 'El taller no esta disponible.');
  end if;

  select precio_xp, oculta into v_precio, v_oculta
    from public.sable_partes where id = p_parte;
  if v_precio is null then
    return jsonb_build_object('ok', false, 'error', 'Esa parte no existe.');
  end if;
  if v_oculta then
    return jsonb_build_object('ok', false, 'error', 'Esa pieza no se compra: se gana de otra forma.');
  end if;
  if v_precio = 0 then
    return jsonb_build_object('ok', false, 'error', 'Esa parte ya viene incluida.');
  end if;
  if exists (select 1 from public.sable_inventario
              where user_id = v_yo and parte_id = p_parte) then
    return jsonb_build_object('ok', false, 'error', 'Ya la tenes.');
  end if;

  v_saldo := public.sable_saldo_xp();
  if v_saldo < v_precio then
    return jsonb_build_object('ok', false, 'error',
      format('Te faltan %s creditos.', v_precio - v_saldo));
  end if;

  insert into public.sable_inventario (user_id, parte_id, pagado_xp)
  values (v_yo, p_parte, v_precio);

  return jsonb_build_object('ok', true, 'parte', p_parte,
                            'pagado', v_precio, 'saldo', public.sable_saldo_xp());
end;
$function$;

create or replace function public.guardar_sable(
  p_emisor text, p_cuerpo text, p_pomo text, p_color text,
  p_nombre text default null, p_acabado text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_yo uuid := auth.uid(); v_falta text; v_acabado text;
begin
  if v_yo is null then
    return jsonb_build_object('ok', false, 'error', 'Sin sesion.');
  end if;
  if not public.sable_abierto() then
    return jsonb_build_object('ok', false, 'error', 'El taller no esta disponible.');
  end if;

  -- SE COMPRUEBA QUE CADA PIEZA SEA TUYA, y que sea del tipo que dice ser.
  -- Sin lo segundo se podría montar un color en la ranura del pomo y el dibujo
  -- saldría con un hueco, sin un solo error.
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

  -- Un acabado que no existe se guarda como NULL (= cada pieza con el suyo) en
  -- vez de reventar la transaccion: una PWA vieja puede mandar uno retirado
  -- (§2g), y perder el sable entero por el color seria el peor cambio posible.
  v_acabado := nullif(btrim(coalesce(p_acabado, '')), '');
  if v_acabado is not null
     and not exists (select 1 from public.sable_acabados where id = v_acabado) then
    v_acabado := null;
  end if;

  insert into public.sable_diseno (user_id, emisor, cuerpo, pomo, color, nombre, acabado, actualizado)
  values (v_yo, p_emisor, p_cuerpo, p_pomo, p_color,
          nullif(btrim(coalesce(p_nombre,'')),''), v_acabado, now())
  on conflict (user_id) do update
    set emisor = excluded.emisor, cuerpo = excluded.cuerpo, pomo = excluded.pomo,
        color = excluded.color, nombre = excluded.nombre,
        acabado = excluded.acabado, actualizado = now();

  return jsonb_build_object('ok', true);
end;
$function$;

-- §3i: Postgres concede EXECUTE a PUBLIC en toda funcion nueva, y `anon` es
-- miembro de PUBLIC. Revocar de `anon` a secas NO alcanza.
revoke all on function public.sable_taller() from public;
revoke all on function public.comprar_parte_sable(text) from public;
revoke all on function public.guardar_sable(text, text, text, text, text, text) from public;
grant execute on function public.sable_taller() to authenticated;
grant execute on function public.comprar_parte_sable(text) to authenticated;
grant execute on function public.guardar_sable(text, text, text, text, text, text) to authenticated;

-- La firma de 5 argumentos queda huerfana: una PWA vieja que la llame guardaria
-- sin acabado, que es exactamente lo que hacia antes. Se deja a proposito.
