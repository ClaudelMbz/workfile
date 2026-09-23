import { useMemo, useState } from 'react'
import LineChart from './LineChart'
import {
  MAX_SERIES,
  SERIES_COLORS,
  buildBuckets,
  msToIso,
  resolveRange,
  seriesPoints,
  summarize,
  todayUtc,
  valuesForBuckets,
} from '../utils/growth'

const nf = new Intl.NumberFormat('fr-FR')

const GRANULARITIES = [
  { key: 'day', label: 'Jour' },
  { key: 'month', label: 'Mois' },
  { key: 'year', label: 'Année' },
]

const PRESETS = [
  { key: '7d', label: '7 j' },
  { key: '30d', label: '30 j' },
  { key: '90d', label: '90 j' },
  { key: '1y', label: '1 an' },
  { key: 'all', label: 'Tout' },
  { key: 'custom', label: 'Dates précises' },
]

const MODES = [
  { key: 'value', label: 'Valeur' },
  { key: 'gain', label: 'Gain' },
]

// Période par défaut la plus parlante pour chaque découpage.
const DEFAULT_PRESET = { day: '30d', month: '1y', year: 'all' }

const MAX_BUCKETS = 800

function signed(v, decimals = 0) {
  const s = v.toFixed(decimals)
  return v > 0 ? `+${s}` : s
}

function Segmented({ label, options, value, onChange }) {
  return (
    <div className="seg-group">
      <span className="seg-label">{label}</span>
      <div className="seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            className={`seg-item${value === o.key ? ' active' : ''}`}
            aria-pressed={value === o.key}
            onClick={() => onChange(o.key)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function GrowthView({ workers, objectiveTypes, projects = [] }) {
  const [selection, setSelection] = useState([]) // [{ id, slot }]
  const [granularity, setGranularity] = useState('day')
  const [preset, setPreset] = useState('30d')
  const [from, setFrom] = useState(() => msToIso(todayUtc() - 29 * 86400000))
  const [to, setTo] = useState(() => msToIso(todayUtc()))
  const [mode, setMode] = useState('value')
  const [notice, setNotice] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])

  // Workers qui ont un objectif, avec leur série de points et leur libellé
  // (icône + nom : plusieurs workers peuvent porter le même nom sur des
  // plateformes différentes).
  const entries = useMemo(
    () =>
      workers
        .filter((w) => w.objective)
        .map((worker) => {
          const provider = objectiveTypes.find((p) => p.id === worker.objective.providerId)
          return {
            worker,
            provider,
            points: seriesPoints(worker),
            name: `${provider?.icon ? `${provider.icon} ` : ''}${worker.name}`,
          }
        }),
    [workers, objectiveTypes]
  )
  const entryById = useMemo(() => new Map(entries.map((e) => [e.worker.id, e])), [entries])

  const selectedIds = new Set(selection.map((s) => s.id))
  const available = entries.filter((e) => !selectedIds.has(e.worker.id))
  const plottable = entries.filter((e) => e.points.length > 0)

  function add(id) {
    const entry = entryById.get(id)
    if (!entry || entry.points.length === 0) return
    if (selection.some((s) => s.id === id)) return
    if (selection.length >= MAX_SERIES) {
      setNotice(`${MAX_SERIES} courbes au maximum en même temps, pour que le graphique reste lisible.`)
      return
    }
    // Un worker garde sa couleur tant qu'il est sur le graphique : on prend le
    // premier emplacement libre, on ne repeint jamais les autres.
    const used = new Set(selection.map((s) => s.slot))
    const slot = SERIES_COLORS.findIndex((_, i) => !used.has(i))
    setSelection((prev) => [...prev, { id, slot }])
    setNotice('')
  }

  function addAll() {
    const used = new Set(selection.map((s) => s.slot))
    const next = [...selection]
    let skipped = 0
    plottable.forEach((e) => {
      if (next.some((s) => s.id === e.worker.id)) return
      const slot = SERIES_COLORS.findIndex((_, i) => !used.has(i))
      if (slot === -1) {
        skipped += 1
        return
      }
      used.add(slot)
      next.push({ id: e.worker.id, slot })
    })
    setSelection(next)
    setNotice(
      skipped > 0
        ? `${MAX_SERIES} courbes affichées sur ${MAX_SERIES + skipped} : au-delà, le graphique devient illisible.`
        : ''
    )
  }

  function remove(id) {
    setSelection((prev) => prev.filter((s) => s.id !== id))
    setNotice('')
  }

  function clear() {
    setSelection([])
    setNotice('')
  }

  function changeGranularity(key) {
    setGranularity(key)
    if (preset !== 'custom') setPreset(DEFAULT_PRESET[key])
  }

  function onDragStart(e, id) {
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    add(e.dataTransfer.getData('text/plain'))
  }

  // --- données du graphique ---------------------------------------------
  const selectedEntries = selection.map((s) => ({ ...s, entry: entryById.get(s.id) })).filter((s) => s.entry)

  const earliest = useMemo(() => {
    const pool = selectedEntries.length ? selectedEntries.map((s) => s.entry) : plottable
    const firsts = pool.filter((e) => e.points.length).map((e) => e.points[0].t)
    return firsts.length ? Math.min(...firsts) : null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, entries])

  const range = resolveRange({ preset, from, to, earliest })
  const buckets = useMemo(
    () => (range ? buildBuckets(granularity, range.startMs, range.endMs) : []),
    [granularity, range?.startMs, range?.endMs] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const tooMany = buckets.length > MAX_BUCKETS
  const usable = buckets.length > 0 && !tooMany

  const series = usable
    ? selectedEntries.map(({ id, slot, entry }) => {
        const values = valuesForBuckets(entry.points, buckets)
        const summary = summarize(entry.points, range.startMs, range.endMs)
        const baseline = summary?.start ?? null
        const display =
          mode === 'gain' ? values.map((v) => (v == null || baseline == null ? null : v - baseline)) : values
        return { id, name: entry.name, color: SERIES_COLORS[slot], values, display, baseline, summary }
      })
    : []

  let rangeProblem = ''
  if (preset === 'custom' && !range) rangeProblem = 'Choisis une date de début et une date de fin (la fin ne peut pas précéder le début).'
  else if (tooMany) rangeProblem = 'Période trop longue pour ce découpage : choisis « Mois » ou « Année ».'

  const empty = selection.length === 0

  return (
    <div className="growth">
      <div className="growth-controls">
        <Segmented label="Découpage" options={GRANULARITIES} value={granularity} onChange={changeGranularity} />
        <Segmented label="Période" options={PRESETS} value={preset} onChange={setPreset} />
        {preset === 'custom' && (
          <div className="seg-group">
            <span className="seg-label">Du / au</span>
            <div className="date-range">
              <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="Date de début" />
              <span aria-hidden="true">→</span>
              <input
                type="date"
                value={to}
                min={from || undefined}
                max={msToIso(todayUtc())}
                onChange={(e) => setTo(e.target.value)}
                aria-label="Date de fin"
              />
            </div>
          </div>
        )}
        <Segmented label="Affichage" options={MODES} value={mode} onChange={setMode} />
      </div>

      {(notice || rangeProblem) && (
        <p className="growth-notice" role="status">
          {rangeProblem || notice}
        </p>
      )}

      <div className="growth-body">
        <div className="growth-main">
          <div
            className={`growth-chart-card${dragOver ? ' drag-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setDragOver(true)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false)
            }}
            onDrop={onDrop}
          >
            {empty ? (
              <div className="growth-empty">
                <div className="growth-empty-icon">📈</div>
                <p className="growth-empty-title">Glisse un worker ici pour voir son évolution</p>
                <p className="growth-empty-sub">Ou clique sur un worker dans la liste, ou sur « Tous les workers ».</p>
              </div>
            ) : usable ? (
              <>
                <LineChart buckets={buckets} series={series} mode={mode} />
                <div className="growth-legend">
                  {series.map((s) => (
                    <span className="growth-legend-item" key={s.id}>
                      <span className="lc-key" style={{ background: s.color }} aria-hidden="true" />
                      <span className="growth-legend-name">{s.name}</span>
                      <button
                        className="growth-legend-remove"
                        onClick={() => remove(s.id)}
                        aria-label={`Retirer ${s.name} du graphique`}
                        title="Retirer du graphique"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="growth-empty">
                <p className="growth-empty-sub">Rien à afficher pour cette période.</p>
              </div>
            )}
          </div>

          {series.length > 0 && (
            <div className="dashboard-table-wrap">
              <table className="dashboard-table">
                <caption className="growth-caption">
                  Détail sur la période ({buckets[0].longLabel} → {buckets[buckets.length - 1].longLabel})
                </caption>
                <thead>
                  <tr>
                    <th>Worker</th>
                    <th className="num">Début</th>
                    <th className="num">Fin</th>
                    <th className="num">Gain</th>
                    <th className="num">%</th>
                    <th className="num">Par jour</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((s) => {
                    const sum = s.summary
                    return (
                      <tr key={s.id}>
                        <td>
                          <span className="lc-key" style={{ background: s.color }} aria-hidden="true" /> {s.name}
                        </td>
                        {sum ? (
                          <>
                            <td className="num">{nf.format(sum.start)}</td>
                            <td className="num">{nf.format(sum.end)}</td>
                            <td className="num">{signed(sum.gain)}</td>
                            <td className="num">{sum.pct != null ? `${signed(sum.pct, 1)} %` : '—'}</td>
                            <td className="num">{signed(sum.perDay, 1)}/j</td>
                          </>
                        ) : (
                          <td className="num" colSpan={5}>
                            Pas de mesure sur cette période
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="growth-aside">
          <div className="growth-aside-head">
            <h3>Workers</h3>
            <div className="growth-aside-actions">
              <button className="btn btn-ghost btn-sm" onClick={addAll} disabled={plottable.length === 0 || available.every((e) => e.points.length === 0)}>
                Tous les workers
              </button>
              {selection.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={clear}>
                  Tout retirer
                </button>
              )}
            </div>
          </div>

          {entries.length === 0 ? (
            <p className="growth-aside-empty">Aucun worker avec un objectif pour l'instant.</p>
          ) : available.length === 0 ? (
            <p className="growth-aside-empty">Tous les workers sont sur le graphique.</p>
          ) : (
            <ul className="growth-list">
              {available.map((e) => {
                const noData = e.points.length === 0
                const project = projectsById.get(e.worker.projectId)
                return (
                  <li key={e.worker.id}>
                    <button
                      className="growth-chip"
                      draggable={!noData}
                      onDragStart={(ev) => onDragStart(ev, e.worker.id)}
                      onClick={() => add(e.worker.id)}
                      disabled={noData}
                      title={noData ? 'Pas encore de mesure pour ce worker' : 'Glisse-le sur le graphique, ou clique'}
                    >
                      <span className="growth-chip-name">{e.name}</span>
                      {project && (
                        <span className="growth-chip-project">
                          <span className="project-dot" style={{ background: project.color }} aria-hidden="true" />
                          {project.name}
                        </span>
                      )}
                      {noData && <span className="growth-chip-project">Pas encore de mesure</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>
      </div>
    </div>
  )
}
