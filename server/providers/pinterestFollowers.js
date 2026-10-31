import { fetchPinterestProfileStats } from '../apify.js'

// Accepte l'URL complète du profil, mais aussi juste le nom d'utilisateur
// ("bible.stories" ou "@bible.stories") : on reconstruit l'URL nous-mêmes.
function toProfileUrl(input) {
  const value = String(input).trim()
  if (/^https?:\/\//i.test(value)) return value
  return `https://www.pinterest.com/${value.replace(/^@/, '')}/`
}

// Fournisseur d'objectif : nombre de followers d'un compte Pinterest, via
// Apify. Remonte aussi le nombre d'épingles comme métrique secondaire —
// même principe que les autres plateformes, gratuit (déjà dans la réponse).
export default {
  id: 'pinterest-followers',
  label: 'Followers Pinterest',
  icon: '📌',
  unit: 'followers',
  description: "Suit la croissance des followers d'un compte Pinterest (via Apify).",
  manualEntry: false,
  fields: [
    {
      key: 'profileUrl',
      label: 'URL du profil Pinterest',
      type: 'text',
      placeholder: 'https://www.pinterest.com/nom-du-compte/',
      primary: true,
    },
  ],
  async fetchValue(config) {
    if (!config?.profileUrl) throw new Error('URL du profil Pinterest manquante.')
    const { followers, pinCount } = await fetchPinterestProfileStats(toProfileUrl(config.profileUrl))
    return {
      value: followers,
      secondary:
        pinCount != null ? { key: 'pins', label: 'Épingles', icon: '📍', value: pinCount } : null,
    }
  },
}
