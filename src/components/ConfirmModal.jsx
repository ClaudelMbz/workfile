import Modal from './Modal'

export default function ConfirmModal({ title, message, confirmLabel = 'Confirmer', onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="modal-hint">{message}</p>
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Annuler
        </button>
        <button type="button" className="btn btn-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
