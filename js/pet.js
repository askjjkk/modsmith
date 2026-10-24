// Питомец: пиксельный моб в стиле Minecraft. Гуляет по низу экрана, его можно таскать и тыкать,
// а ещё у него можно спросить про сайт (ответы заготовлены — это имитация диалога).

// ---------- спрайты 18×12: . — пусто, a — шерсть, b — тёмное, w — светлое, e — глаз, n — нос ----------
const QUAD = {
  stand: [
    '..........b...b...',
    '..........bb.bb...',
    '..........aaaaa...',
    '..........aeaea...',
    'b.........aanaa...',
    'b.aaaaaaaaaaaaa...',
    '.baaaaaaaaaaaa....',
    '..aaaaaaaaaaaa....',
    '..awaaaaaaaawa....',
    '..a.a.....a.a.....',
    '..b.b.....b.b.....',
    '..................',
  ],
  walk: [
    '..........b...b...',
    '..........bb.bb...',
    '..........aaaaa...',
    '..........aeaea...',
    '.b........aanaa...',
    '.b.aaaaaaaaaaaa...',
    '..baaaaaaaaaaa....',
    '..aaaaaaaaaaaa....',
    '..awaaaaaaaawa....',
    '...a.a...a.a......',
    '...b.b...b.b......',
    '..................',
  ],
  sit: [
    '..................',
    '..........b...b...',
    '..........bb.bb...',
    '..........aaaaa...',
    '..........aeaea...',
    '..........aanaa...',
    '......aaaaaaaa....',
    '.b...aaaaaaaaa....',
    '.b..aaaaaaaaaa....',
    '..baaaaaawaaaa....',
    '...bbbaaaa.aa.....',
    '.......bb..bb.....',
  ],
  sleep: [
    '..................',
    '..................',
    '..................',
    '..................',
    '..........b...b...',
    '.....aaaaabbabb...',
    '...aaaaaaaaaaaa...',
    '..aaaaaaaaabbab...',
    '.baaaaaaaaaanaa...',
    'bbaaaaaaaaaaaaa...',
    '.bbbbaaaaaaaaa....',
    '..................',
  ],
}

// Аксолотль: длинный, с жабрами
const AXO = {
  stand: [
    '..................',
    '............b.b...',
    '...........baaab..',
    '...........aeaea..',
    '..........baanaab.',
    '..aaaaaaaaaaaaa...',
    '.aaaaaaaaaaaaaa...',
    'aawaaaaaaaaaaa....',
    '..a.a.....a.a.....',
    '..................',
    '..................',
    '..................',
  ],
}
AXO.walk = AXO.stand.map((r, i) => (i === 8 ? '...a.a...a.a......' : r))
AXO.sit = AXO.stand
AXO.sleep = AXO.stand.map((r, i) => (i === 3 ? '...........abaab..' : r))

// Пчела: висит в воздухе, крылышки
const BEE = {
  stand: [
    '......ww..ww......',
    '.....wwww.wwww....',
    '......ww..ww......',
    '....aabbaabbaa....',
    '...aabbaabbaaea...',
    '...aabbaabbaaaa...',
    '..baabbaabbaana...',
    '....aabbaabbaa....',
    '.....b..b..b......',
    '..................',
    '..................',
    '..................',
  ],
}
BEE.walk = BEE.stand.map((r, i) => (i < 3 ? ['.....ww...ww......', '....wwww.wwww.....', '.....ww...ww......'][i] : r))
BEE.sit = BEE.stand
BEE.sleep = BEE.stand.map((r, i) => (i === 4 ? '...aabbaabbaaba...' : r))

export const PETS = {
  tabby: { name: 'Рыжий кот', shape: QUAD, colors: { a: '#e0a35e', b: '#8a5228', w: '#f6e3c8', e: '#2fb84a', n: '#e88a9a' } },
  black: { name: 'Чёрный кот', shape: QUAD, colors: { a: '#2b2b36', b: '#15151c', w: '#4a4a5a', e: '#f5d33a', n: '#c86b80' } },
  siamese: { name: 'Сиамский кот', shape: QUAD, colors: { a: '#efe3cf', b: '#5a3a2a', w: '#fff6ea', e: '#4fa3ff', n: '#e88a9a' } },
  fox: { name: 'Лисёнок', shape: QUAD, colors: { a: '#e07b39', b: '#3a2418', w: '#fff1e2', e: '#1d1d1d', n: '#1d1d1d' } },
  axolotl: { name: 'Аксолотль', shape: AXO, colors: { a: '#ff9fc4', b: '#e2558f', w: '#ffd1e3', e: '#2a1020', n: '#c23a72' } },
  bee: { name: 'Пчёлка', shape: BEE, colors: { a: '#f7c531', b: '#3a2a12', w: '#dff3ff', e: '#1d1d1d', n: '#1d1d1d' }, flies: true },
}

// ---------- вопросы и ответы ----------
const QA = [
  ['Как собрать сборку?', ['как', 'собрать', 'начать', 'пользоваться', 'работает'], 'Напиши словами, какую сборку хочешь: «магия и драконы», «уютная ферма», «хоррор для слабого пк». Выбери версию и загрузчик и жми «Скрафтить». Я подберу моды, проверю совместимость и отдам файл.'],
  ['Что такое .mrpack?', ['mrpack', 'мрпак', 'файл', 'открыть', 'установить'], '.mrpack — файл сборки. Открой его в Modrinth App, Prism Launcher или ATLauncher — моды скачаются сами. Для TLauncher бери «Архив с модами».'],
  ['Игра не запускается, что делать?', ['не запуска', 'краш', 'вылет', 'ошибк', 'crash', 'падает', 'зависа'], 'Пролистай вниз до «Игра не запустилась?» и перетащи туда logs/latest.log или файл из crash-reports. Доктор найдёт виновника и даст исправленную сборку.'],
  ['Fabric или Forge?', ['fabric', 'forge', 'фабрик', 'фордж', 'neoforge', 'загрузчик'], 'Fabric — лёгкий и быстрый, больше модов на оптимизацию. Forge и NeoForge — больше больших модов (техника, магия). На 1.20.1 модов больше всего у Forge, на 1.21.1 — у Fabric и NeoForge.'],
  ['Какую версию выбрать?', ['верси', '1.20', '1.21', 'version'], 'Самые богатые на моды — 1.20.1 и 1.21.1. Новее — меньше модов, зато свежая игра.'],
  ['Что за «Атмосфера»?', ['атмосфер', 'полировк', 'анимац', 'звук'], 'Это слой красоты как в топовых сборках: анимации, живые звуки, падающие листья, частицы, красивые подсказки к предметам. Можно выключить.'],
  ['Как поставить шейдеры?', ['шейдер', 'графи', 'shader', 'ресурспак', 'текстур'], 'Включи «Шейдеры» в разделе «Графика» и выбери, какие. Я сам поставлю Iris или Oculus и включу шейдер в игре. Для слабого ПК бери MakeUp.'],
  ['Сколько памяти дать игре?', ['памят', 'озу', 'ram', 'оператив', 'лагает', 'лаг', 'фпс', 'fps'], 'После сборки я пишу, сколько выделить: обычно 4–8 ГБ. Больше 10 давать не надо — станет только хуже. А для FPS включи «Оптимизацию».'],
  ['Как сделать сервер?', ['сервер', 'server', 'друз', 'хост'], 'После сборки нажми «Серверная сборка»: там моды для сервера и start.bat, который сам скачает ядро. Друзьям дай .mrpack, чтобы сборка была одинаковая.'],
  ['Это бесплатно?', ['бесплат', 'деньг', 'цена', 'free', 'платн'], 'Да, полностью: без регистрации и рекламы. Моды качаются с Modrinth — их авторам спасибо.'],
  ['Почему мод отсеялся?', ['отсеял', 'нет мода', 'почему', 'убрал', 'пропал'], 'Под каждой сборкой есть «Что я отсеял и почему». Обычно мод не вышел под твою версию, ему нужен другой мод или он ломает игру — такие я заранее проверяю запуском сервера.'],
  ['Как сменить питомца?', ['питом', 'кот', 'смен', 'моб', 'лиса', 'пчел'], 'Нажми шестерёнку вверху этого окошка — там коты, лисёнок, аксолотль и пчёлка. А ещё меня можно таскать мышкой!'],
]
const FALLBACK = 'Хм, про это я пока не знаю. Спроси про сборки, шейдеры, сервер или что делать, если игра не запускается — тут я мастер!'

// ---------- питомец ----------
const KEY = 'modsmith-pet'
const SCALE = 4
const W = 18 * SCALE, H = 12 * SCALE

function loadPrefs() {
  try { return { kind: 'tabby', hidden: false, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return { kind: 'tabby', hidden: false } }
}
function savePrefs(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* приватный режим */ }
}

function draw(ctx, rows, colors, blink = false) {
  ctx.clearRect(0, 0, 18, 12)
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return
    // моргание: глаза на миг становятся цветом шерсти
    ctx.fillStyle = (blink && ch === 'e' ? colors.b : colors[ch]) || colors.a
    ctx.fillRect(x, y, 1, 1)
  }))
}

export function startPet({ reduceMotion = false } = {}) {
  const prefs = loadPrefs()
  const el = document.createElement('div')
  el.className = 'pet'
  el.setAttribute('role', 'button')
  el.setAttribute('aria-label', 'Питомец: нажми, чтобы поговорить')
  el.tabIndex = 0
  const canvas = document.createElement('canvas')
  canvas.width = 18
  canvas.height = 12
  const ctx = canvas.getContext('2d')
  const zzz = document.createElement('span')
  zzz.className = 'pet-zzz'
  zzz.textContent = 'z z'
  const emo = document.createElement('span')
  emo.className = 'pet-emote'
  emo.setAttribute('aria-hidden', 'true')
  el.append(canvas, zzz)

  const bring = document.createElement('button')
  bring.type = 'button'
  bring.className = 'pet-bring'
  bring.title = 'Вернуть питомца'
  bring.setAttribute('aria-label', 'Вернуть питомца')

  const chat = buildChat()
  document.body.append(el, emo, bring, chat.box)

  // эмоция над головой: всплывает пузырьком и сама исчезает
  let emoTimer = null
  function emote(face, ms = 1600) {
    emo.textContent = face
    emo.classList.remove('on'); void emo.offsetWidth; emo.classList.add('on')
    clearTimeout(emoTimer)
    emoTimer = setTimeout(() => emo.classList.remove('on'), ms)
  }

  let x = innerWidth * 0.75, y = 0, vy = 0, dir = -1
  let mode = 'walk', frame = 0, idle = 0, target = null, dragging = null, lastTick = performance.now(), frameTimer = 0
  let blinkUntil = 0, nextBlink = performance.now() + 2500, shake = 0, fallFrom = 0
  // пол — низ экрана; если выехала панель скачивания, питомец стоит над ней
  const ground = () => innerHeight - H - 6 - (PETS[prefs.kind].flies ? 40 : 0) - (document.querySelector('.dock.on') ? 76 : 0)
  y = ground()

  function setKind(kind) {
    prefs.kind = kind
    savePrefs(prefs)
    el.dataset.kind = kind
    chat.markKind(kind)
    y = Math.min(y, ground())
  }
  function setHidden(h) {
    prefs.hidden = h
    savePrefs(prefs)
    el.hidden = h
    bring.hidden = !h
    if (h) chat.close()
  }
  setKind(prefs.kind)
  setHidden(prefs.hidden)

  function render() {
    const pet = PETS[prefs.kind]
    const rows = mode === 'sleep' ? pet.shape.sleep : mode === 'sit' ? pet.shape.sit : (frame % 2 ? pet.shape.walk : pet.shape.stand)
    const now = performance.now()
    if (now > nextBlink) { blinkUntil = now + 140; nextBlink = now + 2200 + Math.random() * 3500 }
    draw(ctx, rows, pet.colors, now < blinkUntil && mode !== 'sleep')
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) scaleX(${dir})`
    emo.style.transform = `translate(${Math.round(x + W / 2 - 16)}px, ${Math.round(y - 34)}px)`
    el.classList.toggle('sleeping', mode === 'sleep')
    chat.place(x, y)
  }

  function hearts(n = 4) {
    for (let i = 0; i < n; i++) {
      const h = document.createElement('span')
      h.className = 'pet-heart'
      h.textContent = '❤'
      h.style.left = `${x + W / 2 + (Math.random() - 0.5) * 40}px`
      h.style.top = `${y + 4}px`
      h.style.animationDelay = `${i * 90}ms`
      document.body.append(h)
      setTimeout(() => h.remove(), 1400)
    }
  }

  function tick(t) {
    const dt = Math.min(0.05, (t - lastTick) / 1000)
    lastTick = t
    if (!dragging && !el.hidden) {
      const g = ground()
      if (y < g) {
        vy += 1800 * dt
        y = Math.min(g, y + vy * dt)
        if (y === g) {
          // приземление: сплющивается; с большой высоты — звёздочки, если трясли — кружится голова
          el.classList.add('land'); setTimeout(() => el.classList.remove('land'), 320)
          if (shake > 2600) { emote('@', 2000); el.classList.add('dizzy'); setTimeout(() => el.classList.remove('dizzy'), 1800) }
          else if (g - fallFrom > 220) emote('✦')
          vy = 0
          shake = 0
        }
      } else y = g
      idle += dt
      if (chat.isOpen()) { mode = 'sit'; idle = 0 }
      else if (idle > 28) { if (mode !== 'sleep') emote('💤', 1200); mode = 'sleep' }
      else if (mode === 'walk' && !reduceMotion) {
        if (target == null || Math.abs(target - x) < 4) { target = null; mode = Math.random() < 0.5 ? 'sit' : 'walk'; if (mode === 'walk') target = 20 + Math.random() * (innerWidth - W - 40) }
        else { dir = target > x ? 1 : -1; x += dir * 46 * dt; if (Math.random() < dt / 14) emote('♪', 1100) }
      } else if (mode === 'sit' && Math.random() < dt / 6 && !reduceMotion) { mode = 'walk'; target = 20 + Math.random() * (innerWidth - W - 40) }
      x = Math.max(4, Math.min(innerWidth - W - 4, x))
      frameTimer += dt
      if (frameTimer > 0.18) { frameTimer = 0; frame++ }
    }
    render()
    requestAnimationFrame(tick)
  }

  // перетаскивание и клик
  el.addEventListener('pointerdown', e => {
    el.setPointerCapture(e.pointerId)
    dragging = { dx: e.clientX - x, dy: e.clientY - y, sx: e.clientX, sy: e.clientY, moved: false }
    if (mode === 'sleep') wake()
    idle = 0
  })
  el.addEventListener('pointermove', e => {
    if (!dragging) return
    if (Math.abs(e.clientX - dragging.sx) + Math.abs(e.clientY - dragging.sy) > 6) dragging.moved = true
    if (!dragging.moved) return
    if (!el.classList.contains('held')) emote('!', 900)
    shake += Math.abs(e.movementX) + Math.abs(e.movementY)
    mode = 'walk'
    el.classList.add('held')
    dir = e.movementX > 0 ? 1 : e.movementX < 0 ? -1 : dir
    x = Math.max(0, Math.min(innerWidth - W, e.clientX - dragging.dx))
    y = Math.max(0, Math.min(ground(), e.clientY - dragging.dy))
  })
  el.addEventListener('pointerup', () => {
    const wasDrag = dragging?.moved
    dragging = null
    el.classList.remove('held')
    vy = 0
    fallFrom = y
    if (!wasDrag) poke()
  })
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); poke() } })

  function wake() {
    // проснулся: потягивается и удивляется
    mode = 'sit'
    el.classList.remove('stretch'); void el.offsetWidth; el.classList.add('stretch')
    emote('!', 900)
  }

  function poke() {
    if (mode === 'sleep') { wake(); idle = 0; return }
    idle = 0
    mode = 'sit'
    el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop')
    hearts()
    emote('♥', 1200)
    chat.toggle()
  }

  bring.addEventListener('click', () => setHidden(false))
  chat.onKind = kind => { setKind(kind); emote('✨', 1200); el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop') }
  chat.onMood = face => emote(face, 1400)
  chat.onHide = () => setHidden(true)
  addEventListener('resize', () => { x = Math.min(x, innerWidth - W - 4); y = Math.min(y, ground()) })
  requestAnimationFrame(tick)
}

// ---------- окно разговора ----------
function buildChat() {
  const box = document.createElement('div')
  box.className = 'pet-chat'
  box.hidden = true
  box.setAttribute('role', 'dialog')
  box.setAttribute('aria-label', 'Разговор с питомцем')
  const head = document.createElement('div')
  head.className = 'pet-chat-head'
  const title = document.createElement('b')
  const gear = document.createElement('button')
  gear.type = 'button'
  gear.className = 'pet-gear'
  gear.title = 'Сменить питомца'
  gear.setAttribute('aria-label', 'Настройки питомца')
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'pet-x'
  close.setAttribute('aria-label', 'Закрыть')
  close.textContent = '×'
  head.append(title, gear, close)

  const settings = document.createElement('div')
  settings.className = 'pet-settings'
  settings.hidden = true
  const kinds = new Map()
  for (const [id, p] of Object.entries(PETS)) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'pet-kind'
    const c = document.createElement('canvas')
    c.width = 18
    c.height = 12
    draw(c.getContext('2d'), p.shape.stand, p.colors)
    b.append(c, p.name)
    b.addEventListener('click', () => api.onKind?.(id))
    kinds.set(id, b)
    settings.append(b)
  }
  const hide = document.createElement('button')
  hide.type = 'button'
  hide.className = 'pet-hide'
  hide.textContent = 'Спрятать питомца'
  hide.addEventListener('click', () => api.onHide?.())
  settings.append(hide)

  const log = document.createElement('div')
  log.className = 'pet-log'
  const chips = document.createElement('div')
  chips.className = 'pet-chips'
  const form = document.createElement('form')
  form.className = 'pet-form'
  const input = document.createElement('input')
  input.placeholder = 'Спроси меня…'
  input.setAttribute('aria-label', 'Вопрос питомцу')
  input.maxLength = 120
  const send = document.createElement('button')
  send.type = 'submit'
  send.textContent = '➤'
  send.setAttribute('aria-label', 'Спросить')
  form.append(input, send)
  box.append(head, settings, log, chips, form)

  let greeted = false
  const last = { x: 0, y: 0 }
  let typing = null

  function say(text, who) {
    const p = document.createElement('p')
    p.className = `pet-msg ${who}`
    log.append(p)
    if (who === 'me') { p.textContent = text; log.scrollTop = log.scrollHeight; return Promise.resolve() }
    // «печатает…», потом текст появляется по буквам
    p.classList.add('typing')
    return new Promise(resolve => {
      setTimeout(() => {
        p.classList.remove('typing')
        let i = 0
        clearInterval(typing)
        typing = setInterval(() => {
          i += 2
          p.textContent = text.slice(0, i)
          log.scrollTop = log.scrollHeight
          if (i >= text.length) { clearInterval(typing); resolve() }
        }, 18)
      }, 450)
    })
  }

  function answerFor(q) {
    const t = q.toLowerCase()
    let best = null, score = 0
    for (const item of QA) {
      const s = item[1].filter(k => t.includes(k)).length + (t === item[0].toLowerCase() ? 5 : 0)
      if (s > score) { score = s; best = item }
    }
    return best ? best[2] : FALLBACK
  }

  async function ask(q) {
    await say(q, 'me')
    const a = answerFor(q)
    api.onMood?.('…')
    await say(a, 'pet')
    api.onMood?.(a === FALLBACK ? '?' : '♪')
  }

  for (const [q] of QA.slice(0, 8)) {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = q
    b.addEventListener('click', () => ask(q))
    chips.append(b)
  }
  form.addEventListener('submit', e => {
    e.preventDefault()
    const q = input.value.trim()
    if (!q) return
    input.value = ''
    ask(q)
  })
  gear.addEventListener('click', () => { settings.hidden = !settings.hidden })
  close.addEventListener('click', () => api.close())

  const api = {
    box,
    onKind: null,
    onHide: null,
    onMood: null,
    isOpen: () => !box.hidden,
    close() { box.hidden = true },
    toggle() {
      box.hidden = !box.hidden
      // сразу ставим окно над питомцем, без проезда через весь экран
      if (!box.hidden) { box.style.transition = 'none'; api.place(last.x, last.y); void box.offsetWidth; box.style.transition = '' }
      if (!box.hidden && !greeted) {
        greeted = true
        say('Мяу! Я помогу со сборкой. Выбери вопрос или напиши свой.', 'pet')
      }
    },
    markKind(kind) {
      title.textContent = PETS[kind].name
      for (const [id, b] of kinds) b.classList.toggle('on', id === kind)
    },
    place(x, y) {
      last.x = x
      last.y = y
      if (box.hidden) return
      const w = box.offsetWidth, h = box.offsetHeight
      const left = Math.max(10, Math.min(innerWidth - w - 10, x + W / 2 - w / 2))
      const top = Math.max(10, y - h - 14)
      box.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`
    },
  }
  return api
}
