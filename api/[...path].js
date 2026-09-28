// Point d'entrée unique de l'API sur Vercel. Le plan gratuit ("Hobby") plafonne
// à 12 fonctions serverless par déploiement — un fichier par route aurait
// dépassé cette limite dès qu'on ajoute une route de plus. Ce fichier capte
// tout /api/* (grâce au nom [...path].js) et route en interne vers les mêmes
// fonctions métier que le serveur Express local (server/handlers.js), donc le
// comportement est identique des deux côtés.
import * as h from '../server/handlers.js'

function send(res, { status, body }) {
  if (status === 204) return res.status(204).end()
  res.status(status).json(body)
}

export default async function handler(req, res) {
  // On préfère parser `req.url` nous-mêmes plutôt que de dépendre de
  // `req.query.path` (le découpage automatique du nom de fichier
  // [...path].js) : en prod ça retombait systématiquement sur "Route
  // inconnue" — req.query.path ne contenait pas ce qu'on attendait pour ce
  // type de projet. Parser l'URL directement ne dépend d'aucun mécanisme
  // framework-spécifique.
  const path = (req.url || '').split('?')[0]
  const segments = path.split('/').filter((s) => s && s !== 'api')
  const [a, b, c, d] = segments
  const { method } = req

  try {
    if (a === 'objective-types' && !b && method === 'GET') {
      return send(res, await h.getObjectiveTypes())
    }

    if (a === 'export' && !b && method === 'GET') {
      return send(res, await h.exportData())
    }
    if (a === 'import' && !b && method === 'POST') {
      return send(res, await h.importData(req.body))
    }

    if (a === 'projects') {
      if (!b) {
        if (method === 'GET') return send(res, await h.listProjects())
        if (method === 'POST') return send(res, await h.createProject(req.body))
      } else if (!c) {
        if (method === 'PUT') return send(res, await h.updateProject(b, req.body))
        if (method === 'DELETE') return send(res, await h.deleteProject(b))
      }
    }

    if (a === 'workers') {
      if (!b) {
        if (method === 'GET') return send(res, await h.getWorkers())
        if (method === 'POST') return send(res, await h.createWorker(req.body))
      } else if (!c) {
        if (method === 'PUT') return send(res, await h.updateWorker(b, req.body))
        if (method === 'DELETE') return send(res, await h.deleteWorker(b))
      } else if (c === 'objective') {
        if (!d) {
          if (method === 'PUT') return send(res, await h.setObjective(b, req.body))
          if (method === 'DELETE') return send(res, await h.deleteObjective(b))
        } else if (d === 'value' && method === 'PATCH') {
          return send(res, await h.updateObjectiveValue(b, req.body))
        } else if (d === 'refresh' && method === 'POST') {
          return send(res, await h.refreshObjective(b))
        }
      }
    }

    if (a === 'workflows') {
      if (!b) {
        if (method === 'GET') return send(res, await h.listWorkflows())
        if (method === 'POST') return send(res, await h.createWorkflow(req.body))
      } else if (!c) {
        if (method === 'DELETE') return send(res, await h.deleteWorkflow(b))
      } else if (c === 'download' && method === 'GET') {
        const r = await h.getWorkflow(b)
        if (r.status !== 200) return send(res, r)
        res.setHeader('Content-Disposition', `attachment; filename="${r.body.filename.replace(/"/g, '')}"`)
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        return res.status(200).send(r.body.content)
      }
    }

    res.status(404).json({ error: 'Route inconnue.' })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Erreur serveur.' })
  }
}
