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
  // FIX: ambigua — «padre de Leia Organa» hacía correcto también a Bail Organa (el que la crió y le dio el apellido); ahora se ancla en el padre BIOLÓGICO.
  { id: 'u06', question: '¿Quién es el padre biológico de Leia?', options: ['Han Solo', 'Bail Organa', 'Anakin Skywalker', 'Obi-Wan Kenobi'], correctIndex: 2, category: 'universe', funFact: 'Leia fue criada por Bail Organa en Alderaan, pero su padre biológico es Anakin Skywalker.', tema: 'jedi' },
  { id: 'u12', question: '¿Cuántos episodios tiene la saga Skywalker?', options: ['6', '7', '8', '9'], correctIndex: 3, category: 'universe', funFact: 'La saga va del Episodio I (1999) al Episodio IX (2019), 9 películas principales.', tema: 'jedi' },
  // FIX: ambigua + funFact falso — «maestro Jedi de Obi-Wan» también cubría a Yoda (entrena a todos los iniciados); y a Qui-Gon le enseñaron las Sacerdotisas de la Fuerza, no lo descubrió él.
  { id: 'u13', question: '¿Quién fue el maestro que entrenó a Obi-Wan Kenobi como Padawan?', options: ['Mace Windu', 'Yoda', 'Qui-Gon Jinn', 'Ki-Adi-Mundi'], correctIndex: 2, category: 'universe', funFact: 'Qui-Gon Jinn fue el primer Jedi en aprender a conservar su identidad en la Fuerza tras la muerte, gracias a las Sacerdotisas de la Fuerza.', tema: 'jedi' },
  // FIX: ambigua — «creó» valía para los kaminoanos, Jango, Dooku y Palpatine (tres estaban entre las opciones); ahora se ancla en «encargó», que es lo que hizo Sifo-Dyas.
  { id: 'u15', question: '¿Qué Maestro Jedi encargó en secreto el Ejército Clon a los kaminoanos?', options: ['Palpatine', 'Sifo-Dyas', 'Dooku', 'Jango Fett'], correctIndex: 1, category: 'universe', funFact: 'Sifo-Dyas encargó el ejército en secreto a Kamino y después fue asesinado por orden de Dooku, que se quedó con el control del pedido.', tema: 'jedi' },
  // FIX: ambigua — «líder de los Mandalorianos» también describía a Bo-Katan (Mand alor con el Sable Oscuro) y a Pre Vizsla, y no decía qué serie; ahora pregunta por el protagonista de The Mandalorian.
  { id: 'u17', question: '¿Cómo se llama el protagonista de la serie The Mandalorian?', options: ['Boba Fett', 'Din Djarin', 'Cad Bane', 'Axe Woves'], correctIndex: 1, category: 'universe', funFact: 'Din Djarin, "El Mandaloriano", es interpretado por Pedro Pascal. Quien unifica a los mandalorianos y porta el Sable Oscuro al final de la serie es Bo-Katan Kryze.', tema: 'jedi' },
  // FIX: funFact falso — el estudio nunca pidió a Christopher Walken; audicionaron unos 500 actores y Lucas eligió a Ford.
  { id: 'u25', question: '¿Quién interpreta a Han Solo en las películas originales?', options: ['Mark Hamill', 'Harrison Ford', 'Alden Ehrenreich', 'Oscar Isaac'], correctIndex: 1, category: 'universe', funFact: 'Harrison Ford ni siquiera era candidato al inicio: leía los diálogos para que otros actores audicionaran, hasta que Lucas se decidió por él. Unos 500 actores probaron para el papel, incluido Christopher Walken.', tema: 'jedi' },
  // Reescrita: la versión vieja preguntaba «¿qué poder permite mover objetos?»
  // y ofrecía Fuerza Push, Telequinesis, Force Grip y Mind Trick — TRES de las
  // cuatro son mover cosas con la Fuerza, así que había tres respuestas
  // defendibles y una sola marcada como buena. Ahora los distractores no
  // tienen nada que ver con mover objetos.
  { id: 'u32', question: '¿Qué es lo que permite a los Jedi mover objetos con la mente?', options: ['La Fuerza', 'Los cristales kyber', 'Un campo magnético', 'La tecnología del sable'], correctIndex: 0, category: 'universe', funFact: 'Mover objetos es telequinesis, una de las aplicaciones más básicas de la Fuerza. Los cristales kyber, en cambio, son lo que alimenta un sable de luz.', tema: 'jedi' },
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
  // FIX: ambigua — tres opciones eran «cristal kyber» dicho de otra forma (Ilum son kyber, y los sintéticos también son canon); ahora pregunta por el proceso, que tiene una sola respuesta.
  { id: 'u19', question: '¿Cómo obtienen los Sith el color rojo de sus sables?', options: ['Corrompiendo (sangrando) un cristal kyber con el Lado Oscuro', 'Pintando la hoja', 'Usando un cristal rojo natural de Mustafar', 'Sobrecargando el emisor'], correctIndex: 0, category: 'universe', funFact: 'El Sith vuelca su odio en el cristal hasta hacerlo "sangrar": ahí la hoja se vuelve roja.', tema: 'sith' },
  // FIX: ambigua — Darth Maul también fue aprendiz de Sidious antes de Vader (fue el primero); ahora se ancla en «inmediatamente antes», y Ventress (que nunca fue aprendiz de Sidious) sale por Plagueis.
  { id: 'u21', question: '¿Quién fue el aprendiz de Darth Sidious inmediatamente antes de Darth Vader?', options: ['Darth Maul', 'General Grievous', 'Conde Dooku', 'Darth Plagueis'], correctIndex: 2, category: 'universe', funFact: 'El orden fue Maul, después Dooku (Darth Tyranus) y por último Vader. Darth Plagueis no fue aprendiz de Sidious: fue su maestro.', tema: 'sith' },
  // FIX: no era canon sino meme — «Armadura débil» era tan defendible como «Mala puntería»; reemplazada por un dato verificable.
  { id: 'u23', question: '¿De quién se clonó el Ejército Clon de la República?', options: ['Jango Fett', 'Boba Fett', 'Cad Bane', 'Rex'], correctIndex: 0, category: 'universe', funFact: 'Jango Fett fue el donante genético y, como parte del pago, pidió un clon sin modificar para criarlo como hijo: Boba Fett.', tema: 'sith' },
  // FIX: ambigua — «Sable doble», «Sable de luz de doble hoja» y «Sable dual» eran la misma arma, y el arma no tiene nombre propio en canon; ahora pregunta por la característica.
  { id: 'u26', question: '¿Qué tenía de particular el sable de luz de Darth Maul?', options: ['Tenía dos hojas, una en cada extremo', 'Su hoja era negra', 'Disparaba rayos de la Fuerza', 'Podía lanzarse como un bumerán'], correctIndex: 0, category: 'universe', funFact: 'El sable de doble hoja de Maul se volvió icónico tras el duelo de Naboo en el Episodio I.', tema: 'sith' },
  // FIX: premisa falsa — los clones no traicionaron por voluntad propia (los forzaba el chip inhibidor) y casi todos ejecutaron la Orden 66; ahora pregunta por el hecho concreto de Utapau.
  { id: 'u27', question: '¿Qué comandante clon ordenó disparar contra Obi-Wan Kenobi en Utapau durante la Orden 66?', options: ['Rex', 'Cody', 'Fives', 'Wolffe'], correctIndex: 1, category: 'universe', funFact: 'Los clones no actuaron por voluntad propia: un chip inhibidor implantado desde Kamino los obligó. Rex logró quitarse el suyo con ayuda de Ahsoka.', tema: 'sith' },
  // FIX: era opinión, no dato — Snoke, Kylo Ren y Palpatine eran los tres defendibles; sustituida por algo verificable.
  { id: 'u31', question: '¿Quién era el Líder Supremo de la Primera Orden en El Despertar de la Fuerza?', options: ['Snoke', 'Kylo Ren', 'General Hux', 'Palpatine'], correctIndex: 0, category: 'universe', funFact: 'Snoke fue asesinado por Kylo Ren en Los Últimos Jedi; en El Ascenso de Skywalker se revela que era una creación de Palpatine.', tema: 'sith' },

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
  // FIX: tautológica — la respuesta (Hoth) estaba escrita en el enunciado; ahora pregunta por la base rebelde.
  { id: 'u20', question: '¿Cómo se llamaba la base rebelde en Hoth?', options: ['Base Echo', 'Base Yavin', 'Base Crait', 'Base Endor'], correctIndex: 0, category: 'universe', funFact: 'La Base Echo fue evacuada a la carrera cuando el Imperio atacó con caminantes AT-AT en El Imperio Contraataca.', tema: 'planetas' },
  // FIX: ambigua — la Estrella de la Muerte también disparó sobre Scarif; ahora el enunciado dice «por completo» y Scarif sale por Dantooine.
  { id: 'u22', question: '¿Qué planeta fue destruido por completo por la Estrella de la Muerte?', options: ['Naboo', 'Coruscant', 'Alderaan', 'Dantooine'], correctIndex: 2, category: 'universe', funFact: 'Alderaan era el planeta adoptivo de Leia. Ella mintió diciendo que la base rebelde estaba en Dantooine, y Tarkin destruyó Alderaan igual.', tema: 'planetas' },
  // FIX: dato falso — el Primer Templo Jedi está en Ahch-To (que además estaba entre las opciones marcado como incorrecto); lo de Tython es material de Legends.
  { id: 'u28', question: '¿En qué planeta está el Primer Templo Jedi?', options: ['Coruscant', 'Ahch-To', 'Tython', 'Jedha'], correctIndex: 1, category: 'universe', funFact: 'Ahch-To es donde Rey encuentra a Luke; el templo tiene unos 25.000 años. Tython, visto en The Mandalorian, es otro mundo Jedi antiguo, pero no es la cuna de la Orden.', tema: 'planetas' },
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
  // FIX: funFact falso — lo de los 12 pársecs es la fanfarronada de Han, y el pársec mide distancia, no tiempo.
  { id: 'u05', question: '¿Cómo se llama la nave de Han Solo?', options: ['X-Wing', 'TIE Fighter', 'Halcón Milenario', 'Slave I'], correctIndex: 2, category: 'universe', funFact: 'Han presumía de haber hecho la Ruta de Kessel en menos de 12 pársecs. En Solo se ve la trampa: el pársec mide distancia, no tiempo, así que atajó por una ruta más corta y en realidad fueron unos 13 redondeados hacia abajo.', tema: 'naves' },
  { id: 'u09', question: '¿Quién construyó a C-3PO?', options: ['Obi-Wan', 'Watto', 'Anakin Skywalker', 'Padmé Amidala'], correctIndex: 2, category: 'universe', funFact: 'Anakin construyó a C-3PO cuando era niño esclavo en Tatooine.', tema: 'naves' },
  { id: 'u16', question: '¿Qué destruyó la primera Estrella de la Muerte?', options: ['Un torpedo de protones', 'Un sable de luz', 'Una bomba termal', 'Un ataque kamikaze'], correctIndex: 0, category: 'universe', funFact: 'Luke Skywalker disparó el torpedo que destruyó la Estrella de la Muerte en la Batalla de Yavin.', tema: 'naves' },
  { id: 'u24', question: '¿Qué tipo de nave es un TIE Fighter?', options: ['Caza estelar', 'Crucero', 'Transporte', 'Bombardero'], correctIndex: 0, category: 'universe', funFact: 'TIE significa Twin Ion Engine (Motor de Iones Gemelo).', tema: 'naves' },
  // FIX: funFact falso — R2-D2 no acompañó a Anakin en TODAS sus misiones de las Guerras Clon; pasó tramos con Padmé, con Ahsoka e incluso capturado.
  { id: 'u29', question: '¿Cómo se llama el droide astromecánico de Anakin?', options: ['BB-8', 'R4-P17', 'R2-D2', 'C1-10P'], correctIndex: 2, category: 'universe', funFact: 'R2-D2 fue el astromecánico de Anakin durante las Guerras Clon y es de los pocos personajes que aparece en las nueve películas de la saga Skywalker.', tema: 'naves' },
  // FIX: premisa falsa — el Consejo Rebelde votó EN CONTRA de la misión; el equipo actuó por su cuenta.
  { id: 'u30', question: '¿Cuál es la misión central de Rogue One?', options: ['Robar los planos de la Estrella de la Muerte', 'Destruir la Estrella de la Muerte', 'Rescatar a la princesa Leia', 'Defender Hoth'], correctIndex: 0, category: 'universe', funFact: 'El equipo actuó sin autorización del Consejo Rebelde: por eso el indicativo improvisado fue Rogue One.', tema: 'naves' },

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
  // FIX: funFact falso — Premier rota (CR 9.2.2D); el que admite todo lo publicado es Eternal.
  { id: 's02', question: '¿Cuál es el formato competitivo principal de SWU?', options: ['Standard', 'Premier', 'Draft', 'Twin Suns'], correctIndex: 1, category: 'swu', funFact: 'Premier es el formato principal y rota: solo admite las cartas de los dos símbolos de rotación más recientes. Donde vale todo lo publicado es Eternal (CR 9.2.2D).', tema: 'juego' },
  // FIX: funFact falso — son MÍNIMO 50 cartas, no exactamente 50 (CR 9.2.2A); contradecía al propio enunciado.
  { id: 's03', question: '¿Cuántas cartas mínimo tiene un deck en formato Premier?', options: ['40', '50', '60', '80'], correctIndex: 1, category: 'swu', funFact: 'Un mazo de Premier lleva exactamente 1 líder, exactamente 1 base y un mínimo de 50 cartas más; podés jugar más de 50 si querés (CR 9.2.2A).', tema: 'juego' },
  { id: 's04', question: '¿Cuál fue el primer set de Star Wars Unlimited?', options: ['Shadows of the Galaxy', 'Spark of Rebellion', 'Twilight of the Republic', 'A Lawless Time'], correctIndex: 1, category: 'swu', funFact: 'Spark of Rebellion se lanzó en marzo de 2024 como el set inaugural del juego.', tema: 'juego' },
  { id: 's05', question: '¿Qué aspecto se asocia con el color rojo?', options: ['Comando', 'Vigilancia', 'Agresión', 'Villanía'], correctIndex: 2, category: 'swu', funFact: 'El aspecto Agresión se enfoca en combate directo y daño al oponente.', tema: 'juego' },
  { id: 's06', question: '¿Qué aspecto se asocia con el color azul?', options: ['Heroísmo', 'Vigilancia', 'Comando', 'Astucia'], correctIndex: 1, category: 'swu', funFact: 'Vigilancia se enfoca en defensa, escudos y protección de unidades.', tema: 'juego' },
  // FIX: funFact falso — «torneos» era un mal calco de troops; Comando va de unidades grandes y robar cartas.
  { id: 's07', question: '¿Qué aspecto se asocia con el color verde?', options: ['Heroísmo', 'Astucia', 'Comando', 'Vigilancia'], correctIndex: 2, category: 'swu', funFact: 'Comando se enfoca en unidades grandes, robar cartas y desarrollar el campo de batalla.', tema: 'juego' },
  { id: 's08', question: '¿Qué aspecto se asocia con el color amarillo?', options: ['Astucia', 'Heroísmo', 'Villanía', 'Agresión'], correctIndex: 0, category: 'swu', funFact: 'Astucia se enfoca en trucos, manipulación y ventajas indirectas.', tema: 'juego' },
  // FIX: dato falso — en el reagrupamiento cada jugador pone 1 recurso, no 2 (CR 5.5.1C), y el funFact se contradecía con la respuesta marcada.
  { id: 's09', question: '¿Cuántas cartas pone cada jugador como recurso en la fase de reagrupamiento?', options: ['1', '2', '3', 'Ninguna'], correctIndex: 0, category: 'swu', funFact: 'En la preparación se ponen 2 recursos de golpe (CR 5.2.1F) y después solo 1 por ronda en el reagrupamiento (CR 5.5.1C).', tema: 'juego' },
  // FIX: tautológica — la respuesta «Base» estaba escrita en el enunciado.
  { id: 's10', question: '¿Cuántas bases lleva cada mazo en SWU?', options: ['Ninguna', 'Exactamente 1', '2, una por arena', 'Las que quieras'], correctIndex: 1, category: 'swu', funFact: 'Cada mazo lleva exactamente 1 base y 1 líder. La base marca tu vida y aporta un aspecto al mazo (CR 9.2.2A).', tema: 'juego' },
  { id: 's11', question: '¿Qué es el Sideboard en SWU?', options: ['Cartas extras para modificar el deck entre rondas', 'Un tipo de carta especial', 'Una zona del tablero', 'Un formato de juego'], correctIndex: 0, category: 'swu', funFact: 'El Sideboard permite hasta 10 cartas adicionales para adaptar tu deck entre rondas.', tema: 'juego' },
  { id: 's12', question: '¿Cuántas copias de una carta puedes tener en un deck?', options: ['2', '3', '4', 'Sin límite'], correctIndex: 1, category: 'swu', funFact: 'El máximo es 3 copias de cada carta en el mazo principal.', tema: 'juego' },
  { id: 's13', question: '¿Qué zona se usa para pagar costos de cartas?', options: ['Mano', 'Recursos', 'Descarte', 'Base'], correctIndex: 1, category: 'swu', funFact: 'Las cartas de recurso se colocan boca abajo y se agotan para pagar costos.', tema: 'juego' },
  { id: 's14', question: '¿Cuál es el segundo set de Star Wars Unlimited?', options: ['A Lawless Time', 'Shadows of the Galaxy', 'Twilight of the Republic', 'Jump to Lightspeed'], correctIndex: 1, category: 'swu', funFact: 'Shadows of the Galaxy se lanzó en julio de 2024 con mecánicas de contrabando.', tema: 'juego' },
  // FIX: ambigua — Twin Suns es un formato MULTIJUGADOR (CR 12.1.1), así que la opción marcada era la peor de las dos defendibles.
  { id: 's15', question: '¿Cuántos líderes lleva cada mazo en el formato Twin Suns?', options: ['1', '2', '3', 'Los que quieras'], correctIndex: 1, category: 'swu', funFact: 'Twin Suns es un formato multijugador: 2 líderes distintos, mínimo 80 cartas y una sola copia de cada carta (CR 12.2.1A y 12.2.2).', tema: 'juego' },
  // FIX: dato falso — el líder empieza EN JUEGO debajo de la base (CR 5.2.1B), no fuera del juego; y la pregunta se respondía sola.
  { id: 's16', question: '¿Dónde está el líder al empezar la partida?', options: ['En juego, debajo de tu base', 'En tu mano', 'Fuera del juego', 'Encima del mazo'], correctIndex: 0, category: 'swu', funFact: 'El líder entra en juego bajo la base con su cara de Líder arriba y se voltea a Unidad Líder cuando lo desplegás pagando su coste (CR 5.2.1B).', tema: 'juego' },
  // FIX: desactualizada — ya hay bases de 33, 34 y 35 PV (Colossus JTL llega a 35) y los rangos ofrecidos se solapaban.
  { id: 's17', question: '¿Cuántos puntos de vida tiene la mayoría de bases en SWU?', options: ['20', '25', '30', '40'], correctIndex: 2, category: 'swu', funFact: 'Lo normal son 30 PV, pero hay bases desde 25 hasta 35: Colossus (JTL) llega a 35 y suele venir con menos texto útil.', tema: 'juego' },
  // FIX: dato falso — Exhaust no es una acción (las 5 están en CR 1.15.1), la correcta «Atacar» ni figuraba, y mezclaba idiomas.
  { id: 's18', question: '¿Qué le pasa a una unidad al declarar un ataque?', options: ['Se agota (exhausta)', 'Se cura', 'Vuelve a la mano', 'Gana un escudo'], correctIndex: 0, category: 'swu', funFact: 'Atacar con una unidad es una de las 5 acciones del juego, y el primer paso del ataque es agotar al atacante (CR 1.15.1 y 6.3.3).', tema: 'juego' },
  // FIX: ambigua — Plot también se juega desde la zona de recursos (CR 7.5.19A); lo que distingue a Smuggle es el coste alternativo.
  { id: 's19', question: '¿Qué palabra clave permite jugar una carta desde tus recursos pagando un coste alternativo?', options: ['Ambush', 'Smuggle', 'Bounty', 'Restore'], correctIndex: 1, category: 'swu', funFact: 'Smuggle juega la carta desde tus recursos por el coste entre corchetes y la reemplaza con la carta de arriba de tu mazo. Plot también se juega desde recursos, pero por su coste normal y solo al desplegar un líder (CR 7.5.14A y 7.5.19A).', tema: 'juego' },
  // FIX: enunciado mal formado y respuesta imprecisa — Sentinel solo obliga a las unidades enemigas de SU arena, también protege la base y Saboteur la ignora.
  { id: 's20', question: '¿Qué hace la palabra clave Sentinel?', options: ['Las unidades enemigas de su arena deben atacarla a ella', 'Gana +2 de poder', 'Se cura al atacar', 'Puede atacar la base directamente'], correctIndex: 0, category: 'swu', funFact: 'Sentinel impide que las unidades enemigas de su arena ataquen a otras unidades o a tu base; una unidad con Saboteur la ignora (CR 7.5.11A).', tema: 'juego' },
  // FIX: dato falso — el rango «Youngling» no existe en HOLOCRON SWU; los rangos reales están en gamification.ts y el tramo 1-5 ni siquiera era uno solo.
  { id: 's21', question: '¿Cuál es el primer rango de un jugador en HOLOCRON SWU (niveles 1-3)?', options: ['Iniciado del Borde Exterior', 'Cadete de la Alianza', 'Guardián Kyber', 'Maestro del Holocrón'], correctIndex: 0, category: 'swu', funFact: 'Los rangos van de Iniciado del Borde Exterior en el nivel 1 hasta Gran Maestro Galáctico a partir del nivel 26.', tema: 'juego' },
  // FIX: dato falso — el icono de Villanía es NEGRO; el púrpura sale de la paleta de la app, no del juego.
  { id: 's22', question: '¿Qué aspecto se asocia con el color negro?', options: ['Heroísmo', 'Astucia', 'Villanía', 'Agresión'], correctIndex: 2, category: 'swu', funFact: 'El icono de Villanía es negro y el de Heroísmo blanco: son los dos aspectos de alineación, frente a los cuatro de color (azul, verde, rojo y amarillo).', tema: 'juego' },
  { id: 's23', question: '¿Qué significa BO3 en un torneo de SWU?', options: ['Best of 1', 'Best of 3', 'Battle Order 3', 'Base Operations 3'], correctIndex: 1, category: 'swu', funFact: 'BO3 significa "Best of 3" — gana el primero en obtener 2 victorias de 3 partidas.', tema: 'juego' },
  // FIX: dato falso — el icono de Heroísmo es BLANCO; el cian viene de la paleta de la app, igual que en s22.
  { id: 's24', question: '¿Qué aspecto se asocia con el color blanco?', options: ['Vigilancia', 'Heroísmo', 'Comando', 'Astucia'], correctIndex: 1, category: 'swu', funFact: 'Heroísmo (blanco) y Villanía (negro) son los aspectos de alineación; los otros cuatro son azul, verde, rojo y amarillo.', tema: 'juego' },
  { id: 's25', question: '¿Cuántas arenas de combate hay en SWU?', options: ['1', '2', '3', '4'], correctIndex: 1, category: 'swu', funFact: 'Hay 2 arenas: Ground (terrestre) y Space (espacial). Las unidades solo combaten en su arena.', tema: 'juego' },
  // FIX: funFact incompleto — Ambush solo permite atacar a una UNIDAD enemiga, nunca a la base (CR 7.5.5A).
  { id: 's26', question: '¿Qué palabra clave permite atacar inmediatamente al desplegarse?', options: ['Sentinel', 'Ambush', 'Raid', 'Overwhelm'], correctIndex: 1, category: 'swu', funFact: 'Ambush deja atacar el mismo turno en que la unidad entra en juego, pero solo puede atacar a una unidad enemiga: nunca a la base (CR 7.5.5A).', tema: 'juego' },
  { id: 's27', question: '¿Qué hace la palabra clave Overwhelm?', options: ['Ignora Sentinel', 'Daño sobrante va a la base', 'Ataca dos veces', 'Gana escudo'], correctIndex: 1, category: 'swu', funFact: 'Overwhelm permite que el daño excedente al derrotar una unidad se aplique a la base enemiga.', tema: 'juego' },
  { id: 's28', question: '¿Qué hace la palabra clave Restore?', options: ['Cura la base al atacar', 'Cura una unidad aliada', 'Revive una unidad', 'Recupera recursos'], correctIndex: 0, category: 'swu', funFact: 'Restore X cura X puntos de vida a tu base cuando esa unidad ataca.', tema: 'juego' },
  // FIX: desactualizada — el CR 8.0 (7.5.8A) define Raid como +X de poder mientras ataca, sin exigir que sea a la base, así que ninguna opción era correcta.
  { id: 's29', question: '¿Qué hace la palabra clave Raid?', options: ['Gana +X de poder mientras ataca', 'Roba cartas al atacar', 'Destruye un recurso enemigo', 'Mueve unidades entre arenas'], correctIndex: 0, category: 'swu', funFact: 'Raid X da +X de poder mientras la unidad ataca, sea a una base o a otra unidad (CR 7.5.8A). El bono dura solo lo que dura el ataque.', tema: 'juego' },
  { id: 's30', question: '¿Cuál fue el tercer set de SWU?', options: ['A Lawless Time', 'Twilight of the Republic', 'Jump to Lightspeed', 'Shadows of the Galaxy'], correctIndex: 1, category: 'swu', funFact: 'Twilight of the Republic se centra en la era de las Guerras Clon.', tema: 'juego' },
]
