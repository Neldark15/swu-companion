const ARTE_PUENTE3 = {
  emblema: '/liga/emblema.webp',
  portada: '/liga/portada.webp',
  banner: '/liga/banner-liga.webp',
}

export function imagenLiga(code: string, tipo: keyof typeof ARTE_PUENTE3, configurada?: string | null): string | null {
  return configurada || (code === 'puente3' ? ARTE_PUENTE3[tipo] : null)
}
