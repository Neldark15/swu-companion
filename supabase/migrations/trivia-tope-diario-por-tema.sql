-- TOPE DIARIO EN `trivia_sumar_tema`, y por qué hacía falta HOY y no ayer.
--
-- La función sumaba un acierto cada vez que la llamaban, SIN TOPE. Mientras ese
-- contador solo pintaba una medalla cosmética, era un problema de vanidad.
-- Desde que los aspectos PAGAN —hasta 1.500 créditos por escalón, y esos
-- créditos compran piezas de sable y terraformación— un bucle de consola
-- llamando a esta RPC es una impresora de dinero.
--
-- EL AGUJERO LO ABRÍ YO HOY: `cobrar_escalon_trivia` verifica contra
-- `trivia_temas.correctas`, o sea que le di valor económico a un contador que
-- no estaba defendido. Es la forma más común de crear un agujero — no
-- escribiendo código inseguro, sino conectando algo que ya existía a algo que
-- ahora vale dinero.
--
-- Medido ANTES de tocar nada: nadie lo había usado. Máximo 10 respuestas por
-- día, cero ids repetidos, 680 XP repartidos en total.
--
-- ── El tope es 20 por tema y por día, y sale de contar ────────────────
-- Lo máximo legítimo de UN tema en un día:
--   10 del modo por tema + 10 de la diaria (si las diez cayeran del mismo
--   tema, improbable pero posible) = 20.
-- No se afina más porque un tope que corta a alguien que jugó de verdad es peor
-- que uno holgado que corta el bucle.
--
-- Pasado el tope se DEVUELVE lo que ya había en vez de reventar: quien llegó
-- ahí jugando no tiene por qué ver un error, y a quien esté en un bucle no hay
-- que darle la señal de que lo detectamos. Lo que importa es que el contador
-- que paga no se mueva.

create table if not exists public.trivia_dia_tema (
  user_id  uuid not null references auth.users(id) on delete cascade,
  dia      date not null,
  tema     text not null,
  cuantas  int  not null default 0,
  primary key (user_id, dia, tema)
);

revoke all on public.trivia_dia_tema from anon, authenticated;
alter table public.trivia_dia_tema enable row level security;
-- Sin policies A PROPÓSITO: nadie la toca directo, solo la RPC SECURITY DEFINER.

-- El cuerpo de `trivia_sumar_tema` con el tope está en el historial de
-- migraciones de Supabase con el nombre `trivia_tope_diario_por_tema`.

-- §2j: `trivia_progress` salió con TODOS los privilegios por defecto de
-- Supabase —incluidos DELETE, TRUNCATE, REFERENCES y TRIGGER—, que el cliente
-- no necesita. RLS limita las FILAS a las propias, pero no hace falta poder
-- truncar la tabla para anotar diez respuestas.
revoke all on public.trivia_progress from anon, authenticated;
grant select, insert, update on public.trivia_progress to authenticated;

-- Verificado en producción, revertido: 60 llamadas seguidas al mismo tema
-- suben las correctas de 46 a 66 — o sea 20, el tope — y ahí se detienen.
