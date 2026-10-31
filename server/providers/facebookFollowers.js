import { fetchFacebookPageStats } from '../apify.js'

// Fournisseur d'objectif : nombre de followers d'une page Facebook, via
// Apify. Remonte aussi le nombre de "J'aime" de la page comme métrique
// secondaire — même principe que TikTok/YouTube/Instagram, gratuit (déjà
// dans la réponse).
export default {
  id: 'facebook-followers',
  label: 'Followers Facebook',
  icon: '📘',
  unit: 'followers',
  description: "Suit la croissance des followers d'une page Facebook (via Apify).",
  manualEntry: false,
  fields: [
    {
      key: 'pageUrl',
      label: 'URL de la page Facebook',
      type: 'text',
      placeholder: 'https://www.facebook.com/nom-de-la-page',
      primary: true,
    },
  ],
  async fetchValue(config) {
    if (!config?.pageUrl) throw new Error('URL de la page Facebook manquante.')
    const { followers, likes } = await fetchFacebookPageStats(config.pageUrl)
    return {
      value: followers,
      secondary: likes != null ? { key: 'likes', label: "J'aime", icon: '👍', value: likes } : null,
    }
  },
}
