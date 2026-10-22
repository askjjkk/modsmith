// Разбор описания: темы, версия, загрузчик и размер сборки.
import { THEMES } from './themes.js'

const LOADERS = [
  ['neoforge', ['neoforge', 'neo forge', 'неофордж', 'неофорж']],
  ['forge', ['forge', 'фордж', 'форж', 'фордж']],
  ['fabric', ['fabric', 'фабрик']],
  ['quilt', ['quilt', 'квилт']],
]

export function normalize(text) {
  return text.toLowerCase().replace(/ё/g, 'е')
}

export function tokens(text) {
  return normalize(text).split(/[^a-zа-я0-9.+-]+/i).filter(Boolean)
}

// «=sea» — только целое слово (иначе «seasons» попадёт в моря)
const matches = (token, stem) => (stem[0] === '=' ? token === stem.slice(1) : token.startsWith(stem))

export function detectThemes(text) {
  const toks = tokens(text)
  const found = []
  for (const theme of THEMES) {
    const hit = theme.stems.find(stem => toks.some(t => matches(t, stem)))
    if (hit) found.push({ theme, word: toks.find(t => matches(t, hit)) })
  }
  return found
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
  return {
    themes: detectThemes(text),
    version: detectVersion(text),
    loader: detectLoader(text),
    size: detectSize(text),
  }
}
