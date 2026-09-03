import { useState } from 'react'
import ConfirmModal from './ConfirmModal'
import Sparkline from './Sparkline'

const PALETTE = [
  { bg: '#eef2ff', fg: '#4f46e5' },
  { bg: '#fdf2f8', fg: '#db2777' },
  { bg: '#f0fdfa', fg: '#0d9488' },
  { bg: '#fff7ed', fg: '#c2410c' },
  { bg: '#f0fdf4', fg: '#16a34a' },
  { bg: '#faf5ff', fg: '#9333ea' },
  { bg: '#fefce8', fg: '#a16207' },
  { bg: '#eff6ff', fg: '#2563eb' },
]

function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function colorFor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

function formatNumber(n) {
  return new Intl.NumberFormat('fr-FR').format(n)
}

function formatCost(n) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.round(diffMs / 60000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.round(h / 24)
  return `il y a ${d} j`
}

// Écart entre la dernière mesure et celle d'avant, à partir de l'historique.
function computeDelta(history) {
  if (!history || history.length < 2) return null
  const last = history[history.length - 1].value
  const prev = history[history.length - 2].value
  return last - prev
}

function DeltaBadge({ delta, compact = false }) {
  if (delta === null) return null
  if (delta === 0) {
    return (
      <span className="objective-delta flat">– {compact ? 'stable' : 'stable depuis la dernière mesure'}</span>
    )
  }
  const up = delta > 0
  return (
    <span className={`objective-delta ${up ? 'up' : 'down'}`}>
      {up ? '▲' : '▼'} {up ? '+' : ''}
      {formatNumber(delta)}
      {!compact && ' depuis la dernière mesure'}
    </span>
  )
}

function objectiveLabel(provider, config) {
  const primaryField = provider?.fields?.find((f) => f.primary)
  if (primaryField && config?.[primaryField.key]) {
    return `${provider.icon} ${primaryField.prefix || ''}${config[primaryField.key]}`
  }
  return `${provider?.icon || '🎯'} ${provider?.label || 'Objectif'}`
}

function ManualValueEditor({ current, onSave }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(current ?? '')
  const [saving, setSaving] = useState(false)

  if (!editing) {
    return (
      <button className="objective-refresh" title="Mettre à jour la valeur" onClick={() => setEditing(true)}>
        ✎
      </button>
    )
  }

  async function save() {
    if (!Number(value) && Number(value) !== 0) return
    setSaving(true)
    await onSave(Number(value))
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="manual-editor">
      <input
        type="number"
        min="0"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
      />
      <button className="btn btn-primary btn-sm" disabled={saving} onClick={save}>
        OK
      </button>
    </div>
  )
}

function ObjectiveSection({ worker, objectiveTypes, onEditObjective, onRefreshObjective, onUpdateValue }) {
  const { objective } = worker

  if (!objective) {
    return (
      <button className="objective-add" onClick={() => onEditObjective(worker)}>
        🎯 Définir un objectif
      </button>
    )
  }

  const provider = objectiveTypes.find((p) => p.id === objective.providerId)
  const { target, current, lastCheckedAt, status, error, history } = objective
  const pct = current != null ? Math.min(100, Math.round((current / target) * 100)) : 0
  const checking = status === 'checking'
  const unit = provider?.unit
  const delta = computeDelta(history)

  return (
    <div className="objective">
      <div className="objective-top">
        <button className="objective-handle" onClick={() => onEditObjective(worker)}>
          {objectiveLabel(provider, objective.config)}
        </button>
        {provider?.manualEntry ? (
          <ManualValueEditor current={current} onSave={(v) => onUpdateValue(worker.id, v)} />
        ) : (
          <button
            className={`objective-refresh${checking ? ' spinning' : ''}`}
            title="Actualiser"
            disabled={checking}
            onClick={() => onRefreshObjective(worker.id)}
          >
            ⟳
          </button>
        )}
      </div>

      {current != null ? (
        <>
          <div className="objective-progress">
            <div className="objective-progress-bar" style={{ width: `${pct}%` }} />
          </div>
          <div className="objective-numbers">
            <span>
              <strong>{formatNumber(current)}</strong> / {formatNumber(target)}
              {unit ? ` ${unit}` : ''}
            </span>
            <span className="objective-pct">{pct}%</span>
          </div>
          {(delta !== null || history?.length >= 2) && (
            <div className="objective-trend">
              <Sparkline data={history} />
              <DeltaBadge delta={delta} />
            </div>
          )}
          {objective.secondary?.current != null && (
            <div className="objective-secondary">
              <span className="objective-secondary-value">
                {objective.secondary.icon} {formatNumber(objective.secondary.current)} {objective.secondary.label.toLowerCase()}
              </span>
              <Sparkline data={objective.secondary.history} width={56} height={20} />
              <DeltaBadge delta={computeDelta(objective.secondary.history)} compact />
            </div>
          )}
        </>
      ) : (
        <p className="objective-empty">
          {provider?.manualEntry ? 'Pas encore de valeur — clique sur ✎.' : 'Pas encore de mesure — clique sur ⟳.'}
        </p>
      )}

      {status === 'error' && <p className="objective-error">{error}</p>}
      {lastCheckedAt && !checking && (
        <p className="objective-updated">Mis à jour {timeAgo(lastCheckedAt)}</p>
      )}
      {checking && <p className="objective-updated">Actualisation en cours…</p>}
    </div>
  )
}

export default function WorkerCard({
  worker,
  onRemove,
  onEdit,
  objectiveTypes,
  onEditObjective,
  onRefreshObjective,
  onUpdateObjectiveValue,
}) {
  const color = colorFor(worker.name || '?')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  return (
    <div className="worker-card">
      <div className="worker-card-actions">
        <button
          className="worker-action"
          title="Modifier"
          onClick={() => onEdit(worker)}
          aria-label={`Modifier ${worker.name}`}
        >
          ✎
        </button>
        <button
          className="worker-action worker-action-danger"
          title="Supprimer"
          onClick={() => setConfirmingDelete(true)}
          aria-label={`Supprimer ${worker.name}`}
        >
          ✕
        </button>
      </div>
      <div className="worker-card-header">
        <div className="worker-avatar" style={{ background: color.bg, color: color.fg }}>
          {initials(worker.name) || '?'}
        </div>
        <div className="worker-info">
          <h3>{worker.name}</h3>
          {worker.role && <p className="worker-role">{worker.role}</p>}
          {worker.email && <p className="worker-email">{worker.email}</p>}
          {worker.cost != null && <p className="worker-cost">{formatCost(worker.cost)}</p>}
        </div>
      </div>

      <ObjectiveSection
        worker={worker}
        objectiveTypes={objectiveTypes}
        onEditObjective={onEditObjective}
        onRefreshObjective={onRefreshObjective}
        onUpdateValue={onUpdateObjectiveValue}
      />

      {confirmingDelete && (
        <ConfirmModal
          title="Supprimer ce worker ?"
          message={`Cette action est définitive : "${worker.name}" et son objectif seront supprimés.`}
          confirmLabel="Supprimer"
          onConfirm={() => {
            onRemove(worker.id)
            setConfirmingDelete(false)
          }}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  )
}
