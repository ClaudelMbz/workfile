import { useState } from 'react'
import WorkerCard from './WorkerCard'
import { summarizeWorkers } from '../utils/stats'

const STORAGE_KEY = 'collapsedProjects'

function loadCollapsed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY)) || [])
  } catch {
    return new Set()
  }
}

function saveCollapsed(set) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
  } catch {
    // stockage indisponible : on garde juste l'état en mémoire
  }
}

function formatNumber(n) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n))
}

function formatCost(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

function GrowthChip({ growth }) {
  if (growth == null) return null
  if (growth === 0) return <span className="objective-delta flat">– stable</span>
  const up = growth > 0
  return (
    <span className={`objective-delta ${up ? 'up' : 'down'}`}>
      {up ? '▲' : '▼'} {up ? '+' : ''}
      {formatNumber(growth)}
    </span>
  )
}

export default function ProjectSection({
  project, // null = "Sans projet"
  workers,
  objectiveTypes,
  onEditProject,
  onDeleteProject,
  ...cardProps
}) {
  const key = project?.id || 'none'
  const [collapsed, setCollapsed] = useState(() => loadCollapsed().has(key))
  const summary = summarizeWorkers(workers, objectiveTypes)

  function toggle() {
    const set = loadCollapsed()
    if (collapsed) set.delete(key)
    else set.add(key)
    saveCollapsed(set)
    setCollapsed(!collapsed)
  }

  return (
    <section className="project-section">
      <div className="project-header">
        <button
          className="project-toggle"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Déplier le projet' : 'Replier le projet'}
        >
          <span className="project-chevron">{collapsed ? '▸' : '▾'}</span>
          <span
            className="project-dot"
            style={{ background: project?.color || 'var(--border)' }}
            aria-hidden="true"
          />
          <span className="project-name">{project ? project.name : 'Sans projet'}</span>
          <span className="project-count">
            {workers.length} worker{workers.length !== 1 ? 's' : ''}
          </span>
        </button>

        <div className="project-summary">
          {summary.platforms.map((p) => (
            <span
              className="project-chip"
              key={p.id}
              title={`${p.label} : ${p.count} compte${p.count !== 1 ? 's' : ''}`}
            >
              {p.icon} <strong>{formatNumber(p.total)}</strong>
              {p.unit ? ` ${p.unit}` : ''}
              <GrowthChip growth={p.growth} />
            </span>
          ))}
          {summary.totalCost > 0 && (
            <span className="project-chip" title="Coût total du projet">
              💰 <strong>{formatCost(summary.totalCost)}</strong>
            </span>
          )}
        </div>

        {project && (
          <div className="project-actions">
            <button
              className="worker-action"
              title="Modifier le projet"
              onClick={() => onEditProject(project)}
              aria-label={`Modifier le projet ${project.name}`}
            >
              ✎
            </button>
            <button
              className="worker-action worker-action-danger"
              title="Supprimer le projet"
              onClick={() => onDeleteProject(project)}
              aria-label={`Supprimer le projet ${project.name}`}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {!collapsed &&
        (workers.length === 0 ? (
          <p className="project-empty">
            Aucun worker dans ce projet — choisis-le dans « Projet » en créant ou en modifiant un worker.
          </p>
        ) : (
          <div className="worker-list">
            {workers.map((worker) => (
              <WorkerCard key={worker.id} worker={worker} objectiveTypes={objectiveTypes} {...cardProps} />
            ))}
          </div>
        ))}
    </section>
  )
}
