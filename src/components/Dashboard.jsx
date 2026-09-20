import { useMemo, useState } from 'react'

function formatNumber(n) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n))
}

function formatCost(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

function formatSigned(n, decimals = 0) {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(decimals)}`
}

// Croissance = dernière mesure - première mesure de l'historique conservé ;
// rate/jour = cette croissance ramenée à la durée écoulée entre les deux ;
// efficacité = croissance obtenue par euro dépensé (seulement si positive et
// qu'un coût est renseigné — sinon la division n'a pas de sens).
function computeStats(worker, objectiveTypes) {
  const obj = worker.objective
  if (!obj) return null
  const provider = objectiveTypes.find((p) => p.id === obj.providerId)
  const history = obj.history || []

  let growth = null
  let ratePerDay = null
  if (history.length >= 2) {
    const first = history[0]
    const last = history[history.length - 1]
    growth = last.value - first.value
    const days = Math.max((new Date(last.at) - new Date(first.at)) / 86400000, 1 / 24)
    ratePerDay = growth / days
  }

  const efficiency = worker.cost && growth != null && growth > 0 ? growth / worker.cost : null

  return { provider, current: obj.current, target: obj.target, growth, ratePerDay, efficiency }
}

const COLUMNS = [
  { key: 'ratePerDay', label: 'Par jour' },
  { key: 'growth', label: 'Croissance' },
  { key: 'efficiency', label: 'Efficacité (€)' },
]

export default function Dashboard({ workers, objectiveTypes }) {
  const [sortKey, setSortKey] = useState('ratePerDay')

  const rows = useMemo(
    () =>
      workers
        .map((worker) => ({ worker, stats: computeStats(worker, objectiveTypes) }))
        .filter((r) => r.stats),
    [workers, objectiveTypes]
  )

  const platformTotals = useMemo(() => {
    const totals = new Map()
    rows.forEach(({ stats }) => {
      if (!stats.provider || stats.current == null) return
      const key = stats.provider.id
      const entry = totals.get(key) || {
        icon: stats.provider.icon,
        label: stats.provider.label,
        total: 0,
        count: 0,
      }
      entry.total += stats.current
      entry.count += 1
      totals.set(key, entry)
    })
    return Array.from(totals.values())
  }, [rows])

  const totalCost = useMemo(() => workers.reduce((sum, w) => sum + (w.cost || 0), 0), [workers])

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a.stats[sortKey]
      const bv = b.stats[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return bv - av
    })
  }, [rows, sortKey])

  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📊</div>
        <h2>Pas encore de données</h2>
        <p>Ajoute un objectif à au moins un worker pour voir apparaître le tableau de bord.</p>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="kpi-row">
        {platformTotals.map((p) => (
          <div className="kpi-tile" key={p.label}>
            <span className="kpi-icon">{p.icon}</span>
            <div>
              <div className="kpi-value">{formatNumber(p.total)}</div>
              <div className="kpi-label">
                {p.label} · {p.count} worker{p.count !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        ))}
        <div className="kpi-tile">
          <span className="kpi-icon">💰</span>
          <div>
            <div className="kpi-value">{formatCost(totalCost)}</div>
            <div className="kpi-label">Coût total</div>
          </div>
        </div>
      </div>

      <div className="dashboard-table-wrap">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Worker</th>
              <th>Plateforme</th>
              <th className="num">Actuel</th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`num sortable${sortKey === col.key ? ' active' : ''}`}
                  onClick={() => setSortKey(col.key)}
                >
                  {col.label}
                  {sortKey === col.key ? ' ▾' : ''}
                </th>
              ))}
              <th className="num">Coût</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map(({ worker, stats }) => (
              <tr key={worker.id}>
                <td>{worker.name}</td>
                <td>
                  {stats.provider?.icon} {stats.provider?.label}
                </td>
                <td className="num">{stats.current != null ? formatNumber(stats.current) : '—'}</td>
                <td className="num">{stats.ratePerDay != null ? `${formatSigned(stats.ratePerDay, 1)}/j` : '—'}</td>
                <td className="num">{stats.growth != null ? formatSigned(stats.growth) : '—'}</td>
                <td className="num">{stats.efficiency != null ? `${formatNumber(stats.efficiency)}/€` : '—'}</td>
                <td className="num">{worker.cost ? formatCost(worker.cost) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
