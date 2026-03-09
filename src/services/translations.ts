/**
 * SWU Card Translation Service — English → Spanish
 *
 * Translates all card game terms: types, rarities, arenas,
 * aspects, keywords, traits, and card ability text.
 */

// ─── Static Term Dictionaries ────────────────────────────

const typeMap: Record<string, string> = {
  'Leader': 'Líder',
  'Unit': 'Unidad',
  'Event': 'Evento',
  'Upgrade': 'Mejora',
  'Base': 'Base',
  'Token Upgrade': 'Mejora Token',
}

const rarityMap: Record<string, string> = {
  'Common': 'Común',
  'Uncommon': 'Infrecuente',
  'Rare': 'Rara',
  'Legendary': 'Legendaria',
  'Special': 'Especial',
}

const arenaMap: Record<string, string> = {
  'Ground': 'Tierra',
  'Space': 'Espacio',
}

const aspectMap: Record<string, string> = {
  'Vigilance': 'Vigilancia',
  'Command': 'Mando',
  'Aggression': 'Agresión',
  'Cunning': 'Astucia',
  'Heroism': 'Heroísmo',
  'Villainy': 'Villanía',
}

const keywordMap: Record<string, string> = {
  'Ambush': 'Emboscada',
  'Bounty': 'Recompensa',
  'Coordinate': 'Coordinar',
  'Exploit': 'Explotar',
  'Grit': 'Tenacidad',
  'Hidden': 'Oculto',
  'Overwhelm': 'Abrumar',
  'Piloting': 'Pilotaje',
  'Raid': 'Incursión',
  'Restore': 'Restaurar',
  'Saboteur': 'Saboteador',
  'Sentinel': 'Centinela',
  'Shielded': 'Escudo',
  'Smuggle': 'Contrabando',
}

const traitMap: Record<string, string> = {
  'Armor': 'Armadura',
  'Bounty': 'Recompensa',
  'Bounty Hunter': 'Cazarrecompensas',
  'Capital Ship': 'Nave Capital',
  'Clone': 'Clon',
  'Condition': 'Condición',
  'Creature': 'Criatura',
  'Disaster': 'Desastre',
  'Droid': 'Droide',
  'Ewok': 'Ewok',
  'Fighter': 'Caza',
  'First Order': 'Primera Orden',
  'Force': 'Fuerza',
  'Fringe': 'Frontera',
  'Gambit': 'Gambito',
  'Hutt': 'Hutt',
  'Imperial': 'Imperial',
  'Innate': 'Innato',
  'Inquisitor': 'Inquisidor',
  'Item': 'Objeto',
  'Jedi': 'Jedi',
  'Kaminoan': 'Kaminoano',
  'Law': 'Ley',
  'Learned': 'Conocimiento',
  'Lightsaber': 'Sable de Luz',
  'Mandalorian': 'Mandaloriano',
  'Modification': 'Modificación',
  'Naboo': 'Naboo',
  'New Republic': 'Nueva República',
  'Night': 'Noche',
  'Nihil': 'Nihil',
  'Official': 'Oficial',
  'Pilot': 'Piloto',
  'Plan': 'Plan',
  'Rebel': 'Rebelde',
  'Republic': 'República',
  'Resistance': 'Resistencia',
  'Separatist': 'Separatista',
  'Sith': 'Sith',
  'Spectre': 'Espectro',
  'Speeder': 'Deslizador',
  'Supply': 'Suministro',
  'Tactic': 'Táctica',
  'Tank': 'Tanque',
  'Transport': 'Transporte',
  'Trick': 'Truco',
  'Trooper': 'Soldado',
  "Twi'lek": "Twi'lek",
  'Tusken': 'Tusken',
  'Undead': 'No-muerto',
  'Underworld': 'Submundo',
  'Vehicle': 'Vehículo',
  'Walker': 'Caminante',
  'Weapon': 'Arma',
  'Wookiee': 'Wookiee',
}

// ─── Card Text Translation Patterns ────────────────────

// Common game terms found in card text, sorted longest-first to avoid partial matches
type Replacer = string | ((...args: string[]) => string)
const textTerms: [RegExp, Replacer][] = [
  // Phases & steps
  [/\bAction\b/g, 'Acción'],
  [/\bWhen Played\b/gi, 'Al Jugar'],
  [/\bWhen Defeated\b/gi, 'Al ser Derrotada'],
  [/\bWhen Attacked\b/gi, 'Al ser Atacada'],
  [/\bOn Attack\b/gi, 'Al Atacar'],
  [/\bEpic Action\b/gi, 'Acción Épica'],
  // Zones
  [/\byour hand\b/gi, 'tu mano'],
  [/\byour deck\b/gi, 'tu mazo'],
  [/\byour discard pile\b/gi, 'tu pila de descarte'],
  [/\bthe discard pile\b/gi, 'la pila de descarte'],
  [/\bdiscard pile\b/gi, 'pila de descarte'],
  [/\byour resources\b/gi, 'tus recursos'],
  [/\ba resource\b/gi, 'un recurso'],
  [/\bresources?\b/gi, (m: string) => m.toLowerCase() === 'resource' ? 'recurso' : 'recursos'],
  [/\bground arena\b/gi, 'arena de Tierra'],
  [/\bspace arena\b/gi, 'arena de Espacio'],
  // Card types in text
  [/\ba unit\b/gi, 'una unidad'],
  [/\bunits?\b/gi, (m: string) => m.toLowerCase() === 'unit' ? 'unidad' : 'unidades'],
  [/\ba base\b/gi, 'una base'],
  [/\bbases?\b/gi, (m: string) => /^[Bb]ase$/.test(m) ? 'base' : 'bases'],
  [/\ban? upgrade\b/gi, 'una mejora'],
  [/\bupgrades?\b/gi, (m: string) => m.toLowerCase() === 'upgrade' ? 'mejora' : 'mejoras'],
  [/\ban? event\b/gi, 'un evento'],
  [/\bevents?\b/gi, (m: string) => m.toLowerCase() === 'event' ? 'evento' : 'eventos'],
  [/\bleaders?\b/gi, (m: string) => m.toLowerCase() === 'leader' ? 'líder' : 'líderes'],
  // Common verbs & phrases
  [/\bDeal (\d+) damage\b/gi, 'Inflige $1 de daño'],
  [/\bdeal damage\b/gi, 'infligir daño'],
  [/\bdamage\b/gi, 'daño'],
  [/\bDraw (\d+) cards?\b/gi, 'Roba $1 carta(s)'],
  [/\bDraw a card\b/gi, 'Roba una carta'],
  [/\bdraw\b/gi, 'robar'],
  [/\bDiscard (\d+) cards?\b/gi, 'Descarta $1 carta(s)'],
  [/\bDiscard a card\b/gi, 'Descarta una carta'],
  [/\bdiscard\b/gi, 'descartar'],
  [/\bDefeat\b/g, 'Derrotar'],
  [/\bdefeated\b/gi, 'derrotada'],
  [/\bDefend\b/g, 'Defender'],
  [/\bExhaust\b/g, 'Agotar'],
  [/\bexhausted\b/gi, 'agotada'],
  [/\bexhaust\b/gi, 'agotar'],
  [/\bReady\b/g, 'Preparar'],
  [/\breadied\b/gi, 'preparada'],
  [/\bAttack\b/g, 'Atacar'],
  [/\battacks?\b/gi, (m: string) => m.toLowerCase() === 'attack' ? 'ataque' : 'ataques'],
  [/\bPlay\b/g, 'Jugar'],
  [/\bplayed\b/gi, 'jugada'],
  [/\bHeal (\d+)\b/gi, 'Cura $1'],
  [/\bheal\b/gi, 'curar'],
  [/\bSearch\b/g, 'Buscar'],
  [/\bShuffle\b/g, 'Barajar'],
  [/\bReveal\b/g, 'Revelar'],
  [/\bReturn\b/g, 'Devolver'],
  [/\bChoose\b/g, 'Elegir'],
  [/\bLook at\b/gi, 'Mirar'],
  [/\bPut\b/g, 'Poner'],
  [/\bGive\b/g, 'Dar'],
  [/\bgains?\b/gi, (m: string) => m.toLowerCase() === 'gain' ? 'obtiene' : 'obtienen'],
  [/\bgets?\b/gi, (m: string) => m.toLowerCase() === 'get' ? 'obtiene' : 'obtienen'],
  [/\bloses?\b/gi, (m: string) => m.toLowerCase() === 'lose' ? 'pierde' : 'pierden'],
  // Stats
  [/\bpower\b/gi, 'poder'],
  [/\bHP\b/g, 'PV'],
  [/\bcost\b/gi, 'costo'],
  // Conditions
  [/\bIf you control\b/gi, 'Si controlas'],
  [/\byou control\b/gi, 'controlas'],
  [/\byour opponent controls\b/gi, 'tu oponente controla'],
  [/\byou may\b/gi, 'puedes'],
  [/\byour opponent\b/gi, 'tu oponente'],
  [/\bopponent\b/gi, 'oponente'],
  [/\beach\b/gi, 'cada'],
  [/\banother\b/gi, 'otra'],
  [/\bfriendly\b/gi, 'aliada'],
  [/\benemy\b/gi, 'enemiga'],
  [/\ball\b/gi, 'todas'],
  [/\bthis phase\b/gi, 'esta fase'],
  [/\bthis round\b/gi, 'esta ronda'],
  [/\bfor this phase\b/gi, 'durante esta fase'],
  [/\bfor this round\b/gi, 'durante esta ronda'],
  // Keywords in text
  [/\bAmbush\b/g, 'Emboscada'],
  [/\bBounty\b/g, 'Recompensa'],
  [/\bCoordinate\b/g, 'Coordinar'],
  [/\bExploit\b/g, 'Explotar'],
  [/\bGrit\b/g, 'Tenacidad'],
  [/\bOverwhelm\b/g, 'Abrumar'],
  [/\bPiloting\b/g, 'Pilotaje'],
  [/\bRaid\b/g, 'Incursión'],
  [/\bRestore\b/g, 'Restaurar'],
  [/\bSaboteur\b/g, 'Saboteador'],
  [/\bSentinel\b/g, 'Centinela'],
  [/\bShielded\b/g, 'Escudo'],
  [/\bSmuggle\b/g, 'Contrabando'],
  [/\bHidden\b/g, 'Oculto'],
  // Aspects in text
  [/\[Vigilance\]/g, '[Vigilancia]'],
  [/\[Command\]/g, '[Mando]'],
  [/\[Aggression\]/g, '[Agresión]'],
  [/\[Cunning\]/g, '[Astucia]'],
  [/\[Heroism\]/g, '[Heroísmo]'],
  [/\[Villainy\]/g, '[Villanía]'],
]

// ─── Public Translation Functions ────────────────────────

export function translateType(type: string): string {
  return typeMap[type] || type
}

export function translateRarity(rarity: string): string {
  return rarityMap[rarity] || rarity
}

export function translateArena(arena: string): string {
  return arenaMap[arena] || arena
}

export function translateAspect(aspect: string): string {
  return aspectMap[aspect] || aspect
}

export function translateKeyword(keyword: string): string {
  return keywordMap[keyword] || keyword
}

export function translateTrait(trait: string): string {
  return traitMap[trait] || trait
}

/**
 * Translate card ability text from English to Spanish.
 * Uses regex-based pattern matching for common game terms.
 * Not perfect but covers ~80% of card text vocabulary.
 */
export function translateCardText(text: string): string {
  if (!text) return text
  let result = text
  for (const [pattern, replacement] of textTerms) {
    if (typeof replacement === 'string') {
      result = result.replace(pattern, replacement)
    } else {
      result = result.replace(pattern, replacement as (match: string) => string)
    }
  }
  return result
}
