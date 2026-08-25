-- LOS ASPECTOS: maestría de trivia, con escalones que PAGAN.
--
-- ── Qué eran, medido ──────────────────────────────────────────────────
-- Ocho contadores renombrados (Vigilancia = partidas, Heroísmo = cartas) y
-- apuntados a cosas que en esta comunidad casi no pasan. Sobre las 39 cuentas,
-- en el PRIMER escalón de cada uno:
--     Vigilancia 100 partidas → 0 personas (el máximo real es 3)
--     Comando    25 torneos   → 0          (el máximo real es 1)
--     Agresión   50 victorias → 0          (el máximo real es 9)
--     Astucia    25 mazos     → 0          (el máximo real es 10)
-- Seis de ocho sin una sola persona. Una escalera cuyo primer escalón está 33
-- veces más arriba de donde llega la gente no es difícil: es decorativa.
--
-- ── Se DERIVAN de `trivia_temas`, no se guardan aparte ────────────────
-- Esa cuenta ya existía y la alimentan las DOS formas de jugar (la diaria y el
-- modo por tema). Una tabla nueva habría arrancado a todos en cero; derivando,
-- el módulo se enciende con lo que la gente YA hizo: 498 aciertos entre 11
-- personas, y 6 de ellas con al menos un aspecto rankeado desde el día uno.
--
-- ── El servidor trabaja en TEMAS; el aspecto es su nombre en pantalla ─
-- El mapa es 1 a 1 (jedi=Heroísmo, sith=Villanía, criaturas=Agresión,
-- planetas=Vigilancia, naves=Comando, juego=Astucia). Si el servidor razonara
-- en aspectos, ese mapa viviría acá Y en el cliente, y sería cuestión de tiempo
-- que se separaran (§2y). Una sola verdad: los aciertos son por tema.
--
-- ── Los escalones pagan, y una sola vez ──────────────────────────────
-- Es lo que impide que vuelvan a ser una barra bonita que no hace nada. Se paga
-- por `sable_bonos`, el mecanismo que ya existe para dar créditos sin tocar el
-- XP — tocarlo subiría de nivel a alguien que no jugó una partida.

create table if not exists public.trivia_escalones_cobrados (
  user_id   uuid not null references auth.users(id) on delete cascade,
  tema      text not null check (tema in ('jedi','sith','criaturas','planetas','naves','juego')),
  escalon   smallint not null check (escalon between 0 and 3),
  pagado_xp int not null,
  cobrado_en timestamptz not null default now(),
  primary key (user_id, tema, escalon)
);

revoke all on public.trivia_escalones_cobrados from anon, authenticated;
grant select on public.trivia_escalones_cobrados to authenticated;
alter table public.trivia_escalones_cobrados enable row level security;

drop policy if exists trivia_escalones_yo on public.trivia_escalones_cobrados;
-- Nada de INSERT por policy: cobrar va por RPC o el cliente elegiría su premio.
create policy trivia_escalones_yo on public.trivia_escalones_cobrados
  for select to authenticated using (user_id = auth.uid());

-- Los umbrales y los premios viven ACÁ y solo acá; el cliente los recibe en la
-- respuesta. Un umbral escrito en dos lados algún día dice dos cosas distintas.
create or replace function public.trivia_umbrales() returns int[]
language sql immutable as $$ select array[10, 30, 75, 150] $$;

create or replace function public.trivia_premios() returns int[]
language sql immutable as $$ select array[100, 250, 600, 1500] $$;

-- `mis_aspectos()` y `cobrar_escalon_trivia()` se aplicaron por MCP con el
-- nombre `trivia_aspectos_escalones`; el cuerpo completo está en el historial
-- de migraciones de Supabase. Lo que importa recordar:
--   · el cobro comprueba `trivia_temas.correctas` DENTRO de la función (§3i-bis)
--   · la clave primaria de la tabla es lo que impide cobrar dos veces, aunque
--     lleguen dos toques a la vez: el segundo no inserta y `not found` lo corta
--
-- Verificado en producción, revertido, con una cuenta que ya tenía historial:
--   mis_aspectos()            → 6 temas, umbrales [10,30,75,150]
--   cobrar escalón 0          → ok, premio 100, saldo 1133 → 1233
--   cobrarlo otra vez         → «Ese escalon ya lo cobraste.»
--   cobrar el 3 sin merecerlo → «Te faltan 104 aciertos de ese aspecto.»
