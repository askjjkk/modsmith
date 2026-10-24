// Инструмент для проверки: собирает сборки по списку запросов прямо в браузере (как сайт)
// и сохраняет их через tools/serve.py: индекс — в tools/out/<папка>/, отчёт об отсеянном — в tools/out/<папка>-info/.
// Использование в консоли страницы http://localhost:8766/: (await import('/tools/gen.js')).gen('final2', [...])
import { createApi } from '../js/modrinth.js'
import { buildPack } from '../js/builder.js'
import { parse, THEME_BY_ID } from '../js/parser.js'
import { buildIndex } from '../js/mrpack.js'
import { allBlocked } from '../js/broken.js'

const api = createApi()

const save = (path, data) => fetch(`/save/${path}`, { method: 'POST', body: JSON.stringify(data) })

/** requests: [{ name, text, loader, version, size?, polish?, themes?: [id] }] */
export async function gen(dir, requests, log = console.log) {
  const out = []
  for (const r of requests) {
    const p = parse(r.text)
    const themes = r.themes ? r.themes.map(id => ({ theme: THEME_BY_ID.get(id), word: id })) : p.themes
    const opts = {
      version: r.version, loader: r.loader, size: r.size || p.size || 'normal',
      perf: true, qol: true, polish: r.polish !== false, themes, excluded: p.excluded, blocked: allBlocked(),
      onlyBase: !!p.settings?.onlyBase,
    }
    const t0 = Date.now()
    try {
      const pack = await buildPack(opts, api)
      const index = buildIndex({ ...pack, name: `Modsmith: ${r.text}`, summary: r.text })
      await save(`${dir}/${r.name}.json`, index)
      await save(`${dir}-info/${r.name}.json`, {
        text: r.text, loader: r.loader, version: r.version, mods: pack.mods.map(m => `${m.project.slug} ${m.version.number} [${m.section.id}]`),
        skipped: pack.skipped, emptyThemes: pack.emptyThemes, seconds: Math.round((Date.now() - t0) / 1000),
      })
      out.push({ name: r.name, mods: pack.mods.length, skipped: pack.skipped.length })
      log(`${r.name}: ${pack.mods.length} модов, отсеяно ${pack.skipped.length}`)
    } catch (e) {
      out.push({ name: r.name, error: String(e) })
      log(`${r.name}: ошибка ${e}`)
    }
  }
  return out
}
