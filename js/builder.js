// Подбор модов: база + темы, версии под (minecraft, загрузчик), зависимости, конфликты.
import { BASE, GROUPS, SIZES, VANILLA_PLUS } from './themes.js'
import { KNOWN_SLUGS, isPlatform, norm, readJarMeta } from './jarmeta.js'
import { CHUNK_EXTRAS, loadRefPack } from './refpack.js'
import { cmpVer, rangeFits, wrongMcInFilename } from './versions.js'
import { SHADER_MOD, addGraphics } from './graphics.js'
import { CLIENT_ONLY } from './broken.js'

export const loaderList = loader => (loader === 'quilt' ? ['quilt', 'fabric'] : [loader])

/**
 * Лучшая версия мода: стабильная, и файл не под другую версию игры (на Modrinth такое бывает:
 * «getittogetherdrops-…-1.21.5» помечен как подходящий для 1.21.1, а в игре падает).
 * noAlpha — для базы (оптимизация и т.п.): альфа-версии туда не берём.
 */
export function pickVersion(versions, mc = null, { noAlpha = false } = {}) {
  if (!versions?.length) return null
  const filename = v => (v.files?.find(f => f.primary) || v.files?.[0])?.filename || ''
  const fits = mc ? versions.filter(v => !wrongMcInFilename(filename(v), mc)) : versions
  for (const type of noAlpha ? ['release', 'beta'] : ['release', 'beta', 'alpha']) {
    const v = fits.find(x => x.version_type === type)
    if (v) return v
  }
  return noAlpha ? null : fits[0] || null
}

export function fileOf(version) {
  const f = version.files.find(x => x.primary) || version.files[0]
  return f && { url: f.url, filename: f.filename, size: f.size, hashes: f.hashes }
}

// Постройки, которые моды «улучшают» целиком: два мода на одну постройку дерутся (YUNG's Better Desert Temples
// и Dungeons and Taverns Desert Temple Overhaul в одной сборке)
const STRUCTURES = [['desert_temple', /desert (temple|pyramid)/], ['jungle_temple', /jungle (temple|pyramid)/],
  ['stronghold', /stronghold/], ['mineshaft', /mineshaft/], ['ocean_monument', /ocean monument/],
  ['nether_fortress', /nether fortress/], ['witch_hut', /witch hut/], ['dungeon', /\bdungeons?\b/], ['end_city', /end (city|cities)/],
  ['bastion', /bastion/], ['outpost', /outpost/], ['mansion', /mansion/], ['igloo', /igloo/], ['shipwreck', /shipwreck/],
  ['ocean_ruins', /ocean ruin/], ['trail_ruins', /trail ruin/], ['ancient_city', /ancient cit/], ['trial_chamber', /trial chamber/],
  ['end_island', /end island/]]

export function structureKey(project) {
  const t = project.title.toLowerCase()
  if (!/\b(better|overhaul|overhauled|replacement|reimagined|improved|remastered|revamped?)\b/.test(t)) return null
  return STRUCTURES.find(([, re]) => re.test(t))?.[0] || null
}

export function groupOf(project) {
  const g = GROUPS.find(g => g.slugs.includes(project.slug) || g.title.test(project.title))?.id
  if (g) return g
  const st = structureKey(project)
  return st ? `structure:${st}` : null
}

export const isLibrary = project => (project.categories || []).includes('library')

export const MIN_DOWNLOADS = 15000

// Крупные моды, к которым пишут дополнения. Если описание мода про них, а их нет в сборке, мод не работает
// (пример: CobbleBoss «для мира Cobblemon» падает без Cobblemon, хотя зависимость нигде не указана).
// Четвёртое поле: можно ли просто добавить основной мод. Лёгкие (Farmer's Delight) — да;
// большие (Create, Cobblemon) — нет: тащить огромный мод ради одного дополнения нельзя.
export const ECOSYSTEMS = [
  ['Cobblemon', /\bcobblemon\b/i, 'cobblemon', false],
  ['Pixelmon', /\bpixelmon\b/i, 'pixelmon', false],
  ['Create', /^create[:\s]|\bcreate addon|\baddon (for|to) create\b|\bfor create\b/i, ['create', 'create-fabric'], false],
  ['Mekanism', /\bmekanism\b/i, 'mekanism', false],
  ['Applied Energistics 2', /\bapplied energistics\b|\bae2\b/i, 'ae2', false],
  ['Iron\'s Spells', /\biron'?s spells\b/i, 'irons-spells-n-spellbooks', false],
  ['Ars Nouveau', /\bars nouveau\b/i, 'ars-nouveau', false],
  ['Botania', /\bbotania\b/i, 'botania', false],
  ['Tinkers\' Construct', /\btinkers'? construct\b/i, 'tinkers-construct', false],
  ['L_Ender\'s Cataclysm', /\bcataclysm\b/i, 'l_enders-cataclysm', false],
  ['Alex\'s Mobs', /\balex'?s mobs\b/i, 'alexs-mobs', true],
  ['Farmer\'s Delight', /\bfarmer'?s delight\b/i, 'farmers-delight', true],
  ['Origins', /\borigins? (addon|expansion)\b/i, 'origins', true],
  ['Tensura', /\btensura\b/i, 'tensura-reincarnated', false],
]

/** Какой основы не хватает дополнению: { name, slug, auto } или null */
export function missingEcosystem(project, chosen) {
  const text = `${project.title} ${project.description || ''}`
  const have = new Set([...chosen.values()].map(m => m.project.slug))
  for (const [name, re, slugs, auto] of ECOSYSTEMS) {
    // у некоторых основ разные адреса под загрузчики (Create и Create Fabric)
    const all = [slugs].flat()
    if (all.includes(project.slug) || all.some(s => have.has(s))) continue
    if (re.test(text)) return { name, slug: all[0], auto }
  }
  return null
}

export const missingBase = (project, chosen) => missingEcosystem(project, chosen)?.name || null

// Зависимости, которые авторы забыли указать на Modrinth (найдено по настоящим падениям)
export const EXTRA_DEPS = {
  'ancient-warfare-3-npcs': ['arlib'], // NoClassDefFoundError: ARLib/network/…
}

// На Forge/NeoForge вместо Fabric API работает его порт (P7dR8mSH — Fabric API)
const DEP_SUBSTITUTE = {
  forge: { P7dR8mSH: 'forgified-fabric-api' },
  neoforge: { P7dR8mSH: 'forgified-fabric-api' },
  // на Quilt — QFAPI (Fabric API внутри Quilt Standard Libraries); оба сразу — «Duplicate mandatory mod ids»
  quilt: { P7dR8mSH: 'qsl' },
}

// Библиотеки, которые обычно не ломают старые моды при обновлении
export const STABLE_LIBS = new Set(['fabric-api', 'fabric-language-kotlin', 'kotlin-for-forge', 'cloth-config', 'architectury-api',
  'forge-config-api-port', 'yacl', 'modmenu', 'trinkets', 'curios', 'playeranimator', 'geckolib', 'azurelib', 'balm',
  'puzzles-lib', 'resourceful-config', 'resourceful-lib', 'structure-pool-api', 'cardinal-components-api', 'owo-lib',
  'midnightlib', 'jei', 'emi', 'jade', 'terrablender', 'lithostitched', 'bookshelf-lib', 'citadel', 'collective',
  'sodium', 'iris', 'qsl', 'patchouli', 'searchables', 'konkrete', 'framework', 'cristel-lib', 'yungs-api'])

// «1.10.9+1.21.1-fabric» -> «1.10», «fabric-1.21.1-26.6.0» -> «26.6» (версию Minecraft выкидываем)
export function majorMinor(versionNumber, mc) {
  const s = String(versionNumber).split(mc).join(' ').split('+')[0]
  const m = s.match(/(\d+)\.(\d+)/)
  return m ? `${m[1]}.${m[2]}` : null
}
// шуточные и «не про то» моды, которые поиск любит поднимать
// скайблок и «один блок» меняют весь мир — в обычную сборку по теме «биомы» им нельзя
const NOISE = /dragon ?ball|meme|joke|troll|april fools|\bmod ?pack\b|sky ?block|one ?block|void world/i

// Насколько мод подходит теме: популярность + совпадение категории + слова темы в названии/описании
// Моды, которые не подходят теме, хотя поиск их находит: для слабого ПК — тяжёлая дальняя прорисовка
const THEME_AVOID = {
  performance: ['distanthorizons', 'bobby', 'farsight', 'voxy', 'nvidium'],
  fps_boost: ['distanthorizons', 'bobby', 'farsight', 'voxy'],
  memory: ['distanthorizons', 'bobby', 'farsight', 'voxy'],
}

export function themeScore(theme, p) {
  if (NOISE.test(p.title) || THEME_AVOID[theme.id]?.includes(p.slug)) return -100
  const text = `${p.title} ${p.description || ''}`.toLowerCase()
  const words = theme.queries.flatMap(q => q.toLowerCase().split(' '))
    .concat(theme.stems.filter(s => /^[a-z=]/.test(s)).map(s => s.replace('=', '')))
  const inTitle = titleMatches(theme, p)
  const inText = words.some(w => w.length > 2 && text.includes(w))
  const cat = (theme.categories || []).some(c => (p.categories || []).includes(c))
  return Math.log10((p.downloads || 0) + 1) + (cat ? 1 : 0) + (inTitle ? 1.5 : inText ? 0.7 : -1)
}

// Мод «про» эту тему: её слово в названии или её особая категория (для «без магии»).
// Общие слова не считаются: «без монстров» не должно выкидывать Alex's Mobs с лисами и капибарами.
export function matchesTheme(theme, p) {
  const specific = (theme.categories || []).filter(c => !['adventure', 'game-mechanics', 'utility', 'decoration', 'worldgen', 'equipment', 'mobs'].includes(c))
  return titleMatches(theme, p, true) || specific.some(c => (p.categories || []).includes(c))
}
const GENERIC_WORDS = new Set(['mobs', 'mob', 'creatures', 'creature', 'animals', 'entities', 'hostile', 'more', 'new', 'better', 'mod', 'mods', 'blocks', 'items', 'the', 'and', 'world'])

// слово темы (из её английских запросов) встречается в описании мода целым словом
export function mentions(theme, p) {
  const text = ` ${(p.description || '').toLowerCase()} `
  return theme.queries.flatMap(q => q.toLowerCase().split(' ')).filter(w => w.length > 3)
    .some(w => new RegExp(`[^a-z]${w.replace(/s$/, '')}s?[^a-z]`).test(text))
}

export function titleMatches(theme, p, skipGeneric = false) {
  const title = ` ${p.title.toLowerCase()} `
  const words = theme.queries.flatMap(q => q.toLowerCase().split(' '))
    .concat(theme.stems.filter(s => /^[a-z=]/.test(s)).map(s => s.replace('=', '')))
    .filter(w => !skipGeneric || !GENERIC_WORDS.has(w))
  // короткие слова — только целиком («mana» не должно совпасть с «Management», «tram» — с «Trample»)
  return words.some(w => w.length > 2 && (w.length > 5
    ? title.includes(w)
    : new RegExp(`[^a-z]${w.replace(/s$/, '')}s?[^a-z]`).test(title)))
}

// «mixins.json», «common.mixins.json» — общие имена, по ним дубли не ищем
const GENERIC_MIXIN = /^(mixins?|common|client|server|main)(\.mixins?)?\.json$/i

// «1.10.9+1.21.1-fabric» -> «1.10.9», «1.21-3.2.8.5» -> «3.2.8.5», «mc1.21.1-0.8.13» -> «0.8.13»:
// номер версии самой библиотеки, без версии игры (её семейство: 1.21 и 1.21.1 для игры 1.21.1)
export function libVersion(number, mc) {
  const family = mc.split('.').slice(0, 2).join('.')
  const cleaned = String(number).replace(/(?<![\d.])(?:mc)?(1\.\d{1,2}(?:\.\d{1,2})?)(?![\d])/g,
    (all, v) => (v === mc || v === family || v.startsWith(`${family}.`) ? ' ' : all))
  return cleaned.match(/\d+(?:\.\d+)+/)?.[0] || cleaned.match(/\d+/)?.[0] || null
}

// Какую версию Fabric Loader изображает Quilt Loader (видно в его отчёте об ошибке): моды Fabric проверяют именно её
const QUILT_FABRIC = { '0.30': '0.19.3', '0.29': '0.16.10' }

// NeoForge до 1.21.6 не читает описание без строки modLoader («Missing ModLoader in file»)
const OLD_NEO = mc => cmpVer(mc, '1.21.6') < 0

// Пары, которые вместе не работают, хотя не все авторы это указали (по слагам, в обе стороны)
const INCOMPATIBLE_SLUGS = {
  'moonrise-opt': ['scalablelux', 'starlight', 'starlight-neoforge', 'c2me-neoforge', 'c2me-fabric', 'canary', 'not-enough-crashes'],
}
const slugsClash = (a, b) => INCOMPATIBLE_SLUGS[a]?.includes(b) || INCOMPATIBLE_SLUGS[b]?.includes(a)

const incompatibleIds = version => (version.dependencies || [])
  .filter(d => d.dependency_type === 'incompatible' && d.project_id).map(d => d.project_id)

export class PackBuilder {
  constructor(api, { version, loader, excluded = [], blocked = {} }, { readMeta = readJarMeta } = {}) {
    this.excluded = excluded
    this.blocked = blocked
    this.api = api
    this.version = version
    this.loader = loader
    this.loaders = loaderList(loader)
    this.chosen = new Map() // projectId -> mod
    this.groups = new Map() // groupId -> projectId
    this.skipped = []
    this.readMeta = readMeta
    this.metaCache = new Map()
    this.vetoed = new Set() // убранные моды обратно не добавляем
  }

  async versionFor(projectId, { noAlpha = false } = {}) {
    return pickVersion(await this.api.versions(projectId, this.version, this.loaders), this.version, { noAlpha })
  }

  conflicts(project, version) {
    const g = groupOf(project)
    if (g && this.groups.has(g) && this.groups.get(g) !== project.id) return 'дублирует уже выбранный мод'
    if (incompatibleIds(version).some(id => this.chosen.has(id))) return 'несовместим с уже выбранным модом'
    for (const m of this.chosen.values()) {
      if (m.incompatible.includes(project.id)) return `несовместим с ${m.project.title}`
      if (slugsClash(project.slug, m.project.slug)) return `несовместим с ${m.project.title}`
    }
    return null
  }

  // Обязательные зависимости по цепочке. Возвращает Map или строку с причиной отказа.
  async resolveDeps(version, acc = new Map(), depth = 0, owner = null) {
    let deps = version.dependencies || []
    if (!deps.length && version.project_id) {
      // автор забыл указать зависимости в новой версии — берём их из предыдущей
      const list = await this.api.versions(version.project_id, this.version, this.loaders)
      deps = list.find(v => v.id !== version.id && v.date_published < version.date_published && v.dependencies?.length)?.dependencies || []
    }
    const extra = EXTRA_DEPS[owner?.slug] || []
    if (extra.length) {
      const found = await this.api.projects(extra)
      deps = [...deps, ...found.filter(Boolean).map(p => ({ project_id: p.id, dependency_type: 'required' }))]
    }
    for (const d of deps) {
      if (d.dependency_type !== 'required') continue
      let pid = d.project_id
      const sub = DEP_SUBSTITUTE[this.loader]?.[pid]
      if (sub) pid = (await this.api.projects([sub]))[0]?.id || pid
      if (!pid && d.version_id) pid = (await this.api.getJson(`https://api.modrinth.com/v2/version/${d.version_id}`))?.project_id
      if (!pid || this.chosen.has(pid) || acc.has(pid)) continue
      const [project] = await this.api.projects([pid])
      if (!project) continue
      const ban = this.blocked[project.slug] || this.blocked[`${project.slug}@${this.loader}`]
      if (ban) return `нужен «${project.title}», а он ${ban}`
      const v = await this.versionFor(pid)
      if (!v) return `нет зависимости «${project.title}» под ${this.version}`
      const why = this.conflicts(project, v)
      if (why) return `зависимость «${project.title}» ${why}`
      acc.set(pid, { project, version: v })
      if (depth < 6) {
        const res = await this.resolveDeps(v, acc, depth + 1, project)
        if (typeof res === 'string') return res
      }
    }
    return acc
  }

  // Пытается добавить мод вместе с зависимостями. true — добавлен.
  async tryAdd(project, section, reason, { allowLibrary = false, quiet = false, noAlpha = false } = {}) {
    // на Quilt Fabric API заменяет QFAPI: вдвоём загрузчик падает («Duplicate mandatory mod ids»)
    if (this.loader === 'quilt' && project.slug === 'fabric-api') {
      const [qsl] = await this.api.projects(['qsl'])
      return qsl ? this.tryAdd(qsl, section, reason, { allowLibrary: true, quiet, noAlpha }) : false
    }
    if (this.chosen.has(project.id) || this.vetoed.has(project.id)) return false
    if (!allowLibrary && isLibrary(project)) return false
    const g = groupOf(project)
    if (g && this.groups.has(g)) return false
    const ban = this.blocked[project.slug] || this.blocked[`${project.slug}@${this.loader}`]
    if (ban) {
      this.skipped.push({ title: project.title, why: ban })
      return false
    }
    const unwanted = !allowLibrary && this.excluded.find(t => matchesTheme(t, project))
    if (unwanted) {
      this.skipped.push({ title: project.title, why: `вы просили без темы «${unwanted.label}»` })
      return false
    }
    const eco = !allowLibrary && missingEcosystem(project, this.chosen)
    if (eco) {
      // дополнение без основы: лёгкую основу добавляем сами, тяжёлую (Cobblemon) — нет
      const [baseProject] = eco.auto ? await this.api.projects([eco.slug]) : []
      const ok = baseProject && await this.tryAdd(baseProject, section, `основа для ${project.title}`)
      if (!ok) {
        this.skipped.push({ title: project.title, why: `дополнение к ${eco.name}, а его нет в сборке` })
        return false
      }
    }
    const version = await this.versionFor(project.id, { noAlpha })
    if (!version) {
      // для «полировки» это обычное дело (мод есть не под все версии) — не засоряем список отсеянного
      if (!quiet) this.skipped.push({ title: project.title, why: `нет версии под ${this.version} ${this.loader}` })
      return false
    }
    const why = this.conflicts(project, version)
    if (why) {
      this.skipped.push({ title: project.title, why })
      return false
    }
    const deps = await this.resolveDeps(version, new Map(), 0, project)
    if (typeof deps === 'string') {
      this.skipped.push({ title: project.title, why: deps })
      return false
    }
    this.commit(project, version, section, reason, false)
    for (const { project: p, version: v } of deps.values()) {
      this.commit(p, v, { id: 'deps', label: 'Библиотеки и зависимости', color: '#8d95b0' }, `нужен для ${project.title}`, true, project.id)
    }
    return true
  }

  commit(project, version, section, reason, dep, parentId = null) {
    const file = fileOf(version)
    if (!file) return
    // только для игры, хотя помечен и для сервера: в серверную часть сборки не попадёт
    if (CLIENT_ONLY[project.slug]) project = { ...project, server: 'unsupported' }
    const mod = { project, version: { id: version.id, number: version.version_number, date: version.date_published }, file, section, reason, dep, parentId, incompatible: incompatibleIds(version) }
    this.chosen.set(project.id, mod)
    const g = groupOf(project)
    if (g && !this.groups.has(g)) this.groups.set(g, project.id)
    this.onMod?.(mod)
  }

  // want — сколько модов нужно от темы: для больших сборок ищем глубже (больше результатов и страниц)
  async candidates(theme, want = 10) {
    const opts = { version: this.version, loaders: this.loaders }
    const category = theme.categories?.[0]
    const limit = Math.min(100, Math.max(20, want * 3))
    const deep = want > 30 ? [100, 200].filter(o => o < want * 3) : []
    const lists = await Promise.all([
      this.api.projects(theme.pinned || []),
      ...theme.queries.map(q => this.api.search(q, { ...opts, category, limit })),
      ...deep.map(offset => this.api.search(theme.queries[0], { ...opts, category, limit: 100, offset })),
      // без категории ищем только для тем, у которых её нет: иначе много случайного
      ...(category ? [] : theme.queries.slice(0, 1).map(q => this.api.search(q, { ...opts, limit: Math.max(30, limit) }))),
    ])
    const pinned = new Set((lists[0] || []).map(p => p.id))
    const seen = new Map()
    for (const p of lists.flat()) if (p && !seen.has(p.id) && !isLibrary(p)) seen.set(p.id, p)
    const score = p => (pinned.has(p.id) ? 100 : 0) + themeScore(theme, p)
    // в больших сборках порог скачиваний мягче: популярных модов на тему просто не хватит
    const minDl = want > 30 ? 3000 : MIN_DOWNLOADS
    let pool = [...seen.values()].filter(p => (pinned.has(p.id) || p.downloads >= minDl) && !THEME_AVOID[theme.id]?.includes(p.slug))
    if (!category) {
      // у темы нет категории на Modrinth: берём только моды со словом темы в названии
      const strict = pool.filter(p => pinned.has(p.id) || titleMatches(theme, p))
      if (strict.length >= 3) pool = strict
    }
    if (pool.length < 3) {
      // узкая тема («вертолёты», «суши»): ищем мягче — без категории и с меньшим порогом скачиваний,
      // но только моды, где слово темы есть в названии или описании
      const wider = await Promise.all(theme.queries.map(q => this.api.search(q, { ...opts, limit: 40 })))
      for (const p of wider.flat()) {
        if (!p || seen.has(p.id) || isLibrary(p) || p.downloads < 2000) continue
        if (!titleMatches(theme, p) && !mentions(theme, p)) continue
        seen.set(p.id, p)
        pool.push(p)
      }
    }
    return pool.sort((a, b) => score(b) - score(a))
  }

  mods() {
    return [...this.chosen.values()]
  }

  remove(projectId, why) {
    const mod = this.chosen.get(projectId)
    if (!mod) return
    this.chosen.delete(projectId)
    this.vetoed.add(projectId)
    for (const [g, id] of this.groups) if (id === projectId) this.groups.delete(g)
    this.skipped.push({ title: mod.project.title, why })
  }

  async metaOf(mod) {
    if (!this.metaCache.has(mod.project.id)) {
      this.metaCache.set(mod.project.id, this.readMeta(mod.file.url, mod.file.size, undefined, this.loader))
    }
    return this.metaCache.get(mod.project.id)
  }

  // Ищет на Modrinth мод, который внутри своего jar называется depId
  async findProvider(depId) {
    const slugs = [...new Set([KNOWN_SLUGS[depId], depId, depId.replace(/_/g, '-')].filter(Boolean))]
    const [direct, found] = await Promise.all([
      this.api.projects(slugs),
      this.api.search(depId.replace(/_/g, ' '), { version: this.version, loaders: this.loaders, limit: 5 }),
    ])
    const seen = new Map()
    for (const p of [...direct, ...found]) if (p && !seen.has(p.id)) seen.set(p.id, p)
    for (const p of [...seen.values()].slice(0, 5)) {
      const v = await this.versionFor(p.id)
      const file = v && fileOf(v)
      if (!file) continue
      // мод из словаря известных библиотек принимаем по адресу: внутри он бывает «архивом в архиве»
      if (KNOWN_SLUGS[depId] === p.slug) return p
      const meta = await this.readMeta(file.url, file.size, undefined, this.loader)
      if (meta?.ids.includes(depId)) return p
    }
    return null
  }

  /**
   * Убирает моды, которые отстали от своей библиотеки (сделаны под Spell Engine 1.8, а в сборке 1.10:
   * формально «>=1.7» подходит, но нужные классы уже удалены), и дополнения, у которых пропала основа.
   * Возвращает true, если что-то убрал.
   */
  // Мод требует версию библиотеки (или загрузчика) новее, чем есть: ищем его версию постарше, которой хватает имеющейся
  async downgradeFor(mod, depId, have) {
    const list = await this.api.versions(mod.project.id, this.version, this.loaders)
    const at = list.findIndex(v => v.id === mod.version.id)
    for (const v of list.slice(at + 1, at + 13)) {
      const file = fileOf(v)
      if (!file || wrongMcInFilename(file.filename, this.version)) continue
      const meta = await this.readMeta(file.url, file.size, undefined, this.loader)
      if (!meta || this.fileProblem(meta)) continue
      const r = meta.ranges?.[depId]
      if (r && !rangeFits(r, meta.mcKind, have, this.version)) continue
      mod.version = { id: v.id, number: v.version_number, date: v.date_published }
      mod.file = file
      this.metaCache.set(mod.project.id, Promise.resolve(meta))
      return true
    }
    return false
  }

  async checkStale(mods, metas) {
    const byId = new Map()
    mods.forEach((m, i) => metas[i]?.ids.forEach(id => byId.set(id, m)))
    let removed = false
    for (const [i, m] of mods.entries()) {
      if (!this.chosen.has(m.project.id)) continue
      if (!m.dep && !['perf', 'qol'].includes(m.section.id)) {
        const base = missingBase(m.project, this.chosen)
        if (base) {
          this.remove(m.project.id, `дополнение к ${base}, а его нет в сборке`)
          removed = true
          continue
        }
      }
      if (!m.version.date || !metas[i]) continue
      let changed = false
      for (const depId of metas[i].depends) {
        const range = metas[i].ranges?.[depId]
        // сам загрузчик: Fabric — выбранная версия, Quilt — версия Fabric, которую он изображает
        if (range && ['fabricloader', 'fabric_loader'].includes(depId)) {
          const have = this.loader === 'fabric' ? this.loaderVersion : this.loader === 'quilt' ? QUILT_FABRIC[String(this.loaderVersion).split('.').slice(0, 2).join('.')] : null
          if (have && !rangeFits(range, metas[i].mcKind, have, this.version)) {
            if (await this.downgradeFor(m, depId, have)) { changed = true; break }
            this.remove(m.project.id, `нужен загрузчик новее (${range}), а есть ${have}`)
            changed = true
            break
          }
          continue
        }
        const d = byId.get(depId)
        if (!d || d === m) continue
        // версия, которую мод сам разрешает (так же проверит и игра при запуске)
        // на Quilt Fabric API — внутри QFAPI: «7.7.0+0.92.2-1.20.1» значит Fabric API 0.92.2
        const qfapi = this.loader === 'quilt' && d.project.slug === 'qsl' && ['fabric_api', 'fabric'].includes(depId)
        const have = qfapi ? d.version.number.match(/\+(\d+\.\d+\.\d+)/)?.[1] : libVersion(d.version.number, this.version)
        if (range && have && !rangeFits(range, metas[i].mcKind, have, this.version)) {
          // сначала пробуем версию мода постарше, которой хватает того, что есть
          if (await this.downgradeFor(m, depId, have)) { changed = true; break }
          this.remove(m.project.id, `нужен ${d.project.title} версии ${range}, а под ${this.version} есть только ${have}`)
          changed = true
          break
        }
        if (STABLE_LIBS.has(d.project.slug)) continue
        const list = await this.api.versions(d.project.id, this.version, this.loaders)
        const before = list.find(v => v.date_published <= m.version.date)
        const then = before && majorMinor(before.version_number, this.version)
        const now = majorMinor(d.version.number, this.version)
        if (!then || !now || then === now) continue
        // библиотека нужна только этому моду — ставим ту её версию, под которую он сделан (Blueprint для Buzzier Bees)
        const others = mods.filter((o, j) => o !== m && o !== d && this.chosen.has(o.project.id) && metas[j]?.depends.includes(depId))
        const olderFile = fileOf(before)
        if (!others.length && olderFile && !wrongMcInFilename(olderFile.filename, this.version)) {
          d.version = { id: before.id, number: before.version_number, date: before.date_published }
          d.file = olderFile
          this.metaCache.delete(d.project.id)
          removed = true // перепроверим сборку с этой версией
          break
        }
        // библиотека нужна и другим: разница в одну версию обычно не мешает, большой скачок ломает
        // (RPG Minibosses под Spell Engine 1.8 падал с 1.10)
        const [tMaj, tMin] = then.split('.').map(Number)
        const [nMaj, nMin] = now.split('.').map(Number)
        if (tMaj !== nMaj || Math.abs(nMin - tMin) >= 2) {
          this.remove(m.project.id, `давно не обновлялся: сделан под ${d.project.title} ${then}, а в сборке ${now}`)
          removed = true
          break
        }
      }
      if (changed) removed = true // мод заменён на версию постарше или убран — перепроверим сборку
    }
    return removed
  }

  /**
   * Проверка «что внутри»: читает fabric.mod.json / mods.toml каждого мода.
   * Чего не хватает — ищет и добавляет; не нашлось — убирает мод, которому это нужно.
   */
  /**
   * Замена мода на похожий из той же темы (кнопка «↻» на карточке): старый убирается,
   * новый добавляется со всеми проверками (зависимости, конфликты, файл внутри jar). Возвращает новый мод или null.
   */
  async replace(mod, theme) {
    const pool = (await this.candidates(theme)).filter(p => p.id !== mod.project.id && !this.chosen.has(p.id) && !this.vetoed.has(p.id))
    this.remove(mod.project.id, 'заменён на похожий по вашей просьбе')
    for (const p of pool.slice(0, 25)) {
      if (await this.tryAdd(p, mod.section, `вместо ${mod.project.title}`)) {
        await this.verifyJars()
        const added = this.chosen.get(p.id)
        if (added) {
          const meta = await this.metaOf(added).catch(() => null)
          added.ids = [...new Set([...(meta?.ids || []), norm(added.project.slug)])]
          added.depends = meta?.depends || []
          return added
        }
      }
    }
    // замены не нашлось — возвращаем старый мод на место
    this.vetoed.delete(mod.project.id)
    this.skipped = this.skipped.filter(x => x.title !== mod.project.title)
    this.chosen.set(mod.project.id, mod)
    const g = groupOf(mod.project)
    if (g && !this.groups.has(g)) this.groups.set(g, mod.project.id)
    return null
  }

  // Подходит ли файл мода к этой сборке. Возвращает причину или null.
  fileProblem(meta) {
    if (!meta) return null
    const forgeLike = ['forge', 'neoforge'].includes(this.loader)
    if (forgeLike && ['fabric', 'quilt'].includes(meta.kind)) return 'в файле версия только для Fabric'
    if (!forgeLike && ['forge', 'neoforge'].includes(meta.kind)) return 'в файле версия только для Forge/NeoForge'
    if (this.loader === 'fabric' && meta.kind === 'quilt') return 'в файле версия только для Quilt'
    if (this.loader === 'forge' && meta.kind === 'neoforge') return 'в файле версия только для NeoForge'
    // NeoForge с 1.20.5 читает только neoforge.mods.toml
    if (this.loader === 'neoforge' && meta.kind === 'forge' && !/^1\.20\.[1-4]$/.test(this.version)) return 'в файле версия для Forge, а не NeoForge'
    if (meta.mc && !rangeFits(meta.mc, meta.mcKind, this.version)) {
      return `файл сделан для Minecraft ${[meta.mc].flat().join(' / ')}, а не ${this.version}`
    }
    if (meta.kind === 'neoforge' && meta.hasModLoader === false && OLD_NEO(this.version)) return 'файл для более новой версии NeoForge (Missing ModLoader)'
    return null
  }

  // Файл не подошёл: ищем другую версию этого же мода; не нашлась — убираем мод
  async reselect(mod, why) {
    const list = await this.api.versions(mod.project.id, this.version, this.loaders)
    for (const v of list.slice(0, 8)) {
      if (v.id === mod.version.id) continue
      const file = fileOf(v)
      if (!file || wrongMcInFilename(file.filename, this.version)) continue
      const meta = await this.readMeta(file.url, file.size, undefined, this.loader)
      if (!meta || this.fileProblem(meta)) continue
      mod.version = { id: v.id, number: v.version_number, date: v.date_published }
      mod.file = file
      this.metaCache.set(mod.project.id, Promise.resolve(meta))
      return true
    }
    this.remove(mod.project.id, why)
    return false
  }

  // Ставит версию мода, которая не попадает в «несовместимый» диапазон. true — получилось.
  async upgradeOutOf(mod, range, kind) {
    const list = await this.api.versions(mod.project.id, this.version, this.loaders)
    const v = list.find(x => {
      const lv = libVersion(x.version_number, this.version)
      const f = fileOf(x)
      return lv && f && !rangeFits(range, kind, lv, this.version) && !wrongMcInFilename(f.filename, this.version)
    })
    if (!v) return false
    mod.version = { id: v.id, number: v.version_number, date: v.date_published }
    mod.file = fileOf(v)
    this.metaCache.delete(mod.project.id)
    return true
  }

  // Два мода встраиваются в игру одним и тем же файлом (Lithium и его порт Radium) или автор явно запретил пару
  async checkClashes(mods, metas) {
    const idOwner = new Map()
    mods.forEach((m, i) => metas[i]?.ids.forEach(id => idOwner.set(id, m)))
    const mixinOwner = new Map()
    for (const [i, m] of mods.entries()) {
      if (!this.chosen.has(m.project.id) || !metas[i]) continue
      for (const cfg of metas[i].mixins || []) {
        if (GENERIC_MIXIN.test(cfg)) continue
        const other = mixinOwner.get(cfg)
        if (other && other !== m && this.chosen.has(other.project.id)) {
          this.remove(m.project.id, `делает то же, что ${other.project.title} (оба меняют игру через ${cfg}): вдвоём игра падает`)
          return true
        }
        mixinOwner.set(cfg, m)
      }
      for (const [id, range] of Object.entries(metas[i].breaks || {})) {
        const other = idOwner.get(id)
        if (!other || other === m || !this.chosen.has(other.project.id)) continue
        // обычно несовместимость только со старыми версиями («Cristel Lib» и старые Towns and Towers)
        const have = libVersion(other.version.number, this.version)
        if (range && range !== '*' && have && !rangeFits(range, metas[i].mcKind, have, this.version)) continue
        // несовместим только со старыми версиями: ставим новее (Sodium 0.8.13 не дружит с Iris до 1.8.13)
        if (range && range !== '*' && await this.upgradeOutOf(other, range, metas[i].mcKind)) return true
        this.remove(m.project.id, `автор пишет, что он несовместим с ${other.project.title}`)
        return true
      }
    }
    return false
  }

  async verifyJars(onProgress = () => {}) {
    for (let round = 0; round < 8; round++) {
      const mods = this.mods()
      const metas = await pool(mods, 6, m => this.metaOf(m))
      onProgress(round)
      // файл подходит к загрузчику и версии игры?
      let fixed = false
      for (const [i, m] of mods.entries()) {
        const why = this.fileProblem(metas[i])
        if (why) {
          await this.reselect(m, why)
          fixed = true
        }
      }
      if (fixed || await this.checkClashes(mods, metas)) continue
      const provided = new Set()
      mods.forEach((m, i) => {
        const meta = metas[i]
        if (meta) [...meta.ids, ...meta.nested].forEach(id => provided.add(id))
        for (const [id, slug] of Object.entries(KNOWN_SLUGS)) if (slug === m.project.slug) provided.add(id)
      })
      const missing = new Map() // depId -> [mod]
      mods.forEach((m, i) => {
        for (const dep of metas[i]?.depends || []) {
          if (isPlatform(dep) || provided.has(dep)) continue
          // библиотека вложена в сам мод под другим именем файла: «registrate_fabric» в Registrate-MC1.20-….jar,
          // «team_reborn_energy» в energy-….jar — загрузчик найдёт её внутри, докачивать не нужно
          if (bundles(metas[i], dep)) continue
          if (!missing.has(dep)) missing.set(dep, [])
          missing.get(dep).push(m)
        }
      })
      if (!missing.size) {
        if (await this.checkStale(mods, metas)) continue // что-то убрали — проверяем ещё раз
        return
      }
      for (const [dep, needers] of missing) {
        const provider = await this.findProvider(dep)
        const section = { id: 'deps', label: 'Библиотеки и зависимости', color: '#8d95b0' }
        const ok = provider && (this.chosen.has(provider.id)
          || await this.tryAdd(provider, section, `нужен для ${needers[0].project.title}`, { allowLibrary: true }))
        if (ok) {
          const added = this.chosen.get(provider.id)
          if (added && !added.parentId) added.parentId = needers[0].project.id
          if (added) added.dep = true
        } else {
          for (const m of needers) this.remove(m.project.id, `требует мод «${dep}», которого нет под ${this.version} ${this.loader}`)
        }
      }
    }
  }
}

// сколько тематических модов: пресет («big») или число с ползунка
export const budgetOf = size => (typeof size === 'number' ? size : Number(size) > 0 ? Number(size) : SIZES[size] || SIZES.normal)

// Категории Modrinth для добора больших сборок, от самых «безопасных» к узким
const FILL_CATEGORIES = [['adventure', 'Приключения'], ['decoration', 'Декор и стройка'], ['worldgen', 'Мир и постройки'],
  ['mobs', 'Существа'], ['equipment', 'Снаряжение'], ['food', 'Еда'], ['game-mechanics', 'Механики'], ['utility', 'Удобства'],
  ['storage', 'Хранение'], ['transportation', 'Транспорт'], ['magic', 'Магия'], ['technology', 'Техника']]

/** Добирает до need модов популярным из категорий, подходящих к запросу. Возвращает, сколько добавил. */
async function fillUp(b, api, opts, need, themes, onAdd) {
  const asked = new Set(themes.flatMap(t => t.theme.categories || []))
  const banned = new Set((opts.excluded || []).flatMap(t => t.categories || []))
  // сначала категории, которые есть у выбранных тем, потом остальные
  const cats = FILL_CATEGORIES.filter(([c]) => !banned.has(c)).sort((x, y) => asked.has(y[0]) - asked.has(x[0]))
  const state = cats.map(() => ({ offset: 0, pool: [], done: false }))
  let added = 0
  for (let round = 0; added < need && round < 400; round++) {
    let progressed = false
    for (let i = 0; i < cats.length && added < need; i++) {
      const st = state[i]
      if (st.done) continue
      if (!st.pool.length) {
        if (st.offset >= 600) { st.done = true; continue }
        const page = await api.search('', { version: opts.version, loaders: b.loaders, category: cats[i][0], limit: 100, offset: st.offset, index: 'downloads' })
        st.offset += 100
        st.pool = page.filter(p => p.downloads >= 2000 && !isLibrary(p) && !b.chosen.has(p.id))
        if (!page.length) { st.done = true; continue }
      }
      while (st.pool.length) {
        const p = st.pool.shift()
        const section = { id: `more-${cats[i][0]}`, label: `Ещё: ${cats[i][1]}`, color: '#90a4ae' }
        if (await b.tryAdd(p, section, 'популярное в этой категории', { quiet: true })) {
          added++
          progressed = true
          onAdd(added)
          break
        }
      }
    }
    if (!progressed && state.every(s => s.done)) break
  }
  return added
}

/** Общий «хвост» сборки: проверка файлов внутри модов, id для «Доктора», серверные библиотеки. Возвращает extras без бесполезных шейдеров. */
async function finishPack(b, api, opts, extras = []) {
  b.loaderVersion = await api.loaderVersion(opts.loader, opts.version)
  await b.verifyJars()
  // если мод для шейдеров не прошёл проверку — шейдер без него бесполезен
  const shaderModOk = b.mods().some(m => m.project.slug === SHADER_MOD[opts.loader])
  const kept = extras.filter(e => e.kind !== 'shader' || shaderModOk)
  // внутренние id и зависимости модов: по ним «Доктор» найдёт мод в crash-report
  for (const m of b.mods()) {
    const meta = await b.metaOf(m).catch(() => null)
    m.ids = [...new Set([...(meta?.ids || []), norm(m.project.slug)])]
    m.depends = meta?.depends || []
  }
  // библиотека помечена «только для игры», но её требует серверный мод (Simply Swords -> Simply Tooltips):
  // на сервере без неё падение, значит ставим и туда
  const byId = new Map(b.mods().flatMap(m => m.ids.map(id => [id, m])))
  for (const m of b.mods()) {
    if (m.project.server === 'unsupported') continue
    for (const dep of m.depends) {
      const lib = byId.get(dep)
      if (lib && lib.project.server === 'unsupported' && !CLIENT_ONLY[lib.project.slug]) lib.project = { ...lib.project, server: 'required' }
    }
  }
  return kept
}

/**
 * «Обновить сборку»: берёт старый .mrpack (его modrinth.index.json) и переносит моды на другую версию игры или загрузчик.
 * Что не вышло под новую версию — в списке отсеянного с причиной. Настройки (overrides) не переносятся.
 */
export async function updatePack(index, opts, api, emit = () => {}) {
  const b = new PackBuilder(api, { version: opts.version, loader: opts.loader, blocked: opts.blocked || {} }, opts.readMeta ? { readMeta: opts.readMeta } : {})
  b.onMod = mod => emit({ type: 'mod', mod })
  const progress = (value, text) => emit({ type: 'progress', value, text })
  const ids = [...new Set((index.files || []).filter(f => /^mods\//.test(f.path))
    .map(f => f.downloads?.[0]?.match(/\/data\/([^/]+)\//)?.[1]).filter(Boolean))]
  progress(0.1, `В старой сборке ${ids.length} модов с Modrinth, ищу их под ${opts.version}…`)
  const projects = await api.projects(ids)
  const section = { id: 'old', label: 'Из старой сборки', color: '#80cbc4' }
  let done = 0
  // версии всех модов запрашиваем сразу пачкой — потом выбор идёт из кэша, а не по одному запросу на мод
  await Promise.all(projects.map(p => b.versionFor(p.id).catch(() => null)))
  // сначала не-библиотеки: библиотеки сами придут как зависимости, а лишние отсеются
  const order = [...projects].sort((x, y) => Number(isLibrary(x)) - Number(isLibrary(y)))
  for (const p of order) {
    await b.tryAdd(p, section, 'был в старой сборке', { allowLibrary: true })
    progress(0.1 + 0.7 * (++done / order.length), p.title)
  }
  const foreign = (index.files || []).filter(f => /^mods\//.test(f.path) && !f.downloads?.[0]?.includes('/data/')).length
  if (foreign) b.skipped.push({ title: `Файлы не с Modrinth (${foreign})`, why: 'их источник не Modrinth, перенести нельзя — скачайте новые версии вручную' })
  progress(0.85, 'Заглядываю внутрь модов: что им нужно на самом деле…')
  await finishPack(b, api, opts)
  progress(1, 'Готово')
  return { mods: b.mods(), extras: [], skipped: b.skipped, emptyThemes: [], loaderVersion: b.loaderVersion, version: opts.version, loader: opts.loader, builder: b, ref: null }
}

// Мод везёт эту библиотеку внутри себя: имя вложенного файла похоже на id зависимости
export function bundles(meta, dep) {
  return (meta?.nested || []).some(n => n.length >= 4 && (dep.includes(n) || n.includes(dep)))
}

// Выполняет fn для элементов, не больше limit одновременно; порядок результатов сохраняется
async function pool(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i]).catch(() => null)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

/**
 * Собирает сборку.
 * opts: { version, loader, size: 'light'|'normal'|'big', perf, qol, themes: [{theme, word}] }
 * emit: события для интерфейса {type:'stage'|'mod'|'progress', ...}
 */
export async function buildPack(opts, api, emit = () => {}) {
  const b = new PackBuilder(api, opts, opts.readMeta ? { readMeta: opts.readMeta } : {})
  b.onMod = mod => emit({ type: 'mod', mod })
  const progress = (value, text) => emit({ type: 'progress', value, text })

  // база оптимизации — как в проверенной сборке (Fabulously Optimized / Keo Optimized) под эту версию
  let ref = null
  if (opts.perf) {
    progress(0.04, 'Беру оптимизацию из проверенной сборки…')
    ref = await (opts.loadRef || loadRefPack)(api, opts.loader, opts.version)
  }
  for (const key of ['perf', 'qol', 'polish']) {
    if (!opts[key]) continue
    const base = BASE[key]
    const fromRef = key === 'perf' && ref
    const slugs = fromRef ? [...ref.slugs, ...CHUNK_EXTRAS[opts.loader]] : key === 'perf' ? [...base[opts.loader], ...CHUNK_EXTRAS[opts.loader]] : base[opts.loader] || []
    const section = { id: key, label: fromRef ? `Оптимизация (как в ${ref.name})` : base.label, color: base.color }
    progress({ perf: 0.08, qol: 0.14, polish: 0.18 }[key], { perf: 'Ставлю оптимизацию…', qol: 'Добавляю удобства…', polish: 'Добавляю атмосферу: анимации, звуки, частицы…' }[key])
    const projects = await api.projects(slugs)
    const bySlug = new Map(projects.map(p => [p.slug, p]))
    await Promise.all(projects.map(p => b.versionFor(p.id))) // прогрев кэша параллельно
    for (const slug of slugs) {
      const p = bySlug.get(slug)
      const reason = key === 'qol' ? 'удобство' : key === 'polish' ? 'атмосфера' : CHUNK_EXTRAS[opts.loader].includes(slug) ? 'быстрая прогрузка чанков'
        : fromRef ? `из ${ref.name}` : 'больше FPS'
      if (p) await b.tryAdd(p, section, reason, { allowLibrary: true, quiet: key === 'polish', noAlpha: true })
    }
  }

  // «сервер» в описании — голосовой чат, чтобы говорить с друзьями прямо в игре
  if (opts.voice) {
    const [voice] = await api.projects(['simple-voice-chat'])
    if (voice) await b.tryAdd(voice, { id: 'qol', label: BASE.qol.label, color: BASE.qol.color }, 'голосовой чат для сервера', { allowLibrary: true, quiet: true })
  }

  // «только оптимизация»: тематические моды не нужны вовсе
  // шейдер уже выбран в «Графике» — темы «Графика»/«Шейдеры» не нужны: они тянут случайные моды вокруг шейдеров
  const asked = opts.graphics?.shader ? opts.themes.filter(t => !['shaders', 'graphics'].includes(t.theme.id)) : opts.themes
  const themes = opts.onlyBase ? [] : asked.length ? asked : [{ theme: VANILLA_PLUS, word: null }]
  const budget = budgetOf(opts.size)
  const quota = Math.max(2, Math.ceil(budget / themes.length))
  progress(0.25, budget > 100 ? `Ищу моды по темам: нужно ${budget}, это займёт несколько минут…` : 'Ищу моды по темам…')
  const pools = await Promise.all(themes.map(t => b.candidates(t.theme, quota)))
  // прогрев версий для первых кандидатов каждой темы
  await Promise.all(pools.flatMap(pool => pool.slice(0, quota * 2).map(p => b.versionFor(p.id).catch(() => null))))

  const taken = themes.map(() => 0)
  const cursor = themes.map(() => 0)
  let added = 0
  for (let round = 0; added < budget && round < quota * 4; round++) {
    let progressed = false
    for (let i = 0; i < themes.length && added < budget; i++) {
      if (taken[i] >= quota) continue
      const pool = pools[i]
      while (cursor[i] < pool.length) {
        const p = pool[cursor[i]++]
        const { theme, word } = themes[i]
        const section = { id: theme.id, label: theme.label, color: theme.color }
        if (await b.tryAdd(p, section, word ? `за «${word}»` : theme.label)) {
          taken[i]++
          added++
          progressed = true
          progress(0.3 + 0.6 * (added / budget), `${theme.label}: ${p.title}`)
          break
        }
      }
    }
    if (!progressed) break
  }

  // тем мало для такого размера — добираем популярное из подходящих категорий (запреты «без …» соблюдаются в tryAdd)
  if (added < budget && !opts.onlyBase) {
    progress(0.8, `Добираю до ${budget} модов популярным из подходящих категорий…`)
    added += await fillUp(b, api, opts, budget - added, themes, n => progress(0.8 + 0.08 * Math.min(1, (added + n) / budget), `Набрано ${added + n} из ${budget}`))
  }

  // шейдеры и ресурспаки — только если попросили
  let extras = []
  if (opts.graphics?.shader || opts.graphics?.packs > 0) {
    progress(0.88, 'Добавляю графику: шейдеры и ресурспаки…')
    extras = await addGraphics(b, api, opts.graphics, themes)
  }

  progress(0.9, 'Заглядываю внутрь модов: что им нужно на самом деле…')
  extras = await finishPack(b, api, opts, extras)
  progress(0.96, 'Проверяю загрузчик…')
  const loaderVersion = b.loaderVersion
  progress(1, 'Готово')
  // темы, по которым в итоге не осталось ни одного мода: честно скажем об этом
  // темы про оптимизацию закрывает база («Оптимизация») — о них не пишем, что пусто
  const coveredByBase = t => opts.perf && (t.theme.categories || []).includes('optimization')
  const emptyThemes = themes.filter(t => t.theme !== VANILLA_PLUS && !coveredByBase(t) && !b.mods().some(m => m.section.id === t.theme.id)).map(t => t.theme.label)
  return { mods: b.mods(), extras, skipped: b.skipped, emptyThemes, loaderVersion, version: opts.version, loader: opts.loader, builder: b,
    ref: ref && { name: ref.name, license: ref.license, version: ref.version, configs: ref.configs } }
}
