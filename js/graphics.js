// Графика: шейдеры и ресурспаки. Ставятся только по запросу или если включить их вручную.
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

/**
 * Добавляет в сборку шейдер и ресурспаки.
 * graphics: { shader: slug|null, packs: [slug] }. Возвращает [{ kind, project, file, path }] — файлы не-модов.
 */
export async function addGraphics(b, api, graphics) {
  const extras = []
  const section = { id: 'gfx', label: 'Шейдеры и ресурспаки', color: '#ffcf4a' }
  // Resourcify — поиск и установка ресурспаков и шейдеров прямо в игре (просьба пользователя: во все сборки)
  const [resourcify] = await api.projects(['resourcify'])
  if (resourcify && !b.chosen.has(resourcify.id)) await b.tryAdd(resourcify, section, 'ресурспаки и шейдеры прямо из игры', { allowLibrary: true, quiet: true })
  if (graphics.shader) {
    const [mod] = await api.projects([SHADER_MOD[b.loader]])
    const [shader] = await api.projects([graphics.shader])
    const modOk = mod && (b.chosen.has(mod.id) || await b.tryAdd(mod, section, 'чтобы работали шейдеры', { allowLibrary: true }))
    // шейдеры редко помечают каждую версию игры: если под эту нет — берём самую свежую (они почти не зависят от версии)
    const versions = shader && ((await api.versions(shader.id, b.version, ['iris'])).length
      ? await api.versions(shader.id, b.version, ['iris'])
      : await api.getJson(`https://api.modrinth.com/v2/project/${shader.id}/version`) || [])
    const file = fileOfVersion(versions?.find(v => v.loaders?.includes('iris')) || versions?.[0])
    if (modOk && file) extras.push({ kind: 'shader', project: shader, file, path: `shaderpacks/${file.filename}` })
    else b.skipped.push({ title: shader?.title || graphics.shader, why: modOk ? 'нет файла шейдера' : `нет ${SHADER_MOD[b.loader]} под ${b.version} ${b.loader}` })
  }
  for (const slug of graphics.packs || []) {
    const info = RESOURCE_PACKS.find(p => p.slug === slug)
    const [pack] = await api.projects([slug])
    if (!pack) continue
    const file = fileOfVersion((await api.versions(pack.id, b.version, ['minecraft']))[0])
    if (!file) { b.skipped.push({ title: pack.title, why: `нет версии ресурспака под ${b.version}` }); continue }
    let ok = true
    for (const need of info?.needs || []) {
      const [p] = await api.projects([need])
      ok = ok && !!p && (b.chosen.has(p.id) || await b.tryAdd(p, section, `нужен для ресурспака ${pack.title}`, { allowLibrary: true }))
    }
    if (ok) extras.push({ kind: 'resourcepack', project: pack, file, path: `resourcepacks/${file.filename}` })
    else b.skipped.push({ title: pack.title, why: 'не нашлось модов, без которых он не работает' })
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
