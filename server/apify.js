// Intégration Apify — actor "clockworks/tiktok-followers-scraper".
// On demande volontairement 1 seul follower/following (coût minimal) :
// chaque item retourné inclut un objet `connectedTo` qui décrit le profil
// interrogé lui-même : followers (`fans`), mais aussi son nombre de vidéos
// publiées (`video`) — récupéré dans le même appel, sans coût Apify en plus.
const ACTOR_ID = 'clockworks~tiktok-followers-scraper'

export async function fetchTiktokProfileStats(handle) {
  const token = process.env.APIFY_TOKEN
  if (!token) {
    throw new Error(
      "APIFY_TOKEN manquant : ajoute ta clé API Apify dans le fichier .env à la racine du projet."
    )
  }

  const url = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profiles: [handle],
      maxFollowersPerProfile: 1,
      maxFollowingPerProfile: 1,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Apify a répondu avec une erreur ${res.status}: ${text.slice(0, 200)}`)
  }

  const items = await res.json()

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(
      `Aucune donnée retournée pour "${handle}" — vérifie que le profil TikTok existe et est public.`
    )
  }

  const meta = items[0]?.connectedTo
  if (!meta || typeof meta.fans !== 'number') {
    throw new Error('Réponse Apify inattendue : le nombre de followers est introuvable.')
  }

  return {
    fans: meta.fans,
    videoCount: typeof meta.video === 'number' ? meta.video : null,
  }
}
