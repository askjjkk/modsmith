// Мини-набор тестов: открыть tests.html через локальный сервер
import { parse, detectThemes, detectVersion, detectLoader } from './parser.js'
import { PackBuilder, buildPack, groupOf, pickVersion } from './builder.js'
import { buildIndex } from './mrpack.js'
import { isPlatform, nestedIds, parseFabric, parseToml } from './jarmeta.js'

const results = []
const test = (name, fn) => results.push({ name, fn })
const eq = (a, b, msg = '') => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}\nожидали ${JSON.stringify(b)}\nполучили ${JSON.stringify(a)}`)
}
const ids = found => found.map(f => f.theme.id)

// --- разбор описания ---
test('темы из русского описания со словоформами', () => {
  eq(ids(detectThemes('Хардкорное выживание с магией и драконами')), ['magic', 'dragons', 'hardcore'])
})
test('английское описание', () => {
  eq(ids(detectThemes('tech pack with machines and space rockets')), ['tech', 'space'])
})
test('seasons не считается морем', () => {
  eq(ids(detectThemes('seasons and weather')), ['seasons'])
})
test('ё и регистр', () => {
  eq(ids(detectThemes('ЕДА и мебель, всё уютное')), ['decor', 'food'])
})
test('версия и загрузчик из текста', () => {
  eq(detectVersion('сборка на 1.20.1 forge'), '1.20.1')
  eq(detectVersion('новая 26.3 с модами'), '26.3')
  eq(detectVersion('без версии'), null)
  eq(detectLoader('хочу на фабрике fabric'), 'fabric')
  eq(detectLoader('neoforge 1.21'), 'neoforge')
  eq(detectLoader('Forge 1.20.1'), 'forge')
})
test('размер из текста', () => {
  eq(parse('огромная сборка').size, 'big')
  eq(parse('лёгкая сборка').size, 'light')
})

// --- выбор версии и групп ---
test('pickVersion предпочитает release', () => {
  eq(pickVersion([{ id: 'b', version_type: 'beta' }, { id: 'r', version_type: 'release' }]).id, 'r')
  eq(pickVersion([]), null)
})
test('группы по slug и названию', () => {
  eq(groupOf({ slug: 'sodium', title: 'Sodium' }), 'render')
  eq(groupOf({ slug: 'some-map', title: 'VoxelMap Updated' }), 'minimap')
  eq(groupOf({ slug: 'create', title: 'Create' }), null)
})

// --- подбор на подставных данных ---
function fakeApi(db) {
  return {
    async projects(list) { return list.map(id => db.projects[id]).filter(Boolean) },
    async versions(id) { return db.versions[id] || [] },
    async search(q) { return (db.search[q] || []).map(id => db.projects[id]) },
    async getJson() { return null },
    async loaderVersion() { return '0.16.0' },
  }
}
const P = (id, extra = {}) => ({ id, slug: id, title: id.toUpperCase(), categories: [], downloads: 100, client: 'required', server: 'optional', ...extra })
const V = (id, deps = [], type = 'release') => [{ id: `v-${id}`, version_number: '1.0', version_type: type, dependencies: deps,
  files: [{ primary: true, url: `https://cdn/${id}.jar`, filename: `${id}.jar`, size: 10, hashes: { sha1: 'a', sha512: 'b' } }] }]

test('зависимости подтягиваются по цепочке', async () => {
  const api = fakeApi({
    projects: { a: P('a'), lib1: P('lib1', { categories: ['library'] }), lib2: P('lib2', { categories: ['library'] }) },
    versions: { a: V('a', [{ project_id: 'lib1', dependency_type: 'required' }]), lib1: V('lib1', [{ project_id: 'lib2', dependency_type: 'required' }]), lib2: V('lib2') },
    search: {},
  })
  const b = new PackBuilder(api, { version: '1.20.1', loader: 'fabric' })
  eq(await b.tryAdd(P('a'), { id: 't' }, 'тест'), true)
  eq(b.mods().map(m => [m.project.id, m.dep]), [['a', false], ['lib1', true], ['lib2', true]])
})

test('мод без нужной зависимости не добавляется', async () => {
  const api = fakeApi({ projects: { a: P('a'), lib: P('lib') }, versions: { a: V('a', [{ project_id: 'lib', dependency_type: 'required' }]) }, search: {} })
  const b = new PackBuilder(api, { version: '1.20.1', loader: 'fabric' })
  eq(await b.tryAdd(P('a'), { id: 't' }, ''), false)
  eq(b.mods().length, 0)
  eq(b.skipped[0].why.includes('нет зависимости'), true)
})

test('несовместимые моды и группы', async () => {
  const api = fakeApi({
    projects: {},
    versions: { a: V('a', [{ project_id: 'b', dependency_type: 'incompatible' }]), b: V('b'), sodium: V('sodium'), embeddium: V('embeddium') },
    search: {},
  })
  const b = new PackBuilder(api, { version: '1.20.1', loader: 'fabric' })
  eq(await b.tryAdd(P('a'), { id: 't' }, ''), true)
  eq(await b.tryAdd(P('b'), { id: 't' }, ''), false, 'b объявлен несовместимым в a')
  eq(await b.tryAdd(P('sodium', { title: 'Sodium' }), { id: 't' }, ''), true)
  eq(await b.tryAdd(P('embeddium', { title: 'Embeddium' }), { id: 't' }, ''), false, 'второй рендер-мод')
})

test('нет версии под Minecraft — мод пропускается', async () => {
  const api = fakeApi({ projects: {}, versions: {}, search: {} })
  const b = new PackBuilder(api, { version: '1.20.1', loader: 'fabric' })
  eq(await b.tryAdd(P('x'), { id: 't' }, ''), false)
  eq(b.skipped.length, 1)
})

test('buildPack: база + темы в пределах бюджета', async () => {
  const projects = { sodium: P('sodium', { title: 'Sodium' }), lithium: P('lithium') }
  const versions = { sodium: V('sodium'), lithium: V('lithium') }
  const search = { magic: [], spells: [] }
  for (let i = 0; i < 20; i++) {
    projects[`m${i}`] = P(`m${i}`, { title: `Magic ${i}`, downloads: 100000 - i })
    versions[`m${i}`] = V(`m${i}`)
    search.magic.push(`m${i}`)
  }
  const api = fakeApi({ projects, versions, search })
  const pack = await buildPack({ version: '1.20.1', loader: 'fabric', size: 'light', perf: true, qol: false, themes: detectThemes('магия'), readMeta: async () => null }, api)
  eq(pack.mods.filter(m => m.section.id === 'magic').length, 8)
  eq(pack.mods.filter(m => m.section.id === 'perf').map(m => m.project.id), ['sodium', 'lithium'])
  eq(pack.mods.find(m => m.project.id === 'm0').reason, 'за «магия»')
})

test('малоизвестные и шуточные моды отсекаются', async () => {
  const projects = {
    good: P('good', { title: 'Dragon Mounts', downloads: 900000 }),
    tiny: P('tiny', { title: 'Tiny Dragons', downloads: 300 }),
    joke: P('joke', { title: 'DragonMine Z - Dragon Ball', downloads: 5000000 }),
  }
  const api = fakeApi({ projects, versions: { good: V('good'), tiny: V('tiny'), joke: V('joke') }, search: { dragons: ['tiny', 'joke', 'good'], dragon: [] } })
  const pack = await buildPack({ version: '1.20.1', loader: 'forge', size: 'light', perf: false, qol: false, themes: detectThemes('драконы'), readMeta: async () => null }, api)
  eq(pack.mods.map(m => m.project.id)[0], 'good')
  eq(pack.mods.some(m => m.project.id === 'tiny'), false)
})

// --- mrpack ---
test('индекс mrpack', () => {
  const idx = buildIndex({ name: 'X', summary: 's', version: '1.20.1', loader: 'fabric', loaderVersion: '0.16.0',
    mods: [{ project: { client: 'required', server: 'unsupported' }, file: { filename: 'a.jar', url: 'u', size: 5, hashes: { sha1: '1', sha512: '2' } }, version: { number: '1' } }] })
  eq(idx.dependencies, { minecraft: '1.20.1', 'fabric-loader': '0.16.0' })
  eq(idx.files[0], { path: 'mods/a.jar', hashes: { sha1: '1', sha512: '2' }, env: { client: 'required', server: 'unsupported' }, downloads: ['u'], fileSize: 5 })
})

test('серверная библиотека всё равно ставится на клиент', () => {
  const idx = buildIndex({ name: 'X', summary: 's', version: '1.21.1', loader: 'fabric', loaderVersion: '0.19.5',
    mods: [{ project: { client: 'unsupported', server: 'required' }, file: { filename: 'spa.jar', url: 'u', size: 5, hashes: { sha1: '1', sha512: '2' } }, version: { number: '1' } }] })
  eq(idx.files[0].env, { client: 'required', server: 'required' })
})

// --- что внутри jar ---
test('разбор fabric.mod.json', () => {
  const m = parseFabric(JSON.stringify({ id: 'wizards', provides: ['spell-power'], depends: { fabricloader: '*', 'structure_pool_api': '*', minecraft: '1.21.1' }, jars: [{ file: 'META-INF/jars/spell_engine-1.2.0+1.21.1.jar' }] }))
  eq(m.ids, ['wizards', 'spell_power'])
  eq(m.depends, ['fabricloader', 'structure_pool_api', 'minecraft'])
  eq(m.nested, ['spell_engine'])
})
test('вложенные jar: имя с загрузчиком в хвосте', () => {
  eq(nestedIds('META-INF/jars/xaerolib-fabric-1.21.1-1.1.0.jar'), ['xaerolib_fabric', 'xaerolib'])
  eq(nestedIds('META-INF/jarjar/structure_pool_api-1.2.0+1.21.1.jar'), ['structure_pool_api'])
  eq(nestedIds('META-INF/jars/quilted_fabric_api_lookup_api_v1-7.0.0+0.92.1-1.20.1.jar'), ['quilted_fabric_api_lookup_api_v1'])
  eq(nestedIds('META-INF/jars/fabric-api-base-0.4.42+6573ed8c19.jar'), ['fabric_api_base'])
  eq(nestedIds('META-INF/jars/foo_lib_1.2.0.jar'), ['foo_lib'])
})
test('разбор mods.toml: обязательные и необязательные зависимости', () => {
  const toml = `modLoader="javafml"\n[[mods]]\nmodId="beyond"\n[[dependencies.beyond]]\nmodId="forge"\nmandatory=true\n[[dependencies.beyond]]\n modId = "tensura"\n type="required"\n[[dependencies.beyond]]\nmodId="jei"\ntype="optional"\n[[dependencies.beyond]]\nmodId="curios"\nmandatory=false`
  const m = parseToml(toml)
  eq(m.ids, ['beyond'])
  eq(m.depends, ['forge', 'tensura'])
})
test('платформенные id не считаются недостающими', () => {
  eq(['minecraft', 'fabricloader', 'fabric-api-base', 'java', 'neoforge'].every(isPlatform), true)
  eq(isPlatform('fabric_api'), false)
  eq(isPlatform('structure_pool_api'), false)
})

test('проверка jar: библиотека добавляется, мод без зависимости убирается', async () => {
  const projects = {
    wiz: P('wiz', { title: 'Wizards' }), beyond: P('beyond', { title: 'Beyond Adventures' }),
    'structure-pool-api': P('spa-id', { slug: 'structure-pool-api', title: 'Structure Pool API', categories: ['library'] }),
  }
  projects['spa-id'] = projects['structure-pool-api']
  const api = fakeApi({ projects, versions: { wiz: V('wiz'), beyond: V('beyond'), 'spa-id': V('spa') }, search: {} })
  const metas = {
    'https://cdn/wiz.jar': { ids: ['wizards'], depends: ['minecraft', 'structure_pool_api'], nested: [] },
    'https://cdn/beyond.jar': { ids: ['beyond_gacha_c'], depends: ['tensura'], nested: [] },
    'https://cdn/spa.jar': { ids: ['structure_pool_api'], depends: [], nested: [] },
  }
  const b = new PackBuilder(api, { version: '1.21.1', loader: 'fabric' }, { readMeta: async url => metas[url] || null })
  await b.tryAdd(P('wiz', { title: 'Wizards' }), { id: 'rpg' }, '')
  await b.tryAdd(P('beyond', { title: 'Beyond Adventures' }), { id: 'adventure' }, '')
  await b.verifyJars()
  eq(b.mods().map(m => m.project.id).sort(), ['spa-id', 'wiz'])
  eq(b.skipped.some(s => s.title === 'Beyond Adventures' && s.why.includes('tensura')), true)
  eq(b.chosen.get('spa-id').parentId, 'wiz')
})

// --- запуск ---
let ok = 0
const out = document.getElementById('out')
for (const { name, fn } of results) {
  try {
    await fn()
    ok++
    const div = document.createElement('div')
    div.className = 'ok'
    div.textContent = `✔ ${name}`
    out.append(div)
  } catch (e) {
    const div = document.createElement('div')
    div.className = 'fail'
    div.textContent = `✘ ${name}: ${e.message}`
    out.append(div)
  }
}
document.getElementById('summary').textContent = `${ok} из ${results.length} тестов прошли`
window.testSummary = { ok, total: results.length }
