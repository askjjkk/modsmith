// Словарь «русское слово → английский запрос» для всего, чего нет среди тем.
// Если слово из описания не узнала ни одна тема, ищем его на Modrinth по переводу (тема «на лету»).
// Ключ — начало слова (как в темах): «вертол» ловит «вертолёт», «вертолёты», «вертолётами». «=» — только целое слово.
export const DICT = {
  // транспорт и техника
  вертол: 'helicopter', самолет: 'airplane', самолёт: 'airplane', истребит: 'fighter jet', дирижабл: 'airship', воздушн: 'airship',
  танк: 'tank', броневик: 'armored vehicle', грузовик: 'truck', автобус: 'bus', трактор: 'tractor', экскават: 'excavator',
  мотоцикл: 'motorcycle', велосипед: 'bicycle', скейт: 'skateboard', самокат: 'scooter', лодк: 'boat', яхт: 'yacht',
  подводн: 'submarine', субмарин: 'submarine', ракет: 'rocket', шаттл: 'space shuttle', спутник: 'satellite', лифт: 'elevator',
  эскалатор: 'escalator', канатн: 'cable car', монорельс: 'monorail', трамва: 'tram', вагон: 'train', локомотив: 'locomotive',
  // оружие и снаряжение
  пистолет: 'pistol', автомат: 'rifle', винтовк: 'rifle', снайпер: 'sniper', дробовик: 'shotgun', пулемет: 'machine gun',
  граната: 'grenade', гранат: 'grenade', базук: 'bazooka', лук: 'bow', арбалет: 'crossbow', копь: 'spear', копье: 'spear',
  алебард: 'halberd', катан: 'katana', кинжал: 'dagger', молот: 'hammer', секир: 'battle axe', коса: 'scythe', кос: 'scythe',
  щит: 'shield', шлем: 'helmet', доспех: 'armor', кольчуг: 'chainmail', плащ: 'cloak', рюкзак: 'backpack', сумк: 'bag',
  парашют: 'parachute', крюк: 'grappling hook', бинокл: 'binoculars', фонар: 'flashlight', факел: 'torch',
  // профессии и люди
  ниндзя: 'ninja', самура: 'samurai', рыцар: 'knight', викинг: 'viking', пират: 'pirate', ковбо: 'cowboy', шериф: 'sheriff',
  полиц: 'police', пожарн: 'firefighter', врач: 'doctor', медик: 'medic', учител: 'teacher', повар: 'cook', пекар: 'bakery',
  кузнец: 'blacksmith', шахтер: 'miner', рыбак: 'fishing', охотн: 'hunter', фермер: 'farmer', торговц: 'trader', купец: 'merchant',
  наемник: 'mercenary', бандит: 'bandit', разбойник: 'bandit', гладиатор: 'gladiator', ассасин: 'assassin', шпион: 'spy',
  солдат: 'soldier', армия: 'army', армии: 'army', генерал: 'general', король: 'king', королев: 'queen', принцесс: 'princess',
  // существа и животные
  собак: 'dog', щенк: 'dog', кот: 'cat', коты: 'cat', котов: 'cat', кошк: 'cat', кошечк: 'cat', котик: 'cat', котят: 'cat', хомяк: 'hamster', кролик: 'rabbit', заяц: 'rabbit',
  лошад: 'horse', пони: 'pony', единорог: 'unicorn', олен: 'deer', лоси: 'moose', лось: 'moose', медвед: 'bear', волк: 'wolf', лиса: 'fox', лисы: 'fox', лисиц: 'fox', лисён: 'fox', лисен: 'fox',
  тигр: 'tiger', лев: 'lion', львы: 'lion', львов: 'lion', слон: 'elephant', жираф: 'giraffe', обезьян: 'monkey', горилл: 'gorilla',
  пингвин: 'penguin', сова: 'owl', совы: 'owl', орел: 'eagle', орлы: 'eagle', ворон: 'crow', попуга: 'parrot', утка: 'duck', утки: 'duck', гуси: 'goose', гусь: 'goose',
  куриц: 'chicken', петух: 'chicken', корова: 'cow', коров: 'cow', свинь: 'pig', овцы: 'sheep', овец: 'sheep', коза: 'goat', козы: 'goat', козел: 'goat', бык: 'bull', быки: 'bull',
  змея: 'snake', змеи: 'snake', ящериц: 'lizard', черепах: 'turtle', крокодил: 'crocodile', лягушк: 'frog', жабы: 'toad', жаба: 'toad',
  паук: 'spider', скорпион: 'scorpion', муравь: 'ant', бабочк: 'butterfly', светлячк: 'firefly', стрекоз: 'dragonfly', жук: 'beetle', жуки: 'beetle',
  акул: 'shark', кит: 'whale', киты: 'whale', дельфин: 'dolphin', осьминог: 'octopus', кальмар: 'squid', краб: 'crab', медуз: 'jellyfish',
  рыбк: 'fish', рыбы: 'fish', сом: 'catfish', лосос: 'salmon', енот: 'raccoon', белк: 'squirrel', ёж: 'hedgehog', еж: 'hedgehog', бобр: 'beaver',
  капибар: 'capybara', панд: 'panda', коал: 'koala', кенгуру: 'kangaroo', ленивц: 'sloth', аксолотл: 'axolotl', фламинго: 'flamingo',
  мамонт: 'mammoth', саблезуб: 'sabertooth', тролл: 'troll', гоблин: 'goblin', орк: 'orc', орки: 'orc', эльф: 'elf', гном: 'dwarf', дварф: 'dwarf',
  фея: 'fairy', феи: 'fairy', русал: 'mermaid', циклоп: 'cyclops', минотавр: 'minotaur', кентавр: 'centaur', грифон: 'griffin',
  феникс: 'phoenix', гидр: 'hydra', кракен: 'kraken', голем: 'golem', йети: 'yeti', снежн: 'snow', призрак: 'ghost', дух: 'spirit',
  мумия: 'mummy', мумии: 'mummy', скелет: 'skeleton', лич: 'lich', некромант: 'necromancer', ведьм: 'witch', колдун: 'warlock',
  шаман: 'shaman', друид: 'druid', паладин: 'paladin', жрец: 'cleric', монах: 'monk', демон: 'demon', ангел: 'angel', бог: 'gods',
  // мир, места и постройки
  замок: 'castle', замки: 'castle', крепост: 'fortress', башн: 'tower', маяк: 'lighthouse', мост: 'bridge', мельниц: 'windmill',
  храм: 'temple', пирамид: 'pyramid', руин: 'ruins', гробниц: 'tomb', склеп: 'crypt', катакомб: 'catacombs', лабиринт: 'labyrinth',
  пещер: 'caves', шахта: 'mine', шахты: 'mine', рудник: 'mine', вулкан: 'volcano', гора: 'mountains', горы: 'mountains', остров: 'islands',
  пустын: 'desert', джунгл: 'jungle', болот: 'swamp', тундр: 'tundra', саванн: 'savanna', степ: 'steppe', каньон: 'canyon',
  оазис: 'oasis', водопад: 'waterfall', озер: 'lake', река: 'river', реки: 'river', пляж: 'beach', риф: 'coral reef', коралл: 'coral',
  лес: 'forest', леса: 'forest', лесн: 'forest', роща: 'grove', сакур: 'cherry blossom', грибн: 'mushroom', гриб: 'mushroom', цветы: 'flowers', цветов: 'flowers', цветоч: 'flowers', деревья: 'trees', деревьев: 'trees',
  город: 'city', деревн: 'village', поселени: 'settlement', таверн: 'tavern', трактир: 'tavern', рынок: 'market', магазин: 'shop',
  банк: 'bank', тюрьм: 'prison', больниц: 'hospital', школ: 'school', музе: 'museum', библиотек: 'library', казарм: 'barracks',
  бункер: 'bunker', убежищ: 'shelter', лаборатор: 'laboratory', завод: 'factory', склад: 'warehouse',
  дом: 'house', домик: 'house', особняк: 'mansion', квартир: 'apartment', мебел: 'furniture', кухн: 'kitchen', ванн: 'bathroom',
  сад: 'garden', сады: 'garden', огород: 'garden', теплиц: 'greenhouse', парк: 'park', аттракцион: 'amusement park', цирк: 'circus',
  // предметы, ремёсла, механики
  руда: 'ores', руды: 'ores', руд: 'ores', кристал: 'crystals', самоцвет: 'gems', алмаз: 'diamond', изумруд: 'emerald', рубин: 'ruby', сапфир: 'sapphire',
  золот: 'gold', серебр: 'silver', медь: 'copper', олов: 'tin', сталь: 'steel', титан: 'titanium', уран: 'uranium',
  зель: 'potions', алхими: 'alchemy', свитк: 'scrolls', руны: 'runes', руна: 'runes', артефакт: 'artifacts', амулет: 'amulets',
  кольц: 'rings', тотем: 'totems', жезл: 'staff', посох: 'staff', палочк: 'wand', книг: 'books', карты: 'maps', карта: 'maps', компас: 'compass',
  часы: 'clock', календар: 'calendar', погод: 'weather', дожд: 'rain', гроз: 'thunderstorm', ураган: 'tornado', торнадо: 'tornado',
  землетрясен: 'earthquake', цунами: 'tsunami', метеорит: 'meteor', метеор: 'meteor', затмени: 'eclipse', луна: 'moon', солнц: 'sun',
  электрич: 'electricity', провод: 'wires', батаре: 'battery', генератор: 'generator', солнечн: 'solar panels', ветрян: 'wind turbine',
  трубы: 'pipes', труб: 'pipes', конвейер: 'conveyor', робот: 'robots', дрон: 'drones', компьютер: 'computer', телефон: 'phone',
  телевиз: 'tv', радио: 'radio', камер: 'camera', принтер: 'printer', лазер: 'laser', портал: 'portals', телепорт: 'teleport',
  музык: 'music', пианино: 'piano', гитар: 'guitar', барабан: 'drums', танц: 'dance', эмоци: 'emotes',
  рыбалк: 'fishing', охот: 'hunting', готовк: 'cooking', пицц: 'pizza', бургер: 'burger', суши: 'sushi', торт: 'cake', сладост: 'sweets',
  чай: 'tea', кофе: 'coffee', пиво: 'beer', вино: 'wine', сыр: 'cheese', хлеб: 'bread', фрукт: 'fruit', овощ: 'vegetables',
  одежд: 'clothes', шляп: 'hats', костюм: 'costumes', маск: 'masks', украшени: 'jewelry', парик: 'hair', прическ: 'hairstyle',
  питом: 'pets', компаньон: 'companion', спутниц: 'companion', наездник: 'mounts', ездов: 'mounts', приручен: 'taming',
  квест: 'quests', задани: 'quests', достижен: 'achievements', навык: 'skills', умени: 'skills', классы: 'classes', классов: 'classes', расы: 'races',
  раса: 'races', гильди: 'guilds', клан: 'clans', фракци: 'factions', дипломат: 'diplomacy', войн: 'war', осад: 'siege',
  экономик: 'economy', деньг: 'money', монет: 'coins', аукцион: 'auction', лотере: 'lottery', казино: 'casino',
  паркур: 'parkour', гонк: 'racing', футбол: 'football', баскетбол: 'basketball', спорт: 'sports', олимпиад: 'olympics',
  выживани: 'survival', голод: 'hunger', жажд: 'thirst', температур: 'temperature', болезн: 'diseases', травм: 'injuries',
  сон: 'sleep', кровать: 'beds', смерт: 'death', могил: 'graves', воскрешен: 'revive', душ: 'souls', проклят: 'curses',
  // жанры и настроение
  стимпанк: 'steampunk', дизельпанк: 'dieselpunk', киберпанк: 'cyberpunk', постапок: 'post apocalyptic', апокалипс: 'apocalypse',
  средневек: 'medieval', антич: 'ancient', египет: 'egypt', рим: 'roman', грец: 'greek', япони: 'japanese', китай: 'chinese',
  славян: 'slavic', сканди: 'nordic', арабск: 'arabian', индейц: 'native', ацтек: 'aztec', майя: 'mayan', вестерн: 'western',
  нуар: 'noir', детектив: 'detective', мистик: 'mystery', сказк: 'fairy tale', мульт: 'cartoon', аниме: 'anime', пиксел: 'pixel',
  реализм: 'realistic', физик: 'physics', разрушен: 'destruction', взрыв: 'explosions', ядерн: 'nuclear', радиац: 'radiation',
  зомби: 'zombie', вампир: 'vampire', оборотен: 'werewolf', оборотн: 'werewolf', инопланет: 'aliens', пришел: 'aliens', нло: 'ufo',
  супергеро: 'superhero', марвел: 'marvel', покемон: 'pokemon', динозавр: 'dinosaurs', драконы: 'dragons',
}

const KEYS = Object.keys(DICT).sort((a, b) => b.length - a.length)

/** Перевод слова: { stem, en } или null. Короткие основы (до 3 букв) — только целым словом. */
export function lookup(token) {
  for (const k of KEYS) {
    if (k.length <= 3 ? token === k : token.startsWith(k)) return { stem: k, en: DICT[k] }
  }
  return null
}
