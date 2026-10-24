// Лучшие моды для тем: их сайт пробует первыми (если мода нет под выбранную версию или загрузчик, берёт следующий).
// Порядок — от главного к дополнительному. Адреса проверены на Modrinth (24.10.2026).
export const PINS = {
  magic: ['irons-spells-n-spellbooks', 'ars-nouveau', 'spell-engine', 'wizards', 'botania', 'forbidden-arcanus', 'occultism', 'arcanus'],
  tech: ['create', 'create-fabric', 'mekanism', 'ae2', 'modern-industrialization', 'immersiveengineering', 'techreborn', 'industrial-foregoing', 'powah'],
  automation: ['create', 'create-fabric', 'ae2', 'refined-storage', 'mekanism', 'modern-industrialization'],
  energy: ['mekanism', 'powah', 'immersiveengineering', 'techreborn', 'modern-industrialization'],
  dragons: ['ice-and-fire-dragons', 'dragon-mounts-legacy', 'wyrmroost'],
  dinos: ['fossils-and-archeology-revival', 'jurassic-reborn', 'prehistoric-fauna'],
  mobs: ['alexs-mobs', 'friends-and-foes', 'naturalist', 'mutant-monsters', 'mowzies-mobs'],
  animals: ['alexs-mobs', 'naturalist', 'friends-and-foes'],
  bosses: ['l_enders-cataclysm', 'bosses-of-mass-destruction', 'mowzies-mobs', 'borninchaos'],
  dungeons: ['when-dungeons-arise', 'yungs-better-dungeons', 'dungeons-and-taverns'],
  adventure: ['when-dungeons-arise', 'artifacts', 'explorers-compass', 'aether', 'paragliders', 'waystones'],
  rpg: ['levelz', 'better-combat', 'artifacts', 'simply-swords', 'paragliders'],
  combat: ['better-combat', 'combat-roll', 'simply-swords', 'epic-knights-shields-armor-and-weapons'],
  armor: ['epic-knights-shields-armor-and-weapons', 'artifacts', 'simply-swords'],
  guns: ['timeless-and-classics-zero', 'vics-point-blank'],
  horror: ['from-the-fog', 'the-man-from-the-fog', 'cave-dweller-evolved', 'better-cave-dweller'],
  zombies: ['zombie-awareness'],
  caves: ['alexs-caves', 'yungs-better-mineshafts', 'deeperdarker'],
  ocean: ['small-ships', 'upgrade-aquatic', 'aquaculture'],
  dimensions: ['aether', 'the-twilight-forest-dungeons-villages', 'blue-skies', 'deeperdarker', 'the-undergarden'],
  medieval: ['epic-knights-shields-armor-and-weapons', 'minecraft-comes-alive-reborn', 'guard-villagers', 'macaws-bridges'],
  fantasy: ['aether', 'irons-spells-n-spellbooks', 'alexs-mobs', 'blue-skies'],
  building: ['macaws-roofs', 'macaws-windows', 'chipped', 'rechiseled', 'handcrafted', 'decorative-blocks', 'macaws-bridges'],
  decor: ['supplementaries', 'handcrafted', 'chipped', 'decorative-blocks'],
  farming: ['farmers-delight', 'farming-for-blockheads', 'serene-seasons'],
  inventory: ['inventory-profiles-next', 'mouse-tweaks'],
  transport: ['small-ships', 'immersive-aircraft', 'create-steam-n-rails'],
  economy: ['lightmans-currency', 'numismatic-overhaul'],
  mining: ['veinminer'],
  pokemon: ['cobblemon'],
  storage: ['sophisticated-backpacks', 'sophisticated-storage', 'refined-storage'],
  villages: ['minecraft-comes-alive-reborn', 'guard-villagers'],
  worldgen: ['terralith', 'tectonic', 'biomes-o-plenty', 'regions-unexplored'],
}

/** Добавляет лучшие моды в начало списка pinned у тем (как есть — без копий) */
export function applyPins(themes) {
  for (const t of themes) {
    const best = PINS[t.id]
    if (best) t.pinned = [...new Set([...best, ...(t.pinned || [])])]
  }
  return themes
}
