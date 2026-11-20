-- Geometrías de la galería del Taller Kyber, disponibles desde el primer sable.
insert into public.sable_partes
  (id, tipo, nombre, precio_xp, orden, rareza, potencia, control, energia, oculta)
values
  ('emi_cruceta', 'emisor', 'Cruceta', 0, 13, 'comun', 6, 4, 4, false),
  ('emi_orbita', 'emisor', 'Órbita', 0, 14, 'comun', 4, 6, 4, false),
  ('emi_lira', 'emisor', 'Lira', 0, 15, 'comun', 4, 4, 6, false),
  ('emi_prisma', 'emisor', 'Prisma', 0, 16, 'comun', 5, 4, 5, false),
  ('cue_shoto', 'cuerpo', 'Shoto', 0, 13, 'comun', 3, 7, 4, false),
  ('cue_pica', 'cuerpo', 'Asta larga', 0, 14, 'comun', 6, 5, 3, false),
  ('cue_reliquia', 'cuerpo', 'Cámara de reliquia', 0, 15, 'comun', 4, 4, 6, false),
  ('cue_senda', 'cuerpo', 'Senda', 0, 16, 'comun', 4, 6, 4, false),
  ('pom_cometa', 'pomo', 'Cometa', 0, 12, 'comun', 4, 6, 4, false),
  ('pom_contrapeso', 'pomo', 'Contrapeso', 0, 13, 'comun', 6, 4, 4, false),
  ('pom_gemelo', 'pomo', 'Emisor gemelo', 0, 14, 'comun', 4, 4, 6, false)
on conflict (id) do nothing;
