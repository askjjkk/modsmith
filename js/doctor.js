// «Доктор сборки»: по crash-report или логу находит, какие моды сборки виноваты в падении.
import { isPlatform, norm } from './jarmeta.js'
import { wrongMcInFilename } from './versions.js'

const IGNORE_PKG = new Set(['net', 'com', 'org', 'io', 'dev', 'me', 'java', 'javax', 'jdk', 'sun', 'knot', 'minecraft',
  'fabricmc', 'mojang', 'impl', 'api', 'common', 'client', 'server', 'mixin', 'mixins', 'core', 'util', 'utils', 'github',
  'spongepowered', 'neoforged', 'minecraftforge', 'fml', 'loader', 'main', 'mod', 'lang', 'reflect', 'base'])

/** Возвращает [{ id, why }] — id модов (как внутри jar), которые упали или вызвали падение */
export function findCulprits(text) {
  const found = new Map()
  const add = (id, why) => { const n = norm(id); if (n && !isPlatform(n) && !found.has(n)) found.set(n, why) }

  for (const m of text.matchAll(/provided by '([^']+)'/g)) add(m[1], 'упал при запуске игры')
  for (const m of text.matchAll(/Exception while [^(\n]+\(([a-z0-9_-]+)\)/g)) add(m[1], 'упал при запуске игры')
  for (const m of text.matchAll(/Mod '([^']+)' \(([^)]+)\) \S+ requires (?:version \S+ or later of |any version of |version \S+ of )?(\S+?),? which is missing/g)) {
    add(m[2], `ему нужен «${m[3]}», которого нет`)
  }
  for (const m of text.matchAll(/Requested by: '([^']+)'/g)) add(m[1], 'не хватает обязательной зависимости')
  // «from mod X» бывает и в безобидных предупреждениях — виним только строки с настоящей ошибкой встраивания
  for (const line of text.split(/\r?\n/)) {
    if (!/ERROR|Mixin apply failed|MixinApplyError|InvalidInjection|Critical injection/.test(line)) continue
    for (const m of line.matchAll(/(?:from mod|by mod) '?([a-z0-9_\-]+)'?/gi)) add(m[1], 'ошибка при встраивании в игру (mixin)')
  }
  for (const m of text.matchAll(/Mod (?:ID|File)?:? ?'?([a-z0-9_\-]+)'? .*?(?:failed|crashed|errored)/gi)) add(m[1], 'сломался при загрузке')
  return [...found.entries()].map(([id, why]) => ({ id, why }))
}

/**
 * Сопоставляет crash-report со сборкой.
 * mods: [{ project, ids: [...], depends: [...] }]. Возвращает { culprits: [{ mod, why }], dependents: [{ mod, why }] }
 */
export function diagnose(text, mods) {
  const byId = new Map()
  for (const m of mods) for (const id of m.ids || []) byId.set(norm(id), m)
  const culprits = new Map()
  for (const { id, why } of findCulprits(text)) {
    const mod = byId.get(id)
    if (mod) culprits.set(mod.project.id, { mod, why })
  }
  // в каждом блоке ошибки (основная, «Caused by:», «Suppressed:») первая строка стека из кода мода — виновник
  let searching = false
  for (const line of text.split(/\r?\n/)) {
    // «файл не найден» — мод просто создаёт свои настройки, это не падение
    if (/^\s*(Caused by:|Suppressed:|[\w.$]+(Exception|Error)\b)/.test(line)) { searching = !/FileNotFoundException|NoSuchFileException/.test(line); continue }
    if (!searching) continue
    const frame = line.match(/^\s*at (?:knot\/{1,2})?([a-zA-Z_][\w.$<>]+)\(/)
    if (!frame) continue
    // в latest.log у строки стека есть имя файла мода: «~[destroying-minecraft-1.0.0.jar:?]»
    const jar = line.match(/\[([^[\]]+\.jar)/)?.[1]
    const byFile = jar && mods.find(m => m.file?.filename === jar)
    if (byFile) {
      if (!culprits.has(byFile.project.id)) culprits.set(byFile.project.id, { mod: byFile, why: 'его код упал (видно по стеку ошибки)' })
      searching = false
      continue
    }
    const mod = frame[1].split('.').slice(0, -1).map(norm).filter(s => s.length > 2 && !IGNORE_PKG.has(s)).map(s => byId.get(s)).find(Boolean)
    if (mod) {
      if (!culprits.has(mod.project.id)) culprits.set(mod.project.id, { mod, why: 'его код упал (видно по стеку ошибки)' })
      searching = false
    }
  }
  // то, что нашёл полный разбор лога (не тот файл, нет библиотеки, дубль встраивания) — сопоставляем со сборкой
  const exam = examineLog(text)
  for (const p of exam.problems) {
    const mod = mods.find(m => p.files.includes(m.file?.filename) || p.ids.some(id => (m.ids || []).includes(norm(id))))
    if (mod && !culprits.has(mod.project.id)) culprits.set(mod.project.id, { mod, why: p.why })
  }
  if (/already exists on config lithium/.test(text)) {
    for (const m of mods) {
      if (/^(radium|canary)/.test(m.project.slug) && !culprits.has(m.project.id)) culprits.set(m.project.id, { mod: m, why: 'копия Lithium: вдвоём с ним игра падает' })
    }
  }
  // кому нужны убранные моды — тоже убираем, иначе они не запустятся
  const removedIds = new Set([...culprits.values()].flatMap(c => (c.mod.ids || []).map(norm)))
  const dependents = []
  for (const m of mods) {
    if (culprits.has(m.project.id)) continue
    const need = (m.depends || []).map(norm).find(d => removedIds.has(d))
    if (need) dependents.push({ mod: m, why: `нужен убранный мод «${need}»` })
  }
  return { culprits: [...culprits.values()], dependents, problems: exam.problems, hints: exam.hints, mc: exam.mc, logMods: exam.mods }
}

// ---------- разбор лога без собранной сборки ----------

/** Версия Minecraft из лога или crash-report */
export function mcFromLog(text) {
  return text.match(/Minecraft Version:\s*([\d.]+)/)?.[1]
    || text.match(/Loading Minecraft ([\d.]+)/)?.[1]
    || text.match(/--fml\.mcVersion,\s*([\d.]+)/)?.[1]
    || text.match(/minecraft@([\d.]+)/)?.[1]
    || text.match(/\bmc(1\.\d+(?:\.\d+)?)\b/)?.[1]
    || null
}

/** Моды, которые видно в логе: [{ id, name, version, file }] (Fabric, NeoForge/Forge, crash-report) */
export function modsFromLog(text) {
  const out = new Map()
  const put = (id, name, version, file) => {
    const key = norm(id || file)
    if (!key || isPlatform(key)) return
    const m = out.get(key) || {}
    out.set(key, { id: norm(id || m.id || ''), name: name || m.name || id, version: version || m.version, file: file || m.file })
  }
  // NeoForge/Forge latest.log: «\t\tWhen Dungeons Arise 2.1.68 (dungeons_arise)»
  for (const m of text.matchAll(/^\t\t(\S.*?) (\S+) \(([a-z0-9_\-]+)\)\s*$/gm)) put(m[3], m[1], m[2])
  // Forge crash-report: «file.jar |Name |modid |version |…»
  for (const m of text.matchAll(/^\s*(\S+\.jar)\s*\|([^|]+)\|([a-z0-9_\-]+)\s*\|([^|]+)\|/gm)) put(m[3], m[2].trim(), m[4].trim(), m[1])
  // Fabric latest.log: «\t- modid 1.2.3»
  const fab = text.indexOf('Loading ') >= 0 ? text.slice(text.search(/Loading \d+ mods:/)) : ''
  for (const m of fab.matchAll(/^\t- ([a-z0-9_\-]+) (\S+)/gm)) put(m[1], null, m[2])
  // Fabric crash-report: «\t\tmodid: Name 1.2.3»
  for (const m of text.matchAll(/^\t\t([a-z0-9_\-]+): (.+?) (\S+)$/gm)) put(m[1], m[2], m[3])
  // имена файлов из папки mods
  for (const m of text.matchAll(/mods[\\/]([^\\/\s"'|]+\.jar)/g)) {
    if (![...out.values()].some(x => x.file === m[1])) put(null, m[1], null, m[1])
  }
  return [...out.values()]
}

// Опасные пары: вместе ломают игру или вешают создание мира (проверено на настоящих сборках)
const RISKY = [
  [['lithium', 'radium'], 'Lithium и Radium — один и тот же мод (Radium — его порт). Вдвоём игра падает на старте: оставьте только Lithium.'],
  [['lithium', 'canary'], 'Lithium и Canary — один и тот же мод. Оставьте один.'],
  [['c2me', 'scalablelux'], 'C2ME и ScalableLux вместе вешают создание мира на 0%. Уберите C2ME (на NeoForge он ещё в альфе).'],
  [['saturn', 'modernfix'], 'Saturn спорит с ModernFix и Lithium (одни и те же исправления). Уберите Saturn.'],
]
const BIOME_MODS = ['terralith', 'biomesoplenty', 'biomeswevegone', 'byg', 'regions_unexplored', 'wwoo']

/**
 * Полный разбор лога: что сломалось, как починить, и подозрительное, если явной ошибки нет.
 * Возвращает { problems: [{ title, why, fix, ids, files }], hints: [строки], mc, mods }
 */
export function examineLog(text) {
  const mc = mcFromLog(text)
  const mods = modsFromLog(text)
  const has = id => mods.some(m => m.id === norm(id) || m.id.startsWith(norm(id)))
  const problems = []
  const add = (title, why, fix, extra = {}) => {
    if (!problems.some(p => p.title === title)) problems.push({ title, why, fix, ids: [], files: [], ...extra })
  }

  for (const m of text.matchAll(/File (?:mods[\\/])?([^\s]+\.jar) is not a valid mod file|InvalidModFileException:[^\n]*?([^\s\\/]+\.jar)/g)) {
    const file = (m[1] || m[2]).split(/[\\/]/).pop()
    add(file, 'игра не может прочитать этот файл: он сделан под другую версию игры или загрузчика',
      `Удалите ${file} из папки mods или скачайте версию под ${mc || 'вашу версию игры'}.`, { files: [file] })
  }
  for (const m of text.matchAll(/Failed to create mod instance\. ModID: ([a-z0-9_\-]+)[\s\S]{0,600}?(?:NoClassDefFoundError|ClassNotFoundException):? ([\w/.$]+)/g)) {
    const lib = m[2].split(/[/.]/)[0]
    add(m[1], `ему не хватает библиотеки (не найден класс ${m[2].replace(/\//g, '.')})`,
      `Доустановите библиотеку «${lib}» под ${mc || 'вашу версию'} или удалите мод ${m[1]}.`, { ids: [m[1]] })
  }
  for (const m of text.matchAll(/Failed to register automatic subscribers\. ModID: ([a-z0-9_\-]+)[\s\S]{0,400}?(?:NoClassDefFoundError|ClassNotFoundException):? ([\w/.$]+)/g)) {
    const base = m[2].split(/[/.]/).slice(0, 2).join('.')
    add(m[1], `сделан под другую версию основного мода (не найден ${m[2].replace(/\//g, '.')})`,
      `Обновите основной мод (${base}) или удалите ${m[1]}.`, { ids: [m[1]] })
  }
  for (const m of text.matchAll(/^\s*- (.+?) \(([a-z0-9_\-]+)\) has failed to load correctly\s*\n\s*(.+)/gm)) {
    const client = /invalid dist/.test(m[3])
    add(m[1], client ? 'это мод только для игры, а его поставили на сервер' : 'не смог загрузиться',
      client ? `Уберите ${m[1]} с сервера (в самой игре он работает).` : `Обновите или удалите ${m[1]}.`, { ids: [m[2]] })
  }
  for (const m of text.matchAll(/Modules (\S+) and (\S+) export package ([\w.]+)/g)) {
    const dup = [m[1], m[2]].filter(x => x.toLowerCase() !== 'mixinextras')
    add(dup.join(' и '), `оба несут внутри одну и ту же библиотеку (${m[3]})`, `Удалите ${dup[0]} или обновите его.`, { ids: dup })
  }
  for (const m of text.matchAll(/Mixin \[([\w.-]+?)\.mixins\.json:[^\]]*\][^\n]*?FAILED/g)) {
    const mod = m[1].split(/[-.]/)[0]
    add(mod, 'не смог встроиться в игру: эту же часть игры уже меняет другой мод (часто — мод оптимизации)',
      `Удалите ${mod} или моды оптимизации, которые трогают то же самое (Lithium/Radium/Canary).`, { ids: [mod] })
  }
  for (const m of text.matchAll(/Decoration with key '[^']+' already exists on config ([\w.-]+)/g)) {
    const base = m[1].replace(/\.mixins?\.json$/, '').split('.')[0]
    add(`${base} (два раза)`, `два мода меняют игру одним и тем же файлом ${m[1]}: это один мод и его копия-порт`,
      base === 'lithium' ? 'Удалите Radium или Canary, оставьте Lithium.' : `Найдите в папке mods два мода про «${base}» и оставьте один.`)
  }
  for (const m of text.matchAll(/Mod ID: '([^']+)', Requested by: '([^']+)', Expected range: '([^']*)', Actual version: '([^']*)'/g)) {
    add(m[2], `ему нужен «${m[1]}» версии ${m[3]}, а стоит ${m[4] === '[MISSING]' ? 'ничего' : m[4]}`,
      `Доустановите «${m[1]}» нужной версии или удалите ${m[2]}.`, { ids: [m[2]] })
  }
  for (const m of text.matchAll(/Mod '([^']+)' \(([^)]+)\) \S+ requires (?:version \S+ or later of |any version of |version \S+ of )?(\S+?),? which is missing/g)) {
    add(m[1], `ему нужен «${m[3]}», которого нет`, `Доустановите «${m[3]}» или удалите ${m[1]}.`, { ids: [m[2]] })
  }
  for (const m of text.matchAll(/Mod '([^']+)' \(([^)]+)\) \S+ is incompatible with[^\n]*?'([^']+)' \(([^)]+)\)/g)) {
    add(m[1], `несовместим с ${m[3]}`, `Оставьте один из двух: ${m[1]} или ${m[3]}.`, { ids: [m[2]] })
  }
  // «Found 2 mods for first modid X» (NeoForge), «Duplicate mods found» (Fabric)
  for (const m of text.matchAll(/Found \d+ mods for first modid ([a-z0-9_\-]+)|(?:Found (?:\d+ )?duplicate mods?|Duplicate mods? found)/gi)) {
    add(`копии мода${m[1] ? ` ${m[1]}` : ''}`, 'один и тот же мод лежит в папке mods два раза', 'Оставьте один файл (самый новый).', { ids: m[1] ? [m[1]] : [] })
  }
  if (/UnsupportedClassVersionError|class file version (6[5-9]|7\d)/.test(text)) {
    add('Java', 'мод требует более новую Java, чем у лаунчера', `Для Minecraft ${mc || '1.20.5+'} нужна Java 21: выберите её в настройках профиля.`)
  }
  if (/OutOfMemoryError|GC overhead limit exceeded/.test(text)) {
    add('Память', 'игре не хватило оперативной памяти', `Выделите больше памяти в настройках профиля: для ${mods.length || 'этой'} модов — ${ramFor(mods.length)} ГБ.`)
  }
  // мод под чужую версию игры по имени файла
  if (mc) {
    for (const m of mods) {
      const wrong = m.file && wrongMcInFilename(m.file, mc)
      if (wrong) add(m.file, `файл сделан под Minecraft ${wrong}, а игра ${mc}`, `Замените ${m.file} версией под ${mc}.`, { files: [m.file], ids: m.id ? [m.id] : [] })
    }
  }

  const hints = []
  for (const [pair, tip] of RISKY) if (pair.every(has)) hints.push(tip)
  const biomes = BIOME_MODS.filter(has)
  if (biomes.length >= 2) hints.push(`Сразу ${biomes.length} больших мода на биомы (${biomes.join(', ')}): из-за них создание мира может зависнуть на 0%. Оставьте один.`)
  if (has('logbegone') || has('log_begone')) hints.push('Стоит Log Begone: он прячет ошибки из лога. Уберите его, чтобы было видно настоящую причину.')
  if (/to a broken mod state/.test(text)) hints.push('Ошибки про модели и звуки («broken mod state») — только последствие. Настоящая причина — первая ошибка выше по логу.')
  return { problems, hints, mc, mods }
}

export const ramFor = n => (n > 200 ? 10 : n > 120 ? 8 : n > 60 ? 6 : 4)
