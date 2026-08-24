-- EL TALLER DE SABLES — armá tu sable y comprá piezas con XP.
-- Aplicada en producción el 2026-08-23 (dos migraciones por MCP:
-- `sable_taller_base` y `sable_taller_rpcs`). Queda escrita acá por el §3o:
-- un DDL aplicado y no versionado deja al proyecto documentando un esquema que
-- no está en ningún lado.
--
-- ── Las cuatro decisiones que importan ───────────────────────────────
--
-- 1. LA PUERTA ES `sable_probadores`, NO `role = 'admin'`. Hay cuatro admins y
--    esto lo ve una sola persona. Y a propósito NO hay escotilla: un admin que
--    pueda darse la llave vuelve la restricción decorativa (§3i-bis). Se
--    reparte insertando la fila desde el SQL Editor.
--
-- 2. EL GUARDIA VA DENTRO DE CADA RPC. Son SECURITY DEFINER con EXECUTE para
--    `authenticated` entero: sin el `if not es_probador_sable()` de adentro,
--    cualquier logueado leería el taller. Es exactamente lo que costó una
--    prueba en `temporada_tabla()`.
--
-- 3. SE PAGA CON XP. Medido: el XP no tiene sumidero en toda la app — solo
--    entra y lo único que hace es subir el nivel. Pagar con sobres competiría
--    con abrirlos, y con 333 sobres sin abrir eso es lo último que hace falta.
--
-- 4. GASTAR NO BAJA DE NIVEL. `player_stats.level` se DERIVA de `xp`, así que
--    restar de ahí te degradaría — comprar un pomo te bajaría de 11 a 10. `xp`
--    sigue siendo el total DE POR VIDA y el saldo se DERIVA:
--    total − sum(sable_inventario.pagado_xp). Sin columna nueva y sin dos
--    verdades (§3c): el recibo de cada compra ya es el cobro.
--
-- La FORMA de cada pieza (el perfil del torneado) vive en TypeScript
-- (`src/features/sable/partesSable.ts`), no acá: la base no guarda datos de
-- presentación que no puede usar ni validar (§2y).

create table if not exists public.sable_probadores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  desde   timestamptz not null default now()
);

create table if not exists public.sable_partes (
  id text primary key,
  tipo text not null check (tipo in ('emisor','cuerpo','pomo','color')),
  nombre text not null,
  precio_xp int not null check (precio_xp >= 0),
  -- Precio 0 = equipo inicial: se tiene sin comprar, así que el sable SIEMPRE
  -- se puede dibujar. Un taller que arranca sin piezas se ve roto.
  orden int not null default 0
);

create table if not exists public.sable_inventario (
  user_id uuid not null references auth.users(id) on delete cascade,
  parte_id text not null references public.sable_partes(id) on delete cascade,
  comprado_en timestamptz not null default now(),
  pagado_xp int not null default 0,
  primary key (user_id, parte_id)
);

create table if not exists public.sable_diseno (
  user_id uuid primary key references auth.users(id) on delete cascade,
  emisor text not null references public.sable_partes(id),
  cuerpo text not null references public.sable_partes(id),
  pomo   text not null references public.sable_partes(id),
  color  text not null references public.sable_partes(id),
  nombre text,
  actualizado timestamptz not null default now()
);

-- REVOCAR primero (§2j): Supabase concede ALL por defecto en toda tabla nueva
-- de `public`. Conceder no alcanza.
revoke all on public.sable_probadores, public.sable_partes,
              public.sable_inventario, public.sable_diseno
  from anon, authenticated;
grant select on public.sable_partes, public.sable_probadores,
                public.sable_inventario, public.sable_diseno
  to authenticated;

alter table public.sable_probadores enable row level security;
alter table public.sable_partes     enable row level security;
alter table public.sable_inventario enable row level security;
alter table public.sable_diseno     enable row level security;

-- Cada quien pregunta por SÍ MISMO: ver la fila de otro delata quién tiene acceso.
create policy sable_probadores_yo on public.sable_probadores
  for select to authenticated using (user_id = auth.uid());
create policy sable_partes_leer on public.sable_partes
  for select to authenticated using (true);
-- Nada de INSERT/UPDATE por policy: comprar y guardar van por RPC, o el cliente
-- elegiría su propio precio.
create policy sable_inventario_yo on public.sable_inventario
  for select to authenticated using (user_id = auth.uid());
create policy sable_diseno_yo on public.sable_diseno
  for select to authenticated using (user_id = auth.uid());

-- El catálogo inicial y las cuatro RPC (`es_probador_sable`, `sable_saldo_xp`,
-- `sable_taller`, `comprar_parte_sable`, `guardar_sable`) están aplicados tal
-- como se escribieron en las migraciones por MCP. Lo que NO se puede olvidar al
-- recrearlas: EXECUTE se revoca de PUBLIC y no solo de `anon` (§3i) — Postgres
-- lo concede a PUBLIC en toda función nueva y `anon` es miembro de PUBLIC.
--
-- Probado con `set local role authenticated` en transacción revertida, 11 de 11:
-- un admin NO probador es rechazado al abrir y al comprar; no se compra dos
-- veces la misma pieza; no se compra la gratis; una pieza inventada se rechaza;
-- no se guarda con una pieza sin comprar; y un COLOR en la ranura del pomo se
-- rechaza por el chequeo de tipo.
