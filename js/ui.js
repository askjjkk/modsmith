// Интерфейс: живой разбор описания, верстак с анимацией сборки, карточки модов, скачивание
import { ApiError, createApi } from './modrinth.js'
import { THEME_BY_ID, parse } from './parser.js'
import { THEMES } from './themes.js'
import { addBlocked, allBlocked } from './broken.js'
import { diagnose, ramFor } from './doctor.js'
import { COMFORT_OPTIONS } from './comfort-options.js'
import { buildPack } from './builder.js'
import { LOADER_NAMES, buildIndex, modsZipBlob, mrpackBlob, serverZipBlob } from './mrpack.js'
import { DEFAULT_SHADER, RESOURCE_PACKS, SHADERS, detectGraphics, graphicsConfigs, shaderFor } from './graphics.js'
import { startSky } from './bg.js'
import { makeTextures } from './textures.js'
import { startPet } from './pet.js'
import { VERIFIED } from './verified.js'

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
  renderPicker()
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

// «+ тема»: окно со всеми темами. Нажал — тема добавилась, окно осталось на месте
function addThemeControl() {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'chip chip-add'
  btn.style.setProperty('--c', '#b77bff')
  btn.textContent = '+ добавить тему'
  btn.setAttribute('aria-expanded', String(!$('#theme-picker').hidden))
  btn.addEventListener('click', () => toggleThemePicker())
  return btn
}

// Русские названия категорий Modrinth — разделы в окне выбора тем
const THEME_GROUPS = [
  ['adventure', 'Приключения'], ['magic', 'Магия'], ['technology', 'Техника'], ['worldgen', 'Мир и биомы'],
  ['mobs', 'Мобы и существа'], ['decoration', 'Стройка и декор'], ['food', 'Еда и фермы'], ['equipment', 'Оружие и броня'],
  ['game-mechanics', 'Механики'], ['transportation', 'Транспорт'], ['storage', 'Хранение'], ['economy', 'Экономика'],
  ['social', 'С друзьями'], ['utility', 'Удобства'], ['optimization', 'Оптимизация'], ['minigame', 'Мини-игры'],
]
let pickerGroup = 'all'

function themeGroupOf(t) {
  const cat = (t.categories || []).find(c => THEME_GROUPS.some(([id]) => id === c))
  return cat || 'other'
}

function initThemePicker() {
  const panel = $('#theme-picker')
  const tabs = $('#picker-tabs')
  for (const [id, label] of [['all', 'Все'], ['chosen', 'Выбранные'], ...THEME_GROUPS, ['other', 'Другое']]) {
    if (!['all', 'chosen', 'other'].includes(id) && !THEMES.some(t => themeGroupOf(t) === id)) continue
    const b = document.createElement('button')
    b.type = 'button'
    b.dataset.group = id
    b.textContent = label
    b.addEventListener('click', () => { pickerGroup = id; renderPicker() })
    tabs.append(b)
  }
  $('#picker-search').addEventListener('input', renderPicker)
  $('#picker-close').addEventListener('click', () => toggleThemePicker(false))
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) toggleThemePicker(false) })
  document.addEventListener('pointerdown', e => {
    if (!panel.hidden && !panel.contains(e.target) && !e.target.closest('.chip-add')) toggleThemePicker(false)
  })
}

function toggleThemePicker(force) {
  const panel = $('#theme-picker')
  const open = force ?? panel.hidden
  panel.hidden = !open
  document.querySelector('.chip-add')?.setAttribute('aria-expanded', String(open))
  if (open) { renderPicker(); $('#picker-search').focus({ preventScroll: true }) }
}

function renderPicker() {
  const panel = $('#theme-picker')
  if (panel.hidden) return
  const q = $('#picker-search').value.trim().toLowerCase()
  const { themes, excluded } = effective()
  const on = new Set(themes.map(t => t.theme.id))
  const off = new Set(excluded.map(t => t.id))
  for (const b of $('#picker-tabs').children) b.classList.toggle('active', b.dataset.group === pickerGroup)
  const grid = $('#picker-grid')
  const keep = grid.scrollTop
  grid.textContent = ''
  const list = THEMES
    .filter(t => (q ? t.label.toLowerCase().includes(q) || t.stems.some(s => s.replace('=', '').startsWith(q)) : true))
    .filter(t => q || pickerGroup === 'all' || (pickerGroup === 'chosen' ? on.has(t.id) || off.has(t.id) : themeGroupOf(t) === pickerGroup))
    .sort((a, b) => a.label.localeCompare(b.label, 'ru'))
  for (const t of list) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `pick${on.has(t.id) ? ' on' : ''}${off.has(t.id) ? ' no' : ''}`
    b.style.setProperty('--c', t.color)
    b.append(document.createElement('i'), t.label)
    b.addEventListener('click', () => {
      // клик: добавить → убрать; запрещённую тему клик возвращает в «можно»
      manual.set(t.id, on.has(t.id) ? 'off' : 'in')
      renderChips()
    })
    grid.append(b)
  }
  if (!list.length) {
    const p = document.createElement('p')
    p.className = 'muted-note'
    p.textContent = 'Такой темы нет. Просто напишите это словами в описании — я поищу моды по смыслу.'
    grid.append(p)
  }
  $('#picker-count').textContent = `${on.size} выбрано`
  grid.scrollTop = keep
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
    // «с шейдерами», «красивая графика», «текстурпаки» включают графику; «для слабого пк» — лёгкий шейдер
    const g = detectGraphics(text)
    if (g.shaders && !$('#shaders').checked) { $('#shaders').checked = true; syncGfx() }
    if (g.packs && !$('#rpacks').checked) { $('#rpacks').checked = true; syncGfx() }
    if (g.power && !manualShader) $('#shader-pick').value = shaderFor(g.power)
  }, 120)
}

// ---------- графика ----------
let manualShader = false
function graphicsChoice() {
  return {
    shader: $('#shaders').checked ? $('#shader-pick').value : null,
    packs: $('#rpacks').checked ? [...document.querySelectorAll('#rp-list input:checked')].map(i => i.value) : [],
  }
}

function syncGfx() {
  $('#shader-pick').closest('.select').classList.toggle('dim', !$('#shaders').checked)
  $('#rp-list').classList.toggle('dim', !$('#rpacks').checked)
}

function initGfx() {
  const sel = $('#shader-pick')
  for (const sh of SHADERS) sel.append(new Option(sh.label, sh.slug, false, sh.slug === DEFAULT_SHADER))
  sel.addEventListener('change', () => { manualShader = true; if (!$('#shaders').checked) { $('#shaders').checked = true; syncGfx() } })
  const list = $('#rp-list')
  for (const rp of RESOURCE_PACKS) {
    const label = document.createElement('label')
    label.className = 'rp'
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.value = rp.slug
    box.checked = rp.on
    box.addEventListener('change', () => { if (box.checked && !$('#rpacks').checked) { $('#rpacks').checked = true; syncGfx() } })
    label.append(box, rp.label)
    list.append(label)
  }
  $('#shaders').addEventListener('change', syncGfx)
  $('#rpacks').addEventListener('change', syncGfx)
  syncGfx()
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
  updateDock()
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
    graphics: graphicsChoice(),
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

// моды этой сборки, которые уже запускались на нашем сервере с созданием мира
const verifiedSet = pack => new Set(VERIFIED[`${pack.loader}@${pack.version}`] || [])

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
    [ramFor(mods.length), ' ГБ', 'памяти выделить игре'],
  ]
  const ok = verifiedSet(pack)
  const checked = mods.filter(m => ok.has(m.project.id)).length
  if (checked) items.push([checked, '', 'уже проверены запуском'])
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
  renderDockInfo()
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
  // «↻ похожий» — только для тематических модов: у базы и библиотек замена не нужна
  const theme = THEME_BY_ID.get(mod.section.id)
  if (theme && !mod.dep && state.pack?.builder) {
    const swap = document.createElement('button')
    swap.type = 'button'
    swap.className = 'swap'
    swap.textContent = '↻'
    swap.dataset.tip = 'Заменить на похожий мод этой же темы'
    swap.setAttribute('aria-label', `Заменить ${mod.project.title} на похожий`)
    swap.addEventListener('click', () => replaceMod(mod, theme, swap))
    el.append(swap)
  }
  if (state.pack && verifiedSet(state.pack).has(mod.project.id)) {
    const v = document.createElement('span')
    v.className = 'verified'
    v.textContent = '✓ проверен запуском'
    v.dataset.tip = `Мы запускали сервер ${LOADER_NAMES[state.pack.loader]} ${state.pack.version} с этим модом в сборке — мир создался`
    el.append(v)
  }

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

async function replaceMod(mod, theme, btn) {
  if (btn.classList.contains('busy')) return
  btn.classList.add('busy')
  const b = state.pack.builder
  try {
    const added = await b.replace(mod, theme)
    state.pack.skipped = b.skipped
    // моды, которые игрок выключил сам, остаются выключенными
    const off = new Set(state.pack.mods.filter(m => !state.enabled.has(m.project.id)).map(m => m.project.id))
    state.pack.mods = b.mods()
    showResult(state.pack)
    for (const id of off) state.enabled.delete(id)
    renderStats()
    toast(added ? `Заменил: ${mod.project.title} → ${added.project.title}` : `Других подходящих модов этой темы под ${state.pack.version} нет — оставил ${mod.project.title}.`, !added)
    // раскрываем тот же раздел, чтобы было видно замену
    document.querySelectorAll('.sec').forEach(d => { if (d.style.getPropertyValue('--c') === mod.section.color) d.open = true })
  } catch {
    toast('Не получилось заменить мод. Попробуйте ещё раз.', true)
    btn.classList.remove('busy')
  }
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
  // сначала то, что просили (темы), потом база (оптимизация, удобства, атмосфера), библиотеки — в самом конце
  const rank = s => (s.id === 'deps' ? 2 : ['perf', 'qol', 'polish', 'gfx'].includes(s.id) ? 1 : 0)
  order.sort((a, b) => rank(a) - rank(b))
  const box = $('#sections')
  box.textContent = ''
  order.forEach((section, i) => box.append(sectionTile(section, pack.mods.filter(m => m.section.id === section.id), i)))
  renderSkipped(pack.skipped)
  const result = $('#result')
  result.hidden = false
  result.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
}

// Раздел сборки: компактная плитка (иконки, сколько модов, примеры), по клику раскрываются карточки
function sectionTile(section, mods, index) {
  const det = document.createElement('details')
  det.className = 'sec'
  det.style.setProperty('--c', section.color)
  det.style.animationDelay = `${Math.min(index * 60, 600)}ms`
  const sum = document.createElement('summary')
  const icons = document.createElement('span')
  icons.className = 'sec-icons'
  for (const m of mods.filter(x => x.project.icon).slice(0, 5)) {
    const img = new Image()
    img.alt = ''
    img.loading = 'lazy'
    img.src = m.project.icon
    icons.append(img)
  }
  const title = document.createElement('span')
  title.className = 'sec-title'
  const name = document.createElement('b')
  name.textContent = section.label
  const sample = document.createElement('small')
  const names = mods.slice(0, 3).map(m => m.project.title)
  sample.textContent = names.join(', ') + (mods.length > 3 ? ` и ещё ${mods.length - 3}` : '')
  title.append(name, sample)
  const count = document.createElement('span')
  count.className = 'sec-count'
  count.textContent = String(mods.length)
  const arrow = document.createElement('span')
  arrow.className = 'sec-arrow'
  arrow.setAttribute('aria-hidden', 'true')
  sum.append(icons, title, count, arrow)
  det.append(sum)
  // карточки рисуем только при первом раскрытии: в большой сборке их больше сотни
  det.addEventListener('toggle', () => {
    if (!det.open || det.querySelector('.cards')) return
    const grid = document.createElement('div')
    grid.className = 'cards'
    mods.forEach((m, i) => {
      const c = card(m, i)
      if (!state.enabled.has(m.project.id)) { c.classList.add('off'); c.querySelector('.toggle').checked = false }
      grid.append(c)
      requestAnimationFrame(() => c.classList.add('in'))
    })
    det.append(grid)
  })
  return det
}

// Отсеянное — по понятным группам, а не одной длинной простынёй
const SKIP_GROUPS = [
  ['Падают или мешают (проверено запуском)', /проверено запуском|прячет ошибки|запускает Fabric-моды|падал в игре/],
  ['Не подружились с другими модами', /дублирует|несовместим|делает то же|вдвоём/],
  ['Нет версии под вашу игру', /нет версии под|файл сделан для|в файле версия|Missing ModLoader/],
  ['Не хватает нужного мода', /нет зависимости|требует мод|нужен .* версии|нужен «/],
  ['Дополнения без основного мода', /дополнение к/],
  ['Давно не обновлялись', /давно не обновлялся/],
  ['Вы просили без этого', /вы просили без/],
]

function renderSkipped(list) {
  const skipped = [...new Map(list.map(s => [s.title, s])).values()]
  $('#skipped').hidden = !skipped.length
  $('#skipped-count').textContent = String(skipped.length)
  const box = $('#skipped-list')
  box.textContent = ''
  const groups = new Map()
  for (const s of skipped) {
    const g = SKIP_GROUPS.find(([, re]) => re.test(s.why))?.[0] || 'Другое'
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g).push(s)
  }
  for (const [g, items] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    const det = document.createElement('details')
    det.className = 'skip-group'
    const sum = document.createElement('summary')
    sum.textContent = `${g} `
    const n = document.createElement('small')
    n.textContent = String(items.length)
    sum.append(n)
    const ul = document.createElement('ul')
    for (const s of items.slice(0, 40)) {
      const li = document.createElement('li')
      const b = document.createElement('b')
      b.textContent = s.title
      li.append(b, ` — ${s.why}`)
      ul.append(li)
    }
    det.append(sum, ul)
    box.append(det)
  }
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
// настройки, чтобы шейдер и ресурспаки включились сами (вместе с комфортными настройками, если они включены)
const extraFiles = pack => graphicsConfigs(pack.extras || [], pack.loader, comfortOptions())

async function downloadMrpack() {
  const pack = enabledPack()
  const index = buildIndex({ ...pack, summary: `Собрано на Modsmith по описанию: ${pack.text}` })
  download(await mrpackBlob(index, window.JSZip, comfortOptions(), pack.ref, extraFiles(pack)), fileName(pack, 'mrpack'))
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
    }, undefined, comfortOptions(), extraFiles(pack))
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

async function downloadServer() {
  const btn = $('#dl-server')
  const fill = btn.querySelector('.btn-fill'), label = btn.querySelector('.btn-text')
  btn.disabled = true
  const pack = enabledPack()
  try {
    const inst = await api.getJson('https://meta.fabricmc.net/v2/versions/installer').catch(() => null)
    const { blob, failed, count } = await serverZipBlob(pack, window.JSZip, k => {
      fill.style.width = `${Math.round(k * 100)}%`
      label.textContent = `Скачиваю ${Math.round(k * 100)}%`
    }, undefined, inst?.[0]?.version || '1.0.1')
    download(blob, fileName(pack, 'zip').replace(/\.zip$/, '-server.zip'))
    toast(failed.length ? `Не скачались: ${failed.join(', ')}. Остальное в архиве.` : `Сервер готов: ${count} модов. Распакуйте и запустите start.bat.`, !!failed.length)
  } catch {
    toast('Не получилось собрать серверный архив. Попробуйте ещё раз.', true)
  } finally {
    btn.disabled = false
    fill.style.width = '0%'
    label.textContent = 'Серверная сборка'
  }
}

// ---------- «Доктор сборки» ----------
let diagnosis = null
let logText = '' // текст из перетащенных файлов

async function readLogFiles(files) {
  const list = [...files].slice(0, 4)
  if (!list.length) return
  // latest.log бывает огромным: самое важное (список модов и первая ошибка) — в начале и в конце
  const parts = await Promise.all(list.map(async f => {
    const t = await f.text()
    return t.length > 6e6 ? `${t.slice(0, 3e6)}\n…\n${t.slice(-3e6)}` : t
  }))
  logText = parts.join('\n\n')
  $('#drop-name').textContent = `Загружено: ${list.map(f => f.name).join(', ')}`
  runDoctor()
}

function diagBlock(kind, title, items) {
  const div = document.createElement('div')
  div.className = `diag-block ${kind}`
  const h = document.createElement('h3')
  h.textContent = title
  const ul = document.createElement('ul')
  for (const { name, why, fix } of items) {
    const li = document.createElement('li')
    if (name) {
      const b = document.createElement('b')
      b.textContent = name
      li.append(b, `: ${why}`)
    } else li.append(why)
    if (fix) {
      const f = document.createElement('span')
      f.className = 'diag-fix'
      f.textContent = fix
      li.append(f)
    }
    ul.append(li)
  }
  div.append(h, ul)
  return div
}

function runDoctor() {
  const box = $('#diag-result')
  box.textContent = ''
  const text = logText || $('#crash').value
  if (text.trim().length < 40) { toast('Перетащите файл logs/latest.log или crash-report — или вставьте текст ошибки целиком.'); return }
  const mods = state.pack ? state.pack.mods.filter(m => state.enabled.has(m.project.id)) : []
  diagnosis = diagnose(text, mods)
  const { culprits, dependents, problems, hints, mc, logMods } = diagnosis
  const inPack = new Set(culprits.map(c => c.mod.project.title))
  const facts = document.createElement('p')
  facts.textContent = [mc && `Minecraft ${mc}`, logMods.length && `модов в логе: ${logMods.length}`].filter(Boolean).join(' · ')
  if (facts.textContent) box.append(facts)

  if (culprits.length || dependents.length) {
    box.append(diagBlock('bad', culprits.length === 1 ? 'Виновник в вашей сборке' : `Виновники в вашей сборке: ${culprits.length}`,
      [...culprits, ...dependents].map(({ mod, why }) => ({ name: mod.project.title, why }))))
    const fix = document.createElement('button')
    fix.type = 'button'
    fix.className = 'btn btn-primary'
    fix.textContent = 'Убрать их и скачать исправленную сборку'
    fix.addEventListener('click', applyDoctor)
    box.append(fix)
  }
  const rest = problems.filter(p => !inPack.has(p.title))
  if (rest.length) box.append(diagBlock('bad', 'Что сломалось и как починить', rest.map(p => ({ name: p.title, why: p.why, fix: p.fix }))))
  if (hints.length) box.append(diagBlock('warn', 'Подозрительно', hints.map(h => ({ why: h }))))
  if (!culprits.length && !problems.length) {
    box.append(diagBlock('warn', 'Явной ошибки в этом тексте нет', [
      { why: 'Если игра вылетает, пришлите отчёт из папки crash-reports: в нём точная причина.' },
      { why: 'Если зависает создание мира — чаще всего виноваты сразу несколько модов на биомы или C2ME. Оставьте один мод на биомы.' },
      { why: 'Если лог обрывается без ошибки — пришлите logs/debug.log: туда пишется больше.' },
    ]))
  }
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
  const g = opts.graphics || {}
  return new URLSearchParams({ q: text, v: opts.version, l: opts.loader, s: opts.size, p: opts.perf ? '1' : '0', u: opts.qol ? '1' : '0', a: opts.polish ? '1' : '0',
    sh: g.shader || '', rp: (g.packs || []).join(',') }).toString()
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
  if (h.get('sh')) { $('#shaders').checked = true; $('#shader-pick').value = h.get('sh'); manualShader = true }
  if (h.get('rp')) {
    $('#rpacks').checked = true
    const on = new Set(h.get('rp').split(','))
    document.querySelectorAll('#rp-list input').forEach(i => { i.checked = on.has(i.value) })
  }
  syncGfx()
  $('.typer').classList.add('hidden')
  onInput()
  return true
}

// ---------- плавающая панель скачивания ----------
// Кнопки «Скачать» всегда под рукой: когда основные ушли за экран, снизу выезжает панель
function initDock() {
  const dock = $('#dock')
  const acts = { mrpack: downloadMrpack, zip: downloadZip, server: downloadServer }
  dock.addEventListener('click', async e => {
    const btn = e.target.closest('button')
    if (!btn) return
    if (btn.dataset.act === 'up') { $('#result').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }); return }
    if (btn.classList.contains('busy') || !acts[btn.dataset.act]) return
    btn.classList.add('busy')
    try { await acts[btn.dataset.act]() } finally { btn.classList.remove('busy') }
  })
  let summaryVisible = true
  const update = () => dock.classList.toggle('on', !!state.pack && !$('#result').hidden && !summaryVisible)
  new IntersectionObserver(([e]) => { summaryVisible = e.isIntersecting; update() }).observe($('.summary'))
  return update
}
let updateDock = () => {}

function renderDockInfo() {
  const mods = state.pack.mods.filter(m => state.enabled.has(m.project.id))
  const mb = mods.reduce((s, m) => s + m.file.size, 0) / 1048576
  const info = $('#dock-info')
  info.textContent = ''
  const b = document.createElement('b')
  b.textContent = String(mods.length)
  info.append(b, ` модов · ${Math.round(mb)} МБ`)
  updateDock()
}

// ---------- подсказки в стиле сайта ----------
// Вместо системных title: своя подсказка, появляется быстро и выглядит как часть сайта
function initTips() {
  const tip = document.createElement('div')
  tip.className = 'tip'
  tip.setAttribute('role', 'tooltip')
  document.body.append(tip)
  let timer = null, current = null
  const adopt = root => root.querySelectorAll('[title]').forEach(el => {
    if (el.closest('.card')) return
    el.dataset.tip = el.title
    el.removeAttribute('title')
  })
  adopt(document)
  new MutationObserver(muts => muts.forEach(m => m.addedNodes.forEach(n => n.nodeType === 1 && (n.title ? adopt(n.parentNode || n) : adopt(n)))))
    .observe(document.body, { childList: true, subtree: true })
  const show = el => {
    current = el
    tip.textContent = el.dataset.tip
    tip.classList.add('on')
    const r = el.getBoundingClientRect()
    const w = tip.offsetWidth, h = tip.offsetHeight
    let x = r.left + r.width / 2 - w / 2
    x = Math.max(12, Math.min(x, innerWidth - w - 12))
    const above = r.top - h - 10
    tip.style.left = `${x}px`
    tip.style.top = `${above > 8 ? above : r.bottom + 10}px`
    tip.classList.toggle('below', above <= 8)
  }
  const hide = () => { clearTimeout(timer); current = null; tip.classList.remove('on') }
  const enter = e => {
    const el = e.target.closest?.('[data-tip]')
    if (!el || el === current) return
    clearTimeout(timer)
    timer = setTimeout(() => show(el), current ? 0 : 120)
  }
  document.addEventListener('pointerover', enter)
  document.addEventListener('focusin', enter)
  document.addEventListener('pointerout', e => { if (current && !current.contains(e.relatedTarget)) hide() })
  document.addEventListener('focusout', hide)
  addEventListener('scroll', hide, { passive: true })
}

// ---------- запуск ----------
async function main() {
  startSky($('#sky'))
  splitLogo()
  spawnCubes()
  typer()
  initSegs()
  initGfx()
  updateDock = initDock()
  startPet({ reduceMotion })
  initTips()
  initThemePicker()
  const forge = $('.forge')
  forge.addEventListener('pointermove', e => {
    const r = forge.getBoundingClientRect()
    forge.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`)
  })
  $('#prompt').addEventListener('input', onInput)
  $('#prompt').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) craft() })
  $('#craft').addEventListener('click', craft)
  $('#diagnose').addEventListener('click', runDoctor)
  $('#crash-file').addEventListener('change', e => readLogFiles(e.target.files))
  $('#crash').addEventListener('input', () => { logText = ''; $('#drop-name').textContent = '' })
  const drop = $('#drop')
  for (const ev of ['dragenter', 'dragover']) drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over') })
  for (const ev of ['dragleave', 'drop']) drop.addEventListener(ev, () => drop.classList.remove('over'))
  drop.addEventListener('drop', e => { e.preventDefault(); readLogFiles(e.dataTransfer.files) })
  const list = $('#theme-list')
  for (const t of [...THEMES].sort((a, b) => a.label.localeCompare(b.label, 'ru'))) list.append(new Option(t.label))
  $('#dl-mrpack').addEventListener('click', downloadMrpack)
  $('#dl-zip').addEventListener('click', downloadZip)
  $('#dl-server').addEventListener('click', downloadServer)
  $('#share').addEventListener('click', share)
  await loadVersions()
  if (restoreFromHash()) setTimeout(craft, 900)
}

main()
