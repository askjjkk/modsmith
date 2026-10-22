// Подбор модов: база + темы, версии под (minecraft, загрузчик), зависимости, конфликты.
import { BASE, GROUPS, SIZES, VANILLA_PLUS } from './themes.js'
import { KNOWN_SLUGS, isPlatform, readJarMeta } from './jarmeta.js'

export const loaderList = loader => (loader === 'quilt' ? ['quilt', 'fabric'] : [loader])

export function pickVersion(versions) {
  if (!versions?.length) return null
  return versions.find(v => v.version_type === 'release') || versions[0]
}

export function fileOf(version) {
  const f = version.files.find(x => x.primary) || version.files[0]
  return f && { url: f.url, filename: f.filename, size: f.size, hashes: f.hashes }
}

export function groupOf(project) {
  return GROUPS.find(g => g.slugs.includes(project.slug) || g.title.test(project.title))?.id || null
}

export const isLibrary = project => (project.categories || []).includes('library')

export const MIN_DOWNLOADS = 15000
// шуточные и «не про то» моды, которые поиск любит поднимать
const NOISE = /dragon ?ball|meme|joke|troll|april fools|\bmod ?pack\b/i

// Насколько мод подходит теме: популярность + совпадение категории + слова темы в названии/описании
export function themeScore(theme, p) {
  if (NOISE.test(p.title)) return -100
  const text = `${p.title} ${p.description || ''}`.toLowerCase()
  const words = theme.queries.flatMap(q => q.toLowerCase().split(' '))
    .concat(theme.stems.filter(s => /^[a-z=]/.test(s)).map(s => s.replace('=', '')))
  const inTitle = titleMatches(theme, p)
  const inText = words.some(w => w.length > 2 && text.includes(w))
  const cat = (theme.categories || []).some(c => (p.categories || []).includes(c))
  return Math.log10((p.downloads || 0) + 1) + (cat ? 1 : 0) + (inTitle ? 1.5 : inText ? 0.7 : -1)
}

export function titleMatches(theme, p) {
  const words = theme.queries.flatMap(q => q.toLowerCase().split(' '))
    .concat(theme.stems.filter(s => /^[a-z=]/.test(s)).map(s => s.replace('=', '')))
  return words.some(w => w.length > 2 && p.title.toLowerCase().includes(w))
}

const incompatibleIds = version => (version.dependencies || [])
  .filter(d => d.dependency_type === 'incompatible' && d.project_id).map(d => d.project_id)

export class PackBuilder {
  constructor(api, { version, loader }, { readMeta = readJarMeta } = {}) {
    this.api = api
    this.version = version
    this.loader = loader
    this.loaders = loaderList(loader)
    this.chosen = new Map() // projectId -> mod
    this.groups = new Map() // groupId -> projectId
    this.skipped = []
    this.readMeta = readMeta
    this.metaCache = new Map()
  }

  async versionFor(projectId) {
    return pickVersion(await this.api.versions(projectId, this.version, this.loaders))
  }

  conflicts(project, version) {
    const g = groupOf(project)
    if (g && this.groups.has(g) && this.groups.get(g) !== project.id) return 'дублирует уже выбранный мод'
    if (incompatibleIds(version).some(id => this.chosen.has(id))) return 'несовместим с уже выбранным модом'
    for (const m of this.chosen.values()) {
      if (m.incompatible.includes(project.id)) return `несовместим с ${m.project.title}`
    }
    return null
  }

  // Обязательные зависимости по цепочке. Возвращает Map или строку с причиной отказа.
  async resolveDeps(version, acc = new Map(), depth = 0) {
    for (const d of version.dependencies || []) {
      if (d.dependency_type !== 'required') continue
      let pid = d.project_id
      if (!pid && d.version_id) pid = (await this.api.getJson(`https://api.modrinth.com/v2/version/${d.version_id}`))?.project_id
      if (!pid || this.chosen.has(pid) || acc.has(pid)) continue
      const [project] = await this.api.projects([pid])
      if (!project) continue
      const v = await this.versionFor(pid)
      if (!v) return `нет зависимости «${project.title}» под ${this.version}`
      const why = this.conflicts(project, v)
      if (why) return `зависимость «${project.title}» ${why}`
      acc.set(pid, { project, version: v })
      if (depth < 6) {
        const res = await this.resolveDeps(v, acc, depth + 1)
        if (typeof res === 'string') return res
      }
    }
    return acc
  }

  // Пытается добавить мод вместе с зависимостями. true — добавлен.
  async tryAdd(project, section, reason, { allowLibrary = false } = {}) {
    if (this.chosen.has(project.id)) return false
    if (!allowLibrary && isLibrary(project)) return false
    const g = groupOf(project)
    if (g && this.groups.has(g)) return false
    const version = await this.versionFor(project.id)
    if (!version) {
      this.skipped.push({ title: project.title, why: `нет версии под ${this.version} ${this.loader}` })
      return false
    }
    const why = this.conflicts(project, version)
    if (why) {
      this.skipped.push({ title: project.title, why })
      return false
    }
    const deps = await this.resolveDeps(version)
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
    const mod = { project, version: { id: version.id, number: version.version_number }, file, section, reason, dep, parentId, incompatible: incompatibleIds(version) }
    this.chosen.set(project.id, mod)
    const g = groupOf(project)
    if (g && !this.groups.has(g)) this.groups.set(g, project.id)
    this.onMod?.(mod)
  }

  async candidates(theme) {
    const opts = { version: this.version, loaders: this.loaders }
    const category = theme.categories?.[0]
    const lists = await Promise.all([
      this.api.projects(theme.pinned || []),
      ...theme.queries.map(q => this.api.search(q, { ...opts, category })),
      // без категории ищем только для тем, у которых её нет: иначе много случайного
      ...(category ? [] : theme.queries.slice(0, 1).map(q => this.api.search(q, { ...opts, limit: 30 }))),
    ])
    const pinned = new Set((lists[0] || []).map(p => p.id))
    const seen = new Map()
    for (const p of lists.flat()) if (p && !seen.has(p.id) && !isLibrary(p)) seen.set(p.id, p)
    const score = p => (pinned.has(p.id) ? 100 : 0) + themeScore(theme, p)
    let pool = [...seen.values()].filter(p => pinned.has(p.id) || p.downloads >= MIN_DOWNLOADS)
    if (!category) {
      // у темы нет категории на Modrinth: берём только моды со словом темы в названии
      const strict = pool.filter(p => pinned.has(p.id) || titleMatches(theme, p))
      if (strict.length >= 3) pool = strict
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
    for (const [g, id] of this.groups) if (id === projectId) this.groups.delete(g)
    this.skipped.push({ title: mod.project.title, why })
  }

  async metaOf(mod) {
    if (!this.metaCache.has(mod.project.id)) {
      this.metaCache.set(mod.project.id, this.readMeta(mod.file.url, mod.file.size))
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
      const meta = await this.readMeta(file.url, file.size)
      if (meta?.ids.includes(depId)) return p
    }
    return null
  }

  /**
   * Проверка «что внутри»: читает fabric.mod.json / mods.toml каждого мода.
   * Чего не хватает — ищет и добавляет; не нашлось — убирает мод, которому это нужно.
   */
  async verifyJars(onProgress = () => {}) {
    for (let round = 0; round < 4; round++) {
      const mods = this.mods()
      const metas = await pool(mods, 6, m => this.metaOf(m))
      onProgress(round)
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
          if (!missing.has(dep)) missing.set(dep, [])
          missing.get(dep).push(m)
        }
      })
      if (!missing.size) return
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

  for (const key of ['perf', 'qol']) {
    if (!opts[key]) continue
    const base = BASE[key]
    const section = { id: key, label: base.label, color: base.color }
    progress(key === 'perf' ? 0.06 : 0.16, key === 'perf' ? 'Ставлю оптимизацию…' : 'Добавляю удобства…')
    const projects = await api.projects(base[opts.loader] || [])
    const bySlug = new Map(projects.map(p => [p.slug, p]))
    await Promise.all(projects.map(p => b.versionFor(p.id))) // прогрев кэша параллельно
    for (const slug of base[opts.loader] || []) {
      const p = bySlug.get(slug)
      if (p) await b.tryAdd(p, section, key === 'perf' ? 'больше FPS' : 'удобство', { allowLibrary: true })
    }
  }

  const themes = opts.themes.length ? opts.themes : [{ theme: VANILLA_PLUS, word: null }]
  const budget = SIZES[opts.size] || SIZES.normal
  const quota = Math.max(2, Math.ceil(budget / themes.length))
  progress(0.25, 'Ищу моды по темам…')
  const pools = await Promise.all(themes.map(t => b.candidates(t.theme)))
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

  progress(0.9, 'Заглядываю внутрь модов: что им нужно на самом деле…')
  await b.verifyJars()
  progress(0.96, 'Проверяю загрузчик…')
  const loaderVersion = await api.loaderVersion(opts.loader, opts.version)
  progress(1, 'Готово')
  return { mods: b.mods(), skipped: b.skipped, loaderVersion, version: opts.version, loader: opts.loader }
}
