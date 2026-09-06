import { getObjectiveTypes } from '../server/handlers.js'

export default async function handler(req, res) {
  const r = await getObjectiveTypes()
  res.status(r.status).json(r.body)
}
