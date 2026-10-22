// Клиент Modrinth API: кэш, не больше N запросов одновременно, повтор при лимите (429).
const API = 'https://api.modrinth.com/v2'
const META = 'https://launcher-meta.modrinth.com'

export class ApiError extends Error {}

const sleep = ms => new Promise(r => setTimeout(r, ms))

export function createApi({ fetchImpl = (...a) => fetch(...a), concurrency = 6 } = {}) {
  const cache = new Map()
  let active = 0
  const queue = []

  const slot = () => new Promise(resolve => {
    const go = () => { active++; resolve() }
    active < concurrency ? go() : queue.push(go)
  })
  const release = () => { active--; queue.length && queue.shift()() }

  async function getJson(url) {
    if (cache.has(url)) return cache.get(url)
    const p = (async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        await slot()
        let res
        try {
          res = await fetchImpl(url)
        } catch {
          release()
          if (attempt === 3) throw new ApiError('Нет связи с Modrinth. Проверьте интернет и попробуйте ещё раз.')
          await sleep(800 * (attempt + 1))
          continue
        }
        release()
        if (res.status === 429) {
          await sleep((Number(res.headers.get('x-ratelimit-reset')) || 2) * 1000)
          continue
        }
        if (res.status === 404) return null
        if (!res.ok) {
          if (attempt === 3) throw new ApiError(`Modrinth ответил ошибкой ${res.status}. Попробуйте позже.`)
          await sleep(800 * (attempt + 1))
          continue
        }
        return res.json()
      }
      throw new ApiError('Modrinth перегружен. Подождите минуту и попробуйте снова.')
    })()
    cache.set(url, p)
    p.catch(() => cache.delete(url))
    return p
  }

  const q = obj => new URLSearchParams(
    Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])),
  ).toString()

  return {
    getJson,

    // Поиск модов под версию и загрузчик; category — необязательная категория
    async search(query, { version, loaders, category, limit = 20 }) {
      const facets = [[`versions:${version}`], loaders.map(l => `categories:${l}`), ['project_type:mod']]
      if (category) facets.push([`categories:${category}`])
      const data = await getJson(`${API}/search?${q({ query, facets, index: 'relevance', limit: String(limit) })}`)
      return (data?.hits || []).map(normalizeHit)
    },

    async projects(ids) {
      if (!ids.length) return []
      const out = []
      for (let i = 0; i < ids.length; i += 80) {
        const data = await getJson(`${API}/projects?${q({ ids: ids.slice(i, i + 80) })}`)
        out.push(...(data || []).map(normalizeProject))
      }
      return out
    },

    // Версии проекта под (minecraft, загрузчики), новые первыми
    async versions(projectId, version, loaders) {
      return (await getJson(`${API}/project/${projectId}/version?${q({ loaders, game_versions: [version] })}`)) || []
    },

    async gameVersions() {
      const data = (await getJson(`${API}/tag/game_version`)) || []
      return data.filter(v => v.version_type === 'release').map(v => v.version)
    },

    // Последняя стабильная версия загрузчика для mrpack
    async loaderVersion(loader, mc) {
      if (loader === 'fabric') {
        const list = await getJson(`https://meta.fabricmc.net/v2/versions/loader/${mc}`)
        const ok = (list || []).find(x => x.loader.stable) || list?.[0]
        return ok?.loader.version || null
      }
      if (loader === 'quilt') {
        const list = await getJson(`https://meta.quiltmc.org/v3/versions/loader/${mc}`)
        const ok = (list || []).find(x => !/beta|pre/i.test(x.loader.version)) || list?.[0]
        return ok?.loader.version || null
      }
      const manifest = await getJson(`${META}/${loader === 'forge' ? 'forge' : 'neo'}/v0/manifest.json`)
      const gv = manifest?.gameVersions?.find(g => g.id === mc)
      const l = gv?.loaders?.find(x => x.stable) || gv?.loaders?.[0]
      return l?.id || null
    },
  }
}

function normalizeHit(h) {
  return {
    id: h.project_id, slug: h.slug, title: h.title, description: h.description,
    categories: h.display_categories || h.categories || [], downloads: h.downloads,
    icon: h.icon_url, client: h.client_side, server: h.server_side,
  }
}

function normalizeProject(p) {
  return {
    id: p.id, slug: p.slug, title: p.title, description: p.description,
    categories: p.categories || [], downloads: p.downloads,
    icon: p.icon_url, client: p.client_side, server: p.server_side,
  }
}
