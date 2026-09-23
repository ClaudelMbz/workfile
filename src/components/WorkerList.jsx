import WorkerCard from './WorkerCard'
import ProjectSection from './ProjectSection'

export default function WorkerList({
  workers,
  projects = [],
  onRemove,
  onEdit,
  onAddClick,
  onEditProject,
  onDeleteProject,
  objectiveTypes,
  onEditObjective,
  onRefreshObjective,
  onUpdateObjectiveValue,
}) {
  if (workers.length === 0 && projects.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">👥</div>
        <h2>Aucun worker pour l'instant</h2>
        <p>Ajoute ton premier worker pour commencer à suivre l'équipe.</p>
        <button className="btn btn-primary" onClick={onAddClick}>
          + Ajouter un worker
        </button>
      </div>
    )
  }

  const cardProps = {
    onRemove,
    onEdit,
    onEditObjective,
    onRefreshObjective,
    onUpdateObjectiveValue,
  }

  // Sans aucun projet : la grille plate d'avant, sans en-têtes.
  if (projects.length === 0) {
    return (
      <div className="worker-list">
        {workers.map((worker) => (
          <WorkerCard key={worker.id} worker={worker} objectiveTypes={objectiveTypes} {...cardProps} />
        ))}
      </div>
    )
  }

  const projectIds = new Set(projects.map((p) => p.id))
  const unassigned = workers.filter((w) => !w.projectId || !projectIds.has(w.projectId))

  return (
    <div className="project-groups">
      {projects.map((project) => (
        <ProjectSection
          key={project.id}
          project={project}
          workers={workers.filter((w) => w.projectId === project.id)}
          objectiveTypes={objectiveTypes}
          onEditProject={onEditProject}
          onDeleteProject={onDeleteProject}
          {...cardProps}
        />
      ))}
      {unassigned.length > 0 && (
        <ProjectSection
          project={null}
          workers={unassigned}
          objectiveTypes={objectiveTypes}
          {...cardProps}
        />
      )}
    </div>
  )
}
