// Фон: ночное небо, мерцающие звёзды, блочные холмы с параллаксом и частицы опыта/зачарования
export function startSky(canvas) {
  const ctx = canvas.getContext('2d')
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  let w, h, dpr, stars, hills, particles
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 }

  function heightmap(cols, seed, base, amp) {
    let s = seed
    const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
    const out = []
    let v = base
    for (let i = 0; i < cols; i++) {
      v += (rand() - 0.5) * amp
      v = Math.max(base - amp * 2, Math.min(base + amp * 2, v))
      out.push(Math.round(v))
    }
    return out
  }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2)
    w = canvas.width = innerWidth * dpr
    h = canvas.height = innerHeight * dpr
    canvas.style.width = innerWidth + 'px'
    canvas.style.height = innerHeight + 'px'
    stars = Array.from({ length: Math.round((w * h) / (9000 * dpr * dpr)) }, () => ({
      x: Math.random() * w, y: Math.random() * h * 0.7, r: (Math.random() < 0.85 ? 1 : 2) * dpr,
      p: Math.random() * Math.PI * 2, s: 0.5 + Math.random() * 1.5,
    }))
    const block = 16 * dpr
    const cols = Math.ceil(w / block) + 40
    hills = [
      { color: '#1a1533', block, depth: 0.15, map: heightmap(cols, 7, 16, 3), y: 0.62 },
      { color: '#141a2e', block, depth: 0.3, map: heightmap(cols, 19, 12, 3), y: 0.72 },
      { color: '#0d1322', block, depth: 0.55, map: heightmap(cols, 31, 9, 2.4), y: 0.82 },
    ]
    particles = Array.from({ length: reduce ? 0 : 46 }, () => spawn(true))
  }

  function spawn(anywhere) {
    const xp = Math.random() < 0.5
    return {
      x: Math.random() * w, y: anywhere ? Math.random() * h : h + 10 * dpr,
      size: (2 + Math.random() * 3) * dpr, vy: (0.15 + Math.random() * 0.45) * dpr,
      sway: Math.random() * Math.PI * 2, color: xp ? '#7dff6a' : '#c89bff', life: 0.4 + Math.random() * 0.6,
    }
  }

  function frame(t) {
    mouse.x += (mouse.tx - mouse.x) * 0.04
    mouse.y += (mouse.ty - mouse.y) * 0.04
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#070912')
    g.addColorStop(0.55, '#141030')
    g.addColorStop(1, '#0b1020')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)

    // луна-квадрат
    const mx = w * 0.82 + mouse.x * 12 * dpr, my = h * 0.16 + mouse.y * 8 * dpr, ms = 46 * dpr
    ctx.fillStyle = 'rgba(232,236,255,0.06)'
    ctx.fillRect(mx - ms, my - ms, ms * 3, ms * 3)
    ctx.fillStyle = '#e9ecff'
    ctx.fillRect(mx, my, ms, ms)
    ctx.fillStyle = '#c9cde8'
    ctx.fillRect(mx + ms * 0.2, my + ms * 0.25, ms * 0.25, ms * 0.25)
    ctx.fillRect(mx + ms * 0.6, my + ms * 0.6, ms * 0.2, ms * 0.2)

    for (const s of stars) {
      const a = reduce ? 0.7 : 0.35 + 0.65 * Math.abs(Math.sin(t / 1000 * s.s + s.p))
      ctx.fillStyle = `rgba(220,228,255,${a})`
      ctx.fillRect(s.x + mouse.x * 4 * dpr, s.y + mouse.y * 3 * dpr, s.r, s.r)
    }

    for (const layer of hills) {
      const off = (reduce ? 0 : t * 0.004 * layer.depth * dpr) + mouse.x * 60 * layer.depth * dpr
      const start = Math.floor(off / layer.block)
      ctx.fillStyle = layer.color
      for (let i = -1; i < w / layer.block + 2; i++) {
        const col = layer.map[((i + start) % layer.map.length + layer.map.length) % layer.map.length]
        const x = i * layer.block - (off % layer.block)
        const top = h * layer.y - col * layer.block * 0.5 + mouse.y * 20 * layer.depth * dpr
        ctx.fillRect(Math.floor(x), Math.floor(top), layer.block + 1, h - top)
      }
    }

    for (const p of particles) {
      p.y -= p.vy
      p.sway += 0.02
      p.life -= 0.0012
      if (p.y < -10 || p.life <= 0) Object.assign(p, spawn(false))
      const x = p.x + Math.sin(p.sway) * 6 * dpr + mouse.x * 30 * dpr
      ctx.globalAlpha = Math.min(1, p.life * 1.5) * 0.85
      ctx.fillStyle = p.color
      ctx.shadowColor = p.color
      ctx.shadowBlur = 12 * dpr
      ctx.fillRect(x, p.y, p.size, p.size)
    }
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
    if (!reduce) requestAnimationFrame(frame)
  }

  addEventListener('resize', resize)
  addEventListener('pointermove', e => {
    mouse.tx = e.clientX / innerWidth - 0.5
    mouse.ty = e.clientY / innerHeight - 0.5
  })
  resize()
  requestAnimationFrame(frame)
}
