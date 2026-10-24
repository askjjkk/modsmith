// Файл .mrpack (формат Modrinth) и zip-архив с .jar
export const LOADER_KEYS = { fabric: 'fabric-loader', quilt: 'quilt-loader', forge: 'forge', neoforge: 'neoforge' }
export const LOADER_NAMES = { fabric: 'Fabric', quilt: 'Quilt', forge: 'Forge', neoforge: 'NeoForge' }

// В одиночной игре внутри клиента работает свой сервер, поэтому на клиент ставим всё,
// даже «серверные» библиотеки (иначе лаунчер их пропустит и игра не запустится).
// На сервер не ставим только чисто клиентские моды (Sodium, мини-карты и т.п.).
const envOf = project => ({ client: 'required', server: project.server === 'unsupported' ? 'unsupported' : 'required' })

export function buildIndex({ name, summary, version, loader, loaderVersion, mods, extras = [] }) {
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
    })).concat(extras.map(e => ({
      // шейдеры и ресурспаки нужны только в игре
      path: e.path,
      hashes: { sha1: e.file.hashes.sha1, sha512: e.file.hashes.sha512 },
      env: { client: 'required', server: 'unsupported' },
      downloads: [e.file.url],
      fileSize: e.file.size,
    }))),
    dependencies,
  }
}

// options: текст options.txt игрока (или null). В .mrpack он лежит в overrides/ — лаунчер сам положит его в профиль.
// ref: эталонная сборка оптимизации { name, license, configs: [{ path, data }] } — её конфиги идут в overrides/
// files: ещё файлы настроек { путь: текст } (включить шейдер и ресурспаки); options.txt отсюда заменяет options
export async function mrpackBlob(index, JSZip, options = null, ref = null, files = null) {
  const zip = new JSZip()
  zip.file('modrinth.index.json', JSON.stringify(index, null, 2))
  if (options && !files?.['options.txt']) zip.file('overrides/options.txt', options)
  addRefConfigs(zip, 'overrides/', ref)
  for (const [path, text] of Object.entries(files || {})) zip.file(`overrides/${path}`, text)
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

// Скачивает файлы (по 4 одновременно) в zip: items — [{ path, url, size, title }]. onProgress(доля 0..1)
async function fetchInto(zip, items, onProgress, fetchImpl) {
  const total = items.reduce((s, x) => s + x.size, 0) || 1
  let done = 0
  const queue = [...items]
  const failed = []
  async function worker() {
    while (queue.length) {
      const x = queue.shift()
      try {
        const res = await fetchImpl(x.url)
        if (!res.ok) throw new Error(res.status)
        zip.file(x.path, await res.arrayBuffer())
      } catch {
        failed.push(x.title)
      }
      done += x.size
      onProgress(done / total)
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
  return failed
}

const modItems = mods => mods.map(m => ({ path: `mods/${m.file.filename}`, url: m.file.url, size: m.file.size, title: m.project.title }))

// Архив для игры: моды, шейдеры/ресурспаки и настройки
export async function modsZipBlob(pack, JSZip, onProgress = () => {}, fetchImpl = (...a) => fetch(...a), options = null, files = null) {
  const zip = new JSZip()
  const opts = files?.['options.txt'] || options
  zip.file('КАК-УСТАНОВИТЬ.txt', readme(pack) + (opts ? '\r\n\r\nНастройки игры: положите options.txt в папку .minecraft (с заменой).' : ''))
  if (opts) zip.file('options.txt', opts)
  addRefConfigs(zip, '', pack.ref)
  for (const [path, text] of Object.entries(files || {})) if (path !== 'options.txt') zip.file(path, text)
  const extras = (pack.extras || []).map(e => ({ path: e.path, url: e.file.url, size: e.file.size, title: e.project.title }))
  const failed = await fetchInto(zip, [...modItems(pack.mods), ...extras], onProgress, fetchImpl)
  const blob = await zip.generateAsync({ type: 'blob' })
  return { blob, failed }
}

// ---------- серверная сборка ----------
const ramFor = n => (n > 200 ? 10 : n > 120 ? 8 : n > 60 ? 6 : 4)

/** Адрес установщика/ядра сервера под загрузчик */
export function serverSource({ loader, version, loaderVersion }, fabricInstaller = '1.0.1') {
  if (loader === 'fabric') return { kind: 'jar', url: `https://meta.fabricmc.net/v2/versions/loader/${version}/${loaderVersion}/${fabricInstaller}/server/jar` }
  if (loader === 'quilt') return { kind: 'quilt', url: 'https://quiltmc.org/api/v1/download-latest-installer/java-universal' }
  if (loader === 'neoforge') return { kind: 'installer', url: `https://maven.neoforged.net/releases/net/neoforged/neoforge/${loaderVersion}/neoforge-${loaderVersion}-installer.jar` }
  return { kind: 'installer', url: `https://maven.minecraftforge.net/net/minecraftforge/forge/${version}-${loaderVersion}/forge-${version}-${loaderVersion}-installer.jar` }
}

/** start.bat и start.sh: при первом запуске скачивают ядро сервера, дальше просто запускают */
export function serverScripts(pack, fabricInstaller) {
  const ram = ramFor(pack.mods.length)
  const src = serverSource(pack, fabricInstaller)
  const bat = ['@echo off', 'chcp 65001 >nul', 'cd /d "%~dp0"']
  const sh = ['#!/bin/sh', 'cd "$(dirname "$0")"']
  if (src.kind === 'jar') {
    bat.push('if not exist server.jar (', '  echo Скачиваю сервер...', `  curl -L -o server.jar "${src.url}"`, ')', `java -Xmx${ram}G -jar server.jar nogui`, 'pause')
    sh.push(`[ -f server.jar ] || curl -L -o server.jar "${src.url}"`, `java -Xmx${ram}G -jar server.jar nogui`)
  } else if (src.kind === 'quilt') {
    const install = `java -jar quilt-installer.jar install server ${pack.version} ${pack.loaderVersion} --download-server --install-dir=.`
    bat.push('if not exist quilt-server-launch.jar (', `  curl -L -o quilt-installer.jar "${src.url}"`, `  ${install}`, ')', `java -Xmx${ram}G -jar quilt-server-launch.jar nogui`, 'pause')
    sh.push(`[ -f quilt-server-launch.jar ] || { curl -L -o quilt-installer.jar "${src.url}" && ${install}; }`, `java -Xmx${ram}G -jar quilt-server-launch.jar nogui`)
  } else {
    bat.push('if not exist run.bat (', '  echo Устанавливаю сервер, это пара минут...', `  curl -L -o installer.jar "${src.url}"`,
      '  java -jar installer.jar --installServer', '  del installer.jar', ')', `echo -Xmx${ram}G> user_jvm_args.txt`, 'call run.bat nogui')
    sh.push(`[ -f run.sh ] || { curl -L -o installer.jar "${src.url}" && java -jar installer.jar --installServer && rm installer.jar; }`,
      `echo "-Xmx${ram}G" > user_jvm_args.txt`, 'sh run.sh nogui')
  }
  return { bat: bat.join('\r\n') + '\r\n', sh: sh.join('\n') + '\n' }
}

// Серверный архив: моды, которые работают на сервере, настройки и файлы запуска
export async function serverZipBlob(pack, JSZip, onProgress = () => {}, fetchImpl = (...a) => fetch(...a), fabricInstaller = '1.0.1') {
  const zip = new JSZip()
  const mods = pack.mods.filter(m => m.project.server !== 'unsupported')
  const scripts = serverScripts({ ...pack, mods }, fabricInstaller)
  zip.file('start.bat', scripts.bat)
  zip.file('start.sh', scripts.sh, { unixPermissions: '755' })
  zip.file('КАК-ЗАПУСТИТЬ.txt', [
    `${pack.name} — сервер`,
    `Minecraft ${pack.version}, ${LOADER_NAMES[pack.loader]} ${pack.loaderVersion || ''}`.trim(),
    `Модов на сервере: ${mods.length} (чисто клиентские вроде мини-карт и шейдеров на сервер не ставятся).`,
    '',
    '1. Нужна Java 21 (для 1.20.1 подойдёт и Java 17).',
    '2. Распакуйте архив в пустую папку и запустите start.bat (Windows) или start.sh (Linux).',
    '   При первом запуске скрипт сам скачает ядро сервера.',
    '3. Сервер остановится и попросит принять лицензию Minecraft: откройте eula.txt,',
    '   прочитайте https://aka.ms/MinecraftEULA и, если согласны, поставьте eula=true. Запустите start.bat ещё раз.',
    `4. Памяти выделено ${ramFor(mods.length)} ГБ — поменять можно в start.bat (число после -Xmx).`,
    '',
    'Игрокам нужна такая же сборка: дайте им .mrpack с сайта.',
  ].join('\r\n'))
  addRefConfigs(zip, '', pack.ref)
  const failed = await fetchInto(zip, modItems(mods), onProgress, fetchImpl)
  const blob = await zip.generateAsync({ type: 'blob', platform: 'UNIX' })
  return { blob, failed, count: mods.length }
}
