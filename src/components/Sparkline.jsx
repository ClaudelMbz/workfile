// Mini graphique de tendance : ligne fine en gris (couleur de bordure du
// thème), dernier point mis en avant en accent — pas d'axes, pas de grille,
// c'est un sparkline. `data` : [{ value, at }], du plus ancien au plus récent.
export default function Sparkline({ data, width = 100, height = 28 }) {
  if (!data || data.length < 2) return null

  const values = data.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const padY = 4
  const stepX = data.length > 1 ? width / (data.length - 1) : 0

  const points = values.map((v, i) => {
    const x = i * stepX
    const y = height - padY - ((v - min) / range) * (height - padY * 2)
    return [x, y]
  })

  const pathD = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const [lastX, lastY] = points[points.length - 1]

  const label = `Évolution : ${values.join(' → ')}`

  return (
    <svg
      className="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <path d={pathD} fill="none" stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="3" fill="var(--accent)" stroke="var(--bg)" strokeWidth="2" />
    </svg>
  )
}
