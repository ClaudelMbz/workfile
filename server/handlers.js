// Logique métier partagée, indépendante du serveur qui l'appelle : le
// serveur Express local (server/index.js, via `npm run dev:all`) et les
// fonctions serverless Vercel (/api/*.js en production) appellent toutes les
// deux ces mêmes fonctions. Chacune renvoie { status, body } — à l'appelant
// de le traduire dans le format de sa plateforme.
import { randomUUID } from 'crypto'
import { readWorkers, withWorkers, pushHistory } from './store.js'
import { listProviders, getProvider } from './providers/index.js'

// Coût : optionnel, mais s'il est fourni il doit être un nombre positif ou nul.
function parseCost(cost) {
  if (cost === undefined || cost === null || cost === '') return { ok: true, value: null }
  const n = Number(cost)
  if (!Number.isFinite(n) || n < 0) return { ok: false }
  return { ok: true, value: n }
}

export async function getObjectiveTypes() {
  return { status: 200, body: listProviders() }
}

export async function getWorkers() {
  return { status: 200, body: await readWorkers() }
}

export async function createWorker(body) {
  const { name, role, email, cost } = body || {}
  if (!name || !name.trim()) {
    return { status: 400, body: { error: 'Le nom est obligatoire.' } }
  }
  const parsedCost = parseCost(cost)
  if (!parsedCost.ok) {
    return { status: 400, body: { error: 'Le coût doit être un nombre positif ou nul.' } }
  }

  const worker = {
    id: randomUUID(),
    name: name.trim(),
    role: (role || '').trim(),
    email: (email || '').trim(),
    cost: parsedCost.value,
    createdAt: new Date().toISOString(),
    objective: null,
  }

  await withWorkers((workers) => {
    workers.unshift(worker)
  })
  return { status: 201, body: worker }
}

export async function updateWorker(id, body) {
  const { name, role, email, cost } = body || {}
  if (!name || !name.trim()) {
    return { status: 400, body: { error: 'Le nom est obligatoire.' } }
  }
  const parsedCost = parseCost(cost)
  if (!parsedCost.ok) {
    return { status: 400, body: { error: 'Le coût doit être un nombre positif ou nul.' } }
  }

  const updated = await withWorkers((workers) => {
    const worker = workers.find((w) => w.id === id)
    if (!worker) return null
    worker.name = name.trim()
    worker.role = (role || '').trim()
    worker.email = (email || '').trim()
    worker.cost = parsedCost.value
    return worker
  })

  if (!updated) return { status: 404, body: { error: 'Worker introuvable.' } }
  return { status: 200, body: updated }
}

export async function deleteWorker(id) {
  const found = await withWorkers((workers) => {
    const idx = workers.findIndex((w) => w.id === id)
    if (idx === -1) return false
    workers.splice(idx, 1)
    return true
  })

  if (!found) return { status: 404, body: { error: 'Worker introuvable.' } }
  return { status: 204, body: null }
}

export async function setObjective(id, body) {
  const { providerId, config, target } = body || {}

  const provider = getProvider(providerId)
  if (!provider) {
    return { status: 400, body: { error: "Type d'objectif inconnu." } }
  }

  for (const field of provider.fields) {
    const value = config?.[field.key]
    if (!value || !String(value).trim()) {
      return { status: 400, body: { error: `${field.label} est obligatoire.` } }
    }
  }

  const targetNum = Number(target)
  if (!Number.isFinite(targetNum) || targetNum <= 0) {
    return { status: 400, body: { error: "L'objectif doit être un nombre positif." } }
  }

  const normalizedConfig = Object.fromEntries(
    provider.fields.map((f) => [f.key, String(config[f.key]).trim().replace(/^@/, '')])
  )

  const updated = await withWorkers((workers) => {
    const worker = workers.find((w) => w.id === id)
    if (!worker) return null
    const sameProvider = worker.objective?.providerId === providerId
    worker.objective = {
      providerId,
      config: normalizedConfig,
      target: targetNum,
      current: sameProvider ? worker.objective.current : null,
      lastCheckedAt: sameProvider ? worker.objective.lastCheckedAt : null,
      history: sameProvider ? worker.objective.history || [] : [],
      secondary: sameProvider ? worker.objective.secondary || null : null,
      status: 'idle',
      error: null,
    }
    return worker
  })

  if (!updated) return { status: 404, body: { error: 'Worker introuvable.' } }
  return { status: 200, body: updated }
}

export async function updateObjectiveValue(id, body) {
  const { current } = body || {}
  const currentNum = Number(current)
  if (!Number.isFinite(currentNum) || currentNum < 0) {
    return { status: 400, body: { error: 'La valeur doit être un nombre positif ou nul.' } }
  }

  const result = await withWorkers((workers) => {
    const worker = workers.find((w) => w.id === id)
    if (!worker) return { status: 404, error: 'Worker introuvable.' }
    if (!worker.objective) return { status: 400, error: "Ce worker n'a pas d'objectif défini." }
    const at = new Date().toISOString()
    worker.objective.current = currentNum
    worker.objective.lastCheckedAt = at
    worker.objective.status = 'idle'
    worker.objective.error = null
    pushHistory(worker.objective, currentNum, at)
    return { status: 200, worker }
  })

  if (result.error) return { status: result.status, body: { error: result.error } }
  return { status: 200, body: result.worker }
}

export async function deleteObjective(id) {
  const updated = await withWorkers((workers) => {
    const worker = workers.find((w) => w.id === id)
    if (!worker) return null
    worker.objective = null
    return worker
  })

  if (!updated) return { status: 404, body: { error: 'Worker introuvable.' } }
  return { status: 200, body: updated }
}

// La récupération de la valeur (appel Apify) se fait AVANT toute écriture,
// hors de la file `withWorkers` : plusieurs objectifs peuvent ainsi être
// rafraîchis en parallèle sans se bloquer les uns les autres. Seule
// l'écriture finale, courte, passe par `withWorkers`, qui relit l'état le
// plus récent pour ne jamais écraser le travail d'une requête concurrente.
export async function refreshObjective(id) {
  const workers = await readWorkers()
  const worker = workers.find((w) => w.id === id)
  if (!worker) return { status: 404, body: { error: 'Worker introuvable.' } }
  if (!worker.objective) {
    return { status: 400, body: { error: "Ce worker n'a pas d'objectif défini." } }
  }

  const provider = getProvider(worker.objective.providerId)
  if (!provider || provider.manualEntry) {
    return {
      status: 400,
      body: {
        error: provider ? "Ce type d'objectif se met à jour manuellement." : 'Fournisseur inconnu.',
      },
    }
  }

  let value
  let secondary = null
  let fetchError = null
  try {
    // Un fournisseur peut renvoyer soit juste la valeur, soit
    // { value, secondary } quand il a une métrique bonus "gratuite" (ex. le
    // nombre de vidéos, obtenu dans le même appel que les followers).
    const result = await provider.fetchValue(worker.objective.config)
    if (result && typeof result === 'object') {
      value = result.value
      secondary = result.secondary || null
    } else {
      value = result
    }
  } catch (err) {
    fetchError = err.message
  }

  const updated = await withWorkers((freshWorkers) => {
    const freshWorker = freshWorkers.find((w) => w.id === id)
    if (!freshWorker || !freshWorker.objective) return null
    if (fetchError) {
      freshWorker.objective.status = 'error'
      freshWorker.objective.error = fetchError
    } else {
      const at = new Date().toISOString()
      freshWorker.objective.current = value
      freshWorker.objective.lastCheckedAt = at
      freshWorker.objective.status = 'idle'
      freshWorker.objective.error = null
      pushHistory(freshWorker.objective, value, at)

      if (secondary) {
        if (!freshWorker.objective.secondary || freshWorker.objective.secondary.key !== secondary.key) {
          freshWorker.objective.secondary = {
            key: secondary.key,
            label: secondary.label,
            icon: secondary.icon,
            current: null,
            history: [],
          }
        }
        freshWorker.objective.secondary.label = secondary.label
        freshWorker.objective.secondary.icon = secondary.icon
        freshWorker.objective.secondary.current = secondary.value
        pushHistory(freshWorker.objective.secondary, secondary.value, at)
      }
    }
    return freshWorker
  })

  if (!updated) return { status: 404, body: { error: 'Worker introuvable.' } }
  return { status: fetchError ? 502 : 200, body: updated }
}
