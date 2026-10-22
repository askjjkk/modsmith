// Читает, что мод требует на самом деле: fabric.mod.json / quilt.mod.json / mods.toml прямо из .jar.
// Файл целиком не качаем: только конец архива (оглавление) и нужную запись (HTTP Range).

const WANTED = ['fabric.mod.json', 'quilt.mod.json', 'META-INF/mods.toml', 'META-INF/neoforge.mods.toml']
const PLATFORM = new Set(['minecraft', 'java', 'fabricloader', 'fabric_loader', 'quilt_loader', 'forge', 'neoforge',
  'javafml', 'lowcodefml', 'mixinextras', 'quilted_fabric_api'])

// id мода внутри jar -> адрес на Modrinth, когда они не совпадают
export const KNOWN_SLUGS = {
  kotlinforforge: 'kotlin-for-forge', fabric_language_kotlin: 'fabric-language-kotlin', architectury: 'architectury-api',
  cloth_config: 'cloth-config', cloth_config2: 'cloth-config', owo: 'owo-lib', bookshelf: 'bookshelf-lib',
  puzzleslib: 'puzzles-lib', forgeconfigapiport: 'forge-config-api-port', resourcefullib: 'resourceful-lib',
  yungsapi: 'yungs-api', supermartijn642corelib: 'supermartijn642s-core-lib', cristellib: 'cristel-lib',
  geckolib: 'geckolib', curios: 'curios', trinkets: 'trinkets', playeranimator: 'playeranimator', azurelib: 'azurelib',
  fzzy_config: 'fzzy-config', midnightlib: 'midnightlib', yet_another_config_lib_v3: 'yacl', yacl: 'yacl',
  sophisticatedcore: 'sophisticated-core', create: 'create', ftblibrary: 'ftb-library-forge', l2library: 'l2library',
  quilted_fabric_api: 'qsl', iceberg: 'iceberg', prism: 'prism-lib', zeta: 'zeta', moonlight: 'moonlight',
}

// «structure-pool-api» и «structure_pool_api» — один и тот же мод
export const norm = id => String(id).toLowerCase().replace(/-/g, '_')

export function isPlatform(id) {
  const n = norm(id)
  // модули Fabric API (fabric_networking_api_v1 и т.п.) лежат внутри самого Fabric API,
  // а вот сам fabric_api / fabric — обычный мод, его наличие проверяем
  // то же для модулей Quilt Standard Libraries / Quilted Fabric API
  return PLATFORM.has(n) || (n.startsWith('fabric_') && n !== 'fabric_api')
    || n.startsWith('quilted_fabric_') || n.startsWith('quilt_')
}

// Имя вложенного jar -> вероятные id мода:
// «structure_pool_api-1.2.0+1.21.jar» -> structure_pool_api, «xaerolib-fabric-1.21.1-1.1.0.jar» -> xaerolib_fabric и xaerolib
export function nestedIds(path) {
  const file = path.split('/').pop().replace(/\.jar$/i, '')
  // версия начинается после «-1.2» / «-v1» / «_1.2.», но не «_v1» внутри id (…_lookup_api_v1-7.0.0)
  const full = norm(file.split(/-(?=v?\d)|_(?=v?\d+[.+])/)[0])
  const bare = full.replace(/(_(fabric|forge|neoforge|quilt|common|mc))+$/, '')
  return bare && bare !== full ? [full, bare] : [full]
}

export function parseFabric(text) {
  const j = JSON.parse(text.replace(/^﻿/, ''))
  const provides = (j.provides || []).map(norm)
  return {
    ids: [norm(j.id), ...provides],
    depends: Object.keys(j.depends || {}).map(norm),
    nested: (j.jars || []).flatMap(x => nestedIds(x.file)),
  }
}

export function parseQuilt(text) {
  const q = JSON.parse(text).quilt_loader || {}
  const dep = d => (typeof d === 'string' ? { id: d } : d)
  return {
    ids: [norm(q.id), ...(q.provides || []).map(p => norm(typeof p === 'string' ? p : p.id))],
    depends: (q.depends || []).map(dep).filter(d => !d.optional && d.id).map(d => norm(d.id)),
    nested: (q.jars || []).flatMap(nestedIds),
  }
}

// Минимальный разбор mods.toml: id модов и обязательные зависимости
export function parseToml(text) {
  const ids = []
  const depends = []
  for (const block of text.split(/^\s*\[\[/m).slice(1)) {
    const head = block.slice(0, block.indexOf(']]'))
    const get = key => block.match(new RegExp(`^\\s*${key}\\s*=\\s*["']?([^"'\\n#]+)`, 'm'))?.[1]?.trim()
    if (head.trim() === 'mods') {
      const id = get('modId')
      if (id) ids.push(norm(id))
    } else if (head.startsWith('dependencies')) {
      const id = get('modId')
      const mandatory = get('mandatory')
      const type = get('type')
      const required = type ? type.toLowerCase() === 'required' : mandatory !== 'false'
      if (id && required) depends.push(norm(id))
    }
  }
  return { ids, depends, nested: [] }
}

const u16 = (b, o) => b[o] | (b[o + 1] << 8)
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0

async function range(fetchImpl, url, start, end) {
  const res = await fetchImpl(url, { headers: { Range: `bytes=${start}-${end}` } })
  if (res.status !== 206 && res.status !== 200) throw new Error(`range ${res.status}`)
  const buf = new Uint8Array(await res.arrayBuffer())
  return res.status === 200 ? buf.subarray(start, end + 1) : buf
}

async function inflate(bytes, method) {
  if (method === 0) return bytes
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Возвращает { ids, depends, nested } или null, если прочитать не вышло. */
export async function readJarMeta(url, size, fetchImpl = (...a) => fetch(...a)) {
  try {
    const tailStart = Math.max(0, size - 66000)
    const tail = await range(fetchImpl, url, tailStart, size - 1)
    let eocd = -1
    for (let i = tail.length - 22; i >= 0; i--) {
      if (u32(tail, i) === 0x06054b50) { eocd = i; break }
    }
    if (eocd < 0) return null
    const cdSize = u32(tail, eocd + 12)
    const cdOffset = u32(tail, eocd + 16)
    if (cdOffset === 0xffffffff) return null // zip64: у модов почти не бывает
    const cd = cdOffset >= tailStart
      ? tail.subarray(cdOffset - tailStart, cdOffset - tailStart + cdSize)
      : await range(fetchImpl, url, cdOffset, cdOffset + cdSize - 1)

    const entries = new Map()
    const nested = []
    const dec = new TextDecoder()
    for (let p = 0; p + 46 <= cd.length && u32(cd, p) === 0x02014b50;) {
      const nameLen = u16(cd, p + 28), extraLen = u16(cd, p + 30), commentLen = u16(cd, p + 32)
      const name = dec.decode(cd.subarray(p + 46, p + 46 + nameLen))
      if (WANTED.includes(name)) {
        entries.set(name, { method: u16(cd, p + 10), comp: u32(cd, p + 20), offset: u32(cd, p + 42), nameLen })
      } else if (/^META-INF\/(jars|jarjar)\/.+\.jar$/i.test(name)) {
        nested.push(...nestedIds(name))
      }
      p += 46 + nameLen + extraLen + commentLen
    }

    const read = async name => {
      const e = entries.get(name)
      const head = await range(fetchImpl, url, e.offset, e.offset + 30 + e.nameLen + 256 + e.comp)
      const start = 30 + u16(head, 26) + u16(head, 28)
      return dec.decode(await inflate(head.subarray(start, start + e.comp), e.method))
    }

    let meta = null
    if (entries.has('fabric.mod.json')) meta = parseFabric(await read('fabric.mod.json'))
    else if (entries.has('quilt.mod.json')) meta = parseQuilt(await read('quilt.mod.json'))
    else if (entries.has('META-INF/neoforge.mods.toml')) meta = parseToml(await read('META-INF/neoforge.mods.toml'))
    else if (entries.has('META-INF/mods.toml')) meta = parseToml(await read('META-INF/mods.toml'))
    if (!meta) return null
    meta.nested = [...new Set([...meta.nested, ...nested])]
    return meta
  } catch {
    return null
  }
}
