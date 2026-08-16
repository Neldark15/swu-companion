-- El mazo con el que jugo cada quien en un torneo: lider y base.
-- Mismo formato que duelos_amistosos: el lider como «Nombre — Subtitulo», la
-- base como el nombre pelado. Vacio = no se sabe. Grants de tabla cubren las
-- columnas nuevas. Aplicada en prod via panel el 2026-08-16.
alter table public.tournament_standings
  add column if not exists leader text not null default '',
  add column if not exists base   text not null default '';

comment on column public.tournament_standings.leader is
  'Lider del jugador. «Nombre — Subtitulo». Vacio = desconocido.';
comment on column public.tournament_standings.base is
  'Base del jugador. Nombre pelado. Vacio = desconocido.';
