import { getWorkflow } from '../../../server/handlers.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non supportée.' })
  }
  const r = await getWorkflow(req.query.id)
  if (r.status !== 200) return res.status(r.status).json(r.body)

  res.setHeader('Content-Disposition', `attachment; filename="${r.body.filename.replace(/"/g, '')}"`)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.status(200).send(r.body.content)
}
