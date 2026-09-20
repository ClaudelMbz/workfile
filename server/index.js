import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import * as handlers from './handlers.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '3mb' })) // les sauvegardes de workflow passent par ici (2 Mo max applicatif)

function send(res, { status, body }) {
  if (status === 204) return res.status(204).end()
  res.status(status).json(body)
}

app.get('/api/objective-types', async (req, res) => send(res, await handlers.getObjectiveTypes()))
app.get('/api/workers', async (req, res) => send(res, await handlers.getWorkers()))
app.post('/api/workers', async (req, res) => send(res, await handlers.createWorker(req.body)))
app.put('/api/workers/:id', async (req, res) => send(res, await handlers.updateWorker(req.params.id, req.body)))
app.delete('/api/workers/:id', async (req, res) => send(res, await handlers.deleteWorker(req.params.id)))
app.put('/api/workers/:id/objective', async (req, res) =>
  send(res, await handlers.setObjective(req.params.id, req.body))
)
app.patch('/api/workers/:id/objective/value', async (req, res) =>
  send(res, await handlers.updateObjectiveValue(req.params.id, req.body))
)
app.delete('/api/workers/:id/objective', async (req, res) => send(res, await handlers.deleteObjective(req.params.id)))
app.post('/api/workers/:id/objective/refresh', async (req, res) =>
  send(res, await handlers.refreshObjective(req.params.id))
)

app.get('/api/workflows', async (req, res) => send(res, await handlers.listWorkflows()))
app.post('/api/workflows', async (req, res) => send(res, await handlers.createWorkflow(req.body)))
app.delete('/api/workflows/:id', async (req, res) => send(res, await handlers.deleteWorkflow(req.params.id)))
app.get('/api/workflows/:id/download', async (req, res) => {
  const r = await handlers.getWorkflow(req.params.id)
  if (r.status !== 200) return send(res, r)
  res.setHeader('Content-Disposition', `attachment; filename="${r.body.filename.replace(/"/g, '')}"`)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.send(r.body.content)
})

app.listen(PORT, () => {
  console.log(`API workers en écoute sur http://localhost:${PORT}`)
})
