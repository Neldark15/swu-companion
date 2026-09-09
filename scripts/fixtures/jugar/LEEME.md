# Fixtures del tablero

`estados-privados.json` es una copia de las vistas privadas reales de `services/juego/fixtures/estados-privados.json`, capturadas con el motor Forceteki fijado a `139c14a240b75498b403ccdb06144a136972ecb6`. Las identidades son exclusivamente de desarrollo. Incluye iniciativa, mulligan, recursos y acción, desde ambas cuentas.

`prompts-upstream.json` prueba las ramas especiales sin depender de un mazo aleatorio: sus objetos proceden de ejecutar los serializadores **originales** de Forceteki con fuentes, jugadores y cartas mínimos de prueba. No son capturas de partidas completas. `generar-prompts.cjs` muestra exactamente cómo se obtiene cada objeto; las clases de grupo y orden de habilidades utilizan un contexto mínimo para llamar a su serializador original.

Regenerar con `node scripts/fixtures/jugar/generar-prompts.cjs`, después de preparar el motor. No se importan al código de producción. La prueba ejecutable es `npx tsx scripts/jugar-vista.test.mts`.
