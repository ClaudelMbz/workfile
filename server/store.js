import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// En local (npm run dev:all / npm run server) : fichier JSON sur disque.
// Sur Vercel : pas de disque persistant entre les invocations d'une fonction
// serverless, donc on bascule sur une base Redis Upstash (marketplace
// Vercel Storage, gratuit, sans carte) dès que ses identifiants sont
// présents — peu importe la plateforme d'hébergement exacte.
const usingKV = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
const kv = usingKV ? (await import('@upstash/redis')).Redis.fromEnv() : null

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')

// Bas niveau, générique : une "collection" est juste un tableau JSON stocké
// sous un nom (clé Redis en prod, fichier <nom>.json en local).
function collectionFile(name) {
  return path.join(DATA_DIR, `${name}.json`)
}

async function ensureCollectionFile(name) {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true })
  const file = collectionFile(name)
  if (!existsSync(file)) await writeFile(file, '[]', 'utf-8')
}

async function readCollection(name) {
  if (usingKV) return (await kv.get(name)) || []
  await ensureCollectionFile(name)
  const raw = await readFile(collectionFile(name), 'utf-8')
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

async function writeCollection(name, items) {
  if (usingKV) {
    await kv.set(name, items)
    return
  }
  await ensureCollectionFile(name)
  await writeFile(collectionFile(name), JSON.stringify(items, null, 2), 'utf-8')
}

// Sérialise les lecture-modification-écriture d'une collection, une file
// d'attente par collection. Voir le commentaire détaillé sur `withWorkers`
// plus bas pour le pourquoi.
function makeQueue() {
  let queue = Promise.resolve()
  return function withCollection(name, mutate) {
    const task = queue.then(async () => {
      const items = await readCollection(name)
      const result = await mutate(items)
      await writeCollection(name, items)
      return result
    })
    queue = task.then(
      () => undefined,
      () => undefined
    )
    return task
  }
}

async function readRaw() {
  return readCollection('workers')
}

async function writeRaw(workers) {
  return writeCollection('workers', workers)
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
const withWorkersQueue = makeQueue()

export function withWorkers(mutate) {
  return withWorkersQueue('workers', async (raw) => {
    // `raw` n'est pas migré — on migre, on laisse `mutate` travailler sur la
    // version migrée (elle peut la modifier en place), puis on resynchronise
    // `raw` dessus avant l'écriture (c'est `raw`, pas la valeur de retour de
    // `mutate`, que `withCollection` persiste).
    const workers = raw.map((w) => ({ ...w, objective: migrateObjective(w.objective) }))
    const result = await mutate(workers)
    raw.length = 0
    raw.push(...workers)
    return result
  })
}

// Sauvegardes de fichiers de workflow (petits exports JSON n8n/Make/Zapier,
// etc.) : nom + contenu, avec re-téléchargement possible plus tard. Même
// mécanique de stockage que les workers, dans sa propre collection.
const withWorkflowsQueue = makeQueue()

export async function readWorkflows() {
  return readCollection('workflows')
}

export function withWorkflows(mutate) {
  return withWorkflowsQueue('workflows', mutate)
}
