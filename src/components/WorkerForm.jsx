import { useState } from 'react'

export default function WorkerForm({ initialValues, submitLabel = 'Ajouter', onSubmit, onCancel }) {
  const [name, setName] = useState(initialValues?.name || '')
  const [role, setRole] = useState(initialValues?.role || '')
  const [email, setEmail] = useState(initialValues?.email || '')
  const [cost, setCost] = useState(initialValues?.cost ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Le nom est obligatoire.')
      return
    }
    if (cost !== '' && (!Number.isFinite(Number(cost)) || Number(cost) < 0)) {
      setError('Le coût doit être un nombre positif ou nul.')
      return
    }
    setSaving(true)
    try {
      await onSubmit({ name, role, email, cost: cost === '' ? null : Number(cost) })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form className="worker-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label htmlFor="name">Nom *</label>
        <input
          id="name"
          type="text"
          placeholder="Ex. Léa Martin"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="form-row">
        <label htmlFor="role">Poste</label>
        <input
          id="role"
          type="text"
          placeholder="Ex. Développeuse"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
      </div>
      <div className="form-row">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          placeholder="Ex. lea@exemple.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="form-row">
        <label htmlFor="cost">Coût (€)</label>
        <div className="input-prefix">
          <span>€</span>
          <input
            id="cost"
            type="number"
            min="0"
            step="0.01"
            placeholder="Ex. 500"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Annuler
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Enregistrement…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
