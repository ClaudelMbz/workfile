import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// En local (npm run dev:all / npm run server) : fichier JSON sur disque.
// Sur Vercel : pas de disque persistant entre les invocations d'une fonction
// serverless, donc on bascule sur Vercel KV (Redis géré, gratuit, sans
// carte). `VERCEL` est injecté automatiquement par la plateforme.
const usingKV = !!process.env.VERCEL
const kv = usingKV ? (await import('@vercel/kv')).kv : null
const KV_KEY = 'workers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const DATA_FILE = path.join(DATA_DIR, 'workers.json')

async function ensureDataFile() {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true })
  if (!existsSync(DATA_FILE)) await writeFile(DATA_FILE, '[]', 'utf-8')
}

async function readRaw() {
  if (usingKV) return (await kv.get(KV_KEY)) || []
  await ensureDataFile()
  const raw = await readFile(DATA_FILE, 'utf-8')
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

async function writeRaw(workers) {
  if (usingKV) {
    await kv.set(KV_KEY, workers)
    return
  }
  await ensureDataFile()
  await writeFile(DATA_FILE, JSON.stringify(workers, null, 2), 'utf-8')
}

// Nombre de mesures conservées par objectif, pour le delta et le sparkline.
export const MAX_HISTORY = 30

// Ajoute une mesure à l'historique d'un objectif (borné à MAX_HISTORY, les
// plus anciennes sont abandonnées en premier).
export function pushHistory(objective, value, at) {
  if (!objective.history) objective.history = []
  objective.history.push({ value, at })
  if (objective.history.length > MAX_HISTORY) {
    objective.history = objective.history.slice(-MAX_HISTORY)
  }
}

// Ancien format d'objectif (avant que "TikTok followers" ne soit qu'un
// fournisseur parmi d'autres) : { platform: 'tiktok', handle, target, ... }.
// On le convertit à la volée vers { providerId, config, target, ... }.
// On profite aussi de ce passage pour garantir la présence de `history`
// (ajouté après coup) et y recaser la mesure déjà connue s'il n'y en a pas.
function migrateObjective(objective) {
  if (!objective) return objective

  let migrated = objective
  if (!objective.providerId && objective.platform === 'tiktok') {
    migrated = {
      providerId: 'tiktok-followers',
      config: { handle: objective.handle },
      target: objective.target,
      current: objective.current ?? null,
      lastCheckedAt: objective.lastCheckedAt ?? null,
      status: objective.status ?? 'idle',
      error: objective.error ?? null,
    }
  }

  if (!migrated.history) {
    migrated = {
      ...migrated,
      history:
        migrated.current != null && migrated.lastCheckedAt
          ? [{ value: migrated.current, at: migrated.lastCheckedAt }]
          : [],
    }
  }

  return migrated
}

export async function readWorkers() {
  const workers = await readRaw()
  return workers.map((w) => ({ ...w, objective: migrateObjective(w.objective) }))
}

export async function writeWorkers(workers) {
  await writeRaw(workers)
}

// Sérialise les lecture-modification-écriture. Sans ça, deux requêtes
// concurrentes (ex. plusieurs objectifs rafraîchis en même temps au
// chargement de la page) lisent chacune l'état, attendent une réponse
// externe (Apify) puis réécrivent TOUT le tableau avec leur propre copie
// devenue obsolète — la dernière à écrire efface silencieusement les
// changements des autres. `withWorkers` relit toujours l'état le plus
// récent juste avant d'écrire, et une file d'attente empêche deux écritures
// de se chevaucher.
//
// Limite connue en serverless (Vercel) : cette file n'existe qu'en mémoire
// d'une instance de fonction. Deux invocations concurrentes sur des
// instances différentes ne se coordonnent pas entre elles — risque résiduel
// faible pour un usage mono-utilisateur à faible trafic, mais pas une vraie
// garantie transactionnelle (il faudrait une structure Redis par worker pour
// ça, pas juste un blob JSON).
let writeQueue = Promise.resolve()

export function withWorkers(mutate) {
  const task = writeQueue.then(async () => {
    const workers = await readWorkers()
    const result = await mutate(workers)
    await writeWorkers(workers)
    return result
  })
  // On avale l'erreur ici pour ne jamais bloquer la file ; l'appelant reçoit
  // quand même le rejet via `task`.
  writeQueue = task.then(
    () => undefined,
    () => undefined
  )
  return task
}
