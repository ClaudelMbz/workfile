import { fetchTiktokProfileStats } from '../apify.js'

// Fournisseur d'objectif : nombre de followers TikTok d'un compte, via Apify.
// Remonte aussi le nombre de vidéos publiées comme métrique secondaire — la
// même réponse Apify contient déjà les deux, donc c'est gratuit.
export default {
  id: 'tiktok-followers',
  label: 'Followers TikTok',
  icon: '🎵',
  unit: 'followers',
  description: 'Suit la croissance des followers d\'un compte TikTok (via Apify).',
  manualEntry: false,
  fields: [
    {
      key: 'handle',
      label: 'Compte TikTok',
      type: 'text',
      prefix: '@',
      placeholder: 'overspace00',
      primary: true,
    },
  ],
  async fetchValue(config) {
    if (!config?.handle) throw new Error('Compte TikTok manquant.')
    const { fans, videoCount } = await fetchTiktokProfileStats(config.handle)
    return {
      value: fans,
      secondary:
        videoCount != null
          ? { key: 'videos', label: 'Vidéos publiées', icon: '🎬', value: videoCount }
          : null,
    }
  },
}
