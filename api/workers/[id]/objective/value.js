import { updateObjectiveValue } from '../../../../server/handlers.js'

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Méthode non supportée.' })
  }
  const r = await updateObjectiveValue(req.query.id, req.body)
  res.status(r.status).json(r.body)
}
