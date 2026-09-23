import { listProjects, createProject } from '../../server/handlers.js'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const r = await listProjects()
    return res.status(r.status).json(r.body)
  }
  if (req.method === 'POST') {
    const r = await createProject(req.body)
    return res.status(r.status).json(r.body)
  }
  res.status(405).json({ error: 'Méthode non supportée.' })
}
