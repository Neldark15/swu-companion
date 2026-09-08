type FuenteLectura = 'arte' | 'texto'
type Candidata = { id: string; fotograma: number; veces: number }

/** Diferencia de forma/textura: un cambio uniforme de exposición no rearma. */
export function cambioDeCarta(antes: Uint8Array, ahora: Uint8Array): boolean {
  if (antes.length !== ahora.length || antes.length === 0) return false
  let desplazamiento = 0
  for (let i = 0; i < antes.length; i++) desplazamiento += ahora[i] - antes[i]
  desplazamiento /= antes.length
  let diferencia = 0
  for (let i = 0; i < antes.length; i++) diferencia += Math.abs(ahora[i] - antes[i] - desplazamiento)
  return diferencia / antes.length >= 18
}

/** Estado ajeno a React: arbitra resultados tardíos, estabilidad y el worker OCR. */
export class CicloEscaner {
  private generacion = 0
  private ultimoFotograma = -1
  private candidatas: Partial<Record<FuenteLectura, Candidata>> = {}
  private bloqueada: string | null = null
  private firmaBloqueada: Uint8Array | null = null
  private cambios = 0
  private texto: Promise<unknown> = Promise.resolve()

  actual(): number { return this.generacion }
  vigente(generacion: number): boolean { return generacion === this.generacion }

  invalidar(): number {
    this.generacion++
    this.candidatas = {}
    this.ultimoFotograma = -1
    return this.generacion
  }

  admitirFotograma(tiempo: number, forzado = false): boolean {
    if (!Number.isFinite(tiempo) || (!forzado && tiempo === this.ultimoFotograma)) return false
    this.ultimoFotograma = tiempo
    return true
  }

  observar(id: string | null, fuente: FuenteLectura, fotograma: number, forzado = false): boolean {
    if (!id) { delete this.candidatas[fuente]; return false }
    if (forzado) return true
    if (id === this.bloqueada) return false
    const anterior = this.candidatas[fuente]
    if (anterior?.fotograma === fotograma) return false
    const veces = anterior?.id === id ? anterior.veces + 1 : 1
    this.candidatas[fuente] = { id, fotograma, veces }
    return veces >= 2
  }

  bloquear(id: string, firma: Uint8Array | null): void {
    this.invalidar()
    this.bloqueada = id
    this.firmaBloqueada = firma?.slice() ?? null
    this.cambios = 0
  }

  esperaRetiro(): boolean { return this.bloqueada !== null }

  observarEscena(firma: Uint8Array | null): boolean {
    if (!firma || !this.bloqueada) return false
    // Una foto/manual no tiene fotograma de cámara asociado: al volver al
    // visor se toma la primera imagen como referencia para poder retirarla.
    if (!this.firmaBloqueada) { this.firmaBloqueada = firma.slice(); return false }
    this.cambios = cambioDeCarta(this.firmaBloqueada, firma) ? this.cambios + 1 : 0
    if (this.cambios < 2) return false
    this.bloqueada = null
    this.firmaBloqueada = null
    this.cambios = 0
    this.candidatas = {}
    return true
  }

  /** Foto y vídeo comparten la cola; invalidar no libera un worker todavía ocupado. */
  encolarTexto<T>(generacion: number, ejecutar: () => Promise<T>): Promise<T | undefined> {
    const pendiente = this.texto.catch(() => {}).then(async () => {
      if (!this.vigente(generacion)) return undefined
      const resultado = await ejecutar()
      return this.vigente(generacion) ? resultado : undefined
    })
    this.texto = pendiente
    return pendiente
  }
}
