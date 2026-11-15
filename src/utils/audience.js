// Audience totale : la somme de TOUS les comptes suivis (followers, abonnés…),
// toutes plateformes confondues — le chiffre "vitrine" affiché en grand.
// C'est un cumul assumé : une même personne qui suit sur TikTok et Instagram
// compte deux fois (le détail par plateforme reste dans summarizeWorkers).
// Les objectifs en saisie manuelle sont exclus : leur unité est libre
// (ça peut être des euros, des ventes…), on ne peut pas les additionner.
import { buildBuckets, seriesPoints, todayUtc, valuesForBuckets } from './growth'

const DAY = 86400000

function trackedObjectives(workers, objectiveTypes) {
  return workers
    .map((worker) => {
      const obj = worker.objective
      if (!obj) return null
      const provider = objectiveTypes.find((p) => p.id === obj.providerId)
      if (!provider || provider.manualEntry) return null
      const points = seriesPoints(worker)
      const current = typeof obj.current === 'number' ? obj.current : points[points.length - 1]?.v
      if (current == null) return null
      return { points, current }
    })
    .filter(Boolean)
}

// Valeur d'un compte à la fin du jour `endMs`. Un compte ajouté APRÈS cette
// date prend sa toute première mesure : il compte dans le total sans créer
// de faux bond (ajouter une chaîne n'est pas de la croissance).
function valueAt(points, endMs, fallback) {
  let value = null
  for (const p of points) {
    if (p.t > endMs) break
    value = p.v
  }
  return value ?? points[0]?.v ?? fallback
}

// `days` = 1 (vs hier), 7, 30… Renvoie le total actuel, le total à la date de
// référence, l'écart, et la série journalière du total pour le sparkline.
export function computeAudience(workers, objectiveTypes, days = 1) {
  const tracked = trackedObjectives(workers, objectiveTypes)
  if (tracked.length === 0) return null

  const today = todayUtc()
  const refEnd = today - (days - 1) * DAY - 1 // fin du jour de référence

  let total = 0
  let before = 0
  tracked.forEach(({ points, current }) => {
    total += current
    before += valueAt(points, refEnd, current)
  })

  // Série du total sur la période (au moins 7 jours pour que la courbe ait
  // une forme), jour par jour, en reprenant la dernière valeur connue.
  const span = Math.max(days, 7)
  const buckets = buildBuckets('day', today - span * DAY, today)
  const series = buckets.map(() => 0)
  tracked.forEach(({ points, current }) => {
    const values = valuesForBuckets(points, buckets)
    const first = points[0]?.v ?? current
    values.forEach((v, i) => {
      series[i] += v ?? first
    })
  })
  series[series.length - 1] = total // aujourd'hui = valeurs actuelles exactes

  const gain = total - before
  return {
    total,
    before,
    gain,
    pct: before > 0 ? (gain / before) * 100 : null,
    accounts: tracked.length,
    series: series.map((value) => ({ value })),
  }
}
