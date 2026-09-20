import { useState } from 'react'
import { useWorkflows } from '../hooks/useWorkflows'
import ConfirmModal from './ConfirmModal'

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(2)} Mo`
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function WorkflowsPanel() {
  const { workflows, loading, error, addWorkflow, removeWorkflow, downloadUrl } = useWorkflows()
  const [name, setName] = useState('')
  const [file, setFile] = useState(null)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmingId, setConfirmingId] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) {
      setFormError('Le nom est obligatoire.')
      return
    }
    if (!file) {
      setFormError('Choisis un fichier.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const content = await file.text()
      await addWorkflow({ name, filename: file.name, content })
      setName('')
      setFile(null)
      e.target.reset()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const confirmingWorkflow = workflows.find((w) => w.id === confirmingId)

  return (
    <div className="workflows-page">
      <form className="workflow-upload" onSubmit={handleSubmit}>
        <div className="form-row">
          <label htmlFor="wf-name">Nom de la sauvegarde</label>
          <input
            id="wf-name"
            type="text"
            placeholder="Ex. Automatisation publication TikTok"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label htmlFor="wf-file">Fichier</label>
          <input id="wf-file" type="file" onChange={(e) => setFile(e.target.files[0] || null)} />
        </div>
        {formError && <p className="form-error">{formError}</p>}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Enregistrement…' : '+ Sauvegarder'}
        </button>
      </form>

      {error && <p className="page-error">Impossible de charger les sauvegardes : {error}</p>}

      {loading ? (
        <p className="page-loading">Chargement…</p>
      ) : workflows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🗂️</div>
          <h2>Aucune sauvegarde pour l'instant</h2>
          <p>Uploade ton premier fichier de workflow ci-dessus.</p>
        </div>
      ) : (
        <div className="workflow-list">
          {workflows.map((w) => (
            <div className="workflow-row" key={w.id}>
              <div className="workflow-row-main">
                <span className="workflow-name">{w.name}</span>
                <span className="workflow-meta">
                  {w.filename} · {formatSize(w.size)} · {formatDate(w.uploadedAt)}
                </span>
              </div>
              <div className="workflow-row-actions">
                <a className="btn btn-ghost btn-sm" href={downloadUrl(w.id)} download={w.filename}>
                  Télécharger
                </a>
                <button
                  className="worker-action worker-action-danger"
                  title="Supprimer"
                  onClick={() => setConfirmingId(w.id)}
                  aria-label={`Supprimer ${w.name}`}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmingWorkflow && (
        <ConfirmModal
          title="Supprimer cette sauvegarde ?"
          message={`"${confirmingWorkflow.name}" sera définitivement supprimé.`}
          confirmLabel="Supprimer"
          onConfirm={() => {
            removeWorkflow(confirmingId)
            setConfirmingId(null)
          }}
          onClose={() => setConfirmingId(null)}
        />
      )}
    </div>
  )
}
