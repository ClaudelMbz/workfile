import { useState } from 'react'
import Modal from './Modal'

export default function ObjectiveModal({ worker, objectiveTypes, onSave, onClose }) {
  const [providerId, setProviderId] = useState(worker.objective?.providerId || null)
  const [config, setConfig] = useState(worker.objective?.config || {})
  const [target, setTarget] = useState(worker.objective?.target || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const provider = objectiveTypes.find((p) => p.id === providerId)

  function selectProvider(p) {
    setProviderId(p.id)
    setConfig(p.id === worker.objective?.providerId ? worker.objective.config : {})
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    for (const field of provider.fields) {
      if (!String(config[field.key] || '').trim()) {
        setError(`${field.label} est obligatoire.`)
        return
      }
    }
    if (!Number(target) || Number(target) <= 0) {
      setError("L'objectif doit être un nombre positif.")
      return
    }
    setSaving(true)
    try {
      await onSave({ providerId, config, target: Number(target) })
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title="Objectif" onClose={onClose}>
      {!provider ? (
        <div className="provider-picker">
          <p className="modal-hint">
            Choisis comment mesurer l'objectif de <strong>{worker.name}</strong>.
          </p>
          {objectiveTypes.map((p) => (
            <button key={p.id} type="button" className="provider-option" onClick={() => selectProvider(p)}>
              <span className="provider-option-icon">{p.icon}</span>
              <span>
                <span className="provider-option-label">{p.label}</span>
                <span className="provider-option-desc">{p.description}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <form className="worker-form" onSubmit={handleSubmit}>
          <button type="button" className="provider-change" onClick={() => setProviderId(null)}>
            ← {provider.icon} {provider.label}
          </button>

          {provider.fields.map((field) => (
            <div className="form-row" key={field.key}>
              <label htmlFor={field.key}>{field.label} *</label>
              {field.prefix ? (
                <div className="input-prefix">
                  <span>{field.prefix}</span>
                  <input
                    id={field.key}
                    type={field.type}
                    placeholder={field.placeholder}
                    autoFocus
                    value={config[field.key] || ''}
                    onChange={(e) => setConfig((c) => ({ ...c, [field.key]: e.target.value }))}
                  />
                </div>
              ) : (
                <input
                  id={field.key}
                  type={field.type}
                  placeholder={field.placeholder}
                  autoFocus
                  value={config[field.key] || ''}
                  onChange={(e) => setConfig((c) => ({ ...c, [field.key]: e.target.value }))}
                />
              )}
            </div>
          ))}

          <div className="form-row">
            <label htmlFor="target">
              Objectif {provider.unit ? `(nombre de ${provider.unit})` : '(valeur cible)'} *
            </label>
            <input
              id="target"
              type="number"
              min="1"
              placeholder="Ex. 10000"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
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
      )}
    </Modal>
  )
}
