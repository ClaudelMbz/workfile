// Exécute `task` sur chaque élément de `items`, avec au plus `limit` tâches
// en vol à la fois — les suivantes démarrent dès qu'une place se libère.
// Sert à ne pas dépasser les limites de concurrence d'une API externe (ex.
// Apify limite les comptes standards à 5 runs simultanés).
export async function runWithConcurrencyLimit(items, limit, task) {
  const queue = [...items]
  const workerCount = Math.max(1, Math.min(limit, queue.length))

  const workers = Array.from({ length: workerCount }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()
      await task(item)
    }
  })

  await Promise.all(workers)
}
