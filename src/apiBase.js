// URL de base de l'API. Vide par défaut : les requêtes restent relatives
// (`/api/...`), ce qui marche en dev (proxy Vite) et quand le frontend et le
// backend sont servis depuis la même origine. Sur un déploiement où le
// frontend est statique (ex. GitHub Pages) et le backend hébergé ailleurs,
// renseigne VITE_API_URL au moment du build pour pointer vers lui
// (ex. "https://mon-api.onrender.com").
export const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || ''
