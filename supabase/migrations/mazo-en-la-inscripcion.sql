-- El mazo se declara AL INSCRIBIRSE.
--
-- Nel: «cuando se inscriban seria bueno tambien pedir que coloquen el mazo o
-- en su defecto lideres y base», y «mostrar el deck twin suns que se va usar».
--
-- Hoy el mazo de cada quien se cargaba A MANO despues del torneo, uno por uno,
-- preguntandole a cada persona que habia jugado. Los doce del torneo del 29/8
-- se escribieron asi, y uno quedo inventado porque nadie se acordaba.
--
-- Se guardan DOS lideres porque un Twin Suns se juega con dos. `leader_2` en
-- NULL es un Premier normal, no un dato a medias.
--
-- El formato del texto es el MISMO que en `tournament_standings`: el lider
-- como «Nombre — Subtitulo» y la base por nombre pelado. Eso no es capricho:
-- es lo que el indice de cartas del cliente sabe resolver a un arte, y usar
-- otro formato aca obligaria a traducir en cada lectura.
alter table public.event_registrations
  add column if not exists leader_1 text,
  add column if not exists leader_2 text,
  add column if not exists base_carta text,
  add column if not exists deck_nombre text;

comment on column public.event_registrations.leader_1 is
  'Lider como «Nombre — Subtitulo», igual que tournament_standings.leader.';
comment on column public.event_registrations.leader_2 is
  'Segundo lider (Twin Suns). NULL en Premier.';
comment on column public.event_registrations.base_carta is
  'Base por nombre pelado, igual que tournament_standings.base.';
