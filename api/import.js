import { importData } from '../server/handlers.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non supportée.' })
  }
  const r = await importData(req.body)
  res.status(r.status).json(r.body)
}
