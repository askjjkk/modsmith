// Темы из словаря (js/dictionary.js): всё, что уже умеем переводить, теперь ещё и обычные темы с русским названием —
// их видно в окне «+ добавить тему», их можно выбрать, запретить и заказать словом.
import { DICT } from './dictionary.js'

// английский запрос -> название темы
const LABELS = {
  airplane: 'Самолёты', 'fighter jet': 'Истребители', airship: 'Дирижабли', truck: 'Грузовики', bus: 'Автобусы', tractor: 'Тракторы',
  bicycle: 'Велосипеды', skateboard: 'Скейтборды', scooter: 'Самокаты', boat: 'Лодки', yacht: 'Яхты', rocket: 'Ракеты',
  'space shuttle': 'Шаттлы', satellite: 'Спутники', escalator: 'Эскалаторы', 'cable car': 'Канатные дороги', monorail: 'Монорельс',
  train: 'Вагоны', locomotive: 'Паровозы', pistol: 'Пистолеты', rifle: 'Автоматы и винтовки', sniper: 'Снайперы', shotgun: 'Дробовики',
  'machine gun': 'Пулемёты', grenade: 'Гранаты', bazooka: 'Базуки', bow: 'Луки', crossbow: 'Арбалеты', spear: 'Копья', halberd: 'Алебарды',
  dagger: 'Кинжалы', hammer: 'Молоты', 'battle axe': 'Боевые секиры', scythe: 'Косы', shield: 'Щиты', helmet: 'Шлемы', chainmail: 'Кольчуги',
  cloak: 'Плащи', backpack: 'Рюкзаки (предмет)', bag: 'Сумки', parachute: 'Парашюты', binoculars: 'Бинокли', flashlight: 'Фонарики',
  torch: 'Факелы', knight: 'Рыцари (персонажи)', viking: 'Викинги (народ)', pirate: 'Пираты (персонажи)', sheriff: 'Шерифы', police: 'Полиция',
  firefighter: 'Пожарные', doctor: 'Врачи', medic: 'Медики', teacher: 'Учителя', cook: 'Повара', bakery: 'Пекарни', blacksmith: 'Кузнецы',
  miner: 'Шахтёры', hunter: 'Охотники', farmer: 'Фермеры', trader: 'Торговцы', merchant: 'Купцы', mercenary: 'Наёмники', bandit: 'Бандиты',
  gladiator: 'Гладиаторы', spy: 'Шпионы', soldier: 'Солдаты', army: 'Армия', general: 'Генералы', king: 'Короли', queen: 'Королевы',
  princess: 'Принцессы', dog: 'Собаки', cat: 'Коты', hamster: 'Хомяки', rabbit: 'Кролики', horse: 'Лошади (звери)', pony: 'Пони', deer: 'Олени',
  moose: 'Лоси', bear: 'Медведи', wolf: 'Волки', fox: 'Лисы (звери)', tiger: 'Тигры', lion: 'Львы', elephant: 'Слоны', giraffe: 'Жирафы',
  monkey: 'Обезьяны', gorilla: 'Гориллы', penguin: 'Пингвины', owl: 'Совы', eagle: 'Орлы', crow: 'Вороны', parrot: 'Попугаи', duck: 'Утки',
  goose: 'Гуси', chicken: 'Куры', cow: 'Коровы', pig: 'Свиньи', sheep: 'Овцы', goat: 'Козы', bull: 'Быки', snake: 'Змеи', lizard: 'Ящерицы',
  turtle: 'Черепахи', crocodile: 'Крокодилы', frog: 'Лягушки', toad: 'Жабы', spider: 'Пауки (звери)', scorpion: 'Скорпионы', ant: 'Муравьи',
  butterfly: 'Бабочки', firefly: 'Светлячки', dragonfly: 'Стрекозы', beetle: 'Жуки', dolphin: 'Дельфины', octopus: 'Осьминоги', squid: 'Кальмары',
  crab: 'Крабы', jellyfish: 'Медузы', catfish: 'Сомы', salmon: 'Лососи', raccoon: 'Еноты', squirrel: 'Белки', hedgehog: 'Ёжики', beaver: 'Бобры',
  capybara: 'Капибары', panda: 'Панды', koala: 'Коалы', kangaroo: 'Кенгуру', sloth: 'Ленивцы', axolotl: 'Аксолотли', flamingo: 'Фламинго',
  sabertooth: 'Саблезубые', troll: 'Тролли', goblin: 'Гоблины', orc: 'Орки', elf: 'Эльфы', dwarf: 'Гномы', fairy: 'Феи', mermaid: 'Русалки',
  cyclops: 'Циклопы', minotaur: 'Минотавры', centaur: 'Кентавры', golem: 'Големы (существа)', yeti: 'Йети', ghost: 'Привидения', spirit: 'Духи',
  skeleton: 'Скелеты', lich: 'Личи', necromancer: 'Некроманты (персонажи)', warlock: 'Колдуны', shaman: 'Шаманы', cleric: 'Жрецы (персонажи)',
  demon: 'Демоны', angel: 'Ангелы (персонажи)', gods: 'Боги', castle: 'Замки', fortress: 'Крепости', tower: 'Башни', lighthouse: 'Маяки',
  bridge: 'Мосты (стройка)', windmill: 'Мельницы', temple: 'Храмы', ruins: 'Руины', tomb: 'Гробницы', crypt: 'Склепы', catacombs: 'Катакомбы',
  labyrinth: 'Лабиринты', mine: 'Шахты и рудники', tundra: 'Тундра', steppe: 'Степи', canyon: 'Каньоны', oasis: 'Оазисы', waterfall: 'Водопады',
  lake: 'Озёра', river: 'Реки (природа)', 'coral reef': 'Рифы', coral: 'Кораллы', grove: 'Рощи', mushroom: 'Грибные места', village: 'Деревни (постройки)',
  settlement: 'Поселения', shop: 'Магазины', bank: 'Банки', prison: 'Тюрьмы', hospital: 'Больницы', school: 'Школы', museum: 'Музеи',
  library: 'Библиотеки', barracks: 'Казармы', bunker: 'Бункеры', shelter: 'Убежища', laboratory: 'Лаборатории', factory: 'Заводы',
  warehouse: 'Склады', house: 'Дома', mansion: 'Особняки', apartment: 'Квартиры', garden: 'Сады (огороды)', park: 'Парки',
  'amusement park': 'Парки аттракционов', circus: 'Цирк', crystals: 'Кристаллы', diamond: 'Алмазы', emerald: 'Изумруды', ruby: 'Рубины',
  sapphire: 'Сапфиры', gold: 'Золото', silver: 'Серебро', copper: 'Медь', tin: 'Олово', steel: 'Сталь', titanium: 'Титан', uranium: 'Уран',
  scrolls: 'Свитки', totems: 'Тотемы', staff: 'Жезлы и посохи', wand: 'Волшебные палочки', books: 'Книги', maps: 'Карты (предмет)', clock: 'Часы',
  calendar: 'Календарь', rain: 'Дожди', thunderstorm: 'Грозы', earthquake: 'Землетрясения', tsunami: 'Цунами', eclipse: 'Затмения', moon: 'Луна',
  sun: 'Солнце', wires: 'Провода', battery: 'Батареи', generator: 'Генераторы', 'wind turbine': 'Ветрогенераторы', conveyor: 'Конвейерные ленты',
  computer: 'Компьютеры (предмет)', phone: 'Телефоны', tv: 'Телевизоры', radio: 'Радио', printer: 'Принтеры', piano: 'Пианино', guitar: 'Гитары',
  drums: 'Барабаны', hunting: 'Охота', pizza: 'Пицца', burger: 'Бургеры', cake: 'Торты', sweets: 'Сладкое', tea: 'Чай', coffee: 'Кофе', beer: 'Пиво',
  wine: 'Вино', bread: 'Хлеб (еда)', fruit: 'Фрукты', vegetables: 'Овощи', costumes: 'Костюмы', masks: 'Маски', hair: 'Парики', hairstyle: 'Причёски',
  companion: 'Спутники-помощники', clans: 'Кланы', diplomacy: 'Дипломатия', siege: 'Осады (машины)', money: 'Деньги', coins: 'Монеты',
  auction: 'Аукционы', lottery: 'Лотереи', football: 'Футбол', basketball: 'Баскетбол', olympics: 'Олимпиада', diseases: 'Болезни (механика)',
  death: 'Смерть', revive: 'Воскрешение', souls: 'Души', dieselpunk: 'Дизельпанк', ancient: 'Древний мир', greek: 'Древняя Греция',
  nordic: 'Север', native: 'Индейцы', noir: 'Нуар (стиль)', cartoon: 'Мультяшный стиль', pixel: 'Пиксельный стиль', radiation: 'Радиация',
  werewolf: 'Оборотни (персонажи)', ufo: 'НЛО', superhero: 'Супергерои (персонажи)', marvel: 'Марвел',
}

const COLORS = ['#ffab91', '#80cbc4', '#ce93d8', '#a5d6a7', '#ffe082', '#90caf9', '#f48fb1', '#bcaaa4', '#9fa8da', '#80deea']

// Возвращает темы, у которых нет «двойника» среди existing (по основам слов): так «шахты» не дублируют тему «Добыча»
export function buildDictThemes(existing) {
  const byEn = {}
  for (const [key, en] of Object.entries(DICT)) (byEn[en] ||= []).push(key)
  const taken = existing.flatMap(t => t.stems.map(s => s.replace(/^=/, '').toLowerCase()))
  const queries = new Set(existing.flatMap(t => t.queries.map(q => q.toLowerCase())))
  const out = []
  for (const [en, keys] of Object.entries(byEn)) {
    if (queries.has(en.toLowerCase())) continue
    // ни одно слово не пересекается с основами существующих тем (в обе стороны)
    if (keys.some(k => taken.some(t => t.length >= 3 && (k.startsWith(t) || t.startsWith(k))))) continue
    out.push({
      id: `q:${en}`, label: LABELS[en] || keys[0][0].toUpperCase() + keys[0].slice(1), color: COLORS[out.length % COLORS.length],
      stems: keys.map(k => (k.length <= 3 ? `=${k}` : k)), categories: [], queries: [en], pinned: [],
    })
  }
  return out
}
