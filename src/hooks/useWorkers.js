import { useCallback, useEffect, useState } from 'react'
import { API_BASE } from '../apiBase'

async function request(path, options) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const isJson = res.headers.get('content-type')?.includes('application/json')
  const body = isJson ? await res.json() : null
  if (!res.ok) {
    throw new Error(body?.error || `Erreur ${res.status}`)
  }
  return body
}

export function useWorkers() {
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const data = await request('/api/workers')
      setWorkers(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function addWorker({ name, role, email, cost }) {
    const worker = await request('/api/workers', {
      method: 'POST',
      body: JSON.stringify({ name, role, email, cost }),
    })
    setWorkers((prev) => [worker, ...prev])
  }

  async function updateWorker(id, { name, role, email, cost }) {
    const worker = await request(`/api/workers/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, role, email, cost }),
    })
    setWorkers((prev) => prev.map((w) => (w.id === id ? worker : w)))
  }

  async function removeWorker(id) {
    await request(`/api/workers/${id}`, { method: 'DELETE' })
    setWorkers((prev) => prev.filter((w) => w.id !== id))
  }

  async function setObjective(id, { providerId, config, target }) {
    const worker = await request(`/api/workers/${id}/objective`, {
      method: 'PUT',
      body: JSON.stringify({ providerId, config, target }),
    })
    setWorkers((prev) => prev.map((w) => (w.id === id ? worker : w)))
  }

  async function updateObjectiveValue(id, current) {
    const worker = await request(`/api/workers/${id}/objective/value`, {
      method: 'PATCH',
      body: JSON.stringify({ current }),
    })
    setWorkers((prev) => prev.map((w) => (w.id === id ? worker : w)))
  }

  async function removeObjective(id) {
    const worker = await request(`/api/workers/${id}/objective`, { method: 'DELETE' })
    setWorkers((prev) => prev.map((w) => (w.id === id ? worker : w)))
  }

  async function refreshObjective(id) {
    setWorkers((prev) =>
      prev.map((w) =>
        w.id === id && w.objective
          ? { ...w, objective: { ...w.objective, status: 'checking' } }
          : w
      )
    )
    // On gère la réponse nous-mêmes : même en cas d'échec (502), l'API renvoie
    // le worker avec objective.error rempli, qu'on veut quand même afficher.
    const res = await fetch(`${API_BASE}/api/workers/${id}/objective/refresh`, { method: 'POST' })
    const worker = await res.json().catch(() => null)
    if (worker) {
      setWorkers((prev) => prev.map((w) => (w.id === id ? worker : w)))
    } else {
      setWorkers((prev) =>
        prev.map((w) =>
          w.id === id && w.objective
            ? { ...w, objective: { ...w.objective, status: 'error', error: 'Erreur réseau.' } }
            : w
        )
      )
    }
  }

  return {
    workers,
    loading,
    error,
    addWorker,
    updateWorker,
    removeWorker,
    setObjective,
    removeObjective,
    refreshObjective,
    updateObjectiveValue,
  }
}
