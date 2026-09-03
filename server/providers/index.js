import tiktokFollowers from './tiktokFollowers.js'
import manual from './manual.js'

// Catalogue des fournisseurs d'objectif disponibles. Pour en ajouter un
// nouveau : créer un fichier ici (même forme que tiktokFollowers.js) et
// l'ajouter à cette liste — rien d'autre à toucher côté serveur, le reste
// (API, UI) est générique.
const PROVIDERS = [tiktokFollowers, manual]

export function listProviders() {
  // Ce qui part vers le frontend : jamais fetchValue (logique serveur only).
  return PROVIDERS.map(({ fetchValue, ...pub }) => pub)
}

export function getProvider(id) {
  return PROVIDERS.find((p) => p.id === id)
}
