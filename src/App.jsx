import { useEffect, useRef, useState } from 'react'
import { useWorkers } from './hooks/useWorkers'
import { useObjectiveTypes } from './hooks/useObjectiveTypes'
import { useProjects } from './hooks/useProjects'
import WorkerForm from './components/WorkerForm'
import WorkerList from './components/WorkerList'
import Modal from './components/Modal'
import ObjectiveModal from './components/ObjectiveModal'
import Dashboard from './components/Dashboard'
import GrowthView from './components/GrowthView'
import ProjectModal from './components/ProjectModal'
import ConfirmModal from './components/ConfirmModal'
import WorkflowsPanel from './components/WorkflowsPanel'
import { runWithConcurrencyLimit } from './utils/concurrency'
import './App.css'

const VIEWS = [
  { key: 'workers', label: 'Workers' },
  { key: 'dashboard', label: 'Tableau de bord' },
  { key: 'growth', label: 'Croissance' },
  { key: 'workflows', label: 'Sauvegardes' },
]

// Apify limite les comptes standards à 5 runs d'actor simultanés. On reste
// prudemment sous cette limite pour laisser de la marge (ex. un refresh
// manuel déclenché pendant que l'auto-refresh au chargement tourne encore).
const CONCURRENT_REFRESH_LIMIT = 4

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
    detachProject,
  } = useWorkers()
  const { objectiveTypes } = useObjectiveTypes()
  const { projects, addProject, updateProject, removeProject } = useProjects()
  const [view, setView] = useState('workers')
  const [isAddOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null) // worker en cours de modification
  const [objectiveTarget, setObjectiveTarget] = useState(null) // worker en cours d'édition d'objectif
  const [projectModal, setProjectModal] = useState(null) // null | 'new' | projet à modifier
  const [projectToDelete, setProjectToDelete] = useState(null)

  // À chaque chargement de la page, on relance immédiatement la mesure de
  // tous les objectifs "automatiques" (pas ceux en saisie manuelle), une
  // seule fois — pour que les données affichées soient toujours à jour dès
  // l'ouverture, sans attendre un clic sur ⟳. Limité à
  // CONCURRENT_REFRESH_LIMIT en parallèle : au-delà, Apify rejette les runs
  // excédentaires (limite de compte), donc on met le reste en file plutôt
  // que de tout lancer d'un coup.
  const didAutoRefresh = useRef(false)
  useEffect(() => {
    if (loading || didAutoRefresh.current || objectiveTypes.length === 0) return
    didAutoRefresh.current = true
    const toRefresh = workers.filter((worker) => {
      if (!worker.objective) return false
      const provider = objectiveTypes.find((p) => p.id === worker.objective.providerId)
      return provider && !provider.manualEntry
    })
    runWithConcurrencyLimit(toRefresh, CONCURRENT_REFRESH_LIMIT, (worker) => refreshObjective(worker.id))
  }, [loading, objectiveTypes, workers, refreshObjective])

  async function handleAdd(data) {
    await addWorker(data)
    setAddOpen(false)
  }

  async function handleSaveProject(data) {
    if (projectModal === 'new') await addProject(data)
    else await updateProject(projectModal.id, data)
  }

  async function handleDeleteProject() {
    const id = projectToDelete.id
    setProjectToDelete(null)
    await removeProject(id)
    detachProject(id)
  }

  async function handleEdit(data) {
    await updateWorker(editTarget.id, data)
    setEditTarget(null)
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-left">
          <div>
            <h1>Workers</h1>
            {view === 'workers' && (
              <p>
                {workers.length} worker{workers.length !== 1 ? 's' : ''} enregistré
                {workers.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <nav className="app-nav">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                className={`app-nav-item${view === v.key ? ' active' : ''}`}
                onClick={() => setView(v.key)}
              >
                {v.label}
              </button>
            ))}
          </nav>
        </div>
        {view === 'workers' && (workers.length > 0 || projects.length > 0) && (
          <div className="app-header-actions">
            <button className="btn btn-ghost" onClick={() => setProjectModal('new')} aria-label="Nouveau projet">
              <span className="btn-add-icon">+</span>
              Projet
            </button>
            <button
              className="btn btn-primary btn-add"
              onClick={() => setAddOpen(true)}
              aria-label="Ajouter un worker"
            >
              <span className="btn-add-icon">+</span>
              Ajouter
            </button>
          </div>
        )}
      </header>

      <main className="app-main">
        {view === 'workers' && (
          <>
            {error && <p className="page-error">Impossible de charger les workers : {error}</p>}
            {loading ? (
              <p className="page-loading">Chargement…</p>
            ) : (
              <WorkerList
                workers={workers}
                projects={projects}
                onEditProject={setProjectModal}
                onDeleteProject={setProjectToDelete}
                onRemove={removeWorker}
                onEdit={setEditTarget}
                onAddClick={() => setAddOpen(true)}
                objectiveTypes={objectiveTypes}
                onEditObjective={setObjectiveTarget}
                onRefreshObjective={refreshObjective}
                onUpdateObjectiveValue={updateObjectiveValue}
              />
            )}
          </>
        )}

        {view === 'dashboard' &&
          (loading ? (
            <p className="page-loading">Chargement…</p>
          ) : (
            <Dashboard workers={workers} objectiveTypes={objectiveTypes} projects={projects} />
          ))}

        {view === 'growth' &&
          (loading ? (
            <p className="page-loading">Chargement…</p>
          ) : (
            <GrowthView workers={workers} objectiveTypes={objectiveTypes} projects={projects} />
          ))}

        {view === 'workflows' && <WorkflowsPanel />}
      </main>

      {isAddOpen && (
        <Modal title="Ajouter un worker" onClose={() => setAddOpen(false)}>
          <WorkerForm projects={projects} onSubmit={handleAdd} onCancel={() => setAddOpen(false)} />
        </Modal>
      )}

      {editTarget && (
        <Modal title="Modifier le worker" onClose={() => setEditTarget(null)}>
          <WorkerForm
            initialValues={editTarget}
            projects={projects}
            submitLabel="Enregistrer"
            onSubmit={handleEdit}
            onCancel={() => setEditTarget(null)}
          />
        </Modal>
      )}

      {projectModal && (
        <ProjectModal
          project={projectModal === 'new' ? null : projectModal}
          onSave={handleSaveProject}
          onClose={() => setProjectModal(null)}
        />
      )}

      {projectToDelete && (
        <ConfirmModal
          title="Supprimer ce projet ?"
          message={`Le projet "${projectToDelete.name}" sera supprimé. Ses workers ne sont pas supprimés : ils repassent dans « Sans projet ».`}
          confirmLabel="Supprimer"
          onConfirm={handleDeleteProject}
          onClose={() => setProjectToDelete(null)}
        />
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
