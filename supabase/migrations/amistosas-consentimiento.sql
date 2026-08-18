-- ═══════════════════════════════════════════════════════════════════════════
-- AMISTOSAS: mazo adjunto + consentimiento del rival
--
-- Hasta ahora una amistosa la anotaba UNA persona y quedaba entre las dos: la
-- policy de lectura es `creador OR rival`. Eso alcanzaba para el historial
-- personal, pero no para lo que se quiere ahora — saber qué mazos se juegan
-- de verdad fuera de torneo y meterlo al meta.
--
-- La regla es simple y no se negocia: NADIE publica la partida de otro. El
-- creador anota; al rival le cae la partida como PENDIENTE; solo si acepta,
-- la fila pasa a `confirmada` y recién ahí es pública y cuenta para el meta.
-- Una partida contra un invitado sin cuenta (`rival_id IS NULL`) no tiene a
-- quién preguntarle, así que nace `sin_rival` y se queda privada para siempre.
--
-- Por qué el mazo va como REFERENCIA y no como copia: `decks` ya guarda la
-- lista completa y su dueño la puede corregir. Copiarla acá sería congelar
-- una versión y tener dos verdades. La contra —que borrar el mazo deja el
-- duelo sin lista— se acepta: el líder y la base, que es lo que el meta
-- necesita, viven en columnas de texto de esta misma tabla y no se van.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Columnas nuevas ─────────────────────────────────────────────────────

alter table public.duelos_amistosos
  add column if not exists estado text not null default 'pendiente',
  add column if not exists confirmado_at timestamptz,
  -- TEXT y no uuid: `decks.id` es text (los mazos traen ids que vienen del
  -- espejo local de Dexie, no todos son uuid). Declararlo uuid hace que la
  -- foreign key ni se pueda crear: «Key columns are of incompatible types».
  add column if not exists mazo_creador_id text references public.decks(id) on delete set null,
  add column if not exists mazo_rival_id   text references public.decks(id) on delete set null;

do $$ begin
  alter table public.duelos_amistosos
    add constraint duelos_estado_valido
    check (estado in ('pendiente', 'confirmada', 'rechazada', 'sin_rival'));
exception when duplicate_object then null; end $$;

-- Una fila sin rival con cuenta NO puede quedar pendiente: no hay quien
-- confirme, y una pendiente eterna es basura que ensucia el contador.
do $$ begin
  alter table public.duelos_amistosos
    add constraint duelos_estado_coherente
    check (rival_id is not null or estado in ('sin_rival', 'rechazada'));
exception when duplicate_object then null; end $$;

-- ── 2. Las filas que ya existen ────────────────────────────────────────────
-- Nada se publica solo. Las que tienen rival quedan PENDIENTES —la persona
-- decide, y de paso estrena la pantalla con algo real dentro— y las de
-- invitado pasan a `sin_rival`.
update public.duelos_amistosos set estado = 'sin_rival' where rival_id is null;
update public.duelos_amistosos set estado = 'pendiente' where rival_id is not null and estado not in ('confirmada','rechazada');

-- ── 3. Lectura pública SOLO de lo confirmado ───────────────────────────────
-- Se suma a la policy existente (`creador OR rival`), no la reemplaza: las
-- policies de SELECT se combinan con OR, así que cada quien sigue viendo sus
-- propias partidas pendientes y además todo el mundo ve las confirmadas.
drop policy if exists duelos_publicos on public.duelos_amistosos;
create policy duelos_publicos on public.duelos_amistosos
  for select using (estado = 'confirmada');

-- ── 4. Confirmar o rechazar ────────────────────────────────────────────────
-- Va por función y no por una policy de UPDATE para el rival, por una razón
-- concreta: RLS es por FILA, no por columna. Una policy que dejara al rival
-- escribir la fila lo dejaría cambiar también el marcador y los mazos del
-- creador. Acá el rival toca exactamente cuatro cosas: el estado, su propio
-- líder, su propia base y su propio mazo.
create or replace function public.confirmar_amistosa(
  p_duelo   uuid,
  p_acepta  boolean,
  p_lider   text default null,
  p_base    text default null,
  p_mazo    text default null
) returns public.duelos_amistosos
language plpgsql
security definer
set search_path = public
as $$
declare
  fila public.duelos_amistosos;
begin
  select * into fila from public.duelos_amistosos where id = p_duelo for update;
  if not found then
    raise exception 'El duelo no existe' using errcode = 'no_data_found';
  end if;

  -- SOLO el rival. Ni el creador (que ya dio su consentimiento al anotarla),
  -- ni un tercero que adivine el uuid.
  if fila.rival_id is distinct from auth.uid() then
    raise exception 'Solo el rival puede confirmar esta partida' using errcode = 'insufficient_privilege';
  end if;

  if fila.estado not in ('pendiente', 'rechazada') then
    raise exception 'Esta partida ya está %', fila.estado using errcode = 'invalid_parameter_value';
  end if;

  -- El mazo tiene que ser DE QUIEN CONFIRMA. Sin esto, cualquiera podría
  -- colgar el mazo de otra persona de una partida suya.
  if p_mazo is not null and not exists (
    select 1 from public.decks d where d.id = p_mazo and d.user_id = auth.uid()
  ) then
    raise exception 'Ese mazo no es tuyo' using errcode = 'insufficient_privilege';
  end if;

  update public.duelos_amistosos set
    estado        = case when p_acepta then 'confirmada' else 'rechazada' end,
    confirmado_at = now(),
    -- El rival puede corregir SU lado: el creador anota de memoria y a veces
    -- se equivoca de líder, o lo deja en blanco.
    lider_rival   = coalesce(nullif(trim(p_lider), ''), lider_rival),
    base_rival    = coalesce(nullif(trim(p_base), ''), base_rival),
    mazo_rival_id = coalesce(p_mazo, mazo_rival_id),
    updated_at    = now()
  where id = p_duelo
  returning * into fila;

  return fila;
end;
$$;

revoke all on function public.confirmar_amistosa(uuid, boolean, text, text, text) from public, anon;
grant execute on function public.confirmar_amistosa(uuid, boolean, text, text, text) to authenticated;

-- ── 5. El mazo de una partida publicada ────────────────────────────────────
-- `decks` solo deja ver el mazo propio o uno marcado público. Adjuntar un
-- mazo a una partida que ACEPTASTE publicar es un consentimiento distinto y
-- más chico: se ve esa lista, en esa partida, sin volver público el mazo
-- entero ni el resto de tu colección.
create or replace function public.mazo_de_amistosa(p_duelo uuid, p_lado text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select d.data
  from public.duelos_amistosos du
  join public.decks d
    on d.id = case when p_lado = 'creador' then du.mazo_creador_id else du.mazo_rival_id end
  where du.id = p_duelo
    and du.estado = 'confirmada';
$$;

revoke all on function public.mazo_de_amistosa(uuid, text) from public;
grant execute on function public.mazo_de_amistosa(uuid, text) to authenticated, anon;

-- ── 6. El meta amistoso ────────────────────────────────────────────────────
-- Agregado, no filas: para el meta lo que importa es qué líder+base se juega
-- y cómo le va, no quién jugó contra quién. Va por función `stable` para que
-- el planificador la pueda cachear dentro de la consulta.
create or replace function public.meta_amistoso(p_desde timestamptz default now() - interval '90 days')
returns table (
  lider text,
  base text,
  partidas bigint,
  ganadas bigint,
  perdidas bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with lados as (
    -- Cada duelo aporta DOS filas, una por lado. Sin esto solo se vería el
    -- mazo de quien anotó, y quien anota es siempre el mismo tipo de persona
    -- (la que lleva el teléfono): el meta saldría sesgado hacia sus mazos.
    select lider_creador as lider, base_creador as base,
           victorias_creador as gano, victorias_rival as perdio
    from public.duelos_amistosos
    where estado = 'confirmada' and created_at >= p_desde
    union all
    select lider_rival, base_rival, victorias_rival, victorias_creador
    from public.duelos_amistosos
    where estado = 'confirmada' and created_at >= p_desde
  )
  select lider, base,
         count(*)::bigint,
         sum(case when gano > perdio then 1 else 0 end)::bigint,
         sum(case when perdio > gano then 1 else 0 end)::bigint
  from lados
  where coalesce(nullif(trim(lider), ''), '') <> ''
  group by lider, base
  order by count(*) desc, lider;
$$;

revoke all on function public.meta_amistoso(timestamptz) from public;
grant execute on function public.meta_amistoso(timestamptz) to authenticated, anon;

-- ── 7. Índices ─────────────────────────────────────────────────────────────
-- El rival consulta «¿qué tengo pendiente?» cada vez que abre la pantalla.
create index if not exists duelos_pendientes_idx
  on public.duelos_amistosos (rival_id) where estado = 'pendiente';
create index if not exists duelos_confirmadas_idx
  on public.duelos_amistosos (created_at desc) where estado = 'confirmada';

commit;
