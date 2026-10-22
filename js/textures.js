// Пиксельные текстуры 16x16, нарисованные кодом (без чужих картинок): для парящих 3D-блоков
function rng(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

function paint(draw, seed) {
  const c = document.createElement('canvas')
  c.width = c.height = 16
  const ctx = c.getContext('2d')
  const r = rng(seed)
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      ctx.fillStyle = draw(x, y, r)
      ctx.fillRect(x, y, 1, 1)
    }
  }
  return c.toDataURL()
}

const pick = (r, list) => list[Math.floor(r() * list.length)]
const DIRT = ['#6b4a2f', '#7a5536', '#5d3f27', '#87603d', '#6f4c30']
const GRASS = ['#4f8a2b', '#5c9b33', '#447a24', '#68a83a', '#3f7020']
const STONE = ['#6e7178', '#7c7f86', '#62656b', '#878a91', '#585b61']
const OBSIDIAN = ['#140d22', '#1d1430', '#22183a', '#0f0a1a', '#2a1d47']

export function makeTextures() {
  const grassTop = paint((x, y, r) => pick(r, GRASS), 11)
  const grassSide = paint((x, y, r) => (y < 3 || (y === 3 && r() < 0.5) ? pick(r, GRASS) : pick(r, DIRT)), 12)
  const dirt = paint((x, y, r) => pick(r, DIRT), 13)
  const diamond = paint((x, y, r) => {
    const vein = [[3, 3], [4, 4], [10, 2], [11, 3], [5, 10], [6, 11], [12, 11], [11, 12], [2, 13]]
    return vein.some(([vx, vy]) => Math.abs(vx - x) + Math.abs(vy - y) <= 1 && r() < 0.8) ? pick(r, ['#5ee7df', '#3cc8c0', '#a8fff8']) : pick(r, STONE)
  }, 14)
  const obsidian = paint((x, y, r) => (r() < 0.06 ? pick(r, ['#b77bff', '#8a4fff']) : pick(r, OBSIDIAN)), 15)
  const gold = paint((x, y, r) => {
    const vein = [[2, 5], [3, 5], [9, 3], [12, 8], [13, 9], [6, 12], [7, 12]]
    return vein.some(([vx, vy]) => Math.abs(vx - x) + Math.abs(vy - y) <= 1 && r() < 0.8) ? pick(r, ['#ffcf4a', '#f2a93b', '#fff1a8']) : pick(r, STONE)
  }, 16)
  return {
    grass: { top: grassTop, side: grassSide, bottom: dirt },
    diamond: { top: diamond, side: diamond, bottom: diamond },
    obsidian: { top: obsidian, side: obsidian, bottom: obsidian },
    gold: { top: gold, side: gold, bottom: gold },
  }
}
