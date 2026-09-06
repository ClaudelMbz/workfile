import { refreshObjective } from '../../../../server/handlers.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non supportée.' })
  }
  const r = await refreshObjective(req.query.id)
  res.status(r.status).json(r.body)
}
