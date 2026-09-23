import { useCallback, useEffect, useState } from 'react'
import { API_BASE } from '../apiBase'

async function request(path, options) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const isJson = res.headers.get('content-type')?.includes('application/json')
  const body = isJson ? await res.json() : null
  if (!res.ok) throw new Error(body?.error || `Erreur ${res.status}`)
  return body
}

export function useProjects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setProjects(await request('/api/projects'))
    } catch {
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function addProject({ name, color }) {
    const project = await request('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    })
    setProjects((prev) => [...prev, project])
  }

  async function updateProject(id, { name, color }) {
    const project = await request(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, color }),
    })
    setProjects((prev) => prev.map((p) => (p.id === id ? project : p)))
  }

  async function removeProject(id) {
    await request(`/api/projects/${id}`, { method: 'DELETE' })
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }

  return { projects, loading, addProject, updateProject, removeProject }
}
