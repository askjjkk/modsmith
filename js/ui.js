// Интерфейс: живой разбор описания, верстак с анимацией сборки, карточки модов, скачивание
import { ApiError, createApi } from './modrinth.js'
import { parse } from './parser.js'
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

// ---------- живой разбор ----------
const chipEls = new Map()
function renderChips(found, hasText) {
  const box = $('.chips')
  const ids = new Set(found.map(f => f.theme.id))
  for (const [id, el] of chipEls) {
    if (!ids.has(id)) {
      chipEls.delete(id)
      el.classList.add('out')
      setTimeout(() => el.remove(), 260)
    }
  }
  box.querySelector('.chip-hint')?.remove()
  for (const { theme } of found) {
    if (chipEls.has(theme.id)) continue
    const el = document.createElement('span')
    el.className = 'chip'
    el.style.setProperty('--c', theme.color)
    el.append(document.createElement('i'), theme.label)
    box.append(el)
    chipEls.set(theme.id, el)
  }
  if (hasText && !found.length) {
    const hint = document.createElement('span')
    hint.className = 'chip-hint'
    hint.textContent = 'Темы пока не узнал. Соберу «ваниллу+»: оптимизация, удобства, структуры.'
    box.append(hint)
  }
}

let parseTimer
function onInput() {
  clearTimeout(parseTimer)
  parseTimer = setTimeout(() => {
    const text = $('#prompt').value
    const p = parse(text)
    renderChips(p.themes, text.trim().length > 2)
    if (p.version) setVersion(p.version, true)
    if (p.loader && p.loader !== state.loader) setSeg('loader', p.loader, true)
    if (p.size && p.size !== state.size) setSeg('size', p.size, true)
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

  const p = parse(text)
  const opts = {
    version: $('#version').value, loader: state.loader, size: state.size,
    perf: $('#perf').checked, qol: $('#qol').checked, themes: p.themes,
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

async function downloadMrpack() {
  const pack = enabledPack()
  const index = buildIndex({ ...pack, summary: `Собрано на Modsmith по описанию: ${pack.text}` })
  download(await mrpackBlob(index, window.JSZip), fileName(pack, 'mrpack'))
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
    })
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

function shareParams(opts, text) {
  return new URLSearchParams({ q: text, v: opts.version, l: opts.loader, s: opts.size, p: opts.perf ? '1' : '0', u: opts.qol ? '1' : '0' }).toString()
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
  $('#dl-mrpack').addEventListener('click', downloadMrpack)
  $('#dl-zip').addEventListener('click', downloadZip)
  $('#share').addEventListener('click', share)
  await loadVersions()
  if (restoreFromHash()) setTimeout(craft, 900)
}

main()
