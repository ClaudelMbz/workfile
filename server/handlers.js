// Logique métier partagée, indépendante du serveur qui l'appelle : le
// serveur Express local (server/index.js, via `npm run dev:all`) et les
// fonctions serverless Vercel (/api/*.js en production) appellent toutes les
// deux ces mêmes fonctions. Chacune renvoie { status, body } — à l'appelant
// de le traduire dans le format de sa plateforme.
import { randomUUID } from 'crypto'
import {
  readWorkers,
  withWorkers,
  pushHistory,
  readWorkflows,
  withWorkflows,
  readProjects,
  withProjects,
} from './store.js'
import { listProviders, getProvider } from './providers/index.js'

// Coût : optionnel, mais s'il est fourni il doit être un nombre positif ou nul.
function parseCost(cost) {
  if (cost === undefined || cost === null || cost === '') return { ok: true, value: null }
  const n = Number(cost)
  if (!Number.isFinite(n) || n < 0) return { ok: false }
  return { ok: true, value: n }
}

// Projet : optionnel (null = "sans projet"), mais s'il est fourni il doit
// désigner un projet existant.
async function resolveProjectId(projectId) {
  if (projectId === undefined || projectId === null || projectId === '') {
    return { ok: true, value: null }
  }
  const projects = await readProjects()
  if (!projects.some((p) => p.id === projectId)) return { ok: false }
  return { ok: true, value: projectId }
}

export async function getObjectiveTypes() {
  return { status: 200, body: listProviders() }
}

export async function getWorkers() {
  return { status: 200, body: await readWorkers() }
}

export async function createWorker(body) {
  const { name, role, email, cost, projectId } = body || {}
  if (!name || !name.trim()) {
    return { status: 400, body: { error: 'Le nom est obligatoire.' } }
  }
  const parsedCost = parseCost(cost)
  if (!parsedCost.ok) {
    return { status: 400, body: { error: 'Le coût doit être un nombre positif ou nul.' } }
  }
  const project = await resolveProjectId(projectId)
  if (!project.ok) return { status: 400, body: { error: 'Projet introuvable.' } }

  const worker = {
    id: randomUUID(),
    name: name.trim(),
    role: (role || '').trim(),
    email: (email || '').trim(),
    cost: parsedCost.value,
    projectId: project.value,
    createdAt: new Date().toISOString(),
    objective: null,
  }

  await withWorkers((workers) => {
    workers.unshift(worker)
  })
  return { status: 201, body: worker }
}

export async function updateWorker(id, body) {
  const { name, role, email, cost, projectId } = body || {}
  if (!name || !name.trim()) {
    return { status: 400, body: { error: 'Le nom est obligatoire.' } }
  }
  const parsedCost = parseCost(cost)
  if (!parsedCost.ok) {
    return { status: 400, body: { error: 'Le coût doit être un nombre positif ou nul.' } }
  }
  // Seulement si le client envoie explicitement projectId : un client qui
  // l'omet ne doit pas faire sortir le worker de son projet par accident.
  const project = projectId === undefined ? null : await resolveProjectId(projectId)
  if (project && !project.ok) return { status: 400, body: { error: 'Projet introuvable.' } }

  const updated = await withWorkers((workers) => {
    const worker = workers.find((w) => w.id === id)
    if (!worker) return null
    worker.name = name.trim()
    worker.role = (role || '').trim()
    worker.email = (email || '').trim()
    worker.cost = parsedCost.value
    if (project) worker.projectId = project.value
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
      daily: sameProvider ? worker.objective.daily || [] : [],
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

// ---- Sauvegardes de fichiers (workflows n8n/Make/Zapier, etc.) ----

const MAX_WORKFLOW_SIZE = 2 * 1024 * 1024 // 2 Mo, largement suffisant pour un export de workflow

export async function listWorkflows() {
  const workflows = await readWorkflows()
  // Jamais le contenu dans la liste — juste de quoi afficher nom/date/taille.
  const meta = workflows.map(({ content, ...rest }) => rest)
  return { status: 200, body: meta }
}

export async function createWorkflow(body) {
  const { name, filename, content } = body || {}
  if (!name || !name.trim()) {
    return { status: 400, body: { error: 'Le nom est obligatoire.' } }
  }
  if (!content || typeof content !== 'string') {
    return { status: 400, body: { error: 'Fichier vide ou invalide.' } }
  }
  const size = Buffer.byteLength(content, 'utf-8')
  if (size > MAX_WORKFLOW_SIZE) {
    return { status: 400, body: { error: 'Fichier trop volumineux (2 Mo maximum).' } }
  }

  const workflow = {
    id: randomUUID(),
    name: name.trim(),
    filename: (filename || `${name.trim()}.json`).trim(),
    size,
    uploadedAt: new Date().toISOString(),
    content,
  }

  await withWorkflows((workflows) => {
    workflows.unshift(workflow)
  })

  const { content: _dropped, ...meta } = workflow
  return { status: 201, body: meta }
}

export async function getWorkflow(id) {
  const workflows = await readWorkflows()
  const workflow = workflows.find((w) => w.id === id)
  if (!workflow) return { status: 404, body: { error: 'Sauvegarde introuvable.' } }
  return { status: 200, body: workflow }
}

export async function deleteWorkflow(id) {
  const found = await withWorkflows((workflows) => {
    const idx = workflows.findIndex((w) => w.id === id)
    if (idx === -1) return false
    workflows.splice(idx, 1)
    return true
  })

  if (!found) return { status: 404, body: { error: 'Sauvegarde introuvable.' } }
  return { status: 204, body: null }
}

// ---- Projets (dossiers de workers) ----

const DEFAULT_PROJECT_COLOR = '#c084fc'

function parseProject(body) {
  const { name, color } = body || {}
  if (!name || !String(name).trim()) return { error: 'Le nom du projet est obligatoire.' }
  return {
    name: String(name).trim(),
    color: /^#[0-9a-fA-F]{6}$/.test(color || '') ? color : DEFAULT_PROJECT_COLOR,
  }
}

export async function listProjects() {
  return { status: 200, body: await readProjects() }
}

export async function createProject(body) {
  const parsed = parseProject(body)
  if (parsed.error) return { status: 400, body: { error: parsed.error } }

  const project = {
    id: randomUUID(),
    name: parsed.name,
    color: parsed.color,
    createdAt: new Date().toISOString(),
  }
  await withProjects((projects) => {
    projects.push(project)
  })
  return { status: 201, body: project }
}

export async function updateProject(id, body) {
  const parsed = parseProject(body)
  if (parsed.error) return { status: 400, body: { error: parsed.error } }

  const updated = await withProjects((projects) => {
    const project = projects.find((p) => p.id === id)
    if (!project) return null
    project.name = parsed.name
    project.color = parsed.color
    return project
  })

  if (!updated) return { status: 404, body: { error: 'Projet introuvable.' } }
  return { status: 200, body: updated }
}

// Supprimer un projet ne supprime jamais ses workers : ils repassent
// simplement en "sans projet".
export async function deleteProject(id) {
  const found = await withProjects((projects) => {
    const idx = projects.findIndex((p) => p.id === id)
    if (idx === -1) return false
    projects.splice(idx, 1)
    return true
  })
  if (!found) return { status: 404, body: { error: 'Projet introuvable.' } }

  await withWorkers((workers) => {
    workers.forEach((w) => {
      if (w.projectId === id) w.projectId = null
    })
  })
  return { status: 204, body: null }
}
