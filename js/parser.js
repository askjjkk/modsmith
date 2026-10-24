// Разбор описания: темы (с отрицаниями «без магии»), отсылки («как в Скайриме»), версия, загрузчик, размер.
import { THEMES } from './themes.js'
import { REFERENCES } from './references.js'
import { INTENTS } from './intents.js'
import { lookup } from './dictionary.js'

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
// и предлоги новой мысли: «без монстров, для слабого пк» — «для слабого пк» уже не под отрицанием
const STOPPERS = new Set(['но', 'а', 'зато', 'хочу', 'нужн', 'нужно', 'нужна', 'добавь', 'with', 'but', 'plus', 'и с', 'с', 'для', 'на', 'в', 'во', 'чтобы', 'чтоб', 'где', 'как', 'for', 'on', 'in'])

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
    return at < 0 ? [] : [{ word: s.trim(), pos: text.slice(0, at).split(/[^a-zа-я0-9.+-]+/i).filter(Boolean).length, len: s.trim().split(/[^a-zа-я0-9.+-]+/i).filter(Boolean).length }]
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
  const used = new Set() // позиции слов, которые уже что-то значат

  for (const theme of THEMES) {
    const hits = theme.stems.flatMap(stem => stemHits(stem, toks, t))
    if (!hits.length) continue
    hits.forEach(h => { for (let k = 0; k < (h.len || 1); k++) used.add(h.pos + k) }) // у фразы заняты все её слова
    const positive = hits.filter(h => !neg.has(h.pos))
    if (positive.length) themes.set(theme.id, { theme, word: positive[0].word, via: null })
    else excluded.set(theme.id, theme)
  }

  const references = []
  for (const [label, stems, ids] of REFERENCES) {
    const hits = stems.flatMap(stem => stemHits(stem, toks, t))
    if (!hits.length) continue
    hits.forEach(h => used.add(h.pos))
    const isNeg = hits.every(h => neg.has(h.pos))
    references.push({ label, negative: isNeg })
    for (const id of ids) {
      const theme = THEME_BY_ID.get(id)
      if (!theme) continue
      if (isNeg) { if (!themes.has(id)) excluded.set(id, theme) } else if (!themes.has(id) && !excluded.has(id)) themes.set(id, { theme, word: label, via: label })
    }
  }
  // типовые фразы: «для слабого пк», «для новичка», «с друзьями»… — темы + настройки
  const intents = []
  const settings = {}
  for (const intent of INTENTS) {
    const hits = intent.stems.flatMap(stem => stemHits(stem, toks, t))
    if (!hits.length) continue
    hits.forEach(h => used.add(h.pos))
    // «не для новичка» — пропускаем; фразы вроде «без хардкора» сами содержат отрицание
    if (hits.every(h => neg.has(h.pos)) && !intent.stems.some(s => /^(без|не) /.test(s))) continue
    intents.push(intent.label)
    for (const id of intent.exclude || []) { const th = THEME_BY_ID.get(id); if (th) excluded.set(id, th) }
    for (const id of intent.themes || []) {
      const th = THEME_BY_ID.get(id)
      if (th && !themes.has(id) && !excluded.has(id)) themes.set(id, { theme: th, word: intent.label, via: intent.label })
    }
    for (const k of ['size', 'perf', 'qol', 'onlyBase']) if (intent[k] !== undefined && settings[k] === undefined) settings[k] = intent[k]
  }

  // опечатки: «магея», «хардкорр», «дракона» с ошибкой — ищем тему с отличием в одну букву
  const matched = new Set([...themes.values()].map(x => normalize(x.word)))
  toks.forEach((tok, pos) => {
    if (tok.length < 5 || STOPWORDS.test(tok) || matched.has(tok) || neg.has(pos)) return
    if (FUZZY.some(([stem]) => tok.startsWith(stem))) return // слово и так распознаётся без исправлений
    for (const [stem, theme] of FUZZY) {
      if (themes.has(theme.id) || excluded.has(theme.id)) continue
      // отличие только в последней букве основы — это окончание другого слова («классная» ≠ «классы»), не опечатка
      if (tok.startsWith(stem.slice(0, -1))) continue
      if (closeEnough(tok, stem)) { themes.set(theme.id, { theme, word: tok, via: 'опечатка' }); used.add(pos); break }
    }
  })

  // слова, которых не узнала ни одна тема: переводим по словарю и ищем моды прямо по ним (тема «на лету»)
  let dynamic = 0
  toks.forEach((rawTok, pos) => {
    const tok = rawTok.replace(/[.+-]+$/, '')
    if (dynamic >= 4 || used.has(pos) || tok.length < 3 || /\d/.test(tok) || STOPWORDS.test(tok) || EN_STOP.has(tok)) return
    const found = /^[a-z]/.test(tok) ? (tok.length >= 4 ? { en: tok } : null) : lookup(tok)
    if (!found) return
    const theme = dynamicTheme(tok, found.en)
    if (themes.has(theme.id) || excluded.has(theme.id) || [...themes.values()].some(x => x.theme.queries.includes(found.en))) return
    dynamic++
    if (neg.has(pos)) excluded.set(theme.id, theme)
    else themes.set(theme.id, { theme, word: tok, via: 'поиск' })
  })

  for (const id of excluded.keys()) themes.delete(id)
  // «сервер», «с друзьями по сети» — понадобится голосовой чат
  if (toks.some((tok, pos) => !neg.has(pos) && /^(сервер|server|мультиплеер|multiplayer)/.test(tok))) settings.voice = true
  return { themes: [...themes.values()], excluded: [...excluded.values()], references, intents, settings }
}

// английские служебные слова — по ним моды не ищем
const EN_STOP = new Set(['with', 'and', 'the', 'for', 'mods', 'mod', 'modpack', 'pack', 'minecraft', 'some', 'more', 'very', 'good', 'cool',
  'nice', 'best', 'like', 'want', 'need', 'game', 'play', 'lots', 'many', 'much', 'without', 'also', 'from', 'that', 'this', 'just',
  'vanilla', 'vanilla+', 'light', 'small', 'huge', 'large', 'big', 'normal', 'edition', 'version', 'java', 'bedrock', 'fps'])

// Тема «на лету» для слова из словаря: ищет моды по английскому переводу
function dynamicTheme(word, en) {
  const id = `q:${en}`
  if (!THEME_BY_ID.has(id)) {
    THEME_BY_ID.set(id, { id, label: `«${word}»`, color: '#5ee7df', stems: [], queries: [en], categories: [], dynamic: true })
  }
  return THEME_BY_ID.get(id)
}

// частые слова запросов: их не «исправляем» в темы
const STOPWORDS = /^(forge|fabric|neoforge|quilt|фордж|форж|фабрик|сборк|хочу|хотел|чтобы|чтоб|было|интерес|играть|поиграть|модов|моды|модам|майнкрафт|minecraft|версия|версии|нужна|нужно|нужен|можно|очень|много|какой|какую|которы|сделай|собери|пожалуйст|давай|побольше|поменьше|разных|разные|немного|просто|лучше|самый|самая|самые|чтобы|норм|нормальн|вообще|короче|типа|where|which|would|should|could|please|really|modpack|something)/

// [основа, тема] для поиска опечаток: только «длинные» основы, без «=целое слово» и фраз
const FUZZY = THEMES.flatMap(th => th.stems.filter(s => s.length >= 5 && s[0] !== '=' && !s.includes(' ')).map(s => [normalize(s), th]))

// Отличается ли начало слова от основы ровно на одну букву (замена, лишняя, пропущенная или перестановка)
export function closeEnough(token, stem) {
  for (const len of [stem.length - 1, stem.length, stem.length + 1]) {
    if (len < 4 || len > token.length) continue
    if (editDistance(token.slice(0, len), stem) === 1) return true
  }
  return false
}

function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
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
  // «500 модов», «на 300 модов» — точное число (как ползунок)
  const n = t.match(/(?:^|[^\d.])(\d{2,4})\s*(?:мод|mods)/)
  if (n && +n[1] >= 5 && +n[1] <= 1000) return +n[1]
  if (/(гигант|giant|мега|сотн\S* мод|куча модов|тысяч)/.test(t)) return 'giant'
  if (/(легк|мини|небольш|light|small)/.test(t)) return 'light'
  if (/(огромн|больш(ая|ую|ой|ие) сборк|много модов|huge|big|large)/.test(t)) return 'big'
  return null
}

export function parse(text) {
  const a = analyze(text)
  return {
    themes: a.themes,
    excluded: a.excluded,
    references: a.references,
    intents: a.intents,
    settings: a.settings,
    version: detectVersion(text),
    loader: detectLoader(text),
    size: detectSize(text) || a.settings.size || null,
  }
}
