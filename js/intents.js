// Типовые фразы, которые люди пишут чаще всего. Меняют не только темы, но и настройки сборки.
// themes: добавить темы; exclude: убрать темы; size: размер; perf/qol: включить базу; note: что сказать человеку.
export const INTENTS = [
  // производительность и «чтобы не лагало»
  { label: 'Слабый ПК', stems: ['слаб пк', 'слабый комп', 'слабого пк', 'слабом пк', 'слабый ноут', 'старый пк', 'старом компе', 'чтоб не лагал', 'чтобы не лагал', 'без лагов', 'не лагало', 'low end', 'potato pc', 'weak pc'], size: 'light', perf: true, themes: ['fps_boost', 'memory'] },
  { label: 'Только оптимизация', stems: ['только оптимиз', 'чисто оптимиз', 'просто оптимиз', 'только фпс', 'only optimization', 'just fps', 'only performance'], size: 'light', perf: true, onlyBase: true },
  { label: 'Мощный ПК', stems: ['мощный пк', 'мощный комп', 'топовый пк', 'хороший комп', 'rtx', 'high end'], size: 'big', themes: ['shaders', 'render_distance'] },
  // похоже на ваниллу
  { label: 'Как ванилла, но лучше', stems: ['ванилл', 'ванил', 'как обычный', 'обычный майн', 'не сильно меня', 'чуть улучш', 'vanilla plus', 'vanilla+', 'vanilla but better'], size: 'light', themes: ['biomes', 'structures', 'villages'], qol: true },
  { label: 'Просто поиграть', stems: ['просто поиграть', 'просто играть', 'что нибудь интерес', 'что-нибудь интерес', 'на твой вкус', 'удиви', 'сам выбери', 'random pack', 'surprise me'], themes: ['adventure', 'biomes', 'structures', 'mobs'] },
  // уровень
  { label: 'Для новичка', stems: ['новичк', 'первый раз', 'впервые', 'нуб', 'не умею', 'для начинающ', 'beginner', 'noob', 'first time'], themes: ['easy_mode', 'guidebook', 'minimap'], exclude: ['hardcore', 'nightmare', 'difficulty'] },
  { label: 'Для ребёнка', stems: ['для ребен', 'для ребён', 'для сына', 'для дочк', 'для младш', 'детская сборк', 'for my kid', 'for kids'], themes: ['cute', 'animals', 'easy_mode'], exclude: ['horror', 'zombies', 'hardcore', 'necromancy', 'undead', 'guns'] },
  { label: 'Посложнее', stems: ['посложнее', 'сложнее', 'чтобы было сложно', 'чтоб было сложно', 'вызов', 'challenging', 'harder'], themes: ['hardcore', 'difficulty'] },
  { label: 'Без хардкора', stems: ['не слишком сложн', 'без хардкор', 'не хардкор', 'полегче', 'спокойн', 'расслаб', 'not too hard', 'casual'], exclude: ['hardcore', 'nightmare', 'difficulty', 'hardcore_one_life'] },
  // с кем играть
  { label: 'С друзьями', stems: ['с друг', 'с другом', 'с подруг', 'с девушк', 'с парнем', 'с братом', 'с сестр', 'вдвоем', 'вдвоём', 'втроем', 'кооп', 'with friends', 'coop', 'co-op'], themes: ['multiplayer'] },
  { label: 'Для сервера', stems: ['для сервер', 'на сервер', 'свой сервер', 'server pack', 'for server'], themes: ['server_perf', 'claims'] },
  { label: 'Для ютуба/стрима', stems: ['для ютуб', 'для стрим', 'для видео', 'снимать', 'для тикток', 'youtube', 'stream'], themes: ['epic', 'bosses', 'screenshots'] },
  // длительность
  { label: 'Надолго', stems: ['надолго', 'на долго', 'на месяц', 'на месяцы', 'много контента', 'long term', 'lots of content'], size: 'big', themes: ['progression', 'quests'] },
  { label: 'На вечер', stems: ['на вечер', 'на пару час', 'быстро пройти', 'короткая', 'short'], size: 'light' },
  // стиль игры
  { label: 'Выживание', stems: ['выживан', 'на выжив', 'survival'], themes: [] },
  { label: 'Строить', stems: ['строить', 'стройк', 'креатив', 'для строит', 'build', 'creative'], themes: ['building', 'furniture', 'blocks', 'decor'] },
  { label: 'Исследовать мир', stems: ['исследов', 'путешеств', 'бродить', 'гулять по миру', 'explore', 'travel'], themes: ['exploration', 'biomes', 'structures'] },
  { label: 'Красиво', stems: ['=красиво', '=красивая', '=красивую', '=красивой', 'красивая графика', 'чтобы было красиво', 'графон', 'реалистичн граф', 'beautiful', 'pretty', 'graphics'], themes: ['shaders', 'graphics', 'particles', 'animations'] },
  { label: 'Атмосферно', stems: ['атмосфер', 'погружен', 'immersive', 'atmospheric'], themes: ['sound', 'weather', 'fog', 'animations'] },
  { label: 'Много боссов', stems: ['много босс', 'больше босс', 'боссы', 'many bosses', 'more bosses'], themes: ['bosses', 'epic'] },
  { label: 'Много данжей', stems: ['много данж', 'больше данж', 'подземель', 'many dungeons'], themes: ['dungeons', 'structures', 'loot'] },
  { label: 'Прокачка', stems: ['прокачк', 'качаться', 'уровни', 'level up', 'leveling'], themes: ['skills', 'stats', 'classes'] },
  { label: 'Лут и шмот', stems: ['шмот', 'лут', 'снаряж', 'gear', 'loot'], themes: ['loot', 'weapons', 'armor', 'accessories'] },
  { label: 'Автоматизация', stems: ['автоматиз', 'чтобы само', 'фермы на автомат', 'automate'], themes: ['automation', 'auto_farm', 'pipes'] },
  { label: 'Магия', stems: ['магичес', 'магией', 'magical'], themes: ['magic', 'mana'] },
  { label: 'Страшно', stems: ['страшн', 'чтоб было страшно', 'чтобы было страшно', 'напугать', 'scary', 'spooky'], themes: ['horror', 'monsters', 'fog'] },
  { label: 'Уютно', stems: ['уютн', 'милая сборк', 'мирн', 'cozy', 'wholesome'], themes: ['cozy', 'farming', 'cooking', 'decor'], exclude: ['horror', 'hardcore'] },
  { label: 'Как сериал/история', stems: ['с сюжет', 'история', 'лор', 'квесты', 'story', 'quests'], themes: ['story', 'quests', 'npc'] },
  // популярные форматы сборок
  { label: 'Скайблок', stems: ['скайблок', 'skyblock', 'на острове в пустоте'], themes: ['void', 'automation', 'progression'] },
  { label: 'Ванблок', stems: ['ванблок', 'один блок', 'one block', 'oneblock'], themes: ['void', 'progression'] },
  { label: 'Кейвблок/пещеры', stems: ['под землей', 'под землёй', 'жить в пещер', 'caveblock'], themes: ['caverns', 'caves', 'mining'] },
  { label: 'Средневековый город', stems: ['средневеков город', 'построить замок', 'королевство'], themes: ['medieval', 'castle_build', 'kingdoms', 'villages'] },
  { label: 'Зомби-апокалипсис', stems: ['апокалипсис', 'зомбиапок', 'zombie apocalypse'], themes: ['zombies', 'postapoc', 'guns', 'hardcore'] },
  { label: 'Ферма и жизнь', stems: ['жить на ферм', 'фермерск жизн', 'farm life'], themes: ['farming', 'animals_farm', 'cooking', 'cozy'] },
  { label: 'Техно-прогрессия', stems: ['от камня до', 'техно прогресс', 'tech progression', 'от каменного века'], themes: ['tech', 'progression', 'automation'] },
  { label: 'RPG-сборка', stems: ['рпг сборк', 'rpg pack', 'rpg modpack', 'как в рпг'], themes: ['rpg', 'classes', 'skills', 'loot', 'bosses'] },
]
