/**
 * Los rótulos en inglés de los módulos.
 *
 * Vive en su propio archivo por la regla de fast refresh: un archivo que
 * exporta un componente Y una constante deja de recargar en caliente
 * (`react-refresh/only-export-components`). Es la misma razón por la que los
 * tonos del HUD se separaron de `Hud.tsx`.
 */

/** El rótulo en inglés de cada módulo. */
export const MOD_EN: Record<string, string> = {
  'Contador de daños': 'Damage Counter', 'Amistosas': 'Friendlies', 'Duelo': 'Duel',
  'Misiones': 'Missions', 'Torneos': 'Tournaments', 'Calendario': 'Calendar',
  'Meta': 'Meta', 'Ranking': 'Ranking', 'En Vivo': 'Live',
  'Mis Decks': 'My Decks', 'Laboratorio': 'Lab', 'Buscar Cartas': 'Card Search',
  'Rulings': 'Rulings', 'Mi Botín': 'My Loot', 'Sobredosis': 'Packs',
  'Binder digital': 'Digital Binder', 'Contrabando': 'Smuggling',
  'Mercancía': 'Market', 'Pedidos': 'Orders', 'La Galaxia': 'The Galaxy',
  'Mi Credencial': 'My Badge', 'Mensajes': 'Messages',
}
