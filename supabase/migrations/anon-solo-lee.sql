-- El anónimo solo LEE.
--
-- ── Qué estaba pasando ───────────────────────────────────────────────
--
-- 38 tablas del esquema `public` tenían INSERT, UPDATE y DELETE concedidos al
-- rol `anon`. No es que alguien los haya otorgado: en `public` el privilegio
-- POR DEFECTO de Supabase para tablas es `anon=arwdm`, así que cada tabla que
-- se creó nació con ellos. Es exactamente lo que advierte la §2j del
-- CLAUDE.md, cumplido 38 veces seguidas.
--
-- ── Por qué no era un agujero, y por qué igual se cierra ─────────────
--
-- Hoy no se puede explotar. Un GRANT no alcanza para escribir: hace falta
-- además una política que deje pasar la fila. Se revisaron TODAS las políticas
-- de escritura del esquema y la única que alcanza a un anónimo es
-- `encuesta_tcg_insert_anon`. Las demás comparan contra `auth.uid()`, que en
-- un anónimo es NULL, y `NULL = x` da NULL — que no es TRUE, así que ninguna
-- fila queda visible para escribir.
--
-- Se cierra porque el grant es la mitad de una cerradura de dos vueltas, y la
-- que queda dada es la política. El día que alguien escriba una política para
-- `{public}` cuya condición sea cierta sin sesión —un `true`, un
-- `is not null` mal puesto— ese grant es la diferencia entre un error y una
-- tabla que cualquiera edita desde la consola del navegador. Y esa política
-- futura se va a escribir pensando en la política, no en un grant que nadie
-- recuerda que existe.
--
-- ── La excepción ─────────────────────────────────────────────────────
--
-- `encuesta_tcg_respuestas` conserva INSERT: la encuesta pública se contesta
-- SIN cuenta. Se le quitan igual UPDATE y DELETE — se responde una vez, no se
-- edita ni se borra lo ajeno. (El formulario hace un POST pelado con
-- `Prefer: return=minimal`; no es un upsert, así que no necesita UPDATE.)

do $$
declare
  t record;
  tocadas int := 0;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')          -- tablas y particionadas, no vistas
      and c.relname <> 'encuesta_tcg_respuestas'
    order by c.relname
  loop
    -- Se nombran los privilegios en vez de usar ALL: un `revoke all` seguido
    -- de un `grant select` le DARÍA lectura a tablas que hoy no la tienen.
    -- Acá SELECT no se toca nunca.
    execute format(
      'revoke insert, update, delete, truncate, references, trigger on public.%I from anon',
      t.relname
    );
    tocadas := tocadas + 1;
  end loop;

  raise notice 'anon quedó de solo lectura en % tablas', tocadas;
end $$;

-- La encuesta: puede responder, no puede editar ni borrar.
revoke update, delete, truncate, references, trigger
  on public.encuesta_tcg_respuestas from anon;
grant insert on public.encuesta_tcg_respuestas to anon;

-- ── Y la causa raíz, para que no vuelva ──────────────────────────────
--
-- Sin esto, la próxima tabla que se cree vuelve a nacer con los tres
-- privilegios y este archivo queda desactualizado el día que se aplique.
-- A partir de acá, una tabla nueva le da al anónimo solo lectura; si alguna
-- necesita de verdad que se le escriba sin sesión —otra encuesta pública—,
-- ese grant se escribe A MANO, que es como debe verse una decisión así.
--
-- Solo se cambia el predeterminado de `postgres`, que es el rol con el que
-- corren las migraciones. El de `supabase_admin` es de la plataforma.
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon;
