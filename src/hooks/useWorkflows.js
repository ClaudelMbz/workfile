import { useCallback, useEffect, useState } from 'react'
import { API_BASE } from '../apiBase'

export function useWorkflows() {
  const [workflows, setWorkflows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/workflows`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `Erreur ${res.status}`)
      setWorkflows(data)
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

  async function addWorkflow({ name, filename, content }) {
    const res = await fetch(`${API_BASE}/api/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, filename, content }),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body?.error || `Erreur ${res.status}`)
    setWorkflows((prev) => [body, ...prev])
  }

  async function removeWorkflow(id) {
    await fetch(`${API_BASE}/api/workflows/${id}`, { method: 'DELETE' })
    setWorkflows((prev) => prev.filter((w) => w.id !== id))
  }

  function downloadUrl(id) {
    return `${API_BASE}/api/workflows/${id}/download`
  }

  return { workflows, loading, error, addWorkflow, removeWorkflow, downloadUrl }
}
