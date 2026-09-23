import { useState } from 'react'
import Modal from './Modal'

const PROJECT_COLORS = ['#c084fc', '#60a5fa', '#2dd4bf', '#4ade80', '#fbbf24', '#fb7185']

export default function ProjectModal({ project, onSave, onClose }) {
  const [name, setName] = useState(project?.name || '')
  const [color, setColor] = useState(project?.color || PROJECT_COLORS[0])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Le nom du projet est obligatoire.')
      return
    }
    setSaving(true)
    try {
      await onSave({ name, color })
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={project ? 'Modifier le projet' : 'Nouveau projet'} onClose={onClose}>
      <form className="worker-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <label htmlFor="project-name">Nom du projet *</label>
          <input
            id="project-name"
            type="text"
            placeholder="Ex. Bible Stories"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label>Couleur</label>
          <div className="color-swatches">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`color-swatch${color === c ? ' selected' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={`Couleur ${c}`}
                aria-pressed={color === c}
              />
            ))}
          </div>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
