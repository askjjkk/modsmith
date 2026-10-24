// Графика: шейдеры и ресурспаки. Число ресурспаков (до 100) и шейдеров зависит от размера сборки.
import { tokens } from './parser.js'

// Шейдеры по силе компьютера (на Modrinth у них есть метки potato/low/medium/high)
export const SHADERS = [
  { slug: 'makeup-ultra-fast-shaders', label: 'MakeUp Ultra Fast — для слабых ПК', power: 'potato' },
  { slug: 'complementary-reimagined', label: 'Complementary Reimagined — как ваниль, но красиво', power: 'low' },
  { slug: 'bsl-shaders', label: 'BSL — сочные краски', power: 'medium' },
  { slug: 'complementary-unbound', label: 'Complementary Unbound — сказочно', power: 'medium' },
  { slug: 'photon-shader', label: 'Photon — реалистичный свет', power: 'high' },
  { slug: 'bliss-shader', label: 'Bliss — кинематографично, для мощных ПК', power: 'high' },
]
export const DEFAULT_SHADER = 'complementary-reimagined'

// Мод, без которого шейдеры не работают
export const SHADER_MOD = { fabric: 'iris', quilt: 'iris', neoforge: 'iris', forge: 'oculus' }
const SHADER_CONFIG = { iris: 'config/iris.properties', oculus: 'config/oculus.properties' }

// Ресурспаки, которые не ломают ничего и делают игру живее. needs — моды, без которых пак не работает
export const RESOURCE_PACKS = [
  { slug: 'fresh-animations', label: 'Живые анимации мобов', needs: ['entity-model-features', 'entitytexturefeatures'], on: true },
  { slug: 'better-leaves', label: 'Пышная листва', on: true },
  { slug: 'fast-better-grass', label: 'Трава по бокам блоков', on: true },
  { slug: 'low-on-fire', label: 'Огонь не закрывает экран', on: true },
  { slug: 'default-dark-mode', label: 'Тёмный интерфейс', on: false },
]

// Сколько ресурспаков брать под размер сборки (число модов по темам): плавно от 3 до 100
export function packCount(budget) {
  const points = [[0, 3], [8, 3], [20, 8], [45, 20], [300, 40], [500, 100]]
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1], [x2, y2] = points[i]
    if (budget <= x2) return Math.round(y1 + (y2 - y1) * ((budget - x1) / (x2 - x1)))
  }
  return 100
}

// Сколько шейдеров положить в папку shaderpacks (включён будет один — выбранный)
export function shaderCount(budget) {
  return budget <= 20 ? 1 : budget <= 45 ? 2 : budget <= 300 ? 4 : budget < 500 ? 6 : 10
}

const has = (toks, stems) => toks.some(t => stems.some(s => t.startsWith(s)))

/** Что из графики просит текст: { shaders, packs, power } */
export function detectGraphics(text) {
  const toks = tokens(text)
  const shaders = has(toks, ['шейдер', 'шейдр', 'shader', 'графон', 'график', 'graphic', 'rtx', 'ртх'])
    && !has(toks, ['безшейд'])
  const packs = has(toks, ['ресурспак', 'ресурс-пак', 'текстурпак', 'текстур', 'resourcepack', 'texture'])
  const power = has(toks, ['слаб', 'калькулятор', 'картош', 'ноутбук', 'ноут', 'старый', 'potato', 'low']) ? 'potato'
    : has(toks, ['мощн', 'топов', 'rtx', 'ртх', 'ультра', 'ultra']) ? 'high' : null
  return { shaders, packs, power }
}

export const shaderFor = power => SHADERS.find(s => s.power === power)?.slug || DEFAULT_SHADER

const fileOfVersion = v => {
  const f = v && (v.files.find(x => x.primary) || v.files[0])
  return f && { url: f.url, filename: f.filename, size: f.size, hashes: f.hashes }
}

// Что считаем «тяжёлым» ресурспаком: полная перерисовка блоков, предметов, мобов и интерфейса — такой берём только один
const HEAVY_CATS = ['blocks', 'items', 'entities', 'gui', 'environment', 'equipment']
const PACK_CATEGORIES = ['tweaks', 'utility', 'environment', 'decoration', 'models', 'gui', 'audio', 'fonts', 'combat', 'equipment', 'items', 'blocks', 'entities', 'themed']
// Эти не берём никогда: делают игру нечитаемой или не про игру
const PACK_SKIP = /fullbright|cursed|meme|nsfw|joke|troll|april|translation|locale|перевод|русск|japanese|spanish|german|french|chinese|korean|italian|polish|portuguese|turkish|ukrain|dutch|swedish/i

/** Подходит ли пак: для «modded» нужно, чтобы в сборке был мод, о котором он */
function packFits(hit, installed) {
  if (PACK_SKIP.test(`${hit.title} ${hit.slug}`)) return false
  if (hit.allCategories.includes('locale') || hit.allCategories.includes('cursed')) return false
  if (!hit.allCategories.includes('modded')) return true
  const text = `${hit.title} ${hit.description || ''}`.toLowerCase()
  return installed.some(t => t.length >= 5 && text.includes(t))
}

/**
 * Автоподбор ресурспаков: popular + по темам сборки, один «тяжёлый», остальные лёгкие, без модов-пустышек.
 * Возвращает [{ project, version, heavy }] — не больше count штук.
 */
export async function pickPacks(b, api, { count, themes = [], pinned = [] }) {
  if (count <= 0) return []
  const installed = [...b.chosen.values()].map(m => m.project.title.toLowerCase())
  const seen = new Map()
  const add = (hits, boost = 0) => hits.forEach(h => { if (!seen.has(h.id)) seen.set(h.id, { hit: h, boost }); else seen.get(h.id).boost = Math.max(seen.get(h.id).boost, boost) })
  const pages = Math.min(3, 1 + Math.floor(count / 35))
  const jobs = []
  for (const cat of PACK_CATEGORIES) for (let i = 0; i < pages; i++) {
    jobs.push(api.searchProjects('resourcepack', { version: b.version, category: cat, offset: i * 100 }).then(h => add(h)))
  }
  // моды и темы сборки: паки «про это» получают бонус
  for (const t of themes.slice(0, 30)) {
    const word = t.theme.queries?.[0]
    if (word) jobs.push(api.searchProjects('resourcepack', { version: b.version, query: word, limit: 20, index: 'relevance' }).then(h => add(h, 2)))
  }
  await Promise.all(jobs.map(j => j.catch(() => null)))
  const pinnedProjects = await api.projects(pinned).catch(() => [])
  for (const p of pinnedProjects) if (p) add([{ ...p, allCategories: p.categories || [] }], 10)

  const ranked = [...seen.values()]
    .filter(({ hit }) => hit.downloads >= 2000 && packFits(hit, installed))
    .sort((x, y) => (y.boost + Math.log10(y.hit.downloads + 1)) - (x.boost + Math.log10(x.hit.downloads + 1)))

  const out = []
  let heavy = 0
  for (const { hit } of ranked) {
    if (out.length >= count) break
    const isHeavy = HEAVY_CATS.filter(c => hit.allCategories.includes(c)).length >= 3
    if (isHeavy && heavy >= 1) continue
    const versions = await api.versions(hit.id, b.version, ['minecraft']).catch(() => [])
    const version = versions[0]
    if (!version || !fileOfVersion(version)) continue
    // нужные моды пака (бывает «требует Entity Model Features»)
    let ok = true
    for (const d of version.dependencies || []) {
      if (d.dependency_type !== 'required' || !d.project_id) continue
      if (b.chosen.has(d.project_id)) continue
      const [dep] = await api.projects([d.project_id]).catch(() => [])
      if (!dep || dep.projectType === 'resourcepack') continue
      ok = await b.tryAdd(dep, { id: 'gfx', label: 'Моды для графики', color: '#ffcf4a' }, `нужен для ресурспака ${hit.title}`, { allowLibrary: true, quiet: true })
      if (!ok) break
    }
    if (!ok) continue
    if (isHeavy) heavy++
    out.push({ project: hit, version, heavy: isHeavy })
  }
  return out
}

/** Шейдеры: сначала выбранный, потом по силе компьютера и популярности */
export async function pickShaders(b, api, { first, count, power }) {
  const order = [first, ...SHADERS.filter(s => power === 'potato' ? ['potato', 'low'].includes(s.power) : power === 'high' ? ['high', 'medium', 'low'].includes(s.power) : s.power !== 'potato').map(s => s.slug)]
  const slugs = [...new Set(order.filter(Boolean))]
  const projects = await api.projects(slugs).catch(() => [])
  const bySlug = new Map(projects.map(p => [p.slug, p]))
  const picked = slugs.map(sl => bySlug.get(sl)).filter(Boolean)
  // не хватило своего списка — добираем самыми популярными шейдерами с поддержкой Iris
  if (picked.length < count) {
    const more = await api.searchProjects('shader', { version: b.version, facets: [['categories:iris']], limit: 40 }).catch(() => [])
    for (const h of more) {
      if (picked.length >= count) break
      if (!picked.some(p => p.id === h.id) && (power !== 'potato' || h.allCategories.some(c => ['potato', 'low'].includes(c)))) picked.push(h)
    }
  }
  const out = []
  for (const shader of picked) {
    if (out.length >= count) break
    // шейдеры редко помечают каждую версию игры: если под эту нет — берём самую свежую
    let versions = await api.versions(shader.id, b.version, ['iris']).catch(() => [])
    if (!versions.length) versions = (await api.getJson(`https://api.modrinth.com/v2/project/${shader.id}/version`).catch(() => [])) || []
    const version = versions.find(v => v.loaders?.includes('iris')) || versions[0]
    if (version && fileOfVersion(version)) out.push({ project: shader, version })
  }
  return out
}

/**
 * Добавляет в сборку шейдеры и ресурспаки.
 * graphics: { shader: slug|null, shaders: сколько, packs: сколько ресурспаков, pinned: [slug], power }.
 * Возвращает [{ kind, project, file, path }] — файлы не-модов.
 */
export async function addGraphics(b, api, graphics, themes = []) {
  const extras = []
  const section = { id: 'gfx', label: 'Моды для графики', color: '#ffcf4a' }
  // Resourcify — поиск и установка ресурспаков и шейдеров прямо в игре (просьба пользователя: во все сборки)
  const [resourcify] = await api.projects(['resourcify'])
  if (resourcify && !b.chosen.has(resourcify.id)) await b.tryAdd(resourcify, section, 'ресурспаки и шейдеры прямо из игры', { allowLibrary: true, quiet: true })

  if (graphics.shader) {
    const [mod] = await api.projects([SHADER_MOD[b.loader]])
    const modOk = mod && (b.chosen.has(mod.id) || await b.tryAdd(mod, section, 'чтобы работали шейдеры', { allowLibrary: true }))
    if (!modOk) b.skipped.push({ title: 'Шейдеры', why: `нет ${SHADER_MOD[b.loader]} под ${b.version} ${b.loader}` })
    else {
      for (const { project, version } of await pickShaders(b, api, { first: graphics.shader, count: graphics.shaders || 1, power: graphics.power })) {
        const file = fileOfVersion(version)
        extras.push({ kind: 'shader', project, file, path: `shaderpacks/${file.filename}` })
      }
    }
  }
  const want = graphics.packs?.length !== undefined ? graphics.packs.length : graphics.packs || 0
  if (want > 0) {
    const picks = await pickPacks(b, api, { count: want, themes, pinned: graphics.pinned || [] })
    // тяжёлый — первым: у него самый низкий приоритет, лёгкие дополнения лежат поверх
    picks.sort((x, y) => Number(y.heavy) - Number(x.heavy))
    for (const { project, version } of picks) {
      const file = fileOfVersion(version)
      extras.push({ kind: 'resourcepack', project, file, path: `resourcepacks/${file.filename}` })
    }
  }
  return extras
}

/** Файлы настроек, чтобы шейдер и ресурспаки включились сами: { path: text } */
export function graphicsConfigs(extras, loader, options) {
  const out = {}
  const shader = extras.find(e => e.kind === 'shader')
  if (shader) out[SHADER_CONFIG[SHADER_MOD[loader]]] = `enableShaders=true\nshaderPack=${shader.file.filename}\n`
  const packs = extras.filter(e => e.kind === 'resourcepack').map(e => `"file/${e.file.filename}"`)
  if (packs.length) {
    const line = `resourcePacks:["vanilla",${packs.join(',')}]`
    const base = options || ''
    out['options.txt'] = /^resourcePacks:/m.test(base) ? base.replace(/^resourcePacks:.*$/m, line) : `${base}${base && !base.endsWith('\n') ? '\n' : ''}${line}\n`
  } else if (options) out['options.txt'] = options
  return out
}
