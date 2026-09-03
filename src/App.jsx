import { useEffect, useRef, useState } from 'react'
import { useWorkers } from './hooks/useWorkers'
import { useObjectiveTypes } from './hooks/useObjectiveTypes'
import WorkerForm from './components/WorkerForm'
import WorkerList from './components/WorkerList'
import Modal from './components/Modal'
import ObjectiveModal from './components/ObjectiveModal'
import './App.css'

export default function App() {
  const {
    workers,
    loading,
    error,
    addWorker,
    updateWorker,
    removeWorker,
    setObjective,
    refreshObjective,
    updateObjectiveValue,
  } = useWorkers()
  const { objectiveTypes } = useObjectiveTypes()
  const [isAddOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null) // worker en cours de modification
  const [objectiveTarget, setObjectiveTarget] = useState(null) // worker en cours d'édition d'objectif

  // À chaque chargement de la page, on relance immédiatement la mesure de
  // tous les objectifs "automatiques" (pas ceux en saisie manuelle), une
  // seule fois — pour que les données affichées soient toujours à jour dès
  // l'ouverture, sans attendre un clic sur ⟳.
  const didAutoRefresh = useRef(false)
  useEffect(() => {
    if (loading || didAutoRefresh.current || objectiveTypes.length === 0) return
    didAutoRefresh.current = true
    workers.forEach((worker) => {
      if (!worker.objective) return
      const provider = objectiveTypes.find((p) => p.id === worker.objective.providerId)
      if (provider && !provider.manualEntry) {
        refreshObjective(worker.id)
      }
    })
  }, [loading, objectiveTypes, workers, refreshObjective])

  async function handleAdd(data) {
    await addWorker(data)
    setAddOpen(false)
  }

  async function handleEdit(data) {
    await updateWorker(editTarget.id, data)
    setEditTarget(null)
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Workers</h1>
          <p>
            {workers.length} worker{workers.length !== 1 ? 's' : ''} enregistré
            {workers.length !== 1 ? 's' : ''}
          </p>
        </div>
        {workers.length > 0 && (
          <button
            className="btn btn-primary btn-add"
            onClick={() => setAddOpen(true)}
            aria-label="Ajouter un worker"
          >
            <span className="btn-add-icon">+</span>
            Ajouter
          </button>
        )}
      </header>

      <main className="app-main">
        {error && <p className="page-error">Impossible de charger les workers : {error}</p>}
        {loading ? (
          <p className="page-loading">Chargement…</p>
        ) : (
          <WorkerList
            workers={workers}
            onRemove={removeWorker}
            onEdit={setEditTarget}
            onAddClick={() => setAddOpen(true)}
            objectiveTypes={objectiveTypes}
            onEditObjective={setObjectiveTarget}
            onRefreshObjective={refreshObjective}
            onUpdateObjectiveValue={updateObjectiveValue}
          />
        )}
      </main>

      {isAddOpen && (
        <Modal title="Ajouter un worker" onClose={() => setAddOpen(false)}>
          <WorkerForm onSubmit={handleAdd} onCancel={() => setAddOpen(false)} />
        </Modal>
      )}

      {editTarget && (
        <Modal title="Modifier le worker" onClose={() => setEditTarget(null)}>
          <WorkerForm
            initialValues={editTarget}
            submitLabel="Enregistrer"
            onSubmit={handleEdit}
            onCancel={() => setEditTarget(null)}
          />
        </Modal>
      )}

      {objectiveTarget && (
        <ObjectiveModal
          worker={objectiveTarget}
          objectiveTypes={objectiveTypes}
          onSave={(data) => setObjective(objectiveTarget.id, data)}
          onClose={() => setObjectiveTarget(null)}
        />
      )}
    </div>
  )
}
