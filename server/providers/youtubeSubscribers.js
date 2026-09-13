import { fetchYoutubeChannelStats } from '../apify.js'

// Fournisseur d'objectif : nombre d'abonnés d'une chaîne YouTube, via Apify.
// Remonte aussi le nombre total de vidéos comme métrique secondaire — même
// principe que le fournisseur TikTok, gratuit puisque déjà dans la réponse.
export default {
  id: 'youtube-subscribers',
  label: 'Abonnés YouTube',
  icon: '▶️',
  unit: 'abonnés',
  description: "Suit la croissance des abonnés d'une chaîne YouTube (via Apify).",
  manualEntry: false,
  fields: [
    {
      key: 'channelUrl',
      label: 'URL de la chaîne YouTube',
      type: 'text',
      placeholder: 'https://www.youtube.com/@nom-de-la-chaine',
      primary: true,
    },
  ],
  async fetchValue(config) {
    if (!config?.channelUrl) throw new Error('URL de la chaîne YouTube manquante.')
    const { subscribers, videoCount } = await fetchYoutubeChannelStats(config.channelUrl)
    return {
      value: subscribers,
      secondary:
        videoCount != null
          ? { key: 'videos', label: 'Vidéos publiées', icon: '🎬', value: videoCount }
          : null,
    }
  },
}
