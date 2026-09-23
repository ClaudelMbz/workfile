// Données du graphique de croissance : séries journalières, découpage en
// périodes (jour / mois / année), gain par rapport au début de la période.

const DAY = 86400000

// Couleurs catégorielles (slots 1 à 8) validées contre la surface sombre de
// l'app (#16171d). L'ordre est ce qui garantit la lisibilité pour les
// daltoniens : on ne les réordonne pas, on ne les fait pas tourner. Au-delà de
// 8 courbes, on ne génère pas de 9e teinte — le graphique refuse d'en ajouter.
export const SERIES_COLORS = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
]
export const MAX_SERIES = SERIES_COLORS.length

export function todayUtc() {
  return Math.floor(Date.now() / DAY) * DAY
}

export function dateToMs(iso) {
  return Date.parse(`${iso}T00:00:00Z`)
}

export function msToIso(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}

// Points [{ t, v }] d'un worker, du plus ancien au plus récent. Utilise la
// série journalière du serveur ; à défaut (ancien serveur), la reconstruit
// depuis l'historique des dernières mesures.
export function seriesPoints(worker) {
  const obj = worker.objective
  if (!obj) return []

  let daily = obj.daily
  if (!daily?.length && obj.history?.length) {
    const days = new Map()
    obj.history.forEach(({ value, at }) => days.set(String(at).slice(0, 10), value))
    daily = Array.from(days.entries())
  }
  return (daily || []).map(([d, v]) => ({ t: dateToMs(d), v }))
}

const fmtDay = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const fmtDayLong = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})
const fmtMonth = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' })
const fmtMonthLong = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

// Découpe [startMs, endMs] en périodes : { start, end (inclus), label, longLabel }.
export function buildBuckets(granularity, startMs, endMs) {
  const buckets = []
  if (endMs < startMs) return buckets

  if (granularity === 'month') {
    const s = new Date(startMs)
    let y = s.getUTCFullYear()
    let m = s.getUTCMonth()
    for (;;) {
      const start = Date.UTC(y, m, 1)
      if (start > endMs) break
      const next = Date.UTC(y, m + 1, 1)
      buckets.push({ start, end: next - 1, label: fmtMonth.format(start), longLabel: fmtMonthLong.format(start) })
      m += 1
      if (m > 11) {
        m = 0
        y += 1
      }
    }
  } else if (granularity === 'year') {
    for (let y = new Date(startMs).getUTCFullYear(); ; y += 1) {
      const start = Date.UTC(y, 0, 1)
      if (start > endMs) break
      buckets.push({ start, end: Date.UTC(y + 1, 0, 1) - 1, label: String(y), longLabel: String(y) })
    }
  } else {
    for (let t = startMs; t <= endMs; t += DAY) {
      buckets.push({ start: t, end: t + DAY - 1, label: fmtDay.format(t), longLabel: fmtDayLong.format(t) })
    }
  }
  return buckets
}

// Dernière valeur connue à la fin de chaque période (une période sans mesure
// reprend la valeur précédente ; avant la toute première mesure : null).
export function valuesForBuckets(points, buckets) {
  let i = 0
  let last = null
  return buckets.map((b) => {
    while (i < points.length && points[i].t <= b.end) {
      last = points[i].v
      i += 1
    }
    return last
  })
}

// Période affichée selon le préréglage. `earliest` = première mesure connue
// (pour "Tout"). Renvoie { startMs, endMs } ou null si les dates sont invalides.
export function resolveRange({ preset, from, to, earliest }) {
  const end = todayUtc()
  if (preset === 'custom') {
    if (!from || !to) return null
    const s = dateToMs(from)
    const e = dateToMs(to)
    if (Number.isNaN(s) || Number.isNaN(e) || e < s) return null
    return { startMs: s, endMs: e }
  }
  if (preset === 'all') {
    return { startMs: earliest ?? end - 29 * DAY, endMs: end }
  }
  const days = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }[preset] || 30
  return { startMs: end - (days - 1) * DAY, endMs: end }
}

// Graduations "propres" pour l'axe vertical (pas entier minimum : ce sont des
// abonnés, pas des décimales).
export function niceTicks(min, max, target = 5) {
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.1)
    min -= pad
    max += pad
  }
  const rawStep = (max - min) / (target - 1)
  const mag = 10 ** Math.floor(Math.log10(rawStep))
  const norm = rawStep / mag
  const step = Math.max(1, (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag)
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v))
  return ticks
}

// Valeur au début et à la fin de la PÉRIODE (pas de chaque intervalle) :
// début = dernière mesure avant la période, à défaut la première dedans ;
// fin = dernière mesure dans la période. C'est ce qui donne la vraie
// croissance même quand le découpage (mois, année) n'a qu'un seul point.
export function summarize(points, startMs, endMs) {
  let before = null
  let firstIn = null
  let lastIn = null
  points.forEach((p) => {
    if (p.t < startMs) before = p
    else if (p.t <= endMs) {
      if (!firstIn) firstIn = p
      lastIn = p
    }
  })

  const startPoint = before || firstIn
  if (!startPoint) return null
  const endPoint = lastIn || before

  const start = startPoint.v
  const end = endPoint.v
  const gain = end - start
  const startT = before ? startMs : firstIn.t
  const endT = lastIn ? lastIn.t : startT
  const days = Math.max(1, Math.round((endT - startT) / DAY))
  return { start, end, gain, pct: start > 0 ? (gain / start) * 100 : null, perDay: gain / days }
}
