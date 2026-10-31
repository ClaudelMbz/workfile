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

// Cocher/décocher et supprimer sont appliqués tout de suite à l'écran puis
// envoyés au serveur (une checklist doit réagir au clic, sans attendre
// l'aller-retour Vercel) ; en cas d'échec on recharge l'état du serveur.
export function useTodos() {
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setTodos(await request('/api/todos'))
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

  async function addTodo(text) {
    const todo = await request('/api/todos', { method: 'POST', body: JSON.stringify({ text }) })
    setTodos((prev) => [...prev, todo])
  }

  async function updateTodo(id, patch) {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
    try {
      await request(`/api/todos/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    } catch (err) {
      setError(err.message)
      refresh()
    }
  }

  async function removeTodo(id) {
    setTodos((prev) => prev.filter((t) => t.id !== id))
    try {
      await request(`/api/todos/${id}`, { method: 'DELETE' })
    } catch (err) {
      setError(err.message)
      refresh()
    }
  }

  return { todos, loading, error, addTodo, updateTodo, removeTodo }
}
