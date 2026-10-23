// Мини-набор тестов: открыть tests.html через локальный сервер
import { THEME_BY_ID, analyze, parse, detectThemes, detectVersion, detectLoader } from './parser.js'
import { REFERENCES } from './references.js'
import { THEMES } from './themes.js'
import { diagnose, findCulprits } from './doctor.js'
import { INTENTS } from './intents.js'
import { COMFORT_OPTIONS } from './comfort-options.js'
import { PackBuilder, buildPack, groupOf, majorMinor, missingBase, pickVersion } from './builder.js'
import { buildIndex, mrpackBlob } from './mrpack.js'
import { isPlatform, nestedIds, parseFabric, parseToml } from './jarmeta.js'

const results = []
const test = (name, fn) => results.push({ name, fn })
const eq = (a, b, msg = '') => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}\nожидали ${JSON.stringify(b)}\nполучили ${JSON.stringify(a)}`)
}
const ids = found => found.map(f => f.theme.id)

// --- разбор описания ---
test('темы из русского описания со словоформами', () => {
  eq(ids(detectThemes('Хардкорное выживание с магией и драконами')).filter(i => ['magic', 'dragons', 'hardcore'].includes(i)), ['magic', 'dragons', 'hardcore'])
})
test('английское описание', () => {
  eq(ids(detectThemes('tech pack with machines and space rockets')), ['tech', 'space'])
})
test('seasons не считается морем', () => {
  eq(ids(detectThemes('seasons and weather')).includes('ocean'), false)
})
test('ё и регистр', () => {
  eq(ids(detectThemes('ЕДА и мебель, всё уютное')).filter(i => ['decor', 'food'].includes(i)), ['decor', 'food'])
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

// --- «отстал от библиотеки» и «дополнение без основы» ---
test('majorMinor без версии Minecraft', () => {
  eq(majorMinor('1.10.9+1.21.1-fabric', '1.21.1'), '1.10')
  eq(majorMinor('1.8.0+1.21.1-fabric', '1.21.1'), '1.8')
  eq(majorMinor('fabric-1.21.1-26.6.0', '1.21.1'), '26.6')
})
test('дополнение к Cobblemon без Cobblemon не берётся', () => {
  const chosen = new Map()
  eq(missingBase({ slug: 'cobbleboss', title: 'CobbleBoss', description: 'Bosses in the Cobblemon world.' }, chosen), 'Cobblemon')
  chosen.set('c', { project: { slug: 'cobblemon' } })
  eq(missingBase({ slug: 'cobbleboss', title: 'CobbleBoss', description: 'Bosses in the Cobblemon world.' }, chosen), null)
  eq(missingBase({ slug: 'wizards', title: 'Wizards (RPG Series)', description: 'Wizard spells' }, new Map()), null)
})
test('мод, отставший от своей библиотеки, убирается', async () => {
  const ver = (id, number, date) => ({ id: `v-${id}-${number}`, version_number: number, version_type: 'release', date_published: date, dependencies: [],
    files: [{ primary: true, url: `https://cdn/${id}.jar`, filename: `${id}.jar`, size: 10, hashes: { sha1: 'a', sha512: 'b' } }] })
  const versions = {
    se: [ver('se', '1.10.9+1.21.1-fabric', '2026-09-29'), ver('se', '1.9.0+1.21.1-fabric', '2026-02-28'), ver('se', '1.8.0+1.21.1-fabric', '2025-09-20')],
    mb: [ver('mb', '1.7.0+1.21.1', '2025-10-15')],
    wiz: [ver('wiz', '3.1.3+1.21.1', '2026-10-01')],
  }
  const api = fakeApi({ projects: {}, versions, search: {} })
  const metas = {
    'https://cdn/se.jar': { ids: ['spell_engine'], depends: [], nested: [] },
    'https://cdn/mb.jar': { ids: ['rpg_minibosses'], depends: ['spell_engine'], nested: [] },
    'https://cdn/wiz.jar': { ids: ['wizards'], depends: ['spell_engine'], nested: [] },
  }
  const b = new PackBuilder(api, { version: '1.21.1', loader: 'fabric' }, { readMeta: async url => metas[url] || null })
  await b.tryAdd(P('se', { title: 'Spell Engine' }), { id: 'magic' }, '')
  await b.tryAdd(P('mb', { title: 'RPG Minibosses' }), { id: 'bosses' }, '')
  await b.tryAdd(P('wiz', { title: 'Wizards' }), { id: 'magic' }, '')
  await b.verifyJars()
  eq(b.mods().map(m => m.project.id).sort(), ['se', 'wiz'])
  eq(b.skipped.find(s => s.title === 'RPG Minibosses').why.includes('1.8'), true)
})

// --- понимание запроса v2 ---
test('отрицание: «но без хоррора»', () => {
  const a = analyze('магия и драконы, но без хоррора')
  eq(a.themes.map(t => t.theme.id).filter(id => ['magic', 'dragons'].includes(id)).sort(), ['dragons', 'magic'])
  eq(a.excluded.map(t => t.id).includes('horror'), true)
  eq(a.themes.some(t => t.theme.id === 'horror'), false)
})
test('отрицание списком и «не хочу»', () => {
  eq(analyze('без магии и драконов').excluded.map(t => t.id).sort().filter(i => ['magic', 'dragons'].includes(i)), ['dragons', 'magic'])
  eq(analyze('хочу технологии, не хочу зомби').excluded.map(t => t.id).includes('zombies'), true)
  eq(analyze('хочу технологии, не хочу зомби').themes.some(t => t.theme.id === 'tech'), true)
  eq(analyze('no magic, just tech').excluded.map(t => t.id).includes('magic'), true)
})
test('отсылка «как в Скайриме»', () => {
  const a = analyze('хочу как в скайриме')
  eq(a.references.map(r => r.label), ['Skyrim'])
  for (const id of ['fantasy', 'dragons', 'rpg']) eq(a.themes.some(t => t.theme.id === id), true, id)
})
test('нет ложных срабатываний', () => {
  const ids = text => analyze(text).themes.map(t => t.theme.id)
  eq(ids('сборка про космос').includes('weapons'), false, 'космос ≠ коса')
  eq(ids('классная сборка').includes('classes'), false, 'классная ≠ классы')
  eq(ids('деревня у реки').includes('forest'), false, 'деревня ≠ деревья')
  eq(ids('по адресу').includes('nether'), false, 'адрес ≠ ад')
})
test('все отсылки ведут на существующие темы, id тем уникальны', () => {
  const missing = REFERENCES.flatMap(([, , ids]) => ids).filter(id => !THEME_BY_ID.has(id))
  eq(missing, [])
  eq(new Set(THEMES.map(t => t.id)).size, THEMES.length)
  eq(THEMES.length >= 120, true, `тем всего ${THEMES.length}`)
})

// --- намерения и опечатки ---
test('намерения: слабый пк, новичок, с другом', () => {
  const a = parse('хочу сборку для слабого пк чтобы не лагало')
  eq(a.size, 'light')
  eq(a.settings.perf, true)
  const b = analyze('сборка для новичка с другом')
  eq(b.intents.includes('Для новичка') && b.intents.includes('С друзьями'), true)
  eq(b.excluded.some(t => t.id === 'hardcore'), true)
  eq(parse('только оптимизация').settings.onlyBase, true)
})
test('для ребёнка: без хоррора и зомби', () => {
  const a = analyze('сборка для ребенка')
  eq(['horror', 'zombies'].every(id => a.excluded.some(t => t.id === id)), true)
})
test('опечатки распознаются', () => {
  const ids = text => analyze(text).themes.map(t => t.theme.id)
  eq(ids('хардкорр выживание').includes('hardcore'), true)
  eq(ids('мнго драконв').includes('dragons'), true)
  eq(ids('техналогии и автамотизация').includes('tech'), true)
})
test('живые запросы: без промахов', () => {
  const ids = text => analyze(text).themes.map(t => t.theme.id)
  eq(ids('выживание с другом на 1.20.1 forge').includes('canyons'), false, 'forge ≠ gorge')
  eq(parse('только оптимизация больше фпс').size, 'light', '«больше» ≠ большая сборка')
  eq(ids('реалистичная графика и шейдеры').includes('hardcore'), false, 'реалистичная ≠ хардкор')
  eq(ids('хочу играть за мага').includes('magic'), true, 'мага → магия')
  eq(ids('хочу в магазин').includes('magic'), false, 'магазин ≠ магия')
  eq(parse('огромная сборка').size, 'big')
})
test('частые слова не становятся темами', () => {
  const a = analyze('хочу интересную сборку чтобы было интересно играть пожалуйста')
  eq(a.themes.filter(t => t.via === 'опечатка').map(t => t.word), [])
})
test('у тем чистые id и поисковые запросы', () => {
  eq(THEMES.filter(t => !/^[a-z_]+$/.test(t.id)).map(t => t.id), [])
  eq(THEMES.filter(t => t.queries.some(q => q.includes('='))).map(t => t.id), [])
  eq(THEMES.filter(t => !t.queries.length).map(t => t.id), [])
})
test('320+ тем, у всех намерений существующие темы', () => {
  eq(THEMES.length >= 320, true, `тем ${THEMES.length}`)
  const bad = INTENTS.flatMap(i => [...(i.themes || []), ...(i.exclude || [])]).filter(id => !THEME_BY_ID.has(id))
  eq(bad, [])
})
test('«только оптимизация» не добавляет тематических модов', async () => {
  const projects = { sodium: P('sodium', { title: 'Sodium' }) }
  const api = fakeApi({ projects, versions: { sodium: V('sodium') }, search: {} })
  const pack = await buildPack({ version: '1.21.1', loader: 'fabric', size: 'light', perf: true, qol: false, themes: [], onlyBase: true, readMeta: async () => null }, api)
  eq(pack.mods.map(m => m.project.id), ['sodium'])
})
test('комфортные настройки: без сервера и ресурспаков, кладутся в overrides', async () => {
  eq(/^(lastServer|resourcePacks|soundDevice|version):/m.test(COMFORT_OPTIONS), false)
  eq(COMFORT_OPTIONS.includes('renderDistance:32') && COMFORT_OPTIONS.includes('lang:ru_ru'), true)
  const zip = await window.JSZip.loadAsync(await mrpackBlob({ files: [] }, window.JSZip, COMFORT_OPTIONS))
  eq(await zip.file('overrides/options.txt').async('string'), COMFORT_OPTIONS)
  const plain = await window.JSZip.loadAsync(await mrpackBlob({ files: [] }, window.JSZip, null))
  eq(plain.file('overrides/options.txt'), null)
})

// --- эталонная оптимизация ---
test('база оптимизации берётся из эталонной сборки, плюс моды для чанков', async () => {
  const projects = {}
  const versions = {}
  for (const s of ['sodium', 'lithium', 'zoomify', 'c2me-fabric', 'noisium', 'scalablelux', 'badoptimizations']) { projects[s] = P(s); versions[s] = V(s) }
  const api = fakeApi({ projects, versions, search: {} })
  const loadRef = async () => ({ name: 'Fabulously Optimized', license: 'BSD-3-Clause', version: '6.5.0', slugs: ['sodium', 'lithium', 'zoomify'], configs: [{ path: 'config/sodium-options.json', data: new Uint8Array([123, 125]) }] })
  const pack = await buildPack({ version: '1.21.1', loader: 'fabric', size: 'light', perf: true, qol: false, themes: [], onlyBase: true, loadRef, readMeta: async () => null }, api)
  eq(pack.mods.map(m => m.project.id), ['sodium', 'lithium', 'zoomify', 'c2me-fabric', 'noisium', 'scalablelux', 'badoptimizations'])
  eq(pack.mods[0].section.label, 'Оптимизация (как в Fabulously Optimized)')
  eq(pack.mods.find(m => m.project.id === 'noisium').reason, 'быстрая прогрузка чанков')
  const zip = await window.JSZip.loadAsync(await mrpackBlob({ files: [] }, window.JSZip, null, pack.ref))
  eq(!!zip.file('overrides/config/sodium-options.json') && !!zip.file('overrides/config/modsmith-credits.txt'), true)
})

// --- доктор ---
test('доктор находит оба виновника из настоящего crash-report', () => {
  const crash = `java.lang.RuntimeException: Could not execute entrypoint stage 'main' due to errors, provided by 'cobbleboss' at 'com.cobbleboss.CobbleBoss'!
	at net.fabricmc.loader.impl.FabricLoaderImpl.lambda$invokeEntrypoints$0(FabricLoaderImpl.java:413)
	Suppressed: java.lang.NoClassDefFoundError: net/spell_engine/api/config/ConfigFile$Equipment
		at knot//com.cleannrooster.rpg_minibosses.config.Default.<clinit>(Default.java:16)
		at knot//com.cleannrooster.rpg_minibosses.RPGMinibosses.<clinit>(RPGMinibosses.java:107)
Caused by: java.lang.NoClassDefFoundError: com/cobblemon/mod/common/battles/dispatch/InterpreterInstruction
	at java.base/java.lang.Class.forName0(Native Method)`
  const mods = [
    { project: { id: 'a', title: 'CobbleBoss', slug: 'cobbleboss' }, ids: ['cobbleboss'], depends: [] },
    { project: { id: 'b', title: 'ANARCHY RPG', slug: 'anarchy-rpg' }, ids: ['rpg_minibosses'], depends: ['spell_engine'] },
    { project: { id: 'c', title: 'Spell Engine', slug: 'spell-engine' }, ids: ['spell_engine'], depends: [] },
    { project: { id: 'd', title: 'Addon', slug: 'addon' }, ids: ['addon'], depends: ['rpg_minibosses'] },
  ]
  const d = diagnose(crash, mods)
  eq(d.culprits.map(c => c.mod.project.id).sort(), ['a', 'b'])
  eq(d.dependents.map(c => c.mod.project.id), ['d'])
})
test('доктор не винит моды за безобидные предупреждения mixin', () => {
  const log = `[WARN]: Method overwrite conflict for method_21740 in modernfix-common.mixins.json:BiomeMixin from mod modernfix, previously written by lithium. Skipping method.
[ERROR]: Mixin apply failed sdmshop.mixins.json:TextFieldMixin from mod sdmshop`
  eq(findCulprits(log).map(c => c.id), ['sdmshop'])
})
test('доктор понимает latest.log нового загрузчика (knot/ и имя jar)', () => {
  const log = `org.ladysnake.cca.internal.base.asm.StaticComponentLoadingException: Exception while registering static component factories for Destroying Minecraft (destroying-minecraft)
	at knot/org.ladysnake.cca.internal.base.asm.StaticComponentPluginBase.processInitializers(StaticComponentPluginBase.java:171) ~[cardinal-components-base-6.1.2.jar:?]
Caused by: java.lang.NoClassDefFoundError: x/y/Z
	at knot/com.sp.cca.InitializeComponents.registerEntityComponentFactories(InitializeComponents.java:30) ~[destroying-minecraft-1.0.0.jar:?]`
  const mods = [
    { project: { id: 'd', title: 'Destroying Minecraft', slug: 'destroying-minecraft' }, ids: ['destroying_minecraft'], depends: [], file: { filename: 'destroying-minecraft-1.0.0.jar' } },
    { project: { id: 'c', title: 'Cardinal Components', slug: 'cardinal-components-api' }, ids: ['cardinal_components'], depends: [], file: { filename: 'cardinal-components-api-6.1.2.jar' } },
  ]
  eq(diagnose(log, mods).culprits.map(c => c.mod.project.id), ['d'])
})
test('доктор понимает окно «Incompatible mods found»', () => {
  const text = "Mod 'Wizards (RPG Series)' (wizards) 3.1.3+1.21.1 requires any version of structure_pool_api, which is missing!"
  eq(findCulprits(text).map(c => c.id), ['wizards'])
})

test('чёрный список и «без темы» в подборе', async () => {
  const api = fakeApi({ projects: {}, versions: { m1: V('m1'), bad: V('bad') }, search: {} })
  const b = new PackBuilder(api, { version: '1.21.1', loader: 'fabric', excluded: [THEME_BY_ID.get('magic')], blocked: { bad: 'сломан' } })
  eq(await b.tryAdd(P('bad'), { id: 't' }, ''), false)
  eq(await b.tryAdd(P('m1', { title: 'Magic Wands', categories: ['magic'] }), { id: 't' }, ''), false)
  eq(b.skipped.map(s => s.why), ['сломан', 'вы просили без темы «Магия»'])
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
