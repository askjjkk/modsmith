// Словарь тем: основы слов (RU/EN) -> категории и поисковые запросы Modrinth.
// pinned: известные хорошие моды темы, проверяются первыми (если есть под версию).

import { EXTRA_THEMES } from './themes-extra.js'
import { MORE_THEMES } from './themes-more.js'
import { PLUS_THEMES } from './themes-plus.js'
import { MOD_THEMES } from './themes-mods.js'
import { buildDictThemes } from './themes-dict.js'
import { applyPins } from './pins.js'

const CORE_THEMES = [
  { id: 'magic', label: 'Магия', color: '#b77bff', stems: ['маги', '=мага', '=магом', '=магов', 'волшеб', 'заклин', 'чар', 'колдов', 'ведьм', 'magic', 'spell', 'wizard', 'sorcer', 'witch'], categories: ['magic'], queries: ['magic', 'spells'], pinned: ['irons-spells-n-spellbooks', 'ars-nouveau', 'botania'] },
  { id: 'tech', label: 'Технологии', color: '#ffb547', stems: ['технолог', 'техник', 'техно', 'механизм', 'завод', 'индустр', 'tech', 'industr', 'machine', 'factory'], categories: ['technology'], queries: ['technology', 'machines'], pinned: ['create'] },
  { id: 'automation', label: 'Автоматизация', color: '#ffa04d', stems: ['автоматиз', 'конвейер', 'automat', 'conveyor'], categories: ['technology'], queries: ['automation', 'create addon'], pinned: ['create'] },
  { id: 'energy', label: 'Энергия', color: '#ffe066', stems: ['электр', 'энерг', 'energy', 'electric', 'power'], categories: ['technology'], queries: ['energy', 'power generation'] },
  { id: 'dragons', label: 'Драконы', color: '#ff5a4f', stems: ['дракон', 'виверн', 'dragon', 'wyvern'], categories: ['mobs'], queries: ['dragons', 'dragon'] },
  { id: 'mobs', label: 'Мобы', color: '#7ee081', stems: ['моб', 'монстр', 'существ', 'creature', 'mob', 'monster'], categories: ['mobs'], queries: ['mobs', 'creatures'], pinned: ['alexs-mobs'] },
  { id: 'animals', label: 'Животные', color: '#9fdc6a', stems: ['животн', 'звер', 'питом', 'animal', '=pet', 'pets', 'wildlife'], categories: ['mobs'], queries: ['animals', 'pets'], pinned: ['alexs-mobs'] },
  { id: 'dinos', label: 'Динозавры', color: '#8bc34a', stems: ['динозавр', 'dino', 'jurass'], categories: [], queries: ['dinosaurs'] },
  { id: 'bosses', label: 'Боссы', color: '#ff6b81', stems: ['босс', 'boss'], categories: [], queries: ['bosses', 'boss'], pinned: ['bosses-of-mass-destruction'] },
  { id: 'dungeons', label: 'Данжи', color: '#c9a26b', stems: ['данж', 'подземел', 'руин', 'структур', 'dungeon', 'ruin', 'structure'], categories: ['worldgen', 'adventure'], queries: ['dungeons', 'structures'], pinned: ['yungs-better-dungeons', 'when-dungeons-arise'] },
  { id: 'adventure', label: 'Приключения', color: '#5ee7df', stems: ['приключ', 'исслед', 'путешеств', 'adventur', 'explor'], categories: ['adventure'], queries: ['adventure', 'exploration'] },
  { id: 'rpg', label: 'RPG', color: '#ff8fd1', stems: ['рпг', 'прокач', 'уровн', 'навык', 'rpg', 'skill', 'leveling'], categories: [], queries: ['rpg', 'skills leveling'] },
  { id: 'combat', label: 'Бои', color: '#ff7a59', stems: ['бой', 'бои', 'битв', 'сражен', 'оружи', 'меч', 'combat', 'weapon', 'sword'], categories: ['equipment'], queries: ['combat', 'weapons'], pinned: ['better-combat'] },
  { id: 'armor', label: 'Броня', color: '#b0c4de', stems: ['брон', 'доспех', 'armor', 'armour'], categories: ['equipment'], queries: ['armor'] },
  { id: 'guns', label: 'Оружие', color: '#9e9e9e', stems: ['огнестр', 'пушк', 'ружь', 'винтов', 'пистолет', 'gun', 'rifle', 'firearm'], categories: [], queries: ['guns'] },
  { id: 'hardcore', label: 'Хардкор', color: '#e53935', stems: ['хардкор', 'сложн', 'выжив', 'hardcore', 'difficult', 'survival'], categories: ['game-mechanics'], queries: ['hardcore', 'difficulty', 'survival'], pinned: ['tough-as-nails'] },
  { id: 'horror', label: 'Хоррор', color: '#8e24aa', stems: ['ужас', 'хоррор', 'страш', 'страх', 'жутк', 'крип', 'horror', 'scary', 'creepy'], categories: [], queries: ['horror', 'scary'] },
  { id: 'zombies', label: 'Зомби', color: '#6d8f3a', stems: ['зомби', 'апокалип', 'zombie', 'apocalyp'], categories: [], queries: ['zombie', 'apocalypse'] },
  { id: 'worldgen', label: 'Генерация мира', color: '#4caf50', stems: ['биом', 'генерац', 'ландшафт', 'рельеф', 'biome', 'terrain', 'worldgen'], categories: ['worldgen'], queries: ['biomes', 'terrain'], pinned: ['terralith', 'tectonic'] },
  { id: 'caves', label: 'Пещеры', color: '#607d8b', stems: ['пещер', 'cave'], categories: ['worldgen'], queries: ['caves'] },
  { id: 'ocean', label: 'Моря и пираты', color: '#29b6f6', stems: ['океан', 'море', 'морск', 'пират', 'корабл', 'ocean', '=sea', 'pirate', 'ship'], categories: [], queries: ['ocean', 'pirates', 'ships'] },
  { id: 'space', label: 'Космос', color: '#7c4dff', stems: ['космос', 'космич', 'ракет', 'планет', 'луна', 'луну', 'space', 'rocket', 'planet', 'galax'], categories: [], queries: ['space', 'planets'], pinned: ['ad-astra', 'creating-space'] },
  { id: 'dimensions', label: 'Измерения', color: '#ba68c8', stems: ['измерен', 'портал', 'dimension'], categories: ['worldgen'], queries: ['dimensions', 'new dimension'] },
  { id: 'medieval', label: 'Средневековье', color: '#a1887f', stems: ['средневек', 'замок', 'замки', 'рыцар', 'medieval', 'castle', 'knight'], categories: [], queries: ['medieval', 'castles'] },
  { id: 'fantasy', label: 'Фэнтези', color: '#ce93d8', stems: ['фэнтез', 'фентез', 'сказ', 'эльф', 'гном', 'fantasy', 'elf', 'elves', 'dwarf'], categories: [], queries: ['fantasy'] },
  { id: 'building', label: 'Строительство', color: '#d7a86e', stems: ['строит', 'постро', 'стройк', 'build'], categories: ['decoration'], queries: ['building blocks', 'building'] },
  { id: 'decor', label: 'Декор', color: '#f4a261', stems: ['декор', 'мебел', 'интерьер', 'уют', 'decor', 'furniture', 'cozy'], categories: ['decoration'], queries: ['furniture', 'decoration'], pinned: ['supplementaries'] },
  { id: 'food', label: 'Еда', color: '#ffcc80', stems: ['еда', 'еды', 'еду', 'едой', 'еде', 'готовк', 'кулинар', 'кухн', 'food', 'cook', 'kitchen'], categories: ['food'], queries: ['food', 'cooking'], pinned: ['farmers-delight'] },
  { id: 'farming', label: 'Фермерство', color: '#aed581', stems: ['ферм', 'урожа', 'огород', 'картошк', 'farm', 'crop', 'harvest'], categories: ['food'], queries: ['farming', 'crops'] },
  { id: 'seasons', label: 'Сезоны и погода', color: '#80deea', stems: ['сезон', 'погод', 'зима', 'зимн', 'season', 'weather'], categories: [], queries: ['seasons', 'weather'], pinned: ['serene-seasons'] },
  { id: 'storage', label: 'Хранение', color: '#bcaaa4', stems: ['сундук', 'хранен', 'рюкзак', 'storage', 'backpack', 'chest'], categories: ['storage'], queries: ['storage', 'backpacks'], pinned: ['sophisticated-backpacks'] },
  { id: 'inventory', label: 'Инвентарь', color: '#90a4ae', stems: ['инвентар', 'сортир', 'inventory', 'sorting'], categories: ['utility'], queries: ['inventory', 'sorting'] },
  { id: 'transport', label: 'Транспорт', color: '#4dd0e1', stems: ['транспорт', 'поезд', 'машин', 'самолет', 'лифт', 'transport', 'train', 'vehicle', 'plane'], categories: ['transportation'], queries: ['vehicles', 'trains'] },
  { id: 'travel', label: 'Телепорты', color: '#64ffda', stems: ['телепорт', 'варп', 'teleport', 'waystone', 'warp'], categories: ['transportation'], queries: ['teleport', 'waystones'], pinned: ['waystones'] },
  { id: 'economy', label: 'Экономика', color: '#ffd54f', stems: ['эконом', 'торгов', 'деньг', 'монет', 'магазин', 'economy', 'trade', 'money', 'shop'], categories: ['economy'], queries: ['economy', 'trading'] },
  { id: 'quests', label: 'Квесты', color: '#ffab40', stems: ['квест', 'задани', 'quest'], categories: [], queries: ['quests'] },
  { id: 'graphics', label: 'Графика', color: '#80d8ff', stems: ['шейдер', 'графи', 'визуал', 'shader', 'graphic', 'visual', 'beautiful'], categories: [], queries: ['visual', 'particles'], pinned: ['iris', 'oculus'] },
  { id: 'sound', label: 'Звук', color: '#b388ff', stems: ['звук', 'музык', 'атмосфер', 'sound', 'music', 'ambien', 'atmospher'], categories: [], queries: ['sound', 'ambient'], pinned: ['sound-physics-remastered', 'ambientsounds'] },
  { id: 'mining', label: 'Добыча', color: '#90caf9', stems: ['шахт', 'добыч', 'руд', 'копат', 'mining', '=ore', 'ores'], categories: [], queries: ['mining', 'ores'] },
  { id: 'pokemon', label: 'Покемоны', color: '#ffeb3b', stems: ['покемон', 'pokemon'], categories: [], queries: ['pokemon'] },
]

// лучшие моды каждой темы идут первыми (js/pins.js)
const HAND_MADE = [...CORE_THEMES, ...EXTRA_THEMES, ...MORE_THEMES, ...PLUS_THEMES]
// сначала темы из словаря (с русскими названиями), потом «франшизы» — каждая со своим модом; повторы по основам слов отсекаются
const FROM_DICT = buildDictThemes(HAND_MADE)
const takenStems = new Set([...HAND_MADE, ...FROM_DICT].flatMap(t => t.stems.map(x => x.toLowerCase())))
// Односложные названия — только достаточно редкие: «sound», «tips», «highlight» легко встретить в обычной фразе
const PLAIN_WORDS = new Set(['highlight', 'transparent', 'species', 'cluttered', 'bountiful', 'carpet', 'crawl', 'spark', 'trek', 'tools', 'tips', 'sound', 'particle',
  'particles', 'comforts', 'physics', 'explorations', 'explorify', 'promenade', 'hearths', 'icarus', 'blossom', 'winterly', 'cluttered', 'interactic', 'objects'])
const SHORT_OK = new Set(['create', 'quark', 'lootr', 'jade', 'twigs', 'goety', 'ae2', 'rei', 'emi'])
const distinctive = t => {
  const w = t.stems.length === 1 && t.stems[0].startsWith('=') ? t.stems[0].slice(1) : null
  return !w || SHORT_OK.has(w) || (w.length >= 7 && !PLAIN_WORDS.has(w))
}
// у мода убираем только основы, которые уже заняты другой темой («ae2»), а саму тему оставляем, пока есть хоть одно своё слово
const FROM_MODS = MOD_THEMES.map(t => ({ ...t, stems: t.stems.filter(x => !takenStems.has(x.toLowerCase())) })).filter(t => t.stems.length && distinctive(t))
export const THEMES = applyPins([...HAND_MADE, ...FROM_DICT, ...FROM_MODS])

// «Ванилла+» на случай, когда в описании нет понятных тем
export const VANILLA_PLUS = { id: 'vanilla', label: 'Ванилла+', color: '#7ee081', stems: [], categories: [], queries: ['vanilla', 'quality of life', 'structures'], pinned: ['terralith', 'yungs-better-dungeons', 'supplementaries', 'waystones'] }

// База: оптимизация и удобства. group: из группы остаётся только первый подходящий мод.
export const BASE = {
  perf: {
    label: 'Оптимизация',
    color: '#5ee7df',
    fabric: ['sodium', 'lithium', 'ferrite-core', 'entityculling', 'immediatelyfast', 'moreculling', 'dynamic-fps', 'modernfix', 'krypton'],
    quilt: ['sodium', 'lithium', 'ferrite-core', 'entityculling', 'immediatelyfast', 'moreculling', 'dynamic-fps', 'modernfix', 'krypton'],
    forge: ['embeddium', 'rubidium', 'ferrite-core', 'entityculling', 'immediatelyfast', 'modernfix', 'dynamic-fps', 'canary', 'radium'],
    neoforge: ['sodium', 'embeddium', 'lithium', 'ferrite-core', 'entityculling', 'immediatelyfast', 'modernfix', 'dynamic-fps'],
  },
  qol: {
    label: 'Удобства',
    color: '#ffcf4a',
    fabric: ['modmenu', 'jei', 'emi', 'xaeros-minimap', 'xaeros-world-map', 'journeymap', 'appleskin', 'mouse-tweaks', 'inventory-profiles-next', 'jade', 'resourcify'],
    quilt: ['modmenu', 'jei', 'emi', 'xaeros-minimap', 'xaeros-world-map', 'journeymap', 'appleskin', 'mouse-tweaks', 'inventory-profiles-next', 'jade', 'resourcify'],
    forge: ['jei', 'emi', 'xaeros-minimap', 'xaeros-world-map', 'journeymap', 'appleskin', 'mouse-tweaks', 'inventory-profiles-next', 'jade', 'resourcify'],
    neoforge: ['jei', 'emi', 'xaeros-minimap', 'xaeros-world-map', 'journeymap', 'appleskin', 'mouse-tweaks', 'inventory-profiles-next', 'jade', 'resourcify'],
  },
}

// «Атмосфера и полировка» — по мотивам топовых сборок вроде Lost Souls: анимации, живые звуки, частицы,
// красивые подсказки. Только клиентские и популярные моды; чего нет под версию — тихо пропускается.
const POLISH_COMMON = ['not-enough-animations', 'ambientsounds', 'particle-rain', 'cameraoverhaul', 'pick-up-notifier',
  'legendary-tooltips', 'item-borders', 'enchantment-descriptions', 'better-advancements', 'chat-heads', 'itemphysic-lite',
  'dynamiccrosshair', 'raised', 'spyglass-improvements', 'sound-physics-remastered', 'entity-model-features',
  'entitytexturefeatures', 'cherished-worlds', 'item-highlighter', 'particular-reforged', 'subtle-effects']
BASE.polish = {
  label: 'Атмосфера и полировка',
  color: '#b388ff',
  fabric: [...POLISH_COMMON, 'fallingleaves', 'visuality', 'explosive-enhancement', 'extrasounds', 'presence-footsteps', 'wakes', 'eating-animation', 'lambdynamiclights'],
  quilt: [...POLISH_COMMON, 'fallingleaves', 'visuality', 'presence-footsteps', 'lambdynamiclights'],
  forge: [...POLISH_COMMON, 'fallingleavesforge', 'visuality-forge', 'extrasoundsforge'],
  neoforge: [...POLISH_COMMON, 'fallingleavesforge', 'visuality-forge', 'extrasoundsforge', 'lambdynamiclights'],
}

// Взаимоисключающие группы: по slug и по названию
export const GROUPS = [
  { id: 'render', slugs: ['sodium', 'embeddium', 'rubidium', 'optifabric', 'canvas-renderer'], title: /\b(sodium|embeddium|rubidium|optifine)\b/i },
  // Lithium и его порты (Radium, Canary) встраиваются в одно и то же: вдвоём игра падает на старте (проверено запуском)
  { id: 'lithium', slugs: ['lithium', 'radium', 'canary'], title: /^(lithium|radium|canary)\b/i },
  // большие моды на биомы: вдвоём-втроём генерация мира зависает на 0% (сборка пользователя, 24.10)
  { id: 'biome_overhaul', slugs: ['biomes-o-plenty', 'terralith', 'oh-the-biomes-weve-gone', 'oh-the-biomes-youll-go', 'regions-unexplored', 'william-wythers-overhauled-overworld'], title: /\b(biomes o'? ?plenty|terralith|oh the biomes|regions unexplored|wythers)\b/i },
  // рельеф: Tectonic и Epic Terrain переделывают одно и то же (с Terralith Tectonic как раз дружит)
  { id: 'terrain', slugs: ['tectonic', 'epicterrain', 'lithosphere', 'big-globe'], title: /^(tectonic|epic terrain)\b/i },
  { id: 'shaders', slugs: ['iris', 'oculus'], title: /\b(iris shaders|oculus)\b/i },
  { id: 'minimap', slugs: ['xaeros-minimap', 'journeymap', 'voxelmap-updated', 'ftb-chunks-fabric', 'ftb-chunks-forge'], title: /\b(minimap|journeymap|voxelmap)\b/i },
  { id: 'worldmap', slugs: ['xaeros-world-map', 'journeymap'], title: /\bworld ?map\b/i },
  { id: 'recipes', slugs: ['jei', 'emi', 'rei'], title: /\b(just enough items|roughly enough items|\bemi\b)\b/i },
]

// сколько тематических модов (база и зависимости добавляются сверху)
// «Гигантская» — 300 тематических модов; ползунок позволяет любое число до 1000
export const SIZES = { light: 8, normal: 20, big: 45, giant: 300 }
