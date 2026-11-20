// Generates src/assets/patterns/footer-stars.svg: the scattered white specks on the footer's plum background.
// Density and size/brightness mix were measured from the design (homepage - individuals, footer at 1440px):
// ~38 specks per 100,000 px²; 62% 1–2 px specks, 19% ~2 px, 15% 3–4 px, 5% ~5 px, larger ones brighter and softer.
// Seeded, so the output is stable between runs. Usage: node scripts/generate-footer-stars.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const W = 1440
const H = 720
const DENSITY = 38 / 100_000
// Radii/opacities tuned so the rendered specks match the design's measured size and brightness per tier
// (anti-aliasing spreads a circle over more pixels than its radius suggests). The larger dots are slightly soft.
const TIERS = [
  { share: 0.62, r: [0.4, 0.55], opacity: [0.14, 0.22], soft: false },
  { share: 0.19, r: [0.6, 0.8], opacity: [0.15, 0.21], soft: false },
  { share: 0.14, r: [1.2, 1.5], opacity: [0.19, 0.25], soft: true },
  { share: 0.05, r: [1.8, 2.2], opacity: [0.21, 0.27], soft: true },
]

// mulberry32: tiny deterministic PRNG
function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = rng(20261120)
const between = ([a, b]) => a + (b - a) * rand()

const total = Math.round(W * H * DENSITY)
const crisp = []
const soft = []
for (const tier of TIERS) {
  const n = Math.round(total * tier.share)
  for (let i = 0; i < n; i++) {
    const r = between(tier.r)
    // keep specks a little inside the tile so none is cut in half where tiles meet
    const x = r + 1 + rand() * (W - 2 * r - 2)
    const y = r + 1 + rand() * (H - 2 * r - 2)
    const circle = `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill-opacity="${between(tier.opacity).toFixed(2)}"/>`
    ;(tier.soft ? soft : crisp).push(circle)
  }
}

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
  `<defs><filter id="s" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.45"/></filter></defs>` +
  `<g fill="#fff">${crisp.join('')}</g>` +
  `<g fill="#fff" filter="url(#s)">${soft.join('')}</g>` +
  `</svg>\n`
const out = resolve(dirname(fileURLToPath(import.meta.url)), '../src/assets/patterns/footer-stars.svg')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, svg)
console.log(`footer-stars.svg: ${crisp.length + soft.length} specks, ${(svg.length / 1024).toFixed(1)} KB`)
