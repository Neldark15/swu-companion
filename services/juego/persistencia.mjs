import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function crearPersistencia(ruta) {
  if (ruta !== ':memory:') mkdirSync(dirname(ruta), { recursive: true });
  const db = new DatabaseSync(ruta, { timeout: 5000 });
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS salas (codigo TEXT PRIMARY KEY, contenido TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS resultados (codigo TEXT PRIMARY KEY, contenido TEXT NOT NULL);`);
  const guardar = db.prepare('INSERT INTO salas VALUES (?, ?) ON CONFLICT(codigo) DO UPDATE SET contenido=excluded.contenido');
  const resultado = db.prepare('INSERT INTO resultados VALUES (?, ?) ON CONFLICT(codigo) DO NOTHING');
  return {
    cargar() { return db.prepare('SELECT contenido FROM salas').all().map((fila) => JSON.parse(fila.contenido)); },
    guardar(sala) {
      // Sin manos, mazos, tokens, estado del motor ni identificadores de cartas.
      const datos = { codigo: sala.codigo, estado: sala.estado, revision: sala.revision,
        jugadores: sala.jugadores.map(({ id, nombre, mazoNombre }) => ({ id, nombre, mazoNombre, preparado: false, conectado: false })),
        resultado: sala.resultado, actualizado: sala.actualizado };
      db.exec('BEGIN IMMEDIATE');
      try {
        guardar.run(sala.codigo, JSON.stringify(datos));
        if (sala.resultado) resultado.run(sala.codigo, JSON.stringify(sala.resultado));
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    eliminar(codigo) { db.prepare('DELETE FROM salas WHERE codigo = ?').run(codigo); },
    resultado(codigo) { const fila = db.prepare('SELECT contenido FROM resultados WHERE codigo = ?').get(codigo); return fila ? JSON.parse(fila.contenido) : null; },
    cerrar() { db.close(); },
  };
}
