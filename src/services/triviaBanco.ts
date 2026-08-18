/**
 * Banco de trivia por TEMAS — HOLOCRON SWU
 *
 * Extiende el banco original de src/services/trivia.ts agregando a cada
 * pregunta un `tema` (jedi, sith, criaturas, planetas, naves, juego) y
 * sumando preguntas nuevas hasta que cada tema tenga mínimo 14.
 *
 * REGLA INMUTABLE: los `id` de las preguntas viven en la base de datos como
 * respuestas ya registradas de la gente (trivia_progress.answered_ids).
 * NUNCA cambiar ni reciclar un id existente (u##, s##, n##): romperías el
 * progreso guardado. Las preguntas nuevas usan el prefijo `n` y continúan
 * la numeración; una pregunta retirada se elimina, su id no se reutiliza.
 *
 * Exactitud: solo hechos canónicos y verificables de las películas/series
 * principales o del juego Star Wars: Unlimited. Ante la duda, la pregunta
 * no se escribe.
 */

// ─── Types ──────────────────────────────────────────────────

export type TemaTrivia = 'jedi' | 'sith' | 'criaturas' | 'planetas' | 'naves' | 'juego'

export interface PreguntaTrivia {
  id: string
  question: string
  options: string[]
  correctIndex: number
  category: 'universe' | 'swu'
  funFact: string
  tema: TemaTrivia
}

// ─── Banco de preguntas ─────────────────────────────────────

export const BANCO_TRIVIA: PreguntaTrivia[] = [
  // ═══ JEDI (personajes / la Orden Jedi) ═══════════════════

  // — existentes (ids inmutables) —
  { id: 'u02', question: '¿Qué color es el sable de luz de Mace Windu?', options: ['Azul', 'Verde', 'Púrpura', 'Rojo'], correctIndex: 2, category: 'universe', funFact: 'Samuel L. Jackson pidió un sable púrpura para distinguirse en las escenas de batalla.', tema: 'jedi' },
  { id: 'u03', question: '¿Quién dijo "Haz o no hagas, no hay intentar"?', options: ['Obi-Wan Kenobi', 'Yoda', 'Luke Skywalker', 'Qui-Gon Jinn'], correctIndex: 1, category: 'universe', funFact: 'Yoda entrenó a Luke en el planeta pantanoso de Dagobah.', tema: 'jedi' },
  { id: 'u06', question: '¿Quién es el padre de Leia Organa?', options: ['Han Solo', 'Bail Organa', 'Anakin Skywalker', 'Obi-Wan Kenobi'], correctIndex: 2, category: 'universe', funFact: 'Leia fue adoptada por Bail Organa, pero su padre biológico es Anakin Skywalker.', tema: 'jedi' },
  { id: 'u12', question: '¿Cuántos episodios tiene la saga Skywalker?', options: ['6', '7', '8', '9'], correctIndex: 3, category: 'universe', funFact: 'La saga va del Episodio I (1999) al Episodio IX (2019), 9 películas principales.', tema: 'jedi' },
  { id: 'u13', question: '¿Cómo se llama el maestro Jedi de Obi-Wan?', options: ['Mace Windu', 'Yoda', 'Qui-Gon Jinn', 'Ki-Adi-Mundi'], correctIndex: 2, category: 'universe', funFact: 'Qui-Gon Jinn fue el primer Jedi en descubrir cómo mantener la consciencia tras la muerte.', tema: 'jedi' },
  { id: 'u15', question: '¿Quién creó el Ejército Clon?', options: ['Palpatine', 'Sifo-Dyas', 'Dooku', 'Jango Fett'], correctIndex: 1, category: 'universe', funFact: 'Sifo-Dyas encargó el ejército en secreto, luego fue asesinado por orden de Dooku.', tema: 'jedi' },
  { id: 'u17', question: '¿Quién es el líder de los Mandalorianos en la serie?', options: ['Boba Fett', 'Din Djarin', 'Bo-Katan Kryze', 'Pre Vizsla'], correctIndex: 1, category: 'universe', funFact: 'Din Djarin, "El Mandaloriano", es interpretado por Pedro Pascal.', tema: 'jedi' },
  { id: 'u25', question: '¿Quién interpreta a Han Solo en las películas originales?', options: ['Mark Hamill', 'Harrison Ford', 'Alden Ehrenreich', 'Oscar Isaac'], correctIndex: 1, category: 'universe', funFact: 'Harrison Ford casi no obtiene el papel; el estudio quería a Christopher Walken.', tema: 'jedi' },
  { id: 'u32', question: '¿Qué poder permite a los Jedi mover objetos?', options: ['Fuerza Push', 'Telequinesis', 'Force Grip', 'Mind Trick'], correctIndex: 1, category: 'universe', funFact: 'La telequinesis es una de las habilidades más básicas enseñadas a los Jedi.', tema: 'jedi' },
  { id: 'u34', question: '¿Quién es Cal Kestis?', options: ['Un Sith', 'Un Padawan sobreviviente de la Orden 66', 'Un Mandaloriano', 'Un piloto rebelde'], correctIndex: 1, category: 'universe', funFact: 'Cal Kestis es el protagonista de los videojuegos Jedi: Fallen Order y Survivor.', tema: 'jedi' },

  // — nuevas —
  { id: 'n01', question: '¿De qué color es el sable de luz de Yoda?', options: ['Azul', 'Verde', 'Púrpura', 'Amarillo'], correctIndex: 1, category: 'universe', funFact: 'Yoda desenfunda su sable verde por primera vez en pantalla contra el Conde Dooku, en el Episodio II.', tema: 'jedi' },
  { id: 'n02', question: '¿Quién fue el maestro Jedi de Anakin Skywalker?', options: ['Qui-Gon Jinn', 'Yoda', 'Obi-Wan Kenobi', 'Mace Windu'], correctIndex: 2, category: 'universe', funFact: 'Obi-Wan le prometió a Qui-Gon moribundo que él mismo entrenaría a Anakin.', tema: 'jedi' },
  { id: 'n03', question: '¿Quién es la hermana gemela de Luke Skywalker?', options: ['Padmé Amidala', 'Leia Organa', 'Rey', 'Ahsoka Tano'], correctIndex: 1, category: 'universe', funFact: 'Los gemelos fueron separados al nacer para esconderlos de Darth Vader; la revelación llega en El Retorno del Jedi.', tema: 'jedi' },
  { id: 'n04', question: '¿Qué rango alcanza un Padawan al superar sus pruebas?', options: ['Maestro Jedi', 'Caballero Jedi', 'Gran Maestro', 'Comandante Jedi'], correctIndex: 1, category: 'universe', funFact: 'El camino Jedi va de youngling a Padawan, luego Caballero y finalmente Maestro Jedi.', tema: 'jedi' },

  // ═══ SITH (el Lado Oscuro) ═══════════════════════════════

  // — existentes (ids inmutables) —
  { id: 'u01', question: '¿Cuál es el verdadero nombre de Darth Vader?', options: ['Anakin Skywalker', 'Luke Skywalker', 'Ben Solo', 'Sheev Palpatine'], correctIndex: 0, category: 'universe', funFact: 'Anakin fue descubierto en Tatooine por Qui-Gon Jinn cuando tenía 9 años.', tema: 'sith' },
  { id: 'u10', question: '¿Qué orden ejecutó el Emperador para eliminar a los Jedi?', options: ['Orden 65', 'Orden 66', 'Orden 77', 'Orden 99'], correctIndex: 1, category: 'universe', funFact: 'La Orden 66 activó los chips inhibidores en los clones, forzándolos a atacar a los Jedi.', tema: 'sith' },
  { id: 'u11', question: '¿Qué personaje dice "Yo soy tu padre"?', options: ['Obi-Wan Kenobi', 'Palpatine', 'Darth Vader', 'Yoda'], correctIndex: 2, category: 'universe', funFact: 'La frase real en inglés es "No, I am your father", no "Luke, I am your father".', tema: 'sith' },
  { id: 'u19', question: '¿Qué cristal usan los Sith para sus sables?', options: ['Cristal Kyber azul', 'Cristal Kyber sangrado', 'Cristal sintético', 'Cristal Ilum'], correctIndex: 1, category: 'universe', funFact: 'Los Sith "sangran" cristales Kyber corrompiéndolos con el Lado Oscuro, haciéndolos rojos.', tema: 'sith' },
  { id: 'u21', question: '¿Quién es el aprendiz de Darth Sidious antes de Vader?', options: ['Darth Maul', 'General Grievous', 'Conde Dooku', 'Asajj Ventress'], correctIndex: 2, category: 'universe', funFact: 'Dooku fue un Jedi respetado antes de caer al Lado Oscuro como Darth Tyranus.', tema: 'sith' },
  { id: 'u23', question: '¿Cuál es la debilidad de los Stormtroopers?', options: ['Son lentos', 'Mala puntería', 'Armadura débil', 'No saben nadar'], correctIndex: 1, category: 'universe', funFact: 'La mala puntería de los Stormtroopers es uno de los memes más famosos de Star Wars.', tema: 'sith' },
  { id: 'u26', question: '¿Cómo se llama la espada láser de Darth Maul?', options: ['Sable doble', 'Sable de luz de doble hoja', 'Sable cruzado', 'Sable dual'], correctIndex: 1, category: 'universe', funFact: 'El sable de doble hoja de Darth Maul fue icónico en Episodio I.', tema: 'sith' },
  { id: 'u27', question: '¿Quién traicionó a los Jedi en la Orden 66 siendo clon?', options: ['Rex', 'Cody', 'Fives', 'Echo'], correctIndex: 1, category: 'universe', funFact: 'El Comandante Cody disparó contra Obi-Wan Kenobi en Utapau durante la Orden 66.', tema: 'sith' },
  { id: 'u31', question: '¿Quién es el villano principal de la trilogía de secuelas?', options: ['Snoke', 'Kylo Ren', 'Palpatine', 'General Hux'], correctIndex: 2, category: 'universe', funFact: 'Palpatine regresó en El Ascenso de Skywalker como el villano final de la saga.', tema: 'sith' },

  // — nuevas —
  { id: 'n05', question: '¿Cuál es el nombre Sith de Palpatine?', options: ['Darth Tyranus', 'Darth Sidious', 'Darth Plagueis', 'Darth Bane'], correctIndex: 1, category: 'universe', funFact: 'En el Episodio III, Palpatine cuenta la tragedia de Darth Plagueis "el Sabio", su propio maestro.', tema: 'sith' },
  { id: 'n06', question: '¿Qué regla limita cuántos Sith existen a la vez?', options: ['La Regla de Dos', 'La Regla de Tres', 'El Código Sith', 'El Pacto Oscuro'], correctIndex: 0, category: 'universe', funFact: 'Solo un maestro y un aprendiz: la Regla de Dos la estableció Darth Bane, cuyo espíritu aparece en The Clone Wars.', tema: 'sith' },
  { id: 'n07', question: '¿De qué especie es Darth Maul?', options: ['Zabrak', 'Twi\'lek', 'Chagrian', 'Humano'], correctIndex: 0, category: 'universe', funFact: 'Maul es un Zabrak de Dathomir; sobrevivió a su derrota en Naboo y regresó en The Clone Wars con piernas mecánicas.', tema: 'sith' },
  { id: 'n08', question: '¿Qué nombre Sith recibe el Conde Dooku?', options: ['Darth Maul', 'Darth Tyranus', 'Darth Sidious', 'Darth Vader'], correctIndex: 1, category: 'universe', funFact: 'Jango Fett fue reclutado para el ejército clon por un hombre al que conocía como Tyranus.', tema: 'sith' },
  { id: 'n09', question: '¿Qué poder usa el Emperador para atacar a Luke en El Retorno del Jedi?', options: ['Estrangulamiento de Fuerza', 'Rayos de Fuerza', 'Empuje de Fuerza', 'Truco mental'], correctIndex: 1, category: 'universe', funFact: 'Al ver sufrir a su hijo, Vader lanzó al Emperador al pozo del reactor y cumplió la profecía del Elegido.', tema: 'sith' },

  // ═══ CRIATURAS (especies y aliens) ═══════════════════════

  // — existentes (ids inmutables) —
  { id: 'u07', question: '¿Qué especie es Jabba?', options: ['Hutt', 'Wookiee', 'Twi\'lek', 'Rodian'], correctIndex: 0, category: 'universe', funFact: 'Los Hutts son una especie longeva que puede vivir más de 1000 años.', tema: 'criaturas' },
  { id: 'u14', question: '¿Qué raza es Ahsoka Tano?', options: ['Twi\'lek', 'Togruta', 'Zabrak', 'Mirialan'], correctIndex: 1, category: 'universe', funFact: 'Los Togruta son nativos del planeta Shili y tienen montrales que detectan movimiento.', tema: 'criaturas' },
  { id: 'u18', question: '¿Cómo se llama el bebé Yoda?', options: ['Yaddle', 'Grogu', 'Minch', 'Vandar'], correctIndex: 1, category: 'universe', funFact: 'Grogu tiene más de 50 años pero sigue siendo un infante de su especie.', tema: 'criaturas' },

  // — nuevas —
  { id: 'n10', question: '¿A qué especie pertenece Yoda?', options: ['Lannik', 'Una especie sin nombre oficial', 'Duros', 'Whill'], correctIndex: 1, category: 'universe', funFact: 'La especie de Yoda nunca ha sido nombrada oficialmente; solo se conocen tres miembros: Yoda, Yaddle y Grogu.', tema: 'criaturas' },
  { id: 'n11', question: '¿Cómo se llaman los pequeños habitantes peludos de Endor?', options: ['Jawas', 'Ewoks', 'Ugnaughts', 'Porgs'], correctIndex: 1, category: 'universe', funFact: 'Los Ewoks ayudaron a los rebeldes a destruir el generador del escudo en la Batalla de Endor.', tema: 'criaturas' },
  { id: 'n12', question: '¿Qué criatura vive en el Gran Pozo de Carkoon en Tatooine?', options: ['Un rancor', 'Un sarlacc', 'Un wampa', 'Un dragón krayt'], correctIndex: 1, category: 'universe', funFact: 'Jabba intentó arrojar a Luke, Han y Chewbacca al sarlacc en El Retorno del Jedi.', tema: 'criaturas' },
  { id: 'n13', question: '¿Qué criatura captura a Luke en los hielos de Hoth?', options: ['Un wampa', 'Un tauntaun', 'Un rancor', 'Un acklay'], correctIndex: 0, category: 'universe', funFact: 'Luke escapó de la cueva del wampa atrayendo su sable de luz con la Fuerza.', tema: 'criaturas' },
  { id: 'n14', question: '¿Qué especie son los chatarreros encapuchados de Tatooine?', options: ['Moradores de las arenas', 'Jawas', 'Rodianos', 'Gungans'], correctIndex: 1, category: 'universe', funFact: 'Los Jawas capturaron a R2-D2 en el Episodio IV y lo vendieron a la familia de Luke.', tema: 'criaturas' },
  { id: 'n15', question: '¿A qué especie pertenece Jar Jar Binks?', options: ['Gungan', 'Mon Calamari', 'Neimoidiano', 'Sullustano'], correctIndex: 0, category: 'universe', funFact: 'Los Gungans viven en ciudades sumergidas de Naboo, como Otoh Gunga.', tema: 'criaturas' },
  { id: 'n16', question: '¿Qué especie es el Almirante Ackbar?', options: ['Quarren', 'Mon Calamari', 'Sullustano', 'Bothan'], correctIndex: 1, category: 'universe', funFact: 'Su frase "¡Es una trampa!" en El Retorno del Jedi es una de las más citadas de la saga.', tema: 'criaturas' },
  { id: 'n17', question: '¿Qué criaturas montan los rebeldes para patrullar en Hoth?', options: ['Dewbacks', 'Tauntauns', 'Banthas', 'Blurrgs'], correctIndex: 1, category: 'universe', funFact: 'Han Solo metió a Luke dentro de un tauntaun muerto para salvarlo del frío de Hoth.', tema: 'criaturas' },
  { id: 'n18', question: '¿Qué criaturas montan los moradores de las arenas de Tatooine?', options: ['Banthas', 'Eopies', 'Rontos', 'Dewbacks'], correctIndex: 0, category: 'universe', funFact: 'Según Obi-Wan, los moradores de las arenas cabalgan en fila india para ocultar cuántos son.', tema: 'criaturas' },
  { id: 'n19', question: '¿Qué criatura tiene Jabba bajo su palacio para devorar a sus enemigos?', options: ['Un rancor', 'Un sarlacc', 'Un nexu', 'Un reek'], correctIndex: 0, category: 'universe', funFact: 'Luke aplastó al rancor con la puerta del foso, y su cuidador lloró la muerte de la bestia.', tema: 'criaturas' },
  { id: 'n20', question: '¿Cómo se llaman las aves de Ahch-To que aparecen en Los Últimos Jedi?', options: ['Porgs', 'Loth-cats', 'Convors', 'Tookas'], correctIndex: 0, category: 'universe', funFact: 'Los porgs se crearon digitalmente sobre los frailecillos reales que habitaban la isla donde se filmó.', tema: 'criaturas' },

  // ═══ PLANETAS (lugares) ══════════════════════════════════

  // — existentes (ids inmutables) —
  { id: 'u04', question: '¿En qué planeta vive Chewbacca originalmente?', options: ['Endor', 'Kashyyyk', 'Hoth', 'Naboo'], correctIndex: 1, category: 'universe', funFact: 'Kashyyyk es el planeta natal de los Wookiees, cubierto de bosques gigantes.', tema: 'planetas' },
  { id: 'u08', question: '¿Cuál es el planeta capital de la República/Imperio?', options: ['Naboo', 'Coruscant', 'Alderaan', 'Mustafar'], correctIndex: 1, category: 'universe', funFact: 'Coruscant es un ecumenópolis, un planeta completamente cubierto por una ciudad.', tema: 'planetas' },
  { id: 'u20', question: '¿En qué planeta se libró la Batalla de Hoth?', options: ['Jakku', 'Endor', 'Hoth', 'Crait'], correctIndex: 2, category: 'universe', funFact: 'Hoth es un planeta helado donde la Alianza Rebelde estableció su base Echo.', tema: 'planetas' },
  { id: 'u22', question: '¿Qué planeta fue destruido por la Estrella de la Muerte?', options: ['Naboo', 'Coruscant', 'Alderaan', 'Scarif'], correctIndex: 2, category: 'universe', funFact: 'Alderaan era el planeta adoptivo de Leia, destruido por el Gran Moff Tarkin.', tema: 'planetas' },
  { id: 'u28', question: '¿Qué planeta es la cuna de los Jedi según los Archivos?', options: ['Coruscant', 'Ahch-To', 'Tython', 'Jedha'], correctIndex: 2, category: 'universe', funFact: 'Tython es donde se fundó la primera Orden Jedi hace miles de años.', tema: 'planetas' },
  { id: 'u33', question: '¿En qué planeta se entrena Luke con Yoda?', options: ['Tatooine', 'Endor', 'Dagobah', 'Bespin'], correctIndex: 2, category: 'universe', funFact: 'Dagobah es un planeta pantanoso elegido por Yoda para esconderse del Imperio.', tema: 'planetas' },
  { id: 'u35', question: '¿Cuántos soles tiene Tatooine?', options: ['1', '2', '3', 'Ninguno'], correctIndex: 1, category: 'universe', funFact: 'Tatooine orbita alrededor de dos soles: Tatoo I y Tatoo II.', tema: 'planetas' },

  // — nuevas —
  { id: 'n21', question: '¿En qué planeta creció Luke Skywalker?', options: ['Alderaan', 'Tatooine', 'Naboo', 'Dantooine'], correctIndex: 1, category: 'universe', funFact: 'Luke vivía en la granja de humedad de sus tíos Owen y Beru.', tema: 'planetas' },
  { id: 'n22', question: '¿En qué planeta volcánico pelean Obi-Wan y Anakin en el Episodio III?', options: ['Mustafar', 'Geonosis', 'Utapau', 'Sullust'], correctIndex: 0, category: 'universe', funFact: 'Años después, Vader construyó su castillo en Mustafar, como se ve en Rogue One.', tema: 'planetas' },
  { id: 'n23', question: '¿Qué planeta oceánico es hogar de los clonadores kaminoanos?', options: ['Kamino', 'Mon Cala', 'Scarif', 'Ahch-To'], correctIndex: 0, category: 'universe', funFact: 'Kamino había sido borrado de los Archivos Jedi cuando Obi-Wan intentó buscarlo.', tema: 'planetas' },
  { id: 'n24', question: '¿En qué luna boscosa se libra la batalla final de El Retorno del Jedi?', options: ['Yavin 4', 'Endor', 'Ajan Kloss', 'Jedha'], correctIndex: 1, category: 'universe', funFact: 'En la luna de Endor estaba el generador del escudo que protegía la segunda Estrella de la Muerte.', tema: 'planetas' },
  { id: 'n25', question: '¿De qué planeta es la reina Padmé Amidala?', options: ['Alderaan', 'Naboo', 'Corellia', 'Chandrila'], correctIndex: 1, category: 'universe', funFact: 'Padmé fue elegida reina de Naboo a los 14 años.', tema: 'planetas' },
  { id: 'n26', question: '¿En qué planeta se esconde Obi-Wan después de la Orden 66?', options: ['Tatooine', 'Dagobah', 'Naboo', 'Jedha'], correctIndex: 0, category: 'universe', funFact: 'Obi-Wan vigiló de lejos a Luke durante años bajo el nombre de Ben Kenobi.', tema: 'planetas' },
  { id: 'n27', question: '¿En qué planeta desértico vive Rey al inicio de El Despertar de la Fuerza?', options: ['Jakku', 'Tatooine', 'Pasaana', 'Geonosis'], correctIndex: 0, category: 'universe', funFact: 'Rey sobrevivía en Jakku recolectando chatarra de las naves caídas, incluidos restos de destructores estelares.', tema: 'planetas' },

  // ═══ NAVES (vehículos y tecnología) ══════════════════════

  // — existentes (ids inmutables) —
  { id: 'u05', question: '¿Cómo se llama la nave de Han Solo?', options: ['X-Wing', 'TIE Fighter', 'Halcón Milenario', 'Slave I'], correctIndex: 2, category: 'universe', funFact: 'El Halcón Milenario hizo el recorrido de Kessel en menos de 12 parsecs.', tema: 'naves' },
  { id: 'u09', question: '¿Quién construyó a C-3PO?', options: ['Obi-Wan', 'Watto', 'Anakin Skywalker', 'Padmé Amidala'], correctIndex: 2, category: 'universe', funFact: 'Anakin construyó a C-3PO cuando era niño esclavo en Tatooine.', tema: 'naves' },
  { id: 'u16', question: '¿Qué destruyó la primera Estrella de la Muerte?', options: ['Un torpedo de protones', 'Un sable de luz', 'Una bomba termal', 'Un ataque kamikaze'], correctIndex: 0, category: 'universe', funFact: 'Luke Skywalker disparó el torpedo que destruyó la Estrella de la Muerte en la Batalla de Yavin.', tema: 'naves' },
  { id: 'u24', question: '¿Qué tipo de nave es un TIE Fighter?', options: ['Caza estelar', 'Crucero', 'Transporte', 'Bombardero'], correctIndex: 0, category: 'universe', funFact: 'TIE significa Twin Ion Engine (Motor de Iones Gemelo).', tema: 'naves' },
  { id: 'u29', question: '¿Cómo se llama el droide astromecánico de Anakin?', options: ['BB-8', 'R4-P17', 'R2-D2', 'C1-10P'], correctIndex: 2, category: 'universe', funFact: 'R2-D2 acompañó a Anakin en todas sus misiones durante las Guerras Clon.', tema: 'naves' },
  { id: 'u30', question: '¿Qué organizó la Alianza Rebelde en Rogue One?', options: ['Robo de los planos de la Estrella de la Muerte', 'Destrucción de la Estrella de la Muerte', 'Rescate de la princesa Leia', 'Batalla de Hoth'], correctIndex: 0, category: 'universe', funFact: 'El equipo Rogue One sacrificó sus vidas para transmitir los planos desde Scarif.', tema: 'naves' },

  // — nuevas —
  { id: 'n28', question: '¿Qué caza pilotea Luke en la Batalla de Yavin?', options: ['Y-Wing', 'X-Wing', 'A-Wing', 'Snowspeeder'], correctIndex: 1, category: 'universe', funFact: 'Luke voló con el indicativo Rojo Cinco en el Escuadrón Rojo.', tema: 'naves' },
  { id: 'n29', question: '¿Cómo se llama la nave de Boba Fett?', options: ['Slave I', 'Razor Crest', 'Ghost', 'Halcón Milenario'], correctIndex: 0, category: 'universe', funFact: 'Boba heredó la nave de su padre, Jango Fett, tras la Batalla de Geonosis.', tema: 'naves' },
  { id: 'n30', question: '¿Cómo se llama la nave de Din Djarin en las primeras temporadas de The Mandalorian?', options: ['Razor Crest', 'Slave I', 'Gauntlet', 'Outrider'], correctIndex: 0, category: 'universe', funFact: 'La Razor Crest fue destruida en la segunda temporada por las fuerzas de Moff Gideon.', tema: 'naves' },
  { id: 'n31', question: '¿Qué caminantes de cuatro patas usa el Imperio en la Batalla de Hoth?', options: ['AT-ST', 'AT-AT', 'AT-TE', 'Juggernaut'], correctIndex: 1, category: 'universe', funFact: 'AT-AT significa All Terrain Armored Transport; los snowspeeders rebeldes los derribaban enredando sus patas con cables.', tema: 'naves' },
  { id: 'n32', question: '¿Qué droide acompaña al piloto Poe Dameron?', options: ['R2-D2', 'BB-8', 'D-O', 'K-2SO'], correctIndex: 1, category: 'universe', funFact: 'BB-8 llevaba el fragmento del mapa hacia Luke Skywalker en El Despertar de la Fuerza.', tema: 'naves' },
  { id: 'n33', question: '¿Qué montan los exploradores imperiales que Luke y Leia persiguen entre los árboles de Endor?', options: ['Motos speeder', 'Dewbacks', 'Landspeeders', 'Deslizadores de nieve'], correctIndex: 0, category: 'universe', funFact: 'Luke y Leia robaron una moto speeder imperial para perseguir a los exploradores entre los árboles.', tema: 'naves' },
  { id: 'n36', question: '¿Qué caza pilotea Darth Vader en la Batalla de Yavin?', options: ['TIE Fighter estándar', 'TIE Advanced', 'TIE Interceptor', 'TIE Bomber'], correctIndex: 1, category: 'universe', funFact: 'El ataque sorpresa del Halcón Milenario hizo que un TIE escolta chocara contra el caza de Vader, mandándolo a girar fuera de control al espacio.', tema: 'naves' },
  { id: 'n35', question: '¿Cómo se llama el Súper Destructor Estelar insignia de Darth Vader?', options: ['Executor', 'Devastator', 'Chimaera', 'Finalizer'], correctIndex: 0, category: 'universe', funFact: 'El Executor se estrelló contra la segunda Estrella de la Muerte tras perder su puente en la Batalla de Endor.', tema: 'naves' },

  // ═══ JUEGO (Star Wars: Unlimited, el TCG) ════════════════

  // — existentes (ids inmutables) —
  { id: 's01', question: '¿Cuántos aspectos tiene Star Wars Unlimited?', options: ['4', '5', '6', '7'], correctIndex: 2, category: 'swu', funFact: 'Los 6 aspectos son: Vigilancia, Comando, Agresión, Astucia, Heroísmo y Villanía.', tema: 'juego' },
  { id: 's02', question: '¿Cuál es el formato competitivo principal de SWU?', options: ['Standard', 'Premier', 'Draft', 'Twin Suns'], correctIndex: 1, category: 'swu', funFact: 'Premier permite cartas de todos los sets disponibles.', tema: 'juego' },
  { id: 's03', question: '¿Cuántas cartas mínimo tiene un deck en formato Premier?', options: ['40', '50', '60', '80'], correctIndex: 1, category: 'swu', funFact: 'Un deck de Premier requiere exactamente 50 cartas en el mazo principal.', tema: 'juego' },
  { id: 's04', question: '¿Cuál fue el primer set de Star Wars Unlimited?', options: ['Shadows of the Galaxy', 'Spark of Rebellion', 'Twilight of the Republic', 'A Lawless Time'], correctIndex: 1, category: 'swu', funFact: 'Spark of Rebellion se lanzó en marzo de 2024 como el set inaugural del juego.', tema: 'juego' },
  { id: 's05', question: '¿Qué aspecto se asocia con el color rojo?', options: ['Comando', 'Vigilancia', 'Agresión', 'Villanía'], correctIndex: 2, category: 'swu', funFact: 'El aspecto Agresión se enfoca en combate directo y daño al oponente.', tema: 'juego' },
  { id: 's06', question: '¿Qué aspecto se asocia con el color azul?', options: ['Heroísmo', 'Vigilancia', 'Comando', 'Astucia'], correctIndex: 1, category: 'swu', funFact: 'Vigilancia se enfoca en defensa, escudos y protección de unidades.', tema: 'juego' },
  { id: 's07', question: '¿Qué aspecto se asocia con el color verde?', options: ['Heroísmo', 'Astucia', 'Comando', 'Vigilancia'], correctIndex: 2, category: 'swu', funFact: 'Comando se enfoca en liderazgo, torneos y control del campo de batalla.', tema: 'juego' },
  { id: 's08', question: '¿Qué aspecto se asocia con el color amarillo?', options: ['Astucia', 'Heroísmo', 'Villanía', 'Agresión'], correctIndex: 0, category: 'swu', funFact: 'Astucia se enfoca en trucos, manipulación y ventajas indirectas.', tema: 'juego' },
  { id: 's09', question: '¿Cuántos recursos se generan por turno normalmente?', options: ['1', '2', '3', 'Variable'], correctIndex: 1, category: 'swu', funFact: 'Cada jugador coloca 1 carta como recurso al inicio de su turno, comenzando con 0.', tema: 'juego' },
  { id: 's10', question: '¿Qué tipo de carta es la Base en SWU?', options: ['Unidad', 'Evento', 'Mejora', 'Base'], correctIndex: 3, category: 'swu', funFact: 'La Base tiene puntos de vida y el objetivo es destruir la base enemiga.', tema: 'juego' },
  { id: 's11', question: '¿Qué es el Sideboard en SWU?', options: ['Cartas extras para modificar el deck entre rondas', 'Un tipo de carta especial', 'Una zona del tablero', 'Un formato de juego'], correctIndex: 0, category: 'swu', funFact: 'El Sideboard permite hasta 10 cartas adicionales para adaptar tu deck entre rondas.', tema: 'juego' },
  { id: 's12', question: '¿Cuántas copias de una carta puedes tener en un deck?', options: ['2', '3', '4', 'Sin límite'], correctIndex: 1, category: 'swu', funFact: 'El máximo es 3 copias de cada carta en el mazo principal.', tema: 'juego' },
  { id: 's13', question: '¿Qué zona se usa para pagar costos de cartas?', options: ['Mano', 'Recursos', 'Descarte', 'Base'], correctIndex: 1, category: 'swu', funFact: 'Las cartas de recurso se colocan boca abajo y se agotan para pagar costos.', tema: 'juego' },
  { id: 's14', question: '¿Cuál es el segundo set de Star Wars Unlimited?', options: ['A Lawless Time', 'Shadows of the Galaxy', 'Twilight of the Republic', 'Jump to Lightspeed'], correctIndex: 1, category: 'swu', funFact: 'Shadows of the Galaxy se lanzó en julio de 2024 con mecánicas de contrabando.', tema: 'juego' },
  { id: 's15', question: '¿Qué tipo de formato es Twin Suns?', options: ['1 vs 1 con 2 líderes', 'Multiplayer', '2 vs 2', 'Draft'], correctIndex: 0, category: 'swu', funFact: 'Twin Suns permite usar 2 líderes y tiene reglas especiales de construcción de deck.', tema: 'juego' },
  { id: 's16', question: '¿Qué carta tipo Leader se despliega como unidad?', options: ['Solo el líder', 'Los eventos', 'Las mejoras', 'Las bases'], correctIndex: 0, category: 'swu', funFact: 'El líder comienza fuera del juego y puede desplegarse pagando su costo cuando se cumplen condiciones.', tema: 'juego' },
  { id: 's17', question: '¿Cuántos puntos de vida tiene típicamente una base?', options: ['10-15', '20-25', '25-30', '30-35'], correctIndex: 2, category: 'swu', funFact: 'Las bases tienen entre 25 y 30 puntos de vida dependiendo de la carta.', tema: 'juego' },
  { id: 's18', question: '¿Qué acción agota una unidad para atacar?', options: ['Exhaust', 'Deploy', 'Play', 'Smuggle'], correctIndex: 0, category: 'swu', funFact: 'Cuando una unidad ataca, se agota (exhaust) y no puede actuar de nuevo hasta reactivarse.', tema: 'juego' },
  { id: 's19', question: '¿Qué palabra clave permite jugar cartas del área de recursos?', options: ['Ambush', 'Smuggle', 'Bounty', 'Restore'], correctIndex: 1, category: 'swu', funFact: 'Smuggle permite jugar una carta desde los recursos pagando un costo alternativo.', tema: 'juego' },
  { id: 's20', question: '¿Qué palabra clave da Sentinel a una unidad?', options: ['Los enemigos deben atacarla primero', 'Gana +2 de ataque', 'Se cura al atacar', 'Puede atacar la base directamente'], correctIndex: 0, category: 'swu', funFact: 'Sentinel obliga a los oponentes a atacar esa unidad antes de poder atacar otras.', tema: 'juego' },
  { id: 's21', question: '¿Qué rango tiene un jugador de nivel 1-5 en HOLOCRON SWU?', options: ['Padawan', 'Youngling', 'Iniciado', 'Aprendiz'], correctIndex: 1, category: 'swu', funFact: 'Youngling es el primer rango, inspirado en los jóvenes aprendices del Templo Jedi.', tema: 'juego' },
  { id: 's22', question: '¿Cuál es el aspecto asociado con el color púrpura?', options: ['Heroísmo', 'Astucia', 'Villanía', 'Agresión'], correctIndex: 2, category: 'swu', funFact: 'Villanía se enfoca en sacrificios, engaños y el poder del Lado Oscuro.', tema: 'juego' },
  { id: 's23', question: '¿Qué significa BO3 en un torneo de SWU?', options: ['Best of 1', 'Best of 3', 'Battle Order 3', 'Base Operations 3'], correctIndex: 1, category: 'swu', funFact: 'BO3 significa "Best of 3" — gana el primero en obtener 2 victorias de 3 partidas.', tema: 'juego' },
  { id: 's24', question: '¿Qué aspecto se asocia con el cian/turquesa?', options: ['Vigilancia', 'Heroísmo', 'Comando', 'Astucia'], correctIndex: 1, category: 'swu', funFact: 'Heroísmo representa valentía, sacrificio y protección de los inocentes.', tema: 'juego' },
  { id: 's25', question: '¿Cuántas arenas de combate hay en SWU?', options: ['1', '2', '3', '4'], correctIndex: 1, category: 'swu', funFact: 'Hay 2 arenas: Ground (terrestre) y Space (espacial). Las unidades solo combaten en su arena.', tema: 'juego' },
  { id: 's26', question: '¿Qué palabra clave permite atacar inmediatamente al desplegarse?', options: ['Sentinel', 'Ambush', 'Raid', 'Overwhelm'], correctIndex: 1, category: 'swu', funFact: 'Ambush permite que una unidad ataque el mismo turno en que se despliega.', tema: 'juego' },
  { id: 's27', question: '¿Qué hace la palabra clave Overwhelm?', options: ['Ignora Sentinel', 'Daño sobrante va a la base', 'Ataca dos veces', 'Gana escudo'], correctIndex: 1, category: 'swu', funFact: 'Overwhelm permite que el daño excedente al derrotar una unidad se aplique a la base enemiga.', tema: 'juego' },
  { id: 's28', question: '¿Qué hace la palabra clave Restore?', options: ['Cura la base al atacar', 'Cura una unidad aliada', 'Revive una unidad', 'Recupera recursos'], correctIndex: 0, category: 'swu', funFact: 'Restore X cura X puntos de vida a tu base cuando esa unidad ataca.', tema: 'juego' },
  { id: 's29', question: '¿Qué hace la palabra clave Raid?', options: ['Gana ataque extra al atacar la base', 'Roba cartas', 'Destruye recursos', 'Mueve unidades entre arenas'], correctIndex: 0, category: 'swu', funFact: 'Raid X da +X de ataque cuando esa unidad ataca una base.', tema: 'juego' },
  { id: 's30', question: '¿Cuál fue el tercer set de SWU?', options: ['A Lawless Time', 'Twilight of the Republic', 'Jump to Lightspeed', 'Shadows of the Galaxy'], correctIndex: 1, category: 'swu', funFact: 'Twilight of the Republic se centra en la era de las Guerras Clon.', tema: 'juego' },
]
