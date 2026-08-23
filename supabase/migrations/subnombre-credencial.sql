-- ═══════════════════════════════════════════════════════════════════════
--  SUB-NOMBRE DE LA CREDENCIAL — y por qué la prohibición vive ACÁ
-- ═══════════════════════════════════════════════════════════════════════
--
--  Debajo del apodo de la placa va una línea chica: «The Creator» en la de
--  Nelson, y la que cada quien elija en la suya. Con una regla: nadie más
--  puede ponerse nada que apunte al creador de la plataforma.
--
--  ── Por qué no alcanza con validarlo en el cliente ────────────────────
--
--  El apodo y la ubicación de la credencial viven en `settings` (un JSON que
--  el cliente escribe entero), así que lo natural era meter el sub-nombre ahí
--  al lado. Pero la credencial se EXPORTA a PNG y se comparte —eso es lo que
--  hace `exportarCredencial`, y §3b lo documenta—, o sea que el sub-nombre
--  termina en una imagen que circula. Una regla que solo vive en el navegador
--  se salta editando `localStorage`: no es una regla, es una sugerencia.
--
--  Por eso es COLUMNA con disparador, y no una llave más del JSON.
--
--  ── El creador no se escribe: se DERIVA ───────────────────────────────
--
--  «The Creator» no se teclea. Sale de estar en `centro_curadores`, que es la
--  tabla que el Centro de Temporada ya usa para decir «solo Nelson» y que a
--  propósito no tiene escotilla de admin (§3i-bis). Si el título se pudiera
--  escribir, la prohibición sería decorativa: bastaría con escribirlo.
--
--  ── La normalización, y por qué no basta con `lower()` ────────────────
--
--  Comparar en minúsculas deja pasar «Cre4dor», «C R E A T O R», «Créator» y
--  «the-creator». Antes de comparar se quitan tildes, se traducen los números
--  que se usan como letras (0→o, 1→i, 3→e, 4→a, 5→s, 7→t) y se borra todo lo
--  que no sea una letra. Recién ahí se buscan las raíces.
--
--  Se bloquean RAÍCES, no frases: `creator`, `creador`, `creater`, `kreator`,
--  `kreador`, `creatore`, `criador`. Así «The Creator», «el creador»,
--  «Creador de la plataforma» y «xXcreatorXx» caen todas con una sola regla.
--
--  Lo que NO se bloquea, a propósito: `creado`, `crear`, `creativo`. Nel pidió
--  que no se pueda apuntar a él, no prohibir un verbo común — «Creativo» o
--  «Creado en SV» son sub-nombres legítimos.
-- ═══════════════════════════════════════════════════════════════════════

begin;

alter table public.profiles
  add column if not exists subnombre text;

-- 24 caracteres es lo que entra en la placa sin partirse; se mide en el banco.
alter table public.profiles
  drop constraint if exists profiles_subnombre_largo;
alter table public.profiles
  add constraint profiles_subnombre_largo
  check (subnombre is null or char_length(subnombre) <= 24);

-- `unaccent` es una extensión y puede no estar; esto hace lo mismo para las
-- letras que importan y no agrega una dependencia por seis caracteres.
create or replace function public.unaccent_simple(p_texto text)
returns text
language sql
immutable
set search_path = public
as $$
  select translate(coalesce(p_texto, ''),
                   'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
                   'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC');
$$;

-- ── La normalización ─────────────────────────────────────────────────────
create or replace function public.normalizar_subnombre(p_texto text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(
           translate(
             lower(unaccent_simple(coalesce(p_texto, ''))),
             '0134557@$', 'oieassst'
           ),
           '[^a-z]', '', 'g'
         );
$$;


-- ── ¿Apunta al creador? ──────────────────────────────────────────────────
create or replace function public.subnombre_reservado(p_texto text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select exists (
    select 1
    from unnest(array['creator','creador','creater','kreator','kreador','creatore','criador']) raiz
    where public.normalizar_subnombre(p_texto) like '%' || raiz || '%'
  );
$$;

-- ── El disparador: la regla, aplicada ────────────────────────────────────
create or replace function public.trg_subnombre_reservado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.subnombre is null or btrim(new.subnombre) = '' then
    new.subnombre := null;
    return new;
  end if;

  new.subnombre := btrim(new.subnombre);

  -- El creador de la plataforma sí puede. Se comprueba contra
  -- `centro_curadores`, la tabla que ya significa «solo Nelson».
  if public.subnombre_reservado(new.subnombre)
     and not exists (select 1 from public.centro_curadores c where c.user_id = new.id)
  then
    raise exception 'Ese sub-nombre está reservado para el creador de la plataforma.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_subnombre on public.profiles;
create trigger trg_profiles_subnombre
  before insert or update of subnombre on public.profiles
  for each row execute function public.trg_subnombre_reservado();

-- ── Permisos ─────────────────────────────────────────────────────────────
-- §2o: `authenticated` tiene una LISTA EXPLÍCITA de columnas actualizables en
-- `profiles`. Una columna nueva no entra sola: sin esta línea, guardar el
-- sub-nombre falla con «permission denied for table profiles».
grant update (subnombre) on public.profiles to authenticated;

-- Se lee junto con el resto del perfil público. `anon` también tiene una lista
-- explícita de columnas legibles (§2j), así que hay que sumarla ahí.
grant select (subnombre) on public.profiles to anon, authenticated;

revoke all on function public.normalizar_subnombre(text) from public, anon;
revoke all on function public.subnombre_reservado(text) from public, anon;
grant execute on function public.subnombre_reservado(text) to authenticated;

commit;
