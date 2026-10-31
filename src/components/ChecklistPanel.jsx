import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Panneau latéral qui glisse depuis la droite. Il reste monté en permanence
// (seule la classe `open` change) pour que l'ouverture ET la fermeture soient
// animées. Pas de fond qui bloque la page : on peut garder la checklist
// ouverte tout en continuant à utiliser l'app.
export default function ChecklistPanel({ open, onClose, todos, loading, error, onAdd, onUpdate, onRemove }) {
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e) {
      if (e.key === 'Escape' && !editingId) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, editingId])

  async function handleSubmit(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || adding) return
    setAdding(true)
    setAddError(null)
    try {
      await onAdd(text)
      setDraft('')
    } catch (err) {
      setAddError(err.message)
    } finally {
      setAdding(false)
      inputRef.current?.focus()
    }
  }

  function startEdit(todo) {
    setEditingId(todo.id)
    setEditText(todo.text)
  }

  function commitEdit(todo) {
    const text = editText.trim()
    setEditingId(null)
    if (text && text !== todo.text) onUpdate(todo.id, { text })
  }

  const remaining = todos.filter((t) => !t.done)
  const done = todos.filter((t) => t.done)

  function renderItem(todo) {
    return (
      <li key={todo.id} className={`checklist-item${todo.done ? ' done' : ''}`}>
        <input
          type="checkbox"
          checked={todo.done}
          onChange={() => onUpdate(todo.id, { done: !todo.done })}
          aria-label={todo.done ? 'Marquer comme à faire' : 'Marquer comme fait'}
        />
        {editingId === todo.id ? (
          <input
            className="checklist-edit"
            value={editText}
            autoFocus
            maxLength={500}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={() => commitEdit(todo)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit(todo)
              if (e.key === 'Escape') setEditingId(null)
            }}
          />
        ) : (
          <span className="checklist-text" onDoubleClick={() => startEdit(todo)} title="Double-clic pour modifier">
            {todo.text}
          </span>
        )}
        <button className="checklist-remove" onClick={() => onRemove(todo.id)} aria-label="Supprimer">
          ✕
        </button>
      </li>
    )
  }

  return createPortal(
    <aside className={`checklist-panel${open ? ' open' : ''}`} aria-hidden={!open} aria-label="Checklist" inert={!open}>
      <div className="checklist-header">
        <h2>Checklist</h2>
        <button className="modal-close" onClick={onClose} aria-label="Fermer la checklist">
          ✕
        </button>
      </div>

      <form className="checklist-form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          value={draft}
          maxLength={500}
          placeholder="Ce qu'il reste à faire…"
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" disabled={!draft.trim() || adding}>
          +
        </button>
      </form>
      {(addError || error) && <p className="checklist-error">{addError || error}</p>}

      <div className="checklist-body">
        {loading ? (
          <p className="checklist-empty">Chargement…</p>
        ) : todos.length === 0 ? (
          <p className="checklist-empty">Rien pour l'instant. Note ici ce qu'il reste à faire.</p>
        ) : (
          <>
            <ul className="checklist-list">{remaining.map(renderItem)}</ul>
            {done.length > 0 && (
              <>
                <p className="checklist-section">Fait ({done.length})</p>
                <ul className="checklist-list">{done.map(renderItem)}</ul>
              </>
            )}
          </>
        )}
      </div>
    </aside>,
    document.body
  )
}
