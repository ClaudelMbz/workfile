import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { randomUUID } from 'crypto'
import { readWorkers, withWorkers, pushHistory } from './store.js'
import { listProviders, getProvider } from './providers/index.js'

const app = express()
const PORT = process.env.PORT || 3001

// Nécessaire dès que le frontend est servi depuis une autre origine que
// l'API (ex. frontend sur GitHub Pages, backend sur Render/Railway/un VPS).
// Outil mono-utilisateur sans authentification : pas de restriction fine à
// apporter ici, seulement à autoriser la requête cross-origin elle-même.
app.use(cors())
app.use(express.json())

// GET /api/objective-types — catalogue des fournisseurs d'objectif disponibles
app.get('/api/objective-types', (req, res) => {
  res.json(listProviders())
})

// GET /api/workers — liste tous les workers
app.get('/api/workers', async (req, res) => {
  const workers = await readWorkers()
  res.json(workers)
})

// Coût : optionnel, mais s'il est fourni il doit être un nombre positif ou nul.
function parseCost(cost) {
  if (cost === undefined || cost === null || cost === '') return { ok: true, value: null }
  const n = Number(cost)
  if (!Number.isFinite(n) || n < 0) return { ok: false }
  return { ok: true, value: n }
}

// POST /api/workers — crée un worker
app.post('/api/workers', async (req, res) => {
  const { name, role, email, cost } = req.body || {}
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Le nom est obligatoire.' })
  }
  const parsedCost = parseCost(cost)
  if (!parsedCost.ok) {
    return res.status(400).json({ error: 'Le coût doit être un nombre positif ou nul.' })
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
  res.status(201).json(worker)
})

// PUT /api/workers/:id — modifie les infos de base d'un worker
app.put('/api/workers/:id', async (req, res) => {
  const { name, role, email, cost } = req.body || {}
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Le nom est obligatoire.' })
  }
  const parsedCost = parseCost(cost)
  if (!parsedCost.ok) {
    return res.status(400).json({ error: 'Le coût doit être un nombre positif ou nul.' })
  }

  const updated = await withWorkers((workers) => {
    const worker = workers.find((w) => w.id === req.params.id)
    if (!worker) return null
    worker.name = name.trim()
    worker.role = (role || '').trim()
    worker.email = (email || '').trim()
    worker.cost = parsedCost.value
    return worker
  })

  if (!updated) return res.status(404).json({ error: 'Worker introuvable.' })
  res.json(updated)
})

// DELETE /api/workers/:id
app.delete('/api/workers/:id', async (req, res) => {
  const found = await withWorkers((workers) => {
    const idx = workers.findIndex((w) => w.id === req.params.id)
    if (idx === -1) return false
    workers.splice(idx, 1)
    return true
  })

  if (!found) return res.status(404).json({ error: 'Worker introuvable.' })
  res.status(204).end()
})

// PUT /api/workers/:id/objective — définit/modifie l'objectif (quel que soit le fournisseur)
app.put('/api/workers/:id/objective', async (req, res) => {
  const { providerId, config, target } = req.body || {}

  const provider = getProvider(providerId)
  if (!provider) {
    return res.status(400).json({ error: "Type d'objectif inconnu." })
  }

  for (const field of provider.fields) {
    const value = config?.[field.key]
    if (!value || !String(value).trim()) {
      return res.status(400).json({ error: `${field.label} est obligatoire.` })
    }
  }

  const targetNum = Number(target)
  if (!Number.isFinite(targetNum) || targetNum <= 0) {
    return res.status(400).json({ error: "L'objectif doit être un nombre positif." })
  }

  const normalizedConfig = Object.fromEntries(
    provider.fields.map((f) => [f.key, String(config[f.key]).trim().replace(/^@/, '')])
  )

  const updated = await withWorkers((workers) => {
    const worker = workers.find((w) => w.id === req.params.id)
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

  if (!updated) return res.status(404).json({ error: 'Worker introuvable.' })
  res.json(updated)
})

// PATCH /api/workers/:id/objective/value — met à jour la valeur courante à la main
// (pour les fournisseurs "manualEntry", qui n'ont pas de fetchValue automatique)
app.patch('/api/workers/:id/objective/value', async (req, res) => {
  const { current } = req.body || {}
  const currentNum = Number(current)
  if (!Number.isFinite(currentNum) || currentNum < 0) {
    return res.status(400).json({ error: 'La valeur doit être un nombre positif ou nul.' })
  }

  const result = await withWorkers((workers) => {
    const worker = workers.find((w) => w.id === req.params.id)
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

  if (result.error) return res.status(result.status).json({ error: result.error })
  res.json(result.worker)
})

// DELETE /api/workers/:id/objective — retire l'objectif
app.delete('/api/workers/:id/objective', async (req, res) => {
  const updated = await withWorkers((workers) => {
    const worker = workers.find((w) => w.id === req.params.id)
    if (!worker) return null
    worker.objective = null
    return worker
  })

  if (!updated) return res.status(404).json({ error: 'Worker introuvable.' })
  res.json(updated)
})

// POST /api/workers/:id/objective/refresh — relance la mesure via le fournisseur configuré
//
// La récupération de la valeur (appel Apify) se fait AVANT toute écriture,
// hors de la file `withWorkers` : plusieurs objectifs peuvent ainsi être
// rafraîchis en parallèle sans se bloquer les uns les autres. Seule
// l'écriture finale, courte, passe par `withWorkers`, qui relit l'état le
// plus récent pour ne jamais écraser le travail d'une requête concurrente.
app.post('/api/workers/:id/objective/refresh', async (req, res) => {
  const workers = await readWorkers()
  const worker = workers.find((w) => w.id === req.params.id)
  if (!worker) return res.status(404).json({ error: 'Worker introuvable.' })
  if (!worker.objective) {
    return res.status(400).json({ error: "Ce worker n'a pas d'objectif défini." })
  }

  const provider = getProvider(worker.objective.providerId)
  if (!provider || provider.manualEntry) {
    return res.status(400).json({
      error: provider ? 'Ce type d\'objectif se met à jour manuellement.' : 'Fournisseur inconnu.',
    })
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
    const freshWorker = freshWorkers.find((w) => w.id === req.params.id)
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

  if (!updated) return res.status(404).json({ error: 'Worker introuvable.' })
  res.status(fetchError ? 502 : 200).json(updated)
})

app.listen(PORT, () => {
  console.log(`API workers en écoute sur http://localhost:${PORT}`)
})
