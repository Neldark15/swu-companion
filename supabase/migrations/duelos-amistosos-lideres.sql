-- Duelos amistosos: guardar también el LÍDER de cada lado
--
-- La tabla nació desde el Contador de mesa, donde lo único que hacía falta era
-- la BASE: es la carta que lleva la vida, y el contador cuenta vida. Pero un
-- duelo no se identifica por la base — se identifica por el LÍDER. «Ahsoka con
-- base azul» y «Cad Bane con base azul» son el mismo `base_creador` y dos
-- mazos que no se parecen en nada.
--
-- Sin líder, el historial cara-a-cara no puede responder la única pregunta que
-- de verdad se hace en la mesa: «¿cómo me va con este mazo contra el suyo?».
--
-- ── Por qué texto y no un uuid de carta ──────────────────────────────
--
-- Por consistencia con `base_creador`/`base_rival`, que ya guardan el NOMBRE
-- impreso (`x.base.name` en ContadorPage). Mezclar uuid en unas columnas y
-- nombre en otras obligaría a resolver dos caminos en cada lectura. Y el
-- nombre sobrevive a que una carta salga del pool: un duelo de hace un año se
-- sigue leyendo aunque el líder ya no esté en el Premier vigente.
--
-- El precio es que el nombre no lleva subtítulo, y hay 4 «Ahsoka Tano»
-- distintas. Por eso se guarda **nombre + subtítulo** cuando el subtítulo
-- existe, en una sola cadena: «Ahsoka Tano — Trust in the Force». Es lo que
-- distingue un líder de otro, y es lo que la gente dice en voz alta.
--
-- ── Grants ───────────────────────────────────────────────────────────
--
-- No hace falta tocarlos. Verificado contra producción: `duelos_amistosos`
-- tiene los grants a nivel de TABLA para `anon` y `authenticated`, y un grant
-- de tabla cubre todas las columnas, presentes **y futuras** (gotcha 2j de
-- CLAUDE.md, acá jugando a favor). Las columnas nuevas quedan escribibles sin
-- una línea más. Quien escriba lo sigue decidiendo RLS: `auth.uid() =
-- creador_id`, que no cambia.
--
-- Sigue siendo AMISTOSA por contrato: sin triggers, sin XP, sin player_stats,
-- sin tournament_results. Esta migración no agrega ninguno.

alter table public.duelos_amistosos
  add column if not exists lider_creador text not null default '',
  add column if not exists lider_rival   text not null default '';

comment on column public.duelos_amistosos.lider_creador is
  'Líder de quien creó el duelo. «Nombre — Subtítulo» cuando hay subtítulo. Vacío = duelo viejo del Contador, que no lo pedía.';
comment on column public.duelos_amistosos.lider_rival is
  'Líder del rival. Mismo formato que lider_creador.';
