// Моды, которые падали при настоящем запуске (tools/server_check.py или crash-report игрока).
// Ключ — slug на Modrinth, значение — почему. Пополняется после проверок запуском.
export const BROKEN = {
  'anarchy-rpg': 'падает на старте со Spell Engine 1.10 (проверено запуском)',
  cobbleboss: 'падает без Cobblemon (проверено запуском)',
  'sdm-shop': 'падает при запуске: нужен SDMCore, которого он не объявляет (проверено запуском)',
  'autosow-by-neni-o': 'падает при запуске на 1.21.1 (проверено запуском)',
  'log-begone': 'прячет ошибки из лога: если игра упадёт, виновника будет не найти',
  'logbegone': 'прячет ошибки из лога: если игра упадёт, виновника будет не найти',
  connector: 'запускает Fabric-моды на NeoForge (бета): часто ломает игру',
  // «slug@загрузчик» — ломается только на этом загрузчике
  'platform@forge': 'на Forge везёт внутри свою копию MixinExtras: игра падает на старте (проверено запуском)',
  'destroying-minecraft': 'падает на старте: ошибка Cardinal Components (проверено запуском)',
}

// Моды только для игры, хотя на Modrinth помечены и для сервера: на сервер их не ставим (проверено запуском)
export const CLIENT_ONLY = {
  fog: 'на сервере падает: ему нужны классы игры (KeyMapping)',
}

const KEY = 'modsmith-blocked'

// Личный список: что «Доктор сборки» нашёл по crash-report этого игрока
export function loadBlocked() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}

export function addBlocked(slug, why) {
  const list = loadBlocked()
  list[slug] = why
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* приватный режим: просто не запомним */ }
}

export function allBlocked() {
  return { ...BROKEN, ...loadBlocked() }
}
