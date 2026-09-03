import WorkerCard from './WorkerCard'

export default function WorkerList({
  workers,
  onRemove,
  onEdit,
  onAddClick,
  objectiveTypes,
  onEditObjective,
  onRefreshObjective,
  onUpdateObjectiveValue,
}) {
  if (workers.length === 0) {
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

  return (
    <div className="worker-list">
      {workers.map((worker) => (
        <WorkerCard
          key={worker.id}
          worker={worker}
          onRemove={onRemove}
          onEdit={onEdit}
          objectiveTypes={objectiveTypes}
          onEditObjective={onEditObjective}
          onRefreshObjective={onRefreshObjective}
          onUpdateObjectiveValue={onUpdateObjectiveValue}
        />
      ))}
    </div>
  )
}
