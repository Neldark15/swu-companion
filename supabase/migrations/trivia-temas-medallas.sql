-- ─────────────────────────────────────────────────────────────────────
-- Trivia por temas: el contador que alimenta las medallas.
-- Aplicada en producción el 2026-08-18 (apply_migration trivia_temas_medallas).
--
-- Una fila por persona y tema. Las MEDALLAS no se guardan: se derivan de
-- `correctas` contra umbrales fijos en el cliente (bronce 10 / plata 25 /
-- oro 50, en trivia.ts). Guardar la medalla sería una segunda fuente de
-- verdad que puede desincronizarse del conteo que la produce.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.trivia_temas (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  tema        text not null check (tema in ('jedi','sith','criaturas','planetas','naves','juego')),
  correctas   integer not null default 0 check (correctas >= 0),
  respondidas integer not null default 0 check (respondidas >= 0 and respondidas >= correctas),
  primary key (user_id, tema)
);

alter table public.trivia_temas enable row level security;

create policy "Cada quien su progreso de temas"
  on public.trivia_temas for select to authenticated
  using (user_id = auth.uid());

-- Ni INSERT ni UPDATE directos: la única escritura es la RPC de abajo, que
-- suma de a uno. Un UPDATE abierto dejaría ponerse `correctas = 999999` y las
-- medallas serían decoración autoservida. Verificado: el update directo rebota.
revoke all on public.trivia_temas from anon, authenticated;
grant select (user_id, tema, correctas, respondidas) on public.trivia_temas to authenticated;

-- Suma UNA respuesta al tema. Atómica: el upsert con incremento evita la
-- carrera leer-modificar-escribir de dos respuestas rápidas seguidas.
create or replace function public.trivia_sumar_tema(p_tema text, p_correcta boolean)
returns table (correctas integer, respondidas integer)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Sin sesión';
  end if;
  if p_tema not in ('jedi','sith','criaturas','planetas','naves','juego') then
    raise exception 'Tema desconocido';
  end if;

  return query
  insert into trivia_temas as t (user_id, tema, correctas, respondidas)
  values (auth.uid(), p_tema, case when p_correcta then 1 else 0 end, 1)
  on conflict (user_id, tema) do update
    set correctas   = t.correctas + (case when p_correcta then 1 else 0 end),
        respondidas = t.respondidas + 1
  returning t.correctas, t.respondidas;
end $$;

revoke all on function public.trivia_sumar_tema(text, boolean) from anon;
grant execute on function public.trivia_sumar_tema(text, boolean) to authenticated;
