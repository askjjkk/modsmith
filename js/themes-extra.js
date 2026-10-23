// Дополнительные темы. Формат тот же, что в themes.js: stems (основы слов RU/EN, «=слово» — только целиком),
// categories (категории Modrinth), queries (английские запросы к поиску), pinned (проверенные моды).

const T = (id, label, color, stems, queries, categories = [], pinned = []) => ({ id, label, color, stems, categories, queries, pinned })

export const EXTRA_THEMES = [
  // --- мир и исследование ---
  T('nether', 'Незер', '#e0533d', ['незер', '=ад', 'адск', 'nether', '=hell'], ['nether', 'nether expansion'], ['worldgen']),
  T('end', 'Энд', '#d6c6ff', ['энд', 'эндер', '=end', 'ender'], ['end expansion', 'end dimension'], ['worldgen']),
  T('sky', 'Небесные острова', '#9fd6ff', ['небес', 'остров', 'облак', 'skyblock', 'sky island', 'floating'], ['sky islands', 'floating islands'], ['worldgen']),
  T('underwater', 'Подводный мир', '#1fb5c9', ['подвод', 'под водой', 'русал', '=кит', 'киты', 'underwater', 'mermaid', 'aquatic'], ['underwater', 'aquatic'], []),
  T('forest', 'Леса', '#3f9b4b', ['=лес', 'леса', 'лесн', 'деревья', 'деревьев', 'forest', 'tree'], ['forest', 'trees'], ['worldgen']),
  T('desert', 'Пустыни', '#e3c06b', ['пустын', 'песк', 'оазис', 'desert', 'dune'], ['desert'], ['worldgen']),
  T('winter', 'Зима и снег', '#cfefff', ['снег', 'снеж', 'лёд', 'лед', 'мороз', 'холод', 'snow', 'frost', 'ice', 'frozen'], ['snow', 'winter'], []),
  T('jungle', 'Джунгли', '#2e8b57', ['джунгл', 'тропик', 'jungle', 'tropical'], ['jungle'], ['worldgen']),
  T('mountains', 'Горы', '#8da3b5', ['горы', 'горн', 'вершин', 'скал', 'mountain', 'cliff', 'peak'], ['mountains', 'terrain'], ['worldgen']),
  T('villages', 'Деревни', '#c9a26b', ['деревн', 'жител', 'поселен', 'village', 'villager', 'settlement'], ['villages', 'villagers'], []),
  T('cities', 'Города', '#b0bec5', ['город', 'мегапол', 'небоскр', 'city', 'town', 'urban'], ['city', 'towns'], []),
  T('ruins', 'Руины и археология', '#a1887f', ['археолог', 'раскоп', 'древн', 'archeolog', 'archaeolog', 'ancient'], ['archeology', 'ancient ruins'], []),
  T('exploration', 'Исследование мира', '#4fc3f7', ['исследов', 'открыт', 'путешест', 'карта мира', 'explore', 'wander'], ['exploration', 'structures'], ['adventure']),
  T('biomes', 'Новые биомы', '#66bb6a', ['биомы', 'биомов', 'природ', 'biomes', 'nature'], ['biomes', 'biome'], ['worldgen'], ['terralith']),
  T('structures', 'Постройки в мире', '#bcaaa4', ['строени', 'зданий', 'крепост', 'башн', 'храм', 'fortress', 'tower', 'temple'], ['structures', 'towers'], ['worldgen']),

  // --- существа ---
  T('monsters', 'Монстры', '#9c27b0', ['чудовищ', 'тварь', 'твари', 'monster', 'beast'], ['monsters', 'hostile mobs'], ['mobs']),
  T('undead', 'Нежить', '#8bc34a', ['нежит', 'скелет', 'мертвец', 'вампир', 'некромант', 'undead', 'skeleton', 'vampire', 'necromanc'], ['undead', 'vampire', 'necromancy'], []),
  T('werewolves', 'Оборотни', '#795548', ['оборот', 'волколак', 'werewolf', 'lycan'], ['werewolves'], []),
  T('fishing', 'Рыбалка', '#4fc3f7', ['рыбал', 'рыб', 'удочк', 'fishing', 'fish'], ['fishing', 'fish'], []),
  T('birds', 'Птицы', '#ffb74d', ['птиц', 'птич', 'bird'], ['birds'], ['mobs']),
  T('insects', 'Насекомые', '#aed581', ['насеком', 'пчел', 'бабоч', 'жук', 'insect', 'bee', 'butterfl', 'bug'], ['insects', 'bees'], []),
  T('horses', 'Лошади и маунты', '#a1887f', ['лошад', 'конь', 'кони', 'маунт', 'ездов', 'horse', 'mount'], ['horses', 'mounts'], []),
  T('companions', 'Компаньоны', '#ffd54f', ['компаньон', 'спутник', 'напарник', 'питомц', 'companion', 'follower', 'tame'], ['companions', 'pets'], ['mobs']),
  T('golems', 'Големы', '#9e9e9e', ['голем', 'golem'], ['golems'], []),
  T('fairies', 'Феи и духи', '#f48fb1', ['фея', 'феи', 'фей', 'дух', 'призрак', 'fairy', 'fairies', 'spirit', 'ghost'], ['fairies', 'spirits'], []),
  T('aliens', 'Пришельцы', '#76ff03', ['пришел', 'инопланет', 'нло', 'alien', 'ufo'], ['aliens'], []),
  T('giants', 'Гиганты', '#8d6e63', ['гигант', 'великан', 'титан', 'giant', 'titan'], ['giants', 'titans'], []),

  // --- магия и сверхъестественное ---
  T('alchemy', 'Алхимия и зелья', '#ab47bc', ['алхим', 'зель', 'зелий', 'отвар', 'alchemy', 'potion', 'brew'], ['alchemy', 'potions'], ['magic']),
  T('enchanting', 'Зачарования', '#7e57c2', ['зачаров', 'чарован', 'enchant'], ['enchantments', 'enchanting'], []),
  T('necromancy', 'Тёмная магия', '#4a148c', ['тёмн', 'темн магии', 'демон', 'культ', 'проклят', 'dark magic', 'demon', 'cult', 'curse'], ['dark magic', 'demons'], []),
  T('druid', 'Друиды и природа', '#558b2f', ['друид', 'шаман', 'druid', 'shaman'], ['druid', 'nature magic'], ['magic']),
  T('artifacts', 'Артефакты и реликвии', '#ffca28', ['артефакт', 'реликв', 'сокровищ', 'клад', 'artifact', 'relic', 'treasure', 'loot'], ['artifacts', 'loot', 'treasure'], ['equipment']),

  // --- RPG и бои ---
  T('classes', 'Классы персонажа', '#ff8a65', ['классы', 'классов', 'классам', 'воин', 'лучник', 'паладин', 'разбойник', '=маг', '=class', 'classes', 'warrior', 'archer', 'paladin', 'rogue'], ['rpg classes', 'classes'], []),
  T('skills', 'Прокачка и навыки', '#ff80ab', ['прокач', 'навык', 'уровн', 'опыт', 'перк', 'талант', 'skill', 'perk', 'talent', 'level'], ['skills', 'leveling', 'perks'], [], ['pufferfish-skills']),
  T('stats', 'Характеристики', '#ef9a9a', ['характеристик', 'атрибут', 'статы', 'stats', 'attribute'], ['attributes', 'stats'], []),
  T('loot', 'Лут и редкость', '#ffd740', ['лут', 'добыч', 'редк', 'легендар', 'loot', 'rarity', 'legendary'], ['loot', 'rarity'], ['equipment']),
  T('weapons', 'Холодное оружие', '#cfd8dc', ['оружи', 'меч', 'топор', 'копь', 'кинжал', 'weapon', 'sword', 'axe', 'spear', 'dagger'], ['weapons', 'swords'], ['equipment']),
  T('archery', 'Луки и стрельба', '#a5d6a7', ['=лук', 'луки', 'арбалет', 'стрел', 'bow', 'crossbow', 'archery', 'arrow'], ['bows', 'archery'], ['equipment']),
  T('shields', 'Щиты и парирование', '#90a4ae', ['щит', 'парир', 'блокир', 'shield', 'parry'], ['shields', 'parry'], []),
  T('pvp', 'PvP', '#ef5350', ['пвп', 'pvp', 'арена', 'arena', 'дуэл', 'duel'], ['pvp', 'arena'], []),
  T('raids', 'Рейды и осады', '#e57373', ['рейд', 'осад', 'нашеств', 'орда', 'орды', 'raid', 'siege', 'invasion', 'horde'], ['raids', 'invasion'], []),
  T('difficulty', 'Сложность мобов', '#d32f2f', ['сложнее', 'сильн мобы', 'умн мобы', 'хардмод', 'difficulty', 'harder', 'smart mobs'], ['difficulty', 'mob scaling'], ['game-mechanics']),

  // --- выживание ---
  T('thirst', 'Жажда и температура', '#4dd0e1', ['жажд', 'температур', 'вода', 'thirst', 'temperature'], ['thirst', 'temperature'], ['game-mechanics']),
  T('realism', 'Реализм', '#8d6e63', ['реализм', 'реалист', 'физик', 'realism', 'realistic', 'physics'], ['realism', 'realistic'], ['game-mechanics']),
  T('primitive', 'Первобытное выживание', '#a1887f', ['первобыт', 'каменн век', 'камен век', 'примитив', 'primitive', 'stone age'], ['primitive', 'early game'], ['game-mechanics']),
  T('camping', 'Походы и лагерь', '#ffb74d', ['поход', 'лагер', 'палатк', 'костер', 'костёр', 'camping', 'tent', 'campfire'], ['camping', 'tents'], []),
  T('injuries', 'Ранения и лечение', '#e53935', ['ранен', 'перелом', 'кровотеч', 'лечен', 'медицин', 'injur', 'bleed', 'medic'], ['injuries', 'healing'], []),
  T('sleep', 'Сон и усталость', '#7986cb', ['сон', 'усталост', 'бессон', 'sleep', 'fatigue'], ['sleep', 'fatigue'], []),

  // --- техника ---
  T('trains', 'Поезда и железные дороги', '#90a4ae', ['поезд', 'железн дорог', 'рельс', 'вагон', 'train', 'railway', 'rail'], ['trains', 'railways'], ['transportation']),
  T('cars', 'Машины', '#ef5350', ['машин', 'автомоб', 'тачк', '=car', 'cars', 'vehicle'], ['cars', 'vehicles'], ['transportation']),
  T('planes', 'Самолёты и полёты', '#64b5f6', ['самолет', 'самолёт', 'полет', 'полёт', 'летать', 'дирижабл', 'plane', 'aircraft', 'airship', 'flying'], ['planes', 'airships'], ['transportation']),
  T('ships', 'Корабли', '#0288d1', ['корабл', 'лодк', 'флот', 'парус', 'ship', 'boat', 'sail'], ['ships', 'boats'], ['transportation']),
  T('steampunk', 'Стимпанк', '#bf8f00', ['стимпанк', '=пар', 'паров', 'шестер', 'steampunk', 'steam', '=cog'], ['steampunk', 'steam'], ['technology'], ['create']),
  T('electricity', 'Электричество', '#ffee58', ['электрич', 'провод', 'генератор', 'батаре', 'electric', 'wire', 'battery'], ['electricity', 'energy'], ['technology']),
  T('redstone', 'Редстоун', '#e53935', ['редстоун', 'красн пыль', 'механизм', 'redstone', 'contraption'], ['redstone'], ['technology']),
  T('robots', 'Роботы', '#90caf9', ['робот', 'дрон', 'андроид', 'robot', 'drone', 'android'], ['robots', 'drones'], ['technology']),
  T('nuclear', 'Ядерка и радиация', '#c6ff00', ['ядерн', 'радиац', 'реактор', 'атомн', 'nuclear', 'radiation', 'reactor'], ['nuclear', 'reactor'], ['technology']),
  T('computers', 'Компьютеры и код', '#26c6da', ['компьютер', 'програм', '=код', 'computer', 'program', 'lua'], ['computers', 'programming'], ['technology']),
  T('storage_tech', 'Автоматическое хранение', '#78909c', ['ме система', 'сортиров', 'склад', 'ae2', 'storage system', 'sorting'], ['storage system', 'item storage'], ['storage']),
  T('modern', 'Современность', '#b0bec5', ['современ', 'модерн', 'наши дни', 'modern', 'contemporary'], ['modern', 'modern furniture'], []),
  T('military', 'Военное', '#6d8f3a', ['воен', 'армия', 'солдат', 'танк', 'military', 'army', 'soldier', 'tank'], ['military', 'tanks'], []),

  // --- строительство и быт ---
  T('furniture', 'Мебель', '#d7a86e', ['мебел', 'стул', 'диван', 'кроват', 'furniture', 'chair', 'sofa'], ['furniture'], ['decoration']),
  T('blocks', 'Новые блоки', '#bcaaa4', ['блок', 'кирпич', 'плитк', 'block', 'brick'], ['building blocks', 'blocks'], ['decoration']),
  T('lighting', 'Освещение', '#ffe082', ['свет', 'фонар', 'ламп', 'освещен', 'light', 'lamp', 'lantern'], ['lighting', 'lamps'], ['decoration']),
  T('gardening', 'Сад и цветы', '#f48fb1', ['сад', 'цвет', 'растен', 'клумб', 'garden', 'flower', 'plant'], ['flowers', 'gardening'], []),
  T('cooking', 'Кулинария', '#ffab91', ['кулинар', 'рецепт', 'блюд', 'выпечк', 'cooking', 'recipe', 'dish', 'bake'], ['cooking', 'recipes'], ['food'], ['farmers-delight']),
  T('drinks', 'Напитки', '#bcaaa4', ['напит', 'пиво', 'вино', 'чай', 'кофе', 'drink', 'beer', 'wine', 'tea', 'coffee'], ['drinks', 'brewing'], ['food']),
  T('animals_farm', 'Животноводство', '#c5e1a5', ['животновод', 'коров', 'свин', 'куры', 'куриц', 'livestock', 'cattle'], ['livestock', 'animal husbandry'], []),
  T('cozy', 'Уют и спокойствие', '#ffcc80', ['уют', 'спокой', 'расслаб', 'милый', 'мило', 'cozy', 'chill', 'relax', 'cute'], ['cozy', 'cute'], ['decoration']),
  T('paths', 'Дороги и тропы', '#a1887f', ['дорог', 'троп', 'мост', 'path', 'road', 'bridge'], ['paths', 'bridges'], ['decoration']),
  T('tools', 'Инструменты и стройка', '#cfd8dc', ['инструмент', 'кирк', 'стройк', 'строй быстр', 'tool', 'pickaxe', 'building tool'], ['building tools', 'tools'], ['utility']),

  // --- игра и сервис ---
  T('multiplayer', 'Для игры с друзьями', '#4dd0e1', ['друз', 'кооп', 'мультипле', 'сервер', 'вместе', 'coop', 'co-op', 'multiplayer', 'friends'], ['multiplayer', 'co-op'], ['social']),
  T('minigames', 'Мини-игры', '#ffd54f', ['мини-игр', 'миниигр', 'minigame', 'party game'], ['minigames'], ['minigame']),
  T('progression', 'Прогрессия', '#81c784', ['прогресс', 'этап', 'развит', 'progression', 'stages', 'tier'], ['progression'], ['game-mechanics']),
  T('story', 'Сюжет и лор', '#ce93d8', ['сюжет', 'истори', 'лор', 'книг', 'story', 'lore', 'narrative'], ['story', 'lore'], ['adventure']),
  T('npc', 'NPC и диалоги', '#ffcc80', ['нпс', 'npc', 'диалог', 'персонаж', 'dialog', 'dialogue'], ['npc', 'dialogue'], []),
  T('hud', 'Интерфейс и HUD', '#90caf9', ['интерфейс', '=худ', 'hud', '=gui', '=ui', 'меню'], ['hud', 'ui'], ['utility']),
  T('performance', 'Слабый компьютер', '#5ee7df', ['слаб', 'старый пк', 'ноут', 'фпс', 'лаг', 'low end', 'potato', 'fps', 'lag', 'performance'], ['optimization', 'performance'], ['optimization']),
  T('shaders', 'Шейдеры', '#80d8ff', ['шейдер', 'shader'], ['shaders support', 'iris'], [], ['iris', 'oculus']),
  T('animations', 'Анимации', '#b39ddb', ['анимац', 'плавн', 'animation', 'animated', 'smooth'], ['animations', 'animated'], []),
  T('particles', 'Частицы и эффекты', '#ea80fc', ['частиц', 'эффект', 'particle', 'effect'], ['particles', 'visual effects'], []),
  T('weather', 'Погода и небо', '#80deea', ['погод', 'гроз', 'дожд', 'облак', 'weather', 'storm', 'rain', 'cloud'], ['weather', 'clouds'], [], ['serene-seasons']),
  T('music', 'Музыка', '#b388ff', ['музык', 'песн', 'саундтрек', 'music', 'song', 'soundtrack'], ['music'], []),

  // --- жанры и сеттинги ---
  T('cyberpunk', 'Киберпанк', '#ff4081', ['киберпанк', 'кибер', 'неон', 'cyberpunk', 'cyber', 'neon'], ['cyberpunk', 'futuristic'], ['technology']),
  T('scifi', 'Научная фантастика', '#7c4dff', ['фантастик', 'будущ', 'футурист', 'лазер', 'sci-fi', 'scifi', 'future', 'laser'], ['sci-fi', 'futuristic'], ['technology']),
  T('postapoc', 'Постапокалипсис', '#795548', ['постапок', 'пустош', 'выжженн', 'post-apoc', 'wasteland'], ['post apocalyptic', 'wasteland'], []),
  T('western', 'Дикий Запад', '#d4a056', ['вестерн', 'ковбо', 'дикий запад', 'western', 'cowboy'], ['western', 'cowboy'], []),
  T('japan', 'Япония и самураи', '#e57373', ['япон', 'самура', 'ниндз', 'аниме', 'japan', 'samurai', 'ninja', 'anime'], ['japanese', 'samurai', 'ninja'], []),
  T('vikings', 'Викинги', '#90a4ae', ['викинг', 'норд', 'скандинав', 'viking', 'norse'], ['vikings', 'norse'], []),
  T('egypt', 'Египет', '#ffd54f', ['египет', 'египт', 'фараон', 'пирамид', 'мумий', 'egypt', 'pharaoh', 'pyramid', 'mummy'], ['egypt', 'pyramid'], []),
  T('greek', 'Античность', '#e0e0e0', ['античн', 'греч', 'римск', 'олимп', 'greek', 'roman', 'mythology'], ['greek mythology', 'roman'], []),
  T('pirates', 'Пираты', '#5d4037', ['пират', 'пиратск', 'pirate', 'buccaneer'], ['pirates'], []),
  T('superheroes', 'Супергерои', '#e53935', ['супергер', 'суперсил', 'marvel', 'superhero', 'superpower'], ['superheroes', 'superpowers'], []),
  T('mystery', 'Тайны и загадки', '#7e57c2', ['тайн', 'загад', 'головолом', 'mystery', 'puzzle', 'riddle'], ['mystery', 'puzzle'], []),
  T('kids', 'Для детей', '#ffcc80', ['дети', 'детей', 'детск', 'ребен', 'ребён', '=kid', 'kids', 'child', 'family'], ['kid friendly', 'cute'], []),
]
