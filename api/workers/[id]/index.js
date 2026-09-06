import { updateWorker, deleteWorker } from '../../../server/handlers.js'

export default async function handler(req, res) {
  const { id } = req.query

  if (req.method === 'PUT') {
    const r = await updateWorker(id, req.body)
    return res.status(r.status).json(r.body)
  }
  if (req.method === 'DELETE') {
    const r = await deleteWorker(id)
    if (r.status === 204) return res.status(204).end()
    return res.status(r.status).json(r.body)
  }
  res.status(405).json({ error: 'Méthode non supportée.' })
}
