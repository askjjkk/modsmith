// Дополнения вокруг сборки: требования к компьютеру, сохранённые сборки, «Удиви меня».
import { THEMES } from './themes.js'

// ---------- требования к ПК ----------
const GPU_TIERS = [
  [0, 'любая видеокарта (встроенная тоже)'],
  [1, 'GTX 1050 / RX 560 и новее'],
  [2, 'GTX 1060 / RX 580 и новее'],
  [3, 'RTX 2060 / RX 5600 XT и новее'],
  [4, 'RTX 3060 / RX 6700 и новее'],
]

/**
 * Прикидка требований: по числу модов, шейдерам и ресурспакам.
 * Это оценка, а не замер: сколько ОЗУ выделить игре, чего хватит процессору и видеокарте.
 */
export function requirements({ modCount, shaders = 0, packs = 0, version = '' }) {
  // ОЗУ игре: ~2 ГБ базы + по 25–40 МБ на мод, ресурспаки и шейдеры съедают текстуры
  const heavyMods = modCount > 250
  const ram = Math.min(16, Math.max(2, Math.ceil((2 + modCount * (heavyMods ? 0.04 : 0.028) + packs * 0.03 + (shaders ? 1 : 0)) / 1) ))
  const ramSteps = [2, 3, 4, 6, 8, 10, 12, 16]
  const gameRam = ramSteps.find(x => x >= ram) || 16
  const totalRam = Math.max(8, gameRam * 2)
  let gpu = 0
  if (shaders) gpu = shaders > 4 ? 4 : 3
  else if (packs > 40 || modCount > 300) gpu = 2
  else if (packs > 10 || modCount > 120) gpu = 1
  const cpu = modCount > 400 ? '6 ядер и больше (Ryzen 5 / Core i5 последних лет)'
    : modCount > 150 ? '4–6 ядер (Ryzen 3 / Core i3 последних лет)'
      : '4 ядра, подойдёт и старый процессор'
  const disk = Math.max(1, Math.round((modCount * 0.012 + packs * 0.05 + shaders * 0.03 + 1.5) * 10) / 10)
  const hours = modCount > 500 ? '5–10 минут' : modCount > 200 ? '2–4 минуты' : '30–90 секунд'
  return {
    gameRam, totalRam, gpu: GPU_TIERS[gpu][1], cpu, disk, firstStart: hours,
    text: `Игре выделить ${gameRam} ГБ (всего в компьютере от ${totalRam} ГБ). Видеокарта: ${GPU_TIERS[gpu][1]}. Процессор: ${cpu}. Места на диске около ${disk} ГБ, лучше SSD. Первый запуск ${hours}.`,
  }
}

// ---------- сохранённые сборки ----------
const KEY = 'modsmith-profiles'

export function loadProfiles() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

export function saveProfile(profile) {
  const list = loadProfiles().filter(p => p.hash !== profile.hash)
  list.unshift({ ...profile, date: new Date().toISOString() })
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 30))) } catch { /* приватный режим: просто не сохранится */ }
  return list.slice(0, 30)
}

export function deleteProfile(hash) {
  const list = loadProfiles().filter(p => p.hash !== hash)
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* ничего */ }
  return list
}

// ---------- «Удиви меня» ----------
const MOODS = ['для вечера с друзьями', 'на выходные', 'чтобы было необычно', 'для длинного прохождения', 'для стрима', 'для себя']
const SIZES = ['light', 'normal', 'normal', 'big']

/** Случайное описание: 3–5 разных тем + настроение. Возвращает { text, size } */
export function surprise(rand = Math.random) {
  // только настоящие темы с русским названием: «франшизы» по названию модов и словарные не берём
  const pool = THEMES.filter(t => !/^(mod|q):/.test(t.id) && t.categories !== undefined && t.label.length < 28 && !['Ванилла+', 'Слабый компьютер', 'Лёгкий режим'].includes(t.label))
  const n = 3 + Math.floor(rand() * 3)
  const picked = []
  while (picked.length < n) {
    const t = pool[Math.floor(rand() * pool.length)]
    if (!picked.includes(t)) picked.push(t)
  }
  const mood = MOODS[Math.floor(rand() * MOODS.length)]
  const words = picked.map(t => t.stems.find(s => /^[а-яё ]{4,}$/i.test(s.replace(/^=/, ''))) || t.label).map(w => w.replace(/^=/, ''))
  const text = `Сборка ${mood}: ${picked.map(t => t.label.toLowerCase()).join(', ')}`
  return { text, size: SIZES[Math.floor(rand() * SIZES.length)], themes: picked.map(t => t.id), words }
}
