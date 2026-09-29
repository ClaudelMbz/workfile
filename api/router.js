// Point d'entrée unique de l'API sur Vercel. Le plan gratuit ("Hobby") plafonne
// à 12 fonctions serverless par déploiement — un fichier par route aurait
// dépassé cette limite dès qu'on ajoute une route de plus. Ce fichier capte
// tout /api/* et route en interne vers les mêmes fonctions métier que le
// serveur Express local (server/handlers.js).
//
// La capture de /api/* se fait par une réécriture dans vercel.json
// (/api/:path* -> /api/router?__path=:path*), pas par un nom de fichier
// [...path].js : hors Next.js, Vercel ne faisait correspondre ce nom qu'à UN
// segment (/api/workers marchait, /api/workers/<id>/... tombait en 404).
//
// Signature Web standard (Request -> Response), celle que Vercel recommande
// pour les projets hors Next.js : `request.url` est toujours une URL absolue
// bien formée, ce qui évite les ambiguïtés qu'on a eues avec la signature
// Node (req, res) classique (req.query.path vide, req.url qui ne se
// comportait pas comme attendu sur les chemins imbriqués en prod).
import * as h from '../server/handlers.js'

// Explicite, ne pas laisser Vercel deviner : store.js utilise `fs`/`path`
// (Node), pas disponibles sur l'Edge Runtime. Sans ce config, la signature à
// un seul argument (Request -> Response) a fait tourner la fonction sur Edge,
// donc tout plantait dès l'import de store.js — sur toutes les routes.
export const config = { runtime: 'nodejs' }

function json({ status, body }) {
  if (body == null) return new Response(null, { status })
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Sur le runtime Node.js de Vercel, un `export default function` est toujours
// traité comme l'ancienne signature (req, res) : `request` serait alors un
// IncomingMessage dont `url` est relative ("/api/workers"), et `new URL(...)`
// planterait avant le try/catch -> 500 sur toutes les routes. Pour recevoir
// un vrai `Request` Web, il faut exporter un objet `{ fetch }`.
async function handler(request) {
  // `__path` est posé par la réécriture de vercel.json ; selon les cas, Vercel
  // présente à la fonction l'URL d'origine ou l'URL réécrite, on gère les deux.
  const url = new URL(request.url)
  const rawPath = url.searchParams.get('__path') ?? url.pathname
  const segments = rawPath.split('/').filter((s) => s && s !== 'api' && s !== 'router')
  const [a, b, c, d] = segments
  const { method } = request

  let body = null
  if (method !== 'GET' && method !== 'DELETE') {
    try {
      body = await request.json()
    } catch {
      body = null
    }
  }

  try {
    if (a === 'objective-types' && !b && method === 'GET') {
      return json(await h.getObjectiveTypes())
    }

    if (a === 'export' && !b && method === 'GET') {
      return json(await h.exportData())
    }
    if (a === 'import' && !b && method === 'POST') {
      return json(await h.importData(body))
    }

    if (a === 'projects') {
      if (!b) {
        if (method === 'GET') return json(await h.listProjects())
        if (method === 'POST') return json(await h.createProject(body))
      } else if (!c) {
        if (method === 'PUT') return json(await h.updateProject(b, body))
        if (method === 'DELETE') return json(await h.deleteProject(b))
      }
    }

    if (a === 'workers') {
      if (!b) {
        if (method === 'GET') return json(await h.getWorkers())
        if (method === 'POST') return json(await h.createWorker(body))
      } else if (!c) {
        if (method === 'PUT') return json(await h.updateWorker(b, body))
        if (method === 'DELETE') return json(await h.deleteWorker(b))
      } else if (c === 'objective') {
        if (!d) {
          if (method === 'PUT') return json(await h.setObjective(b, body))
          if (method === 'DELETE') return json(await h.deleteObjective(b))
        } else if (d === 'value' && method === 'PATCH') {
          return json(await h.updateObjectiveValue(b, body))
        } else if (d === 'refresh' && method === 'POST') {
          return json(await h.refreshObjective(b))
        }
      }
    }

    if (a === 'workflows') {
      if (!b) {
        if (method === 'GET') return json(await h.listWorkflows())
        if (method === 'POST') return json(await h.createWorkflow(body))
      } else if (!c) {
        if (method === 'DELETE') return json(await h.deleteWorkflow(b))
      } else if (c === 'download' && method === 'GET') {
        const r = await h.getWorkflow(b)
        if (r.status !== 200) return json(r)
        return new Response(r.body.content, {
          status: 200,
          headers: {
            'Content-Disposition': `attachment; filename="${r.body.filename.replace(/"/g, '')}"`,
            'Content-Type': 'application/json; charset=utf-8',
          },
        })
      }
    }

    return json({ status: 404, body: { error: 'Route inconnue.' } })
  } catch (err) {
    return json({ status: 500, body: { error: err.message || 'Erreur serveur.' } })
  }
}

export default { fetch: handler }
