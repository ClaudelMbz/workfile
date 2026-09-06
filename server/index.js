import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import * as handlers from './handlers.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

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

app.listen(PORT, () => {
  console.log(`API workers en écoute sur http://localhost:${PORT}`)
})
