// База оптимизации из проверенных сборок: их состав и конфиги под нужную версию игры.
// Fabulously Optimized — BSD-3-Clause, Keo Optimized — CC0: конфиги можно включать с указанием авторства.

export const REF_PACKS = {
  fabric: { slug: 'fabulously-optimized', name: 'Fabulously Optimized', license: 'BSD-3-Clause' },
  quilt: { slug: 'fabulously-optimized', name: 'Fabulously Optimized', license: 'BSD-3-Clause', loader: 'fabric' },
  forge: { slug: 'keo-optimized', name: 'Keo Optimized', license: 'CC0-1.0' },
  neoforge: { slug: 'keo-optimized', name: 'Keo Optimized', license: 'CC0-1.0' },
}

// Прогрузка чанков и сеть: в Fabulously Optimized этого нет (набор как в Simply Optimized);
// для Forge/NeoForge — то, что сверх Keo Optimized стоит в топовых сборках вроде Lost Souls
export const CHUNK_EXTRAS = {
  fabric: ['c2me-fabric', 'noisium', 'scalablelux', 'badoptimizations', 'packet-fixer', 'particle-core'],
  quilt: ['c2me-fabric', 'noisium', 'scalablelux', 'badoptimizations', 'packet-fixer', 'particle-core'],
  forge: ['c2mef', 'radium', 'saturn', 'badoptimizations', 'packet-fixer', 'particle-core'],
  // Moonrise проверен и НЕ подходит: ломает запуск вместе с Forgified Fabric API (ChunkHolderMixin) — см. js/broken.js
  neoforge: ['packet-fixer', 'particle-core'],
}

// Что из эталона НЕ берём (проверено на настоящих падениях, 24.10):
// C2ME для NeoForge и Forge — только альфа, с ScalableLux мир висит на 0% (на Forge замер выигрыша не показал); Saturn спорит с ModernFix и Lithium;
// Log Begone прячет ошибки из лога — без них не найти виновника падения
export const REF_SKIP = {
  fabric: /^log-begone/,
  quilt: /^(log-begone|fabric-api)$/,
  // Chunky — прогрузка мира заранее на сервере, в сборке игрока не нужен; с Distant Horizons роняет создание мира
  forge: /^(log-begone|chunky)$/,
  neoforge: /^(c2me|scalablelux|saturn|log-begone|chunky)/, // ScalableLux: замер скорости ничего не дал, а он несовместим с Sable (Create Aeronautics)
}

// Конфиги, которые не нужны или вредны в чужой сборке
const SKIP_CONFIG = /fabric_loader_dependencies\.json|\/jei\/world\/|crash_assistant\/modlist\.json|problematic_mods_config|options\.txt$|\/servers\.dat$/

/**
 * Состав и конфиги эталонной сборки под (loader, mc). Возвращает
 * { name, license, slugs: [...], configs: [{ path, data: Uint8Array }] } или null, если сборки под эту версию нет.
 */
export async function loadRefPack(api, loader, mc, JSZip = globalThis.JSZip, fetchImpl = (...a) => fetch(...a)) {
  const ref = REF_PACKS[loader]
  if (!ref || !JSZip) return null
  try {
    const q = new URLSearchParams({ loaders: JSON.stringify([ref.loader || loader]), game_versions: JSON.stringify([mc]) })
    const versions = await api.getJson(`https://api.modrinth.com/v2/project/${ref.slug}/version?${q}`)
    const v = versions?.[0]
    const file = v?.files.find(f => f.filename.endsWith('.mrpack')) || v?.files[0]
    if (!file) return null
    const zip = await JSZip.loadAsync(await (await fetchImpl(file.url)).arrayBuffer())
    const index = JSON.parse(await zip.file('modrinth.index.json').async('string'))
    const ids = [...new Set(index.files.filter(f => f.path.startsWith('mods/'))
      .map(f => f.downloads[0].split('/data/')[1]?.split('/')[0]).filter(Boolean))]
    const projects = await api.projects(ids)
    const configs = []
    for (const [path, entry] of Object.entries(zip.files)) {
      if (entry.dir || !path.startsWith('overrides/config/') || SKIP_CONFIG.test(path)) continue
      configs.push({ path: path.replace(/^overrides\//, ''), data: await entry.async('uint8array') })
    }
    const skip = REF_SKIP[loader]
    return { name: ref.name, license: ref.license, version: v.version_number, slugs: projects.map(p => p.slug).filter(slug => !skip?.test(slug)), configs }
  } catch {
    return null // нет сети или сборка изменила формат: возьмём свой список
  }
}
