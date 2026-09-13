// Petit client Apify partagé par tous les fournisseurs qui scrapent via
// Apify (TikTok, YouTube...) — un seul endroit pour la clé API, les erreurs
// réseau et le format de réponse.
async function apifyRunSync(actorId, input) {
  const token = process.env.APIFY_TOKEN
  if (!token) {
    throw new Error(
      "APIFY_TOKEN manquant : ajoute ta clé API Apify dans le fichier .env à la racine du projet."
    )
  }

  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Apify a répondu avec une erreur ${res.status}: ${text.slice(0, 200)}`)
  }

  return res.json()
}

// Actor "clockworks/tiktok-followers-scraper". On demande volontairement 1
// seul follower/following (coût minimal) : chaque item retourné inclut un
// objet `connectedTo` qui décrit le profil interrogé lui-même : followers
// (`fans`), mais aussi son nombre de vidéos publiées (`video`) — récupéré
// dans le même appel, sans coût Apify en plus.
export async function fetchTiktokProfileStats(handle) {
  const items = await apifyRunSync('clockworks~tiktok-followers-scraper', {
    profiles: [handle],
    maxFollowersPerProfile: 1,
    maxFollowingPerProfile: 1,
  })

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

// Actor "streamers/youtube-channel-scraper". maxResults/maxResultsShorts/
// maxResultStreams à 0 : on ne récupère que les infos de la chaîne
// (abonnés, nombre total de vidéos), pas la liste des vidéos — coût minimal.
export async function fetchYoutubeChannelStats(channelUrl) {
  const items = await apifyRunSync('streamers~youtube-channel-scraper', {
    startUrls: [{ url: channelUrl }],
    maxResults: 0,
    maxResultsShorts: 0,
    maxResultStreams: 0,
  })

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(
      `Aucune donnée retournée pour "${channelUrl}" — vérifie que l'URL de la chaîne YouTube est correcte et publique.`
    )
  }

  const channel = items[0]
  if (!channel || typeof channel.numberOfSubscribers !== 'number') {
    throw new Error("Réponse Apify inattendue : le nombre d'abonnés est introuvable.")
  }

  return {
    subscribers: channel.numberOfSubscribers,
    videoCount: typeof channel.channelTotalVideos === 'number' ? channel.channelTotalVideos : null,
  }
}
