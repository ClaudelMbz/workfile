import { useEffect, useRef, useState } from 'react'
import { niceTicks } from '../utils/growth'

const MARGIN = { top: 14, bottom: 30, left: 52 }
const nf = new Intl.NumberFormat('fr-FR')

function useWidth(ref) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    setWidth(Math.floor(el.getBoundingClientRect().width))
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return width
}

function signed(v) {
  return v > 0 ? `+${nf.format(v)}` : nf.format(v)
}

function pathFor(values, x, y) {
  let d = ''
  let pen = false
  values.forEach((v, i) => {
    if (v == null) {
      pen = false
      return
    }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
    pen = true
  })
  return d
}

// series : [{ id, name, color, values, display }]
//  - values  : valeur réelle par période (null avant la 1re mesure)
//  - display : ce qui est dessiné (la valeur, ou le gain depuis le début de la période)
export default function LineChart({ buckets, series, mode, height = 320 }) {
  const wrapRef = useRef(null)
  const width = useWidth(wrapRef)
  const [hover, setHover] = useState(null)

  const n = buckets.length
  const direct = series.length > 0 && series.length <= 4 && width >= 560
  const right = direct ? 124 : 16
  const plotW = Math.max(10, width - MARGIN.left - right)
  const plotH = height - MARGIN.top - MARGIN.bottom

  const shown = series.flatMap((s) => s.display.filter((v) => v != null))
  const dataMin = shown.length ? Math.min(...shown, mode === 'gain' ? 0 : Infinity) : 0
  const dataMax = shown.length ? Math.max(...shown, mode === 'gain' ? 0 : -Infinity) : 1
  const ticks = niceTicks(dataMin, dataMax, 5)
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]

  const x = (i) => MARGIN.left + (n <= 1 ? plotW / 2 : (i * plotW) / (n - 1))
  const y = (v) => MARGIN.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH

  const maxLabels = Math.max(2, Math.floor(plotW / 78))
  const labelStep = Math.max(1, Math.ceil(n / maxLabels))
  const xLabels = []
  for (let i = 0; i < n; i += labelStep) xLabels.push(i)

  // Étiquettes directes en bout de courbe : jamais empilées — si deux se
  // touchent, la seconde est omise (la légende et l'info-bulle prennent le relais).
  const endLabels = []
  if (direct) {
    const ends = series
      .map((s) => ({ s, v: s.display[n - 1] }))
      .filter((e) => e.v != null)
      .sort((a, b) => y(a.v) - y(b.v))
    let lastY = -Infinity
    ends.forEach(({ s, v }) => {
      const py = y(v)
      if (py - lastY >= 15) {
        endLabels.push({ id: s.id, name: s.name, y: py })
        lastY = py
      }
    })
  }

  function indexFromPointer(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    if (n <= 1) return 0
    const ratio = (e.clientX - rect.left) / rect.width
    return Math.min(n - 1, Math.max(0, Math.round(ratio * (n - 1))))
  }

  function onKeyDown(e) {
    if (n === 0) return
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      setHover((h) => Math.min(n - 1, (h ?? -1) + 1))
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setHover((h) => Math.max(0, (h ?? n) - 1))
    } else if (e.key === 'Escape') {
      setHover(null)
    }
  }

  const tipRight = hover != null && x(hover) > width * 0.6

  return (
    <div className="linechart" ref={wrapRef} style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Évolution des workers sélectionnés au fil du temps. Le détail est dans le tableau sous le graphique."
          tabIndex={0}
          onKeyDown={onKeyDown}
          onBlur={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={MARGIN.left}
                x2={MARGIN.left + plotW}
                y1={y(t)}
                y2={y(t)}
                stroke={mode === 'gain' && t === 0 ? 'rgba(255,255,255,0.28)' : 'var(--border)'}
                strokeWidth="1"
              />
              <text x={MARGIN.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="lc-tick">
                {mode === 'gain' ? signed(t) : nf.format(t)}
              </text>
            </g>
          ))}

          {xLabels.map((i) => (
            <text key={i} x={x(i)} y={height - 9} textAnchor="middle" className="lc-tick">
              {buckets[i].label}
            </text>
          ))}

          {series.map((s) => (
            <path
              key={s.id}
              d={pathFor(s.display, x, y)}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {series.map((s) =>
            s.display[n - 1] != null ? (
              <circle
                key={s.id}
                cx={x(n - 1)}
                cy={y(s.display[n - 1])}
                r="4"
                fill={s.color}
                stroke="var(--bg)"
                strokeWidth="2"
              />
            ) : null
          )}

          {endLabels.map((l) => (
            <text key={l.id} x={x(n - 1) + 12} y={l.y} dy="0.32em" className="lc-end">
              {l.name.length > 16 ? `${l.name.slice(0, 15)}…` : l.name}
            </text>
          ))}

          {hover != null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={MARGIN.top} y2={MARGIN.top + plotH} stroke="var(--text)" strokeWidth="1" opacity="0.5" />
              {series.map((s) =>
                s.display[hover] != null ? (
                  <circle key={s.id} cx={x(hover)} cy={y(s.display[hover])} r="4" fill={s.color} stroke="var(--bg)" strokeWidth="2" />
                ) : null
              )}
            </g>
          )}

          <rect
            x={MARGIN.left}
            y={MARGIN.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            onPointerMove={(e) => setHover(indexFromPointer(e))}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}

      {hover != null && (
        <div
          className="lc-tooltip"
          style={{
            left: x(hover) + (tipRight ? -12 : 12),
            top: MARGIN.top,
            transform: tipRight ? 'translateX(-100%)' : 'none',
          }}
        >
          <div className="lc-tip-date">{buckets[hover].longLabel}</div>
          {series.map((s) => {
            const v = s.values[hover]
            return (
              <div className="lc-tip-row" key={s.id}>
                <span className="lc-key" style={{ background: s.color }} aria-hidden="true" />
                <strong>{v != null ? nf.format(v) : '—'}</strong>
                {v != null && s.baseline != null && <span className="lc-tip-gain">{signed(v - s.baseline)}</span>}
                <span className="lc-tip-name">{s.name}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
