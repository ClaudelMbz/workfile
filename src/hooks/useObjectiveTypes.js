import { useEffect, useState } from 'react'
import { API_BASE } from '../apiBase'

// Catalogue des fournisseurs d'objectif (TikTok followers, saisie manuelle,
// et tout ce qui viendra s'y ajouter côté serveur) — chargé une fois.
export function useObjectiveTypes() {
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE}/api/objective-types`)
      .then((res) => res.json())
      .then(setTypes)
      .catch(() => setTypes([]))
      .finally(() => setLoading(false))
  }, [])

  return { objectiveTypes: types, loading }
}
