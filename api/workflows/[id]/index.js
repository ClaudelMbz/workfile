import { deleteWorkflow } from '../../../server/handlers.js'

export default async function handler(req, res) {
  if (req.method === 'DELETE') {
    const r = await deleteWorkflow(req.query.id)
    if (r.status === 204) return res.status(204).end()
    return res.status(r.status).json(r.body)
  }
  res.status(405).json({ error: 'Méthode non supportée.' })
}
