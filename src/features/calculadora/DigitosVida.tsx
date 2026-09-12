// Display vectorial de siete segmentos: nítido a cualquier tamaño y sin fuentes remotas.
const ENCENDIDOS = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg']
const SEGMENTOS = [
  ['a', '12,4 48,4 54,10 48,16 12,16 6,10'],
  ['b', '50,18 56,12 56,48 50,54 44,48 44,24'],
  ['c', '50,58 56,64 56,100 50,106 44,100 44,64'],
  ['d', '12,102 42,102 48,108 42,114 12,114 6,108'],
  ['e', '6,58 12,64 12,100 6,106 0,100 0,64'],
  ['f', '6,12 12,18 12,48 6,54 0,48 0,18'],
  ['g', '12,52 42,52 48,58 42,64 12,64 6,58'],
]

export function DigitosVida({ valor }: { valor: number }) {
  const digitos = String(valor).padStart(2, '0').split('')
  return (
    <svg className="calc-digitos" viewBox={`0 0 ${digitos.length * 68 - 12} 118`} aria-hidden="true">
      {digitos.map((d, i) => <g key={i} transform={`translate(${i * 68} 0)`}>
        {SEGMENTOS.map(([letra, puntos]) => <polygon key={letra} points={puntos}
          fill="currentColor" opacity={ENCENDIDOS[Number(d)].includes(letra) ? 1 : 0.045} />)}
      </g>)}
    </svg>
  )
}
