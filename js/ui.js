// Интерфейс: живой разбор описания, верстак с анимацией сборки, карточки модов, скачивание
import { ApiError, createApi } from './modrinth.js'
import { THEME_BY_ID, parse } from './parser.js'
import { THEMES } from './themes.js'
import { addBlocked, allBlocked } from './broken.js'
import { diagnose } from './doctor.js'
import { COMFORT_OPTIONS } from './comfort-options.js'
import { buildPack } from './builder.js'
import { LOADER_NAMES, buildIndex, modsZipBlob, mrpackBlob } from './mrpack.js'
import { startSky } from './bg.js'
import { makeTextures } from './textures.js'

const $ = s => document.querySelector(s)
const api = createApi()
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
const state = { loader: 'fabric', size: 'normal', pack: null, enabled: new Set(), building: false }

const EXAMPLES = [
  'хардкорное выживание с магией и драконами',
  'техно сборка с Create, автоматизацией и космосом',
  'уютная ферма: еда, декор, животные и сезоны',
  'приключения, данжи и боссы на 1.20.1 forge',
  'хоррор с зомби-апокалипсисом и оружием',
  'красивая графика и звук, но лёгкая сборка',
]

// ---------- оформление ----------
function splitLogo() {
  const el = $('.glint')
  const text = el.textContent
  el.textContent = ''
  ;[...text].forEach((ch, i) => {
    const s = document.createElement('span')
    s.className = 'char'
    s.style.setProperty('--i', i)
    s.textContent = ch
    el.append(s)
  })
  // когда буквы упали, возвращаем сплошной текст, чтобы по нему бежал блик
  setTimeout(() => { el.textContent = text }, reduceMotion ? 0 : 1700)
}

function spawnCubes() {
  const tex = makeTextures()
  const layout = innerWidth < 700
    ? [['grass', 3, 1.5, 34], ['diamond', 86, 2, 30]]
    : [['grass', 8, 18, 92], ['diamond', 86, 14, 70], ['obsidian', 90, 62, 58], ['gold', 5, 70, 50]]
  const box = $('.cubes')
  layout.forEach(([kind, x, y, size], i) => {
    const t = tex[kind]
    const cube = document.createElement('div')
    cube.className = 'cube'
    cube.style.cssText = `left:${x}%;top:${y}%;--s:${size}px;--bob:${6 + i * 1.3}s;--spin:${20 + i * 6}s;animation-delay:${-i * 2}s`
    for (const [face, img] of [['f', t.side], ['b', t.side], ['r', t.side], ['l', t.side], ['t', t.top], ['d', t.bottom]]) {
      const f = document.createElement('div')
      f.className = `face ${face}`
      f.style.backgroundImage = `url(${img})`
      cube.append(f)
    }
    box.append(cube)
    setTimeout(() => cube.classList.add('on'), 600 + i * 250)
  })
  addEventListener('pointermove', e => {
    const dx = e.clientX / innerWidth - 0.5, dy = e.clientY / innerHeight - 0.5
    box.style.transform = `translate(${dx * -18}px, ${dy * -12}px)`
  })
}

function typer() {
  const el = $('.typer'), input = $('#prompt')
  let ex = 0, i = 0, dir = 1, wait = 0
  const sync = () => el.classList.toggle('hidden', !!input.value || document.activeElement === input)
  input.addEventListener('focus', sync)
  input.addEventListener('blur', sync)
  input.addEventListener('input', sync)
  if (reduceMotion) { el.textContent = EXAMPLES[0]; return }
  setInterval(() => {
    if (wait > 0) { wait--; return }
    const text = EXAMPLES[ex]
    i += dir
    el.textContent = text.slice(0, i)
    if (dir > 0 && i >= text.length) { dir = -1; wait = 40 }
    else if (dir < 0 && i <= 0) { dir = 1; ex = (ex + 1) % EXAMPLES.length; wait = 6 }
  }, 45)
}

function toast(text, error = false) {
  const t = $('#toast')
  t.textContent = text
  t.classList.toggle('error', error)
  t.classList.add('show')
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => t.classList.remove('show'), error ? 6000 : 3200)
}

// ---------- переключатели ----------
function setSeg(id, value, flash = false) {
  const seg = $(`#${id}`)
  const btn = seg.querySelector(`[data-value="${value}"]`)
  if (!btn) return
  seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b === btn)))
  const pill = seg.querySelector('.seg-pill')
  pill.style.width = `${btn.offsetWidth}px`
  pill.style.transform = `translate(${btn.offsetLeft}px, ${btn.offsetTop - 4}px)`
  state[id] = value
  if (flash) { seg.classList.remove('flash'); void seg.offsetWidth; seg.classList.add('flash') }
}

function initSegs() {
  for (const id of ['loader', 'size']) {
    $(`#${id}`).addEventListener('click', e => {
      const b = e.target.closest('button')
      if (b) setSeg(id, b.dataset.value)
    })
  }
  setSeg('loader', state.loader)
  setSeg('size', state.size)
  addEventListener('resize', () => { setSeg('loader', state.loader); setSeg('size', state.size) })
}

async function loadVersions() {
  const sel = $('#version')
  try {
    const list = (await api.gameVersions()).slice(0, 40)
    sel.textContent = ''
    for (const v of list) sel.append(new Option(v, v))
    sel.value = list.includes('1.21.1') ? '1.21.1' : list[0]
  } catch {
    sel.textContent = ''
    for (const v of ['1.21.1', '1.20.1', '1.19.2', '1.18.2', '1.16.5']) sel.append(new Option(v, v))
  }
}

function setVersion(v, flash) {
  const sel = $('#version')
  if (![...sel.options].some(o => o.value === v)) sel.prepend(new Option(v, v))
  if (sel.value === v) return
  sel.value = v
  if (flash) { sel.classList.remove('flash'); void sel.offsetWidth; sel.classList.add('flash') }
}

// ---------- живой разбор и «Понял так» ----------
// manual: темы, которые человек поправил кликом: id -> 'in' (хочу) | 'out' (не хочу) | 'off' (убрать)
const manual = new Map()
let lastParse = { themes: [], excluded: [], references: [] }

function effective() {
  const inc = new Map(lastParse.themes.map(t => [t.theme.id, t]))
  const exc = new Map(lastParse.excluded.map(t => [t.id, t]))
  for (const [id, mode] of manual) {
    const theme = THEME_BY_ID.get(id)
    if (!theme) continue
    inc.delete(id)
    exc.delete(id)
    if (mode === 'in') inc.set(id, { theme, word: theme.label, via: 'вручную' })
    if (mode === 'out') exc.set(id, theme)
  }
  return { themes: [...inc.values()], excluded: [...exc.values()] }
}

const chipEls = new Map()
function chip(key, theme, negative) {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = negative ? 'chip no' : 'chip'
  el.style.setProperty('--c', negative ? '#ff5a4f' : theme.color)
  el.title = negative ? 'Не будет в сборке. Нажмите, чтобы убрать запрет' : 'Нажмите: «не хочу эту тему»'
  el.append(document.createElement('i'), negative ? `без: ${theme.label}` : theme.label)
  el.addEventListener('click', () => {
    manual.set(theme.id, negative ? 'off' : 'out')
    renderChips()
  })
  return el
}

function renderChips() {
  const box = $('.chips')
  const text = $('#prompt').value.trim()
  const { themes, excluded } = effective()
  const wanted = new Map([
    ...themes.map(t => [`${t.theme.id}:in`, [t.theme, false]]),
    ...excluded.map(t => [`${t.id}:out`, [t, true]]),
  ])
  for (const [key, el] of chipEls) {
    if (!wanted.has(key)) {
      chipEls.delete(key)
      el.classList.add('out')
      setTimeout(() => el.remove(), 260)
    }
  }
  box.querySelectorAll('.chip-hint, .chip-add, .refs').forEach(e => e.remove())
  for (const [key, [theme, negative]] of wanted) {
    if (chipEls.has(key)) continue
    const el = chip(key, theme, negative)
    box.append(el)
    chipEls.set(key, el)
  }
  if (text.length > 2 && !themes.length) {
    const hint = document.createElement('span')
    hint.className = 'chip-hint'
    hint.textContent = 'Темы пока не узнал. Соберу «ваниллу+»: оптимизация, удобства, структуры.'
    box.append(hint)
  }
  if (text.length > 2) box.append(addThemeControl())
  const refs = lastParse.references.filter(r => !r.negative).map(x => x.label)
  const understood = [...refs, ...(lastParse.intents || [])]
  const typos = themes.filter(x => x.via === 'опечатка').map(x => `«${x.word}» → ${x.theme.label}`)
  if (understood.length || typos.length) {
    const r = document.createElement('p')
    r.className = 'refs'
    r.textContent = [
      understood.length ? `Понял: ${understood.join(', ')}.` : '',
      typos.length ? `Исправил опечатки: ${typos.join(', ')}.` : '',
      'Лишнее можно снять кликом.',
    ].filter(Boolean).join(' ')
    box.append(r)
  }
}

// «+ тема»: выбрать любую из 320+ тем вручную
function addThemeControl() {
  const wrap = document.createElement('span')
  wrap.className = 'chip-add'
  const input = document.createElement('input')
  input.setAttribute('list', 'theme-list')
  input.placeholder = '+ добавить тему'
  input.setAttribute('aria-label', 'Добавить тему')
  input.addEventListener('change', () => {
    const theme = THEMES.find(t => t.label.toLowerCase() === input.value.trim().toLowerCase())
    if (theme) { manual.set(theme.id, 'in'); renderChips() }
    input.value = ''
  })
  wrap.append(input)
  return wrap
}

let parseTimer
function onInput() {
  clearTimeout(parseTimer)
  parseTimer = setTimeout(() => {
    const text = $('#prompt').value
    const p = parse(text)
    lastParse = p
    renderChips()
    if (p.version) setVersion(p.version, true)
    if (p.loader && p.loader !== state.loader) setSeg('loader', p.loader, true)
    if (p.size && p.size !== state.size) setSeg('size', p.size, true)
    // «для слабого пк», «только оптимизация» включают оптимизацию
    if (p.settings?.perf && !$('#perf').checked) { $('#perf').checked = true }
    if (p.settings?.qol && !$('#qol').checked) { $('#qol').checked = true }
  }, 120)
}

// ---------- сборка ----------
function resetCrafting() {
  const grid = $('#grid')
  grid.textContent = ''
  for (let i = 0; i < 9; i++) {
    const s = document.createElement('div')
    s.className = 'slot'
    grid.append(s)
  }
  $('#result-slot').classList.remove('ready')
  $('#xp-fill').style.width = '0%'
  $('#xp-level').textContent = '0'
  setStatus('Разжигаю горн…')
}

function setStatus(text) {
  const el = $('#xp-text')
  if (el.textContent === text) return
  el.textContent = text
  el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap')
}

async function craft() {
  if (state.building) return
  const text = $('#prompt').value.trim()
  if (!text) {
    toast('Опиши сборку хотя бы парой слов: например «магия и драконы».')
    $('#prompt').focus()
    return
  }
  state.building = true
  const btn = $('#craft')
  btn.disabled = true
  btn.querySelector('.craft-text').textContent = 'Крафтим…'
  $('#result').hidden = true
  const crafting = $('#crafting')
  crafting.hidden = false
  resetCrafting()
  crafting.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })

  const slots = [...document.querySelectorAll('#grid .slot')]
  let count = 0
  const emit = ev => {
    if (ev.type === 'progress') {
      $('#xp-fill').style.width = `${Math.round(ev.value * 100)}%`
      if (ev.text) setStatus(ev.text)
    } else if (ev.type === 'mod') {
      const slot = slots[count % 9]
      count++
      $('#xp-level').textContent = String(count)
      slot.textContent = ''
      slot.style.setProperty('--c', ev.mod.section.color)
      slot.classList.add('lit')
      if (ev.mod.project.icon) {
        const img = new Image()
        img.alt = ''
        img.src = ev.mod.project.icon
        slot.append(img)
      }
    }
  }

  lastParse = parse(text)
  const { themes, excluded } = effective()
  const opts = {
    version: $('#version').value, loader: state.loader, size: state.size,
    perf: $('#perf').checked, qol: $('#qol').checked, polish: $('#polish').checked, themes, excluded, blocked: allBlocked(),
    onlyBase: !!lastParse.settings?.onlyBase && !manual.size,
  }
  try {
    const pack = await buildPack(opts, api, emit)
    pack.name = `Modsmith: ${text.slice(0, 48)}`
    pack.text = text
    if (!pack.mods.length) {
      toast(`Под ${opts.version} ${LOADER_NAMES[opts.loader]} ничего не нашлось. Попробуй версию 1.20.1 или 1.21.1.`, true)
      crafting.hidden = true
      return
    }
    $('#result-slot').classList.add('ready')
    setStatus(`Готово: ${pack.mods.length} модов`)
    history.replaceState(null, '', `#${shareParams(opts, text)}`)
    await new Promise(r => setTimeout(r, reduceMotion ? 0 : 900))
    showResult(pack)
  } catch (e) {
    toast(e instanceof ApiError ? e.message : 'Что-то пошло не так. Попробуйте ещё раз.', true)
    crafting.hidden = true
    console.error(e)
  } finally {
    state.building = false
    btn.disabled = false
    btn.querySelector('.craft-text').textContent = 'Скрафтить сборку'
  }
}

// ---------- результат ----------
const fmtNum = n => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} млн` : n >= 1e3 ? `${Math.round(n / 1e3)} тыс.` : String(n))

function countUp(el, to, suffix = '') {
  if (reduceMotion) { el.textContent = to + suffix; return }
  const t0 = performance.now(), dur = 900
  const step = t => {
    const k = Math.min(1, (t - t0) / dur)
    const v = to * (1 - Math.pow(1 - k, 3))
    el.textContent = (Number.isInteger(to) ? Math.round(v) : v.toFixed(1).replace('.', ',')) + suffix
    if (k < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

function renderStats() {
  const pack = state.pack
  const mods = pack.mods.filter(m => state.enabled.has(m.project.id))
  const deps = mods.filter(m => m.dep).length
  const mb = mods.reduce((s, m) => s + m.file.size, 0) / 1048576
  const box = $('#stats')
  box.textContent = ''
  const items = [
    [mods.length, '', 'модов'],
    [deps, '', 'из них зависимостей'],
    [Math.round(mb * 10) / 10, '', 'МБ скачать'],
  ]
  for (const [num, suffix, label] of items) {
    const s = document.createElement('div')
    s.className = 'stat'
    const b = document.createElement('b')
    const span = document.createElement('span')
    span.textContent = label
    s.append(b, span)
    box.append(s)
    countUp(b, num, suffix)
  }
  const v = document.createElement('div')
  v.className = 'stat'
  const b = document.createElement('b')
  b.textContent = pack.version
  const span = document.createElement('span')
  span.textContent = `${LOADER_NAMES[pack.loader]} ${pack.loaderVersion || ''}`.trim()
  v.append(b, span)
  box.append(v)
}

function card(mod, index) {
  const el = document.createElement('article')
  el.className = 'card'
  el.dataset.id = mod.project.id
  el.style.setProperty('--c', mod.section.color)
  el.style.transitionDelay = `${Math.min(index * 45, 500)}ms`
  const img = document.createElement('img')
  img.loading = 'lazy'
  img.alt = ''
  if (mod.project.icon) img.src = mod.project.icon
  const h3 = document.createElement('h3')
  const a = document.createElement('a')
  a.href = `https://modrinth.com/mod/${mod.project.slug}`
  a.target = '_blank'
  a.rel = 'noopener'
  a.textContent = mod.project.title
  h3.append(a)
  const toggle = document.createElement('input')
  toggle.type = 'checkbox'
  toggle.className = 'toggle'
  toggle.checked = true
  toggle.setAttribute('aria-label', `Оставить ${mod.project.title} в сборке`)
  toggle.style.gridRow = 'span 2'
  toggle.addEventListener('change', () => onToggle(mod, toggle, el))
  const meta = document.createElement('div')
  meta.className = 'meta'
  meta.textContent = `${fmtNum(mod.project.downloads || 0)} скачиваний, v${mod.version.number}`
  const p = document.createElement('p')
  p.textContent = mod.project.description || ''
  const reason = document.createElement('span')
  reason.className = 'reason'
  reason.textContent = mod.reason
  el.append(img, h3, toggle, meta, p, reason)

  el.addEventListener('pointermove', e => {
    if (reduceMotion) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
    el.style.setProperty('--ry', `${(x - 0.5) * 10}deg`)
    el.style.setProperty('--rx', `${(0.5 - y) * 10}deg`)
    el.style.setProperty('--gx', `${x * 100}%`)
    el.style.setProperty('--gy', `${y * 100}%`)
  })
  el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg') })
  return el
}

function onToggle(mod, toggle, el) {
  if (!toggle.checked) {
    // нельзя убрать библиотеку, пока включён мод, которому она нужна
    const parent = state.pack.mods.find(m => m.project.id === mod.parentId)
    if (mod.dep && parent && state.enabled.has(parent.project.id)) {
      toggle.checked = true
      toast(`${mod.project.title} нужен для ${parent.project.title}. Сначала уберите его.`)
      return
    }
    state.enabled.delete(mod.project.id)
  } else {
    state.enabled.add(mod.project.id)
  }
  el.classList.toggle('off', !toggle.checked)
  renderStats()
}

function showResult(pack) {
  state.pack = pack
  state.enabled = new Set(pack.mods.map(m => m.project.id))
  renderStats()
  const empty = $('#empty-themes')
  empty.hidden = !pack.emptyThemes?.length
  empty.textContent = pack.emptyThemes?.length
    ? `По темам «${pack.emptyThemes.join('», «')}» под ${pack.version} ${LOADER_NAMES[pack.loader]} подходящих модов не нашлось. Попробуйте другую версию или загрузчик (чаще всего модов больше всего на 1.20.1 Forge и 1.21.1 Fabric).`
    : ''

  const order = []
  for (const m of pack.mods) if (!order.some(s => s.id === m.section.id)) order.push(m.section)
  order.sort((a, b) => (a.id === 'deps') - (b.id === 'deps'))
  const box = $('#sections')
  box.textContent = ''
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) }
  }, { rootMargin: '0px 0px -40px 0px' })
  for (const section of order) {
    const mods = pack.mods.filter(m => m.section.id === section.id)
    const head = document.createElement('h2')
    head.className = 'section-head'
    head.style.setProperty('--c', section.color)
    const small = document.createElement('small')
    small.textContent = String(mods.length)
    head.append(document.createElement('i'), section.label, small)
    const grid = document.createElement('div')
    grid.className = 'cards'
    mods.forEach((m, i) => {
      const c = card(m, i)
      grid.append(c)
      io.observe(c)
    })
    box.append(head, grid)
  }

  const skipped = [...new Map(pack.skipped.map(s => [s.title, s])).values()]
  $('#skipped').hidden = !skipped.length
  const ul = $('#skipped-list')
  ul.textContent = ''
  for (const s of skipped.slice(0, 60)) {
    const li = document.createElement('li')
    li.textContent = `${s.title}: ${s.why}`
    ul.append(li)
  }
  const result = $('#result')
  result.hidden = false
  result.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
}

function enabledPack() {
  const pack = state.pack
  return { ...pack, mods: pack.mods.filter(m => state.enabled.has(m.project.id)) }
}

const fileName = (pack, ext) => `${pack.text.slice(0, 40).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'modsmith'}-${pack.version}.${ext}`

function download(blob, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 30000)
}

// «Комфортные настройки игры»: options.txt кладётся в сборку, только если включён переключатель
const comfortOptions = () => ($('#comfort').checked ? COMFORT_OPTIONS : null)

async function downloadMrpack() {
  const pack = enabledPack()
  const index = buildIndex({ ...pack, summary: `Собрано на Modsmith по описанию: ${pack.text}` })
  download(await mrpackBlob(index, window.JSZip, comfortOptions(), pack.ref), fileName(pack, 'mrpack'))
  toast('Готово! Открой файл двойным кликом в Modrinth App или перетащи в Prism Launcher.')
}

async function downloadZip() {
  const btn = $('#dl-zip')
  const fill = btn.querySelector('.btn-fill'), label = btn.querySelector('.btn-text')
  btn.disabled = true
  const pack = enabledPack()
  try {
    const { blob, failed } = await modsZipBlob(pack, window.JSZip, k => {
      fill.style.width = `${Math.round(k * 100)}%`
      label.textContent = `Скачиваю ${Math.round(k * 100)}%`
    }, undefined, comfortOptions())
    download(blob, fileName(pack, 'zip'))
    toast(failed.length ? `Не скачались: ${failed.join(', ')}. Остальное в архиве.` : 'Архив готов: распакуй папку mods в .minecraft.', !!failed.length)
  } catch {
    toast('Не получилось собрать архив. Попробуйте .mrpack или повторите.', true)
  } finally {
    btn.disabled = false
    fill.style.width = '0%'
    label.textContent = 'Архив с модами'
  }
}

// ---------- «Доктор сборки» ----------
let diagnosis = null
function runDoctor() {
  const box = $('#diag-result')
  box.textContent = ''
  const text = $('#crash').value
  if (!state.pack) { toast('Сначала соберите сборку (или откройте ссылку на неё), потом вставьте crash-report.'); return }
  if (text.trim().length < 40) { toast('Вставьте текст crash-report целиком: файл из папки crash-reports или logs/latest.log.'); return }
  const mods = state.pack.mods.filter(m => state.enabled.has(m.project.id))
  diagnosis = diagnose(text, mods)
  const all = [...diagnosis.culprits, ...diagnosis.dependents]
  const p = document.createElement('p')
  if (!all.length) {
    p.textContent = 'В этой сборке виновника не нашёл. Проверьте, что вставили отчёт именно от этой сборки, или пришлите logs/latest.log: там подробнее.'
    box.append(p)
    return
  }
  p.textContent = diagnosis.culprits.length === 1 ? 'Нашёл виновника:' : `Нашёл виновников: ${diagnosis.culprits.length}`
  const ul = document.createElement('ul')
  for (const { mod, why } of all) {
    const li = document.createElement('li')
    const b = document.createElement('b')
    b.textContent = mod.project.title
    li.append(b, `: ${why}`)
    ul.append(li)
  }
  const fix = document.createElement('button')
  fix.type = 'button'
  fix.className = 'btn btn-primary'
  fix.textContent = 'Убрать их и скачать исправленную сборку'
  fix.addEventListener('click', applyDoctor)
  box.append(p, ul, fix)
}

async function applyDoctor() {
  if (!diagnosis) return
  for (const { mod, why } of [...diagnosis.culprits, ...diagnosis.dependents]) {
    state.enabled.delete(mod.project.id)
    const card = document.querySelector(`.card[data-id="${mod.project.id}"]`)
    if (card) { card.classList.add('off'); card.querySelector('.toggle').checked = false }
    if (diagnosis.culprits.some(c => c.mod === mod)) addBlocked(mod.project.slug, `падал в игре: ${why}`)
  }
  renderStats()
  await downloadMrpack()
  toast('Убрал и запомнил: в следующих сборках этих модов не будет. Удалите старый профиль в лаунчере и откройте новый файл.')
}

function shareParams(opts, text) {
  return new URLSearchParams({ q: text, v: opts.version, l: opts.loader, s: opts.size, p: opts.perf ? '1' : '0', u: opts.qol ? '1' : '0', a: opts.polish ? '1' : '0' }).toString()
}

async function share() {
  const url = location.href
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: 'Modsmith', text: state.pack?.name, url })
    else { await navigator.clipboard.writeText(url); toast('Ссылка на сборку скопирована.') }
  } catch { /* пользователь закрыл окно «поделиться» */ }
}

function restoreFromHash() {
  const h = new URLSearchParams(location.hash.slice(1))
  if (!h.get('q')) return false
  $('#prompt').value = h.get('q')
  if (h.get('v')) setVersion(h.get('v'))
  if (h.get('l')) setSeg('loader', h.get('l'))
  if (h.get('s')) setSeg('size', h.get('s'))
  $('#perf').checked = h.get('p') !== '0'
  $('#qol').checked = h.get('u') !== '0'
  $('#polish').checked = h.get('a') !== '0'
  $('.typer').classList.add('hidden')
  onInput()
  return true
}

// ---------- запуск ----------
async function main() {
  startSky($('#sky'))
  splitLogo()
  spawnCubes()
  typer()
  initSegs()
  const forge = $('.forge')
  forge.addEventListener('pointermove', e => {
    const r = forge.getBoundingClientRect()
    forge.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`)
  })
  $('#prompt').addEventListener('input', onInput)
  $('#prompt').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) craft() })
  $('#craft').addEventListener('click', craft)
  $('#diagnose').addEventListener('click', runDoctor)
  const list = $('#theme-list')
  for (const t of [...THEMES].sort((a, b) => a.label.localeCompare(b.label, 'ru'))) list.append(new Option(t.label))
  $('#dl-mrpack').addEventListener('click', downloadMrpack)
  $('#dl-zip').addEventListener('click', downloadZip)
  $('#share').addEventListener('click', share)
  await loadVersions()
  if (restoreFromHash()) setTimeout(craft, 900)
}

main()
