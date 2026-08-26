-- FUERA TRUNCATE, REFERENCES Y TRIGGER de los roles de la API, en TODA tabla.
--
-- Medido: 37 tablas de `public` —incluidas profiles, collection, player_stats
-- y decks— tenían TRUNCATE concedido a `anon` y `authenticated` por los
-- privilegios por defecto de Supabase (§2j).
--
-- TRUNCATE es especial: **NO pasa por RLS**. Las policies no lo frenan. Hoy no
-- es explotable porque PostgREST no expone ese verbo, pero es un privilegio
-- cargado apoyado en un detalle de la API: si cualquier camino futuro diera
-- SQL arbitrario como esos roles, la primera defensa ya estaría regalada.
-- REFERENCES y TRIGGER igual: ningún cliente legítimo crea claves foráneas ni
-- triggers por la API.
--
-- Se revocan SOLO esos tres; SELECT/INSERT/UPDATE/DELETE los usa la app y los
-- gobierna RLS. Verificado tras aplicar: 0 tablas los conservan, el SELECT de
-- `authenticated` sigue intacto en 67 tablas y el perfil público carga normal.

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format(
      'revoke truncate, references, trigger on public.%I from anon, authenticated',
      t.tablename
    );
  end loop;
end $$;

-- Y que las tablas FUTURAS no nazcan con ellos.
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;
