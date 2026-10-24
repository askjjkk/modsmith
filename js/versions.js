// Версии: «подходит ли мод к этой версии Minecraft» — по описанию внутри jar и по имени файла.

// «1.21.1» -> [1, 21, 1]; хвосты вроде «-pre1», «+build» и «.x» отбрасываем
const parts = v => String(v).trim().split(/[-+]/)[0].replace(/\.x$/i, '').split('.').map(n => parseInt(n, 10)).filter(n => !Number.isNaN(n))

export function cmpVer(a, b) {
  const x = parts(a), y = parts(b)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0)
    if (d) return d < 0 ? -1 : 1
  }
  return 0
}

// Диапазон Maven из mods.toml: «[1.21,1.21.2)», «[1.21.1]», «[1.20,)», «[1.0,2.0),[3.0,)». Просто «1.21» — «от 1.21».
// upperInclusive: NeoForge на деле пускает мод с «[1.21,1.21.1)» на 1.21.1 (проверено запуском When Dungeons Arise)
export function inMavenRange(range, v, { upperInclusive = false } = {}) {
  const sets = String(range).match(/[[(][^\])]*[\])]/g)
  if (!sets) return !range.trim() || range.trim() === '*' || cmpVer(v, range) >= 0
  return sets.some(set => {
    const [lo, hi = lo] = set.slice(1, -1).split(',').map(s => s.trim())
    const single = !set.includes(',')
    if (single) return cmpVer(v, lo) === 0
    if (lo && (set[0] === '[' ? cmpVer(v, lo) < 0 : cmpVer(v, lo) <= 0)) return false
    if (hi && (set.at(-1) === ']' || upperInclusive ? cmpVer(v, hi) > 0 : cmpVer(v, hi) >= 0)) return false
    return true
  })
}

// Условие Fabric: «>=1.21 <1.21.2», «~1.21.1», «1.21.x», «*»; массив — «любое из»
export function inFabricRange(pred, v) {
  if (Array.isArray(pred)) return !pred.length || pred.some(p => inFabricRange(p, v))
  return String(pred).trim().split(/\s+/).every(term => {
    if (!term || term === '*') return true
    const m = term.match(/^(>=|<=|>|<|=|~|\^)?(.+)$/)
    const [, op = '=', ver] = m
    const p = parts(ver)
    if (!p.length) return true // непонятное условие (снапшот) — не мешаем
    const c = cmpVer(v, ver)
    if (op === '>=') return c >= 0
    if (op === '<=') return c <= 0
    if (op === '>') return c > 0
    if (op === '<') return c < 0
    if (op === '~') return c >= 0 && cmpVer(v, `${p[0]}.${(p[1] || 0) + 1}`) < 0
    if (op === '^') return c >= 0 && cmpVer(v, `${p[0] + 1}`) < 0
    // «1.21.x» и «1.21» без оператора: совпадение начала
    if (/\.x$/i.test(ver)) return sameFamily(v, ver.replace(/\.x$/i, ''))
    return c === 0
  })
}

/**
 * Подходит ли версия v под условие из описания мода — так же мягко, как проверяет сама игра.
 * kind: 'maven' (mods.toml) или 'fabric'. Бывает, что в mods.toml записано условие в стиле Fabric («>=1.21 <=1.21.1»).
 */
export function rangeFits(range, kind, v, mc = null) {
  if (range == null || range === '') return true
  // «[1.20.1-2,1.20.1-3)» — версии с приставкой игры: сравниваем без неё (Iron's Lib, Farmer's Delight)
  if (mc && typeof range === 'string') range = range.split(`${mc}-`).join('')
  if (kind === 'maven' && !Array.isArray(range)) {
    if (/[[(]/.test(range)) return inMavenRange(range, v, { upperInclusive: true })
    if (/[<>=~^*]|\.x\b/.test(range)) return inFabricRange(range, v)
    return inMavenRange(range, v)
  }
  return inFabricRange(range, v)
}

// Версии Minecraft в имени файла: «…-1.21.5-1.4.jar» -> [«1.21.5»], «Structory_Towers_26.2_v1.0.17» -> [«26.2»]
export function mcInFilename(name) {
  const out = []
  for (const m of String(name).matchAll(/(?<![\d.])(1\.(?:1[2-9]|2\d)(?:\.\d{1,2})?|2[5-9]\.\d{1,2}(?:\.\d{1,2})?)(\.x)?(?![\d])/g)) {
    out.push(m[2] ? m[1] : m[1].replace(/\.0$/, ''))
  }
  return out
}

// «1.21» — семейство для «1.21.1»; «1.21.5» — нет
const sameFamily = (target, mention) => target === mention || target.startsWith(`${mention}.`)

/**
 * Файл явно сделан под другую версию игры: в имени есть версии Minecraft, и ни одна не подходит.
 * Возвращает найденную чужую версию или null.
 */
export function wrongMcInFilename(name, mc) {
  const found = mcInFilename(name)
  if (!found.length || found.some(f => sameFamily(mc, f) || sameFamily(f, mc))) return null
  return found[0]
}
