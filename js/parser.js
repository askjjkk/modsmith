// Разбор описания: темы (с отрицаниями «без магии»), отсылки («как в Скайриме»), версия, загрузчик, размер.
import { THEMES } from './themes.js'
import { REFERENCES } from './references.js'

const LOADERS = [
  ['neoforge', ['neoforge', 'neo forge', 'неофордж', 'неофорж']],
  ['forge', ['forge', 'фордж', 'форж']],
  ['fabric', ['fabric', 'фабрик']],
  ['quilt', ['quilt', 'квилт']],
]

// после этих слов идёт то, чего НЕ хочется: «без магии и драконов», «не хочу хоррор», «no magic»
const NEGATORS = new Set(['без', 'безо', 'не', 'нет', 'никаких', 'никакой', 'никакого', 'кроме', 'исключи', 'убери',
  'no', 'without', 'not', 'except', 'minus', 'nothing'])
// а здесь отрицание заканчивается: «без магии, но с драконами»
const STOPPERS = new Set(['но', 'а', 'зато', 'хочу', 'нужн', 'нужно', 'нужна', 'добавь', 'with', 'but', 'plus', 'и с', 'с'])

export const THEME_BY_ID = new Map(THEMES.map(t => [t.id, t]))

export function normalize(text) {
  return text.toLowerCase().replace(/ё/g, 'е')
}

export function tokens(text) {
  return normalize(text).split(/[^a-zа-я0-9.+-]+/i).filter(Boolean)
}

// «=sea» — только целое слово (иначе «seasons» попадёт в моря); со пробелом — фраза целиком
function stemHits(stem, toks, text) {
  const s = normalize(stem)
  if (s.includes(' ')) {
    const at = text.indexOf(s.trim())
    return at < 0 ? [] : [{ word: s.trim(), pos: text.slice(0, at).split(/[^a-zа-я0-9.+-]+/i).filter(Boolean).length }]
  }
  const exact = s[0] === '='
  const core = exact ? s.slice(1) : s
  const hits = []
  toks.forEach((t, i) => { if (exact ? t === core : t.startsWith(core)) hits.push({ word: t, pos: i }) })
  return hits
}

// Позиции слов, которые стоят под отрицанием (до 4 слов после «без», через «и» и запятые)
export function negatedPositions(toks) {
  const neg = new Set()
  toks.forEach((t, i) => {
    if (!NEGATORS.has(t)) return
    // «не только магия» — это не отрицание
    if (t === 'не' && toks[i + 1] === 'только') return
    for (let j = i + 1, n = 0; j < toks.length && n < 4; j++) {
      if (STOPPERS.has(toks[j]) && j > i + 1) break
      if (toks[j] === 'и' || toks[j] === 'or' || toks[j] === 'and' || toks[j] === 'или') continue
      neg.add(j)
      n++
    }
  })
  return neg
}

export function detectThemes(text) {
  return analyze(text).themes
}

/** Полный разбор: { themes: [{theme, word, via}], excluded: [theme], references: [label] } */
export function analyze(text) {
  const t = normalize(text)
  const toks = tokens(text)
  const neg = negatedPositions(toks)
  const themes = new Map()
  const excluded = new Map()

  for (const theme of THEMES) {
    const hits = theme.stems.flatMap(stem => stemHits(stem, toks, t))
    if (!hits.length) continue
    const positive = hits.filter(h => !neg.has(h.pos))
    if (positive.length) themes.set(theme.id, { theme, word: positive[0].word, via: null })
    else excluded.set(theme.id, theme)
  }

  const references = []
  for (const [label, stems, ids] of REFERENCES) {
    const hits = stems.flatMap(stem => stemHits(stem, toks, t))
    if (!hits.length) continue
    const isNeg = hits.every(h => neg.has(h.pos))
    references.push({ label, negative: isNeg })
    for (const id of ids) {
      const theme = THEME_BY_ID.get(id)
      if (!theme) continue
      if (isNeg) { if (!themes.has(id)) excluded.set(id, theme) } else if (!themes.has(id) && !excluded.has(id)) themes.set(id, { theme, word: label, via: label })
    }
  }
  for (const id of excluded.keys()) themes.delete(id)
  return { themes: [...themes.values()], excluded: [...excluded.values()], references }
}

export function detectVersion(text) {
  const m = normalize(text).match(/(?:^|[^\d.])((?:1\.\d{1,2}(?:\.\d{1,2})?)|(?:2\d\.\d{1,2}(?:\.\d{1,2})?))(?![\d.]*\d)/)
  return m ? m[1] : null
}

export function detectLoader(text) {
  const t = normalize(text)
  for (const [id, words] of LOADERS) {
    if (words.some(w => t.includes(w))) return id
  }
  return null
}

export function detectSize(text) {
  const t = normalize(text)
  if (/(легк|мини|небольш|light|small)/.test(t)) return 'light'
  if (/(огромн|больш|мега|много модов|huge|big|large)/.test(t)) return 'big'
  return null
}

export function parse(text) {
  const a = analyze(text)
  return {
    themes: a.themes,
    excluded: a.excluded,
    references: a.references,
    version: detectVersion(text),
    loader: detectLoader(text),
    size: detectSize(text),
  }
}
