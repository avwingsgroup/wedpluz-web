#!/usr/bin/env node
/**
 * Renders the static brand assets used for SEO and installability:
 *   public/icons/{favicon-32,apple-touch-icon,icon-192,icon-512,icon-maskable-512}.png
 *   public/og/wedpluz-default.jpg   (1200×630 default social share image)
 * Usage: node scripts/generate-brand-assets.mjs   (optional: PLAYWRIGHT_CHROMIUM_EXECUTABLE=…)
 * Re-run after changing the logo, colours or the home artwork.
 */
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..')
const pub = (...p) => path.join(root, 'public', ...p)
fs.mkdirSync(pub('icons'), { recursive: true })
fs.mkdirSync(pub('og'), { recursive: true })

const dataUrl = (file, mime) => `data:${mime};base64,${fs.readFileSync(path.join(root, file)).toString('base64')}`
const artwork = dataUrl('src/assets/illustrations/create-manage-events.webp', 'image/webp')

// Brand "W" mark (same geometry as public/favicon.svg) without the rounded tile.
const mark = (size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff2bb0"/><stop offset="1" stop-color="#e45ce4"/></linearGradient></defs><path d="M12 18 L22 48 L32 28 L42 48 L52 18" fill="none" stroke="url(#g)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="12" r="2" fill="#ff2bb0"/><circle cx="28" cy="9" r="1.5" fill="#ffb3e6"/><circle cx="36" cy="12" r="2" fill="#f0a3f0"/></svg>`

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined })

async function render(file, width, height, html, type = 'png') {
  const page = await browser.newPage({ viewport: { width, height } })
  await page.setContent(`<!doctype html><html><head><style>*{margin:0;box-sizing:border-box}html,body{width:${width}px;height:${height}px;overflow:hidden}</style></head><body>${html}</body></html>`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: file, type, ...(type === 'jpeg' ? { quality: 88 } : { omitBackground: false }) })
  await page.close()
  console.log('wrote', path.relative(root, file), `${fs.statSync(file).size} bytes`)
}

// Icons: plum tile, mark centred. Maskable keeps the mark inside the 80% safe zone.
const tile = (size, scale) => `<div style="width:${size}px;height:${size}px;background:#270427;display:flex;align-items:center;justify-content:center">${mark(Math.round(size * scale))}</div>`
await render(pub('icons', 'favicon-32.png'), 32, 32, tile(32, 0.95))
await render(pub('icons', 'apple-touch-icon.png'), 180, 180, tile(180, 0.82))
await render(pub('icons', 'icon-192.png'), 192, 192, tile(192, 0.82))
await render(pub('icons', 'icon-512.png'), 512, 512, tile(512, 0.82))
await render(pub('icons', 'icon-maskable-512.png'), 512, 512, tile(512, 0.62))

// Default share image (1200×630, safe for WhatsApp, Facebook, X, LinkedIn, Slack).
await render(
  pub('og', 'wedpluz-default.jpg'),
  1200,
  630,
  `<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&display=block" rel="stylesheet">
  <div style="position:relative;width:1200px;height:630px;overflow:hidden;font-family:Manrope,system-ui,sans-serif;color:#fff;background:radial-gradient(circle at 85% 15%,#9b119b 0,transparent 45%),radial-gradient(circle at 10% 95%,#5b0f5b 0,transparent 40%),#270427">
    <div style="position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.08) 1.2px,transparent 1.6px);background-size:22px 22px"></div>
    <div style="position:absolute;left:72px;top:64px;display:flex;align-items:center;gap:2px">${mark(64)}<span style="font-size:44px;font-weight:800;letter-spacing:-1px;margin-left:-6px">edpluz</span></div>
    <div style="position:absolute;left:72px;top:190px;width:600px">
      <div style="font-size:62px;line-height:1.08;font-weight:800;letter-spacing:-1.5px">Discover events.<br>Buy tickets.<br>Hire vendors.</div>
      <div style="margin-top:26px;font-size:26px;line-height:1.35;font-weight:500;color:rgba(255,255,255,.82)">Weddings, parties, concerts and trusted event vendors across Nigeria.</div>
      <div style="margin-top:34px;display:inline-block;padding:12px 26px;border-radius:999px;background:#fff;color:#9b119b;font-size:24px;font-weight:700">wedpluz.com</div>
    </div>
    <img src="${artwork}" style="position:absolute;right:48px;top:92px;width:461px;height:454px" alt="">
  </div>`,
  'jpeg',
)

await browser.close()
