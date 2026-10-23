// «Доктор сборки»: по crash-report или логу находит, какие моды сборки виноваты в падении.
import { isPlatform, norm } from './jarmeta.js'

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
    if (/^\s*(Caused by:|Suppressed:|[\w.$]+(Exception|Error)\b)/.test(line)) { searching = true; continue }
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
  // кому нужны убранные моды — тоже убираем, иначе они не запустятся
  const removedIds = new Set([...culprits.values()].flatMap(c => (c.mod.ids || []).map(norm)))
  const dependents = []
  for (const m of mods) {
    if (culprits.has(m.project.id)) continue
    const need = (m.depends || []).map(norm).find(d => removedIds.has(d))
    if (need) dependents.push({ mod: m, why: `нужен убранный мод «${need}»` })
  }
  return { culprits: [...culprits.values()], dependents }
}
