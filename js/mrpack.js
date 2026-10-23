// Файл .mrpack (формат Modrinth) и zip-архив с .jar
export const LOADER_KEYS = { fabric: 'fabric-loader', quilt: 'quilt-loader', forge: 'forge', neoforge: 'neoforge' }
export const LOADER_NAMES = { fabric: 'Fabric', quilt: 'Quilt', forge: 'Forge', neoforge: 'NeoForge' }

// В одиночной игре внутри клиента работает свой сервер, поэтому на клиент ставим всё,
// даже «серверные» библиотеки (иначе лаунчер их пропустит и игра не запустится).
// На сервер не ставим только чисто клиентские моды (Sodium, мини-карты и т.п.).
const envOf = project => ({ client: 'required', server: project.server === 'unsupported' ? 'unsupported' : 'required' })

export function buildIndex({ name, summary, version, loader, loaderVersion, mods }) {
  const dependencies = { minecraft: version }
  if (loaderVersion) dependencies[LOADER_KEYS[loader]] = loaderVersion
  return {
    formatVersion: 1,
    game: 'minecraft',
    versionId: '1.0.0',
    name,
    summary,
    files: mods.map(m => ({
      path: `mods/${m.file.filename}`,
      hashes: { sha1: m.file.hashes.sha1, sha512: m.file.hashes.sha512 },
      env: envOf(m.project),
      downloads: [m.file.url],
      fileSize: m.file.size,
    })),
    dependencies,
  }
}

// options: текст options.txt игрока (или null). В .mrpack он лежит в overrides/ — лаунчер сам положит его в профиль.
// ref: эталонная сборка оптимизации { name, license, configs: [{ path, data }] } — её конфиги идут в overrides/
export async function mrpackBlob(index, JSZip, options = null, ref = null) {
  const zip = new JSZip()
  zip.file('modrinth.index.json', JSON.stringify(index, null, 2))
  if (options) zip.file('overrides/options.txt', options)
  addRefConfigs(zip, 'overrides/', ref)
  return zip.generateAsync({ type: 'blob', mimeType: 'application/x-modrinth-modpack+zip' })
}

export const REF_CREDITS = {
  'Fabulously Optimized': 'https://github.com/Fabulously-Optimized/fabulously-optimized (BSD-3-Clause, Copyright (c) Fabulously Optimized contributors)',
  'Keo Optimized': 'https://modrinth.com/modpack/keo-optimized (CC0-1.0)',
}

function addRefConfigs(zip, prefix, ref) {
  if (!ref?.configs?.length) return
  for (const { path, data } of ref.configs) zip.file(prefix + path, data)
  zip.file(`${prefix}config/modsmith-credits.txt`,
    `Конфиги оптимизации взяты из сборки ${ref.name} ${ref.version || ''}: ${REF_CREDITS[ref.name] || ref.license}\r\n` +
    'Configs are redistributed under their original license. Thanks to the authors!\r\n')
}

export function readme({ name, version, loader, loaderVersion, mods }) {
  const ln = LOADER_NAMES[loader]
  return [
    `${name}`,
    `Minecraft ${version}, ${ln} ${loaderVersion || ''}`.trim(),
    `Модов: ${mods.length}`,
    '',
    'Как установить:',
    `1. Установите ${ln} для Minecraft ${version} (в TLauncher, Prism или официальном установщике ${ln}).`,
    '2. Откройте папку игры (.minecraft) и папку mods внутри неё (если её нет, создайте).',
    '3. Скопируйте туда все файлы из папки mods этого архива, а папку config (если есть) — в .minecraft с заменой: там настройки оптимизации.',
    `4. Запустите игру с профилем ${ln} ${version}.`,
    '',
    'Проще: откройте файл .mrpack в Modrinth App или Prism Launcher, всё поставится само.',
    '',
    'Собрано на Modsmith: https://askjjkk.github.io/modsmith/',
    '',
    ...mods.map(m => `- ${m.project.title} ${m.version.number}`),
  ].join('\r\n')
}

// Скачивает .jar (по 4 одновременно) и складывает в zip. onProgress(доля 0..1)
export async function modsZipBlob(pack, JSZip, onProgress = () => {}, fetchImpl = (...a) => fetch(...a), options = null) {
  const zip = new JSZip()
  zip.file('КАК-УСТАНОВИТЬ.txt', readme(pack) + (options ? '\r\n\r\nВаши настройки игры: положите options.txt в папку .minecraft (с заменой).' : ''))
  if (options) zip.file('options.txt', options)
  addRefConfigs(zip, '', pack.ref)
  const total = pack.mods.reduce((s, m) => s + m.file.size, 0)
  let done = 0
  const queue = [...pack.mods]
  const failed = []
  async function worker() {
    while (queue.length) {
      const m = queue.shift()
      try {
        const res = await fetchImpl(m.file.url)
        if (!res.ok) throw new Error(res.status)
        zip.file(`mods/${m.file.filename}`, await res.arrayBuffer())
      } catch {
        failed.push(m.project.title)
      }
      done += m.file.size
      onProgress(done / total)
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
  const blob = await zip.generateAsync({ type: 'blob' })
  return { blob, failed }
}
