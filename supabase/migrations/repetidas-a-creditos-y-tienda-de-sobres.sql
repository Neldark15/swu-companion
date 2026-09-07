-- REPETIDAS → CRÉDITOS, Y LA TIENDA DE SOBRES.
--
-- Dos mitades de la misma idea: lo que sobra del álbum se convierte en la
-- moneda que ya existe, y con esa moneda se compran más sobres (y piezas de
-- sable, y terraformación: es UNA billetera, §4i).
--
-- ── UNA REPETIDA SALE DE `cartas_desbloqueadas`, NUNCA DE `collection` ──
--
-- Son dos tablas parecidas con dos orígenes distintos, y confundirlas es una
-- impresora de dinero. `collection` la escribe el cliente y se puede IMPORTAR
-- (`collectionImport.ts`): la colección más grande son 2.089 filas con
-- `quantity = 3` de una importación, así que canjear desde ahí sería regalar
-- créditos por un archivo de texto. `cartas_desbloqueadas` solo la escribe
-- `abrir_sobre()`, que es SECURITY DEFINER — verificado: las únicas funciones
-- que la nombran son `abrir_sobre`, las dos del álbum y estas dos, y
-- `authenticated` tiene sobre ella `rm`, o sea SELECT y nada más.
--
-- ── LA PRIMERA COPIA NUNCA SE CANJEA ─────────────────────────────────
--
-- El techo es siempre `cantidad - 1`. El álbum ES la colección: si el canje
-- pudiera vaciar una casilla, alguien perdería su Showcase por tocar un botón
-- que decía «convertir lo que te sobra». Verificado en transacción revertida:
-- canjeando TODO, las casillas vaciadas fueron 0.
--
-- ── POR QUÉ UN SOBRE CUESTA 250 Y NO 50 ──────────────────────────────
--
-- `abrir_sobre()` paga 50 XP (§4a) y los créditos SON el XP. Un sobre a menos
-- de 50 se paga solo: comprar, abrir, cobrar, comprar. Medido sobre las 700
-- aperturas reales: 211 repetidas, o sea un 6% — un sobre devuelve ~55
-- créditos entre el XP y lo que se pueda canjear. A 250, cada compra DRENA
-- ~195. La tienda es un sumidero, que es lo que a esta economía le faltaba.
--
-- ── Y NO ES UNA MÁQUINA TRAGAMONEDAS: HAY MENORES ────────────────────
--
-- Tope de 5 sobres por día, calculado con el día de El Salvador DENTRO de la
-- función (§3i: si el día viniera por parámetro, cualquiera pediría «el cupo
-- de ayer»). No se compra con dinero real y no se puede comprar sin límite.

-- ─────────────────────────────────────────────────────────────────────
-- Las tarifas, EDITABLES (§4s)
--
-- La escala de sobres de los torneos existió meses sin un escritor en la app y
-- por eso el 4.º de una final se quedó sin premio: un precio que necesita un
-- programador se queda viejo. Esto es una tabla.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.sobres_tarifas (
  clave text primary key,
  valor int not null check (valor >= 0),
  nota  text
);

alter table public.sobres_tarifas enable row level security;

-- Se LEE con sesión: el precio hay que mostrarlo, y una tienda que no dice
-- cuánto cuesta no es una tienda. No se escribe desde el cliente.
revoke all on table public.sobres_tarifas from anon, authenticated;
grant select on table public.sobres_tarifas to authenticated;

drop policy if exists sobres_tarifas_ver on public.sobres_tarifas;
create policy sobres_tarifas_ver on public.sobres_tarifas
  for select to authenticated using (true);

insert into public.sobres_tarifas (clave, valor, nota) values
  ('repetida:Hyperspace Foil',     10,  'la mas comun del sobre (62% de las tiradas)'),
  ('repetida:Showcase',            25,  '3% de la ranura de premio'),
  ('repetida:Standard Prestige',   35,  '8%'),
  ('repetida:Foil Prestige',       50,  '11%'),
  ('repetida:Serialized Prestige', 150, 'la mas rara; casi nunca se repite'),
  ('repetida:*',                   10,  'cualquier variante que no este arriba'),
  ('precio_sobre',                 250, 'creditos por sobre en la tienda'),
  ('tope_diario',                  5,   'sobres que se pueden comprar por dia')
on conflict (clave) do nothing;

-- ─────────────────────────────────────────────────────────────────────
-- LA CLAVE DE UNA TARIFA TIENE QUE CASAR CON UNA VARIANTE DE VERDAD
--
-- Esta fila estuvo mal y no falló: decía `repetida:Serializada` y la variante
-- que guarda `sobres_pool` es **`Serialized Prestige`**. La clave no casaba
-- con nada, caía en el comodín, y la carta más rara del juego pagaba 10
-- créditos en vez de 150 — un número plausible, quince veces más chico, sin un
-- solo error. Y la pantalla iba a anunciar la tarifa de la tabla mientras el
-- servidor pagaba otra, que es exactamente lo que el §4a prohíbe.
--
-- La tabla sigue siendo editable; lo que no se puede es teclear una clave que
-- no paga. `*` y `?` se admiten: son las dos claves especiales que el servidor
-- consulta de verdad — el comodín, y la carta que está en el álbum pero no en
-- el pool (una variante retirada, §3i).
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.sobres_tarifa_clave_valida()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare v_var text;
begin
  if new.clave like 'repetida:%' then
    v_var := substring(new.clave from 10);
    if v_var not in ('*', '?')
       and not exists (select 1 from public.sobres_pool p where p.variante = v_var)
    then
      raise exception
        'No existe la variante % en sobres_pool: esta tarifa nunca se aplicaria y se pagaria la de repetida:*.',
        v_var
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_sobres_tarifa_clave on public.sobres_tarifas;
create trigger trg_sobres_tarifa_clave
  before insert or update on public.sobres_tarifas
  for each row execute function public.sobres_tarifa_clave_valida();

-- ─────────────────────────────────────────────────────────────────────
-- Los RECIBOS. Son lo que mueve el saldo, no una bitácora.
--
-- `creditos_saldo()` deriva de estas dos tablas, igual que ya derivaba del
-- inventario del sable y del planeta: no hay una columna «saldo» que pueda
-- quedar vieja (§3c). Si el recibo no se escribe, la compra fue gratis.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.sobres_compras (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  sobres    int  not null check (sobres > 0),
  pagado_xp int  not null check (pagado_xp >= 0),
  creado_en timestamptz not null default now()
);

create table if not exists public.repetidas_canjes (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  cartas    int  not null check (cartas > 0),
  creditos  int  not null check (creditos >= 0),
  creado_en timestamptz not null default now()
);

alter table public.sobres_compras   enable row level security;
alter table public.repetidas_canjes enable row level security;

-- Supabase concede ALL por defecto a toda tabla nueva de `public` (§2j): hay
-- que REVOCAR, conceder SELECT no alcanza. Un INSERT desde el cliente en
-- `repetidas_canjes` sería créditos de la nada.
revoke all on table public.sobres_compras   from anon, authenticated;
revoke all on table public.repetidas_canjes from anon, authenticated;
grant select on table public.sobres_compras   to authenticated;
grant select on table public.repetidas_canjes to authenticated;

drop policy if exists sobres_compras_mias on public.sobres_compras;
create policy sobres_compras_mias on public.sobres_compras
  for select to authenticated using (user_id = auth.uid());

drop policy if exists repetidas_canjes_mios on public.repetidas_canjes;
create policy repetidas_canjes_mios on public.repetidas_canjes
  for select to authenticated using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────
-- UNA sola billetera
--
-- `creditos_saldo()` ya restaba el sable y el planeta. Ahora resta también los
-- sobres comprados y suma lo canjeado. Con dos cuentas separadas alguien
-- gastaría los mismos créditos dos veces y las dos pantallas cuadrarían por
-- separado.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.creditos_saldo()
returns int
language sql
stable
security definer
set search_path to 'public'
as $function$
  select greatest(0,
    coalesce((select xp from public.player_stats where user_id = auth.uid()), 0)
    - coalesce((select sum(pagado_xp) from public.sable_inventario   where user_id = auth.uid()), 0)
    - coalesce((select sum(pagado_xp) from public.planeta_inventario where user_id = auth.uid()), 0)
    - coalesce((select sum(pagado_xp) from public.sobres_compras     where user_id = auth.uid()), 0)
    + coalesce((select sum(cantidad)  from public.sable_bonos        where user_id = auth.uid()), 0)
    + coalesce((select sum(creditos)  from public.repetidas_canjes   where user_id = auth.uid()), 0)
  )
$function$;

-- ─────────────────────────────────────────────────────────────────────
-- `sobres_comprados_hoy()` — la regla del día, UNA vez
--
-- La comparten la función que MUESTRA el tope y la que lo APLICA. Con dos
-- copias, la pantalla diría «te quedan 3» y el servidor rechazaría —o al
-- revés— y las dos tendrían razón por su cuenta.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.sobres_comprados_hoy(p_user uuid)
returns int
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(sum(sobres), 0)::int
    from public.sobres_compras
   where user_id = p_user
     and (creado_en at time zone 'America/El_Salvador')::date
       = (now() at time zone 'America/El_Salvador')::date;
$function$;

-- ─────────────────────────────────────────────────────────────────────
-- `tienda_sobres()` — la pantalla entera en UNA lectura
--
-- Saldo, precio, tope, cuántos llevás hoy, tus repetidas con su tarifa ya
-- aplicada y los totales. Mismo criterio que `mi_liga()`: cuatro consultas
-- sueltas son cuatro viajes para pintar un bloque, y el «cuántos llevás hoy»
-- obligaría además al cliente a calcular el día de El Salvador por su cuenta.
--
-- Los totales los suma el SERVIDOR, con la misma expresión que después cobra
-- `canjear_repetidas()`. Sumarlos en la pantalla sería una segunda aritmética
-- que se puede separar de la que paga (§4a).
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.tienda_sobres()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_yo uuid := auth.uid();
  v_precio int; v_tope int;
begin
  if v_yo is null then return jsonb_build_object('ok', false, 'error', 'Sin sesion.'); end if;

  select valor into v_precio from public.sobres_tarifas where clave = 'precio_sobre';
  select valor into v_tope   from public.sobres_tarifas where clave = 'tope_diario';

  return jsonb_build_object(
    'ok', true,
    'saldo',       public.creditos_saldo(),
    'precio',      v_precio,
    'tope',        v_tope,
    'hoy',         public.sobres_comprados_hoy(v_yo),
    'disponibles', coalesce((select disponibles from public.sobres_saldo where user_id = v_yo), 0),
    'tarifas', (select coalesce(jsonb_object_agg(substring(t.clave from 10), t.valor), '{}'::jsonb)
                  from public.sobres_tarifas t where t.clave like 'repetida:%'),
    'repetidas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'cardId', x.card_id, 'variante', x.variante,
               'repetidas', x.repetidas, 'creditosCadaUna', x.vale,
               'creditos', x.repetidas * x.vale)
             order by x.repetidas * x.vale desc, x.repetidas desc)
        from (
          select d.card_id, coalesce(p.variante, '?') as variante,
                 d.cantidad - 1 as repetidas,
                 coalesce(
                   (select t.valor from public.sobres_tarifas t
                     where t.clave = 'repetida:' || coalesce(p.variante, '?')),
                   (select t.valor from public.sobres_tarifas t where t.clave = 'repetida:*'),
                   0) as vale
            from public.cartas_desbloqueadas d
            left join public.sobres_pool p on p.card_id = d.card_id
           where d.user_id = v_yo and d.cantidad > 1
        ) x), '[]'::jsonb),
    'repetidasCartas', coalesce((
      select sum(d.cantidad - 1)::int from public.cartas_desbloqueadas d
       where d.user_id = v_yo and d.cantidad > 1), 0),
    'repetidasCreditos', coalesce((
      select sum((d.cantidad - 1) * coalesce(
               (select t.valor from public.sobres_tarifas t
                 where t.clave = 'repetida:' || coalesce(p.variante, '?')),
               (select t.valor from public.sobres_tarifas t where t.clave = 'repetida:*'),
               0))::int
        from public.cartas_desbloqueadas d
        left join public.sobres_pool p on p.card_id = d.card_id
       where d.user_id = v_yo and d.cantidad > 1), 0)
  );
end;
$function$;

-- `mis_repetidas()` existió un rato y quedó absorbida por `tienda_sobres()`.
-- Una función sin llamador es el patrón que este repo documenta cuatro veces;
-- barrido de llamadores hecho antes de soltarla (§5h): cero.
drop function if exists public.mis_repetidas();

-- ─────────────────────────────────────────────────────────────────────
-- `canjear_repetidas(p_cartas)` — con null, TODO lo que sobra.
--
-- El descuento del álbum y el recibo van en la MISMA transacción: si el
-- descuento fallara, el recibo se revierte con él. No hay forma de cobrar sin
-- entregar ni de entregar sin cobrar.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.canjear_repetidas(p_cartas jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_yo uuid := auth.uid(); v_cartas int := 0; v_creditos int := 0;
begin
  if v_yo is null then return jsonb_build_object('ok', false, 'error', 'Sin sesion.'); end if;

  -- `drop table if exists` antes de cada temporal: dos canjes dentro de una
  -- misma transacción —una prueba— chocarían con «la tabla ya existe», y ese
  -- error no tiene nada que ver con el canje (§4z).
  drop table if exists _canje;
  create temporary table _canje on commit drop as
  select d.card_id,
         -- Lo pedido, topado por lo que de verdad sobra. Nunca toca la primera
         -- copia: `cantidad - 1` es el techo, siempre.
         least(
           coalesce((select (x->>'cantidad')::int
                       from jsonb_array_elements(coalesce(p_cartas, '[]'::jsonb)) x
                      where (x->>'cardId')::uuid = d.card_id),
                    case when p_cartas is null then d.cantidad - 1 else 0 end),
           d.cantidad - 1
         ) as cuantas,
         coalesce(
           (select t.valor from public.sobres_tarifas t
             where t.clave = 'repetida:' || coalesce(p.variante, '?')),
           (select t.valor from public.sobres_tarifas t where t.clave = 'repetida:*'),
           0) as vale
    from public.cartas_desbloqueadas d
    left join public.sobres_pool p on p.card_id = d.card_id
   where d.user_id = v_yo and d.cantidad > 1;

  delete from _canje where cuantas <= 0;

  select coalesce(sum(cuantas),0), coalesce(sum(cuantas * vale),0)
    into v_cartas, v_creditos from _canje;

  if v_cartas = 0 then
    return jsonb_build_object('ok', false, 'error', 'No tenes repetidas para canjear.',
                              'falta', 'repetidas');
  end if;

  update public.cartas_desbloqueadas d
     set cantidad = d.cantidad - c.cuantas
    from _canje c
   where d.user_id = v_yo and d.card_id = c.card_id;

  insert into public.repetidas_canjes (user_id, cartas, creditos)
  values (v_yo, v_cartas, v_creditos);

  return jsonb_build_object('ok', true, 'cartas', v_cartas, 'creditos', v_creditos,
                            'saldo', public.creditos_saldo());
end;
$function$;

-- ─────────────────────────────────────────────────────────────────────
-- `comprar_sobres(p_cantidad)`
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.comprar_sobres(p_cantidad int default 1)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_yo uuid := auth.uid();
  v_precio int; v_tope int; v_hoy int; v_costo int; v_saldo int;
begin
  if v_yo is null then return jsonb_build_object('ok', false, 'error', 'Sin sesion.'); end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 20 then
    return jsonb_build_object('ok', false, 'error', 'Cantidad invalida.', 'falta', 'cantidad');
  end if;

  select valor into v_precio from public.sobres_tarifas where clave = 'precio_sobre';
  select valor into v_tope   from public.sobres_tarifas where clave = 'tope_diario';
  if v_precio is null then
    return jsonb_build_object('ok', false, 'error', 'La tienda no esta configurada.');
  end if;

  -- El tope va por DÍA DE EL SALVADOR, como el sobre diario (§3i): la función
  -- calcula el día, no lo recibe — si viniera de afuera, cualquiera pediría
  -- «el cupo de ayer». Y sale del MISMO helper que lo muestra.
  v_hoy := public.sobres_comprados_hoy(v_yo);

  if v_tope is not null and v_hoy + p_cantidad > v_tope then
    return jsonb_build_object('ok', false,
      'error', format('Hoy podes comprar %s sobres y ya llevas %s.', v_tope, v_hoy),
      'falta', 'tope', 'tope', v_tope, 'hoy', v_hoy);
  end if;

  v_costo := v_precio * p_cantidad;
  v_saldo := public.creditos_saldo();
  if v_saldo < v_costo then
    return jsonb_build_object('ok', false,
      'error', format('Te faltan %s creditos.', v_costo - v_saldo),
      'falta', 'creditos', 'costo', v_costo, 'saldo', v_saldo);
  end if;

  -- El recibo PRIMERO: es lo que descuenta el saldo. Si el segundo insert
  -- fallara, esto se revierte con él — nunca se cobra sin entregar.
  insert into public.sobres_compras (user_id, sobres, pagado_xp)
  values (v_yo, p_cantidad, v_costo);

  insert into public.sobres_saldo (user_id, disponibles)
  values (v_yo, p_cantidad)
  on conflict (user_id) do update set disponibles = public.sobres_saldo.disponibles + p_cantidad,
                                      updated_at = now();

  return jsonb_build_object('ok', true, 'sobres', p_cantidad, 'costo', v_costo,
    'saldo', public.creditos_saldo(),
    'hoy', public.sobres_comprados_hoy(v_yo),
    'disponibles', (select disponibles from public.sobres_saldo where user_id = v_yo));
end;
$function$;

-- Los grants: `revoke ... from anon, public` y DESPUÉS conceder (§4e). Revocar
-- solo de PUBLIC no le quita el EXECUTE a `anon`, porque Supabase además tiene
-- un ALTER DEFAULT PRIVILEGES que se lo concede directo. Nadie sin sesión
-- tiene nada que hacer acá: las cuatro empiezan por `auth.uid()`.
revoke all on function public.creditos_saldo()              from anon, public;
revoke all on function public.tienda_sobres()               from anon, public;
revoke all on function public.canjear_repetidas(jsonb)      from anon, public;
revoke all on function public.comprar_sobres(int)           from anon, public;
revoke all on function public.sobres_comprados_hoy(uuid)    from anon, authenticated, public;
revoke all on function public.sobres_tarifa_clave_valida()  from anon, authenticated, public;

grant execute on function public.creditos_saldo()         to authenticated, service_role;
grant execute on function public.tienda_sobres()          to authenticated, service_role;
grant execute on function public.canjear_repetidas(jsonb) to authenticated, service_role;
grant execute on function public.comprar_sobres(int)      to authenticated, service_role;
-- El helper del día NO se le da a `authenticated`: toma un uuid por parámetro,
-- así que concedérselo sería dejar preguntar cuántos sobres compró hoy otro.
grant execute on function public.sobres_comprados_hoy(uuid) to service_role;
