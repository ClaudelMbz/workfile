import { fetchInstagramProfileStats } from '../apify.js'

// Fournisseur d'objectif : nombre de followers d'un compte Instagram, via
// Apify. Remonte aussi le nombre de publications comme métrique secondaire
// — même principe que TikTok/YouTube, gratuit (déjà dans la réponse).
export default {
  id: 'instagram-followers',
  label: 'Followers Instagram',
  icon: '📷',
  unit: 'followers',
  description: "Suit la croissance des followers d'un compte Instagram (via Apify).",
  manualEntry: false,
  fields: [
    {
      key: 'profileUrl',
      label: 'URL du profil Instagram',
      type: 'text',
      placeholder: 'https://www.instagram.com/nom-du-compte/',
      primary: true,
    },
  ],
  async fetchValue(config) {
    if (!config?.profileUrl) throw new Error('URL du profil Instagram manquante.')
    const { followers, postsCount } = await fetchInstagramProfileStats(config.profileUrl)
    return {
      value: followers,
      secondary:
        postsCount != null
          ? { key: 'posts', label: 'Publications', icon: '📸', value: postsCount }
          : null,
    }
  },
}
