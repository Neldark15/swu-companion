-- Duelos amistosos: el historial del CONTADOR de mesa
--
-- Guarda cómo va cada duelo físico (bases, victorias del mejor-de-3, rondas)
-- y contra quién, para que el historial cara-a-cara exista. Es AMISTOSO por
-- contrato: esta tabla no tiene triggers, no escribe en player_stats, no da
-- XP ni toca tournament_results. El ranking NO se entera de estos duelos —
-- pedido explícito, y la garantía es estructural, no una promesa del cliente.
--
-- El id lo genera el CLIENTE (crypto.randomUUID) para poder hacer upsert del
-- mismo duelo mientras avanza, sin ida y vuelta.
--
-- Verificado con los claims exactos de PostgREST, en transacciones revertidas:
--   · el creador inserta y re-upserta su duelo (1 fila, rondas avanzan)
--   · el RIVAL lo lee (cara-a-cara de los dos lados) y ve sus victorias
--   · un tercero ve 0 filas y su update afecta 0 (victorias intactas)
--   · player_stats no se movió en ninguna prueba

create table public.duelos_amistosos (
  id uuid primary key,
  creador_id uuid not null references public.profiles(id) on delete cascade,
  -- null = el rival no tiene cuenta (o no se eligió): el duelo se guarda igual
  rival_id uuid references public.profiles(id) on delete set null,
  rival_nombre text not null default '',
  base_creador text not null default '',
  base_rival text not null default '',
  victorias_creador int not null default 0 check (victorias_creador between 0 and 2),
  victorias_rival int not null default 0 check (victorias_rival between 0 and 2),
  rondas int not null default 1,
  terminado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ix_duelos_creador on public.duelos_amistosos (creador_id, created_at desc);
create index ix_duelos_rival on public.duelos_amistosos (rival_id, created_at desc);

alter table public.duelos_amistosos enable row level security;

-- Escribe SOLO quien lleva el teléfono (el creador). El rival puede LEER: el
-- cara-a-cara es de los dos.
create policy duelos_insert on public.duelos_amistosos
for insert with check (auth.uid() = creador_id);

create policy duelos_update on public.duelos_amistosos
for update using (auth.uid() = creador_id) with check (auth.uid() = creador_id);

create policy duelos_select on public.duelos_amistosos
for select using (auth.uid() = creador_id or auth.uid() = rival_id);

-- Sin DELETE a propósito: un historial que se puede borrar selectivamente es
-- un historial maquillable. Si algún día hace falta, se discute.
