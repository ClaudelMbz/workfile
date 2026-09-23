// Croissance = dernière mesure - première mesure de l'historique conservé ;
// rate/jour = cette croissance ramenée à la durée écoulée entre les deux ;
// efficacité = croissance obtenue par euro dépensé (seulement si positive et
// qu'un coût est renseigné — sinon la division n'a pas de sens).
export function computeStats(worker, objectiveTypes) {
  const obj = worker.objective
  if (!obj) return null
  const provider = objectiveTypes.find((p) => p.id === obj.providerId)
  const history = obj.history || []

  let growth = null
  let ratePerDay = null
  if (history.length >= 2) {
    const first = history[0]
    const last = history[history.length - 1]
    growth = last.value - first.value
    const days = Math.max((new Date(last.at) - new Date(first.at)) / 86400000, 1 / 24)
    ratePerDay = growth / days
  }

  const efficiency = worker.cost && growth != null && growth > 0 ? growth / worker.cost : null

  return { provider, current: obj.current, target: obj.target, growth, ratePerDay, efficiency }
}

// Résumé d'un groupe de workers (un projet, ou tout le monde) : un total PAR
// plateforme — jamais une somme unique entre plateformes, ce sont souvent les
// mêmes personnes qui suivent le même contenu sur TikTok, Instagram et
// YouTube — plus le coût total.
export function summarizeWorkers(workers, objectiveTypes) {
  const platforms = new Map()
  let totalCost = 0

  workers.forEach((worker) => {
    totalCost += worker.cost || 0
    const stats = computeStats(worker, objectiveTypes)
    if (!stats || !stats.provider || stats.current == null) return

    const entry = platforms.get(stats.provider.id) || {
      id: stats.provider.id,
      icon: stats.provider.icon,
      label: stats.provider.label,
      unit: stats.provider.unit,
      total: 0,
      growth: null,
      count: 0,
    }
    entry.total += stats.current
    entry.count += 1
    if (stats.growth != null) entry.growth = (entry.growth ?? 0) + stats.growth
    platforms.set(stats.provider.id, entry)
  })

  return { platforms: Array.from(platforms.values()), totalCost }
}
