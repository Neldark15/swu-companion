import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, access, rm } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const servicio = fileURLToPath(new URL('./', import.meta.url));
const cache = join(servicio, '.motor');
const fuente = join(cache, 'fuente');
const lock = JSON.parse(await readFile(join(servicio, 'motor-lock.json'), 'utf8'));
const existe = (ruta) => access(ruta).then(() => true, () => false);
const hash = (datos) => createHash('sha256').update(datos).digest('hex');
function ejecutar(comando, args, cwd = fuente) { return execFileSync(comando, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim(); }
function comprobar(valor, esperado, mensaje) { if (valor !== esperado) throw new Error(mensaje); }

await mkdir(cache, { recursive: true });
// Quitar el sello antes de trabajar: un fallo no debe dejar una caché parcialmente preparada utilizable.
await rm(join(cache, 'preparado.json'), { force: true });
const comprimido = await readFile(join(servicio, lock.catalogo.archivo));
comprobar(hash(comprimido), lock.catalogo.sha256, 'La integridad del catálogo de cartas no coincide.');
if (!await existe(join(fuente, '.git'))) {
  await mkdir(fuente, { recursive: true });
  ejecutar('git', ['init', '--quiet']);
  ejecutar('git', ['remote', 'add', 'origin', lock.repositorio]);
}
let revisionActual;
try { revisionActual = ejecutar('git', ['rev-parse', '--verify', 'HEAD']); } catch { revisionActual = null; }
if (!revisionActual) {
  ejecutar('git', ['fetch', '--depth=1', 'origin', lock.revision]);
  ejecutar('git', ['checkout', '--detach', lock.revision]);
}
comprobar(ejecutar('git', ['rev-parse', 'HEAD']), lock.revision, 'La caché usa otra revisión; eliminá .motor y prepará otra vez.');
comprobar(ejecutar('git', ['diff', '--name-only', 'HEAD']), '', 'El código upstream tiene modificaciones locales; restaurá la caché antes de prepararla.');
comprobar(ejecutar('git', ['ls-files', '--others', '--exclude-standard', '--', 'server', 'scripts']), '', 'La caché contiene código upstream sin seguimiento.');
comprobar(hash(await readFile(join(fuente, 'package-lock.json'))), lock.dependenciasSha256, 'El lock de dependencias upstream no coincide.');
console.log('Instalando las dependencias fijadas del motor…');
ejecutar('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
console.log('Compilando Forceteki…');
// Evita restos compilados de otra preparación (el índice upstream descubre todos los .js del directorio).
await rm(join(fuente, 'build'), { force: true, recursive: true });
await rm(join(fuente, 'tsconfig.tsbuildinfo'), { force: true });
ejecutar('npm', ['run', 'build']);
const catalogo = JSON.parse(gunzipSync(comprimido).toString('utf8'));
const carpetaDatos = join(fuente, 'test', 'json');
await rm(carpetaDatos, { recursive: true, force: true });
await mkdir(join(carpetaDatos, 'Card'), { recursive: true });
for (const [nombre, datos] of Object.entries(catalogo)) {
  if (!/^(Card\/[a-z0-9#-]+\.json|_[A-Za-z]+\.json)$/.test(nombre)) throw new Error('Ruta de catálogo inválida.');
  await writeFile(join(carpetaDatos, nombre), JSON.stringify(datos));
}
const requerir = createRequire(join(fuente, 'package.json'));
const { computeCardDataHash } = requerir('./scripts/cardDataHash.js');
await writeFile(join(carpetaDatos, 'card-data-hash.txt'), computeCardDataHash());
await writeFile(join(cache, 'preparado.json'), JSON.stringify({ revision: lock.revision, catalogoSha256: lock.catalogo.sha256 }) + '\n');
console.log(`Motor preparado: ${lock.revision}. No se iniciaron servicios externos.`);
