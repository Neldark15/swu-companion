/**
 * Continent → Country data for community/region system.
 * Flags are emoji flags. Only countries where SWU has known community presence
 * are included, with an option to add more over time.
 */

export interface Country {
  code: string     // ISO 3166-1 alpha-2
  name: string     // Spanish name
  nameEn: string   // English name (for search)
  flag: string     // Emoji flag
}

export interface Continent {
  id: string
  name: string
  icon: string
  countries: Country[]
}

export const CONTINENTS: Continent[] = [
  {
    id: 'NA',
    name: 'Norteamérica',
    icon: '🌎',
    countries: [
      { code: 'US', name: 'Estados Unidos', nameEn: 'United States', flag: '🇺🇸' },
      { code: 'CA', name: 'Canadá', nameEn: 'Canada', flag: '🇨🇦' },
      { code: 'MX', name: 'México', nameEn: 'Mexico', flag: '🇲🇽' },
    ],
  },
  {
    id: 'CA',
    name: 'Centroamérica y Caribe',
    icon: '🌴',
    countries: [
      { code: 'GT', name: 'Guatemala', nameEn: 'Guatemala', flag: '🇬🇹' },
      { code: 'SV', name: 'El Salvador', nameEn: 'El Salvador', flag: '🇸🇻' },
      { code: 'HN', name: 'Honduras', nameEn: 'Honduras', flag: '🇭🇳' },
      { code: 'NI', name: 'Nicaragua', nameEn: 'Nicaragua', flag: '🇳🇮' },
      { code: 'CR', name: 'Costa Rica', nameEn: 'Costa Rica', flag: '🇨🇷' },
      { code: 'PA', name: 'Panamá', nameEn: 'Panama', flag: '🇵🇦' },
      { code: 'BZ', name: 'Belice', nameEn: 'Belize', flag: '🇧🇿' },
      { code: 'CU', name: 'Cuba', nameEn: 'Cuba', flag: '🇨🇺' },
      { code: 'DO', name: 'República Dominicana', nameEn: 'Dominican Republic', flag: '🇩🇴' },
      { code: 'PR', name: 'Puerto Rico', nameEn: 'Puerto Rico', flag: '🇵🇷' },
      { code: 'JM', name: 'Jamaica', nameEn: 'Jamaica', flag: '🇯🇲' },
      { code: 'TT', name: 'Trinidad y Tobago', nameEn: 'Trinidad and Tobago', flag: '🇹🇹' },
    ],
  },
  {
    id: 'SA',
    name: 'Sudamérica',
    icon: '🌎',
    countries: [
      { code: 'AR', name: 'Argentina', nameEn: 'Argentina', flag: '🇦🇷' },
      { code: 'BR', name: 'Brasil', nameEn: 'Brazil', flag: '🇧🇷' },
      { code: 'CL', name: 'Chile', nameEn: 'Chile', flag: '🇨🇱' },
      { code: 'CO', name: 'Colombia', nameEn: 'Colombia', flag: '🇨🇴' },
      { code: 'EC', name: 'Ecuador', nameEn: 'Ecuador', flag: '🇪🇨' },
      { code: 'PE', name: 'Perú', nameEn: 'Peru', flag: '🇵🇪' },
      { code: 'VE', name: 'Venezuela', nameEn: 'Venezuela', flag: '🇻🇪' },
      { code: 'UY', name: 'Uruguay', nameEn: 'Uruguay', flag: '🇺🇾' },
      { code: 'PY', name: 'Paraguay', nameEn: 'Paraguay', flag: '🇵🇾' },
      { code: 'BO', name: 'Bolivia', nameEn: 'Bolivia', flag: '🇧🇴' },
    ],
  },
  {
    id: 'EU',
    name: 'Europa',
    icon: '🌍',
    countries: [
      { code: 'ES', name: 'España', nameEn: 'Spain', flag: '🇪🇸' },
      { code: 'FR', name: 'Francia', nameEn: 'France', flag: '🇫🇷' },
      { code: 'DE', name: 'Alemania', nameEn: 'Germany', flag: '🇩🇪' },
      { code: 'IT', name: 'Italia', nameEn: 'Italy', flag: '🇮🇹' },
      { code: 'GB', name: 'Reino Unido', nameEn: 'United Kingdom', flag: '🇬🇧' },
      { code: 'PT', name: 'Portugal', nameEn: 'Portugal', flag: '🇵🇹' },
      { code: 'NL', name: 'Países Bajos', nameEn: 'Netherlands', flag: '🇳🇱' },
      { code: 'BE', name: 'Bélgica', nameEn: 'Belgium', flag: '🇧🇪' },
      { code: 'AT', name: 'Austria', nameEn: 'Austria', flag: '🇦🇹' },
      { code: 'CH', name: 'Suiza', nameEn: 'Switzerland', flag: '🇨🇭' },
      { code: 'PL', name: 'Polonia', nameEn: 'Poland', flag: '🇵🇱' },
      { code: 'SE', name: 'Suecia', nameEn: 'Sweden', flag: '🇸🇪' },
      { code: 'NO', name: 'Noruega', nameEn: 'Norway', flag: '🇳🇴' },
      { code: 'DK', name: 'Dinamarca', nameEn: 'Denmark', flag: '🇩🇰' },
      { code: 'FI', name: 'Finlandia', nameEn: 'Finland', flag: '🇫🇮' },
      { code: 'IE', name: 'Irlanda', nameEn: 'Ireland', flag: '🇮🇪' },
      { code: 'CZ', name: 'Chequia', nameEn: 'Czech Republic', flag: '🇨🇿' },
      { code: 'GR', name: 'Grecia', nameEn: 'Greece', flag: '🇬🇷' },
      { code: 'RO', name: 'Rumanía', nameEn: 'Romania', flag: '🇷🇴' },
      { code: 'HU', name: 'Hungría', nameEn: 'Hungary', flag: '🇭🇺' },
    ],
  },
  {
    id: 'AS',
    name: 'Asia y Oceanía',
    icon: '🌏',
    countries: [
      { code: 'JP', name: 'Japón', nameEn: 'Japan', flag: '🇯🇵' },
      { code: 'KR', name: 'Corea del Sur', nameEn: 'South Korea', flag: '🇰🇷' },
      { code: 'CN', name: 'China', nameEn: 'China', flag: '🇨🇳' },
      { code: 'TW', name: 'Taiwán', nameEn: 'Taiwan', flag: '🇹🇼' },
      { code: 'TH', name: 'Tailandia', nameEn: 'Thailand', flag: '🇹🇭' },
      { code: 'PH', name: 'Filipinas', nameEn: 'Philippines', flag: '🇵🇭' },
      { code: 'SG', name: 'Singapur', nameEn: 'Singapore', flag: '🇸🇬' },
      { code: 'MY', name: 'Malasia', nameEn: 'Malaysia', flag: '🇲🇾' },
      { code: 'ID', name: 'Indonesia', nameEn: 'Indonesia', flag: '🇮🇩' },
      { code: 'IN', name: 'India', nameEn: 'India', flag: '🇮🇳' },
      { code: 'IL', name: 'Israel', nameEn: 'Israel', flag: '🇮🇱' },
      { code: 'TR', name: 'Turquía', nameEn: 'Turkey', flag: '🇹🇷' },
      { code: 'AU', name: 'Australia', nameEn: 'Australia', flag: '🇦🇺' },
      { code: 'NZ', name: 'Nueva Zelanda', nameEn: 'New Zealand', flag: '🇳🇿' },
    ],
  },
  {
    id: 'AF',
    name: 'África y Medio Oriente',
    icon: '🌍',
    countries: [
      { code: 'ZA', name: 'Sudáfrica', nameEn: 'South Africa', flag: '🇿🇦' },
      { code: 'EG', name: 'Egipto', nameEn: 'Egypt', flag: '🇪🇬' },
      { code: 'NG', name: 'Nigeria', nameEn: 'Nigeria', flag: '🇳🇬' },
      { code: 'KE', name: 'Kenia', nameEn: 'Kenya', flag: '🇰🇪' },
      { code: 'MA', name: 'Marruecos', nameEn: 'Morocco', flag: '🇲🇦' },
      { code: 'AE', name: 'Emiratos Árabes', nameEn: 'UAE', flag: '🇦🇪' },
      { code: 'SA', name: 'Arabia Saudita', nameEn: 'Saudi Arabia', flag: '🇸🇦' },
    ],
  },
]

// ─── Helpers ────────────────────────────────────────────────

/** Flat list of all countries */
export const ALL_COUNTRIES: Country[] = CONTINENTS.flatMap(c => c.countries)

/** Look up a country by ISO code */
export function getCountryByCode(code: string): Country | undefined {
  return ALL_COUNTRIES.find(c => c.code === code)
}

/** Look up a continent by country code */
export function getContinentByCountryCode(code: string): Continent | undefined {
  return CONTINENTS.find(c => c.countries.some(co => co.code === code))
}

/** Get continent by continent ID */
export function getContinentById(id: string): Continent | undefined {
  return CONTINENTS.find(c => c.id === id)
}

/** Get display string: "🇸🇻 El Salvador" */
export function getCountryDisplay(code: string): string {
  const country = getCountryByCode(code)
  if (!country) return code
  return `${country.flag} ${country.name}`
}

/** Get region display: "🌴 Centroamérica y Caribe" */
export function getContinentDisplay(code: string): string {
  const continent = getContinentByCountryCode(code)
  if (!continent) return ''
  return `${continent.icon} ${continent.name}`
}
