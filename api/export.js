import { exportData } from '../server/handlers.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non supportée.' })
  }
  const r = await exportData()
  res.status(r.status).json(r.body)
}
