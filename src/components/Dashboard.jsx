import { useMemo, useState } from 'react'
import { computeStats, summarizeWorkers } from '../utils/stats'

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

const COLUMNS = [
  { key: 'ratePerDay', label: 'Par jour' },
  { key: 'growth', label: 'Croissance' },
  { key: 'efficiency', label: 'Efficacité (€)' },
]

export default function Dashboard({ workers, objectiveTypes, projects = [] }) {
  const [sortKey, setSortKey] = useState('ratePerDay')
  const [projectFilter, setProjectFilter] = useState('all') // 'all' | 'none' | id de projet

  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects])

  const filteredWorkers = useMemo(() => {
    if (projectFilter === 'all') return workers
    if (projectFilter === 'none') return workers.filter((w) => !w.projectId || !projectsById.has(w.projectId))
    return workers.filter((w) => w.projectId === projectFilter)
  }, [workers, projectFilter, projectsById])

  const rows = useMemo(
    () =>
      filteredWorkers
        .map((worker) => ({ worker, stats: computeStats(worker, objectiveTypes) }))
        .filter((r) => r.stats),
    [filteredWorkers, objectiveTypes]
  )

  const summary = useMemo(
    () => summarizeWorkers(filteredWorkers, objectiveTypes),
    [filteredWorkers, objectiveTypes]
  )

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

  const filter =
    projects.length > 0 ? (
      <div className="dashboard-filter">
        <label htmlFor="dashboard-project">Projet</label>
        <select id="dashboard-project" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
          <option value="all">Tous les projets</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="none">Sans projet</option>
        </select>
      </div>
    ) : null

  if (rows.length === 0) {
    return (
      <div className="dashboard">
        {filter}
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <h2>Pas encore de données</h2>
          <p>
            {projectFilter === 'all'
              ? 'Ajoute un objectif à au moins un worker pour voir apparaître le tableau de bord.'
              : 'Aucun worker avec un objectif dans ce projet.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">
      {filter}

      <div className="kpi-row">
        {summary.platforms.map((p) => (
          <div className="kpi-tile" key={p.id}>
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
            <div className="kpi-value">{formatCost(summary.totalCost)}</div>
            <div className="kpi-label">Coût total</div>
          </div>
        </div>
      </div>

      <div className="dashboard-table-wrap">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Worker</th>
              {projects.length > 0 && <th>Projet</th>}
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
            {sortedRows.map(({ worker, stats }) => {
              const project = projectsById.get(worker.projectId)
              return (
                <tr key={worker.id}>
                  <td>{worker.name}</td>
                  {projects.length > 0 && (
                    <td>
                      {project ? (
                        <span className="project-tag">
                          <span className="project-dot" style={{ background: project.color }} aria-hidden="true" />
                          {project.name}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  )}
                  <td>
                    {stats.provider?.icon} {stats.provider?.label}
                  </td>
                  <td className="num">{stats.current != null ? formatNumber(stats.current) : '—'}</td>
                  <td className="num">{stats.ratePerDay != null ? `${formatSigned(stats.ratePerDay, 1)}/j` : '—'}</td>
                  <td className="num">{stats.growth != null ? formatSigned(stats.growth) : '—'}</td>
                  <td className="num">{stats.efficiency != null ? `${formatNumber(stats.efficiency)}/€` : '—'}</td>
                  <td className="num">{worker.cost ? formatCost(worker.cost) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
