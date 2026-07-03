// Forge Picks — automated demo recording (Playwright)
// Clip A: local mock demo (full match). Clip B: production live TxLINE data.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const OUT = new URL('./video/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const W = 1920, H = 1080

// ---------- helpers ----------
async function inject(page) {
  await page.evaluate(() => {
    // fake cursor (headless has no visible pointer)
    const c = document.createElement('div')
    c.id = '__cur'
    Object.assign(c.style, {
      position: 'fixed', left: '0', top: '0', width: '22px', height: '22px',
      borderRadius: '50%', background: 'rgba(255,140,40,.85)',
      border: '2px solid #fff', boxShadow: '0 0 14px rgba(255,120,0,.9)',
      zIndex: 999999, pointerEvents: 'none', transform: 'translate(-50%,-50%)',
      transition: 'width .12s, height .12s',
    })
    document.body.appendChild(c)
    window.addEventListener('mousemove', (e) => {
      c.style.left = e.clientX + 'px'
      c.style.top = e.clientY + 'px'
    }, { passive: true })
    window.addEventListener('mousedown', () => { c.style.width = '34px'; c.style.height = '34px' })
    window.addEventListener('mouseup', () => { c.style.width = '22px'; c.style.height = '22px' })

    // caption bar
    const cap = document.createElement('div')
    cap.id = '__cap'
    Object.assign(cap.style, {
      position: 'fixed', left: '50%', bottom: '36px', transform: 'translateX(-50%)',
      maxWidth: '72%', padding: '14px 26px', borderRadius: '14px',
      background: 'rgba(12,10,8,.88)', color: '#ffe9d6',
      font: '600 26px/1.35 system-ui, sans-serif', letterSpacing: '.2px',
      textAlign: 'center', zIndex: 999998, pointerEvents: 'none',
      border: '1px solid rgba(255,140,40,.45)', boxShadow: '0 8px 30px rgba(0,0,0,.6)',
      opacity: '0', transition: 'opacity .35s',
    })
    document.body.appendChild(cap)
  })
}

async function cap(page, text) {
  await page.evaluate((t) => {
    const el = document.getElementById('__cap')
    if (!t) { el.style.opacity = '0'; return }
    el.textContent = t
    el.style.opacity = '1'
  }, text)
}

async function moveTo(page, selector, opts = {}) {
  const el = page.locator(selector).first()
  await el.waitFor({ state: 'visible', timeout: 20000 })
  const box = await el.boundingBox()
  if (!box) throw new Error('no box for ' + selector)
  const x = box.x + box.width * (opts.fx ?? 0.5)
  const y = box.y + box.height * (opts.fy ?? 0.5)
  await page.mouse.move(x, y, { steps: 30 })
  return { x, y }
}

async function clickAt(page, selector, opts) {
  const { x, y } = await moveTo(page, selector, opts)
  await page.waitForTimeout(350)
  await page.mouse.down(); await page.waitForTimeout(120); await page.mouse.up()
  return { x, y }
}

async function scrollToEl(page, selector, block = 'center') {
  await page.evaluate(([sel, blk]) => {
    document.querySelector(sel)?.scrollIntoView({ behavior: 'smooth', block: blk })
  }, [selector, block])
  await page.waitForTimeout(1400)
}

const sleep = (page, ms) => page.waitForTimeout(ms)

// ---------- clip A: mock demo, full match ----------
async function clipA(browser) {
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: OUT, size: { width: W, height: H } },
  })
  const page = await ctx.newPage()
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
  await inject(page)
  await page.mouse.move(W / 2, H / 2)

  // S1 — hook
  await cap(page, 'Forge Picks — live World Cup scores from TxLINE, turned into a fan pick game.')
  await sleep(page, 4200)
  await scrollToEl(page, '.board-panel')
  await sleep(page, 1200)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await sleep(page, 1600)

  // S2 — select match + pick
  await cap(page, 'Pick a match — I’ll take Germany vs Paraguay — and make your call: home, draw, or away.')
  await clickAt(page, '.fixtures button:has-text("Germany")')
  await sleep(page, 1500)
  await scrollToEl(page, '.pick-panel')
  await moveTo(page, '.pick-row button:has-text("Draw")')
  await sleep(page, 700)
  await moveTo(page, '.pick-row button:has-text("Paraguay")')
  await sleep(page, 700)
  await clickAt(page, '.pick-row button:has-text("Germany")')
  await cap(page, 'A correct call earns +10 forge points at full time. I’m backing Germany.')
  await sleep(page, 3200)

  // S3 — kick off
  await clickAt(page, 'button.kickoff')
  await cap(page, 'Kick off! The app polls the TxLINE score feed every 2 seconds.')
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await sleep(page, 9000)

  await cap(page, '⚽ Every goal fires a banner, a score pop and a hero flash — in real time.')
  await sleep(page, 12000)

  // goals timeline
  await scrollToEl(page, '.pick-panel')
  await cap(page, 'The goal timeline: scorer, minute and their club — with a Transfermarkt lookup link.')
  try { await moveTo(page, 'ul.goals a.g-scorer') } catch {}
  await sleep(page, 11000)

  // back to hero — progress bar
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await cap(page, 'The hero tracks match time with a 0–90′ progress bar and your pick pinned below.')
  await sleep(page, 12000)

  // board
  await scrollToEl(page, '.board-panel')
  await cap(page, 'The Forge Board — you vs rival typers. It reshuffles the moment results settle.')
  await sleep(page, 11000)

  // ride out the match on the hero
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await cap(page, 'Final minutes… my Germany call is still alive.')

  // wait for full time (demo match ~90s total)
  await page.locator('.hero-tag:has-text("FULL TIME")').waitFor({ timeout: 160000 })
  await cap(page, 'Full time — the pick settles instantly: +10 forge points.')
  await sleep(page, 3000)
  await scrollToEl(page, '.pick-panel')
  await sleep(page, 3500)
  await scrollToEl(page, '.board-panel')
  await cap(page, 'And the Forge Board reshuffles — no refresh, it just happens.')
  await sleep(page, 6000)
  await cap(page, null)
  await sleep(page, 800)

  await ctx.close()
  return page.video()
}

// ---------- clip B: production, live TxLINE ----------
async function clipB(browser) {
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: OUT, size: { width: W, height: H } },
  })
  const page = await ctx.newPage()
  await page.goto('https://forge-picks.vercel.app/', { waitUntil: 'networkidle' })
  await inject(page)
  await page.mouse.move(W / 2, H / 2)

  await cap(page, 'Everything so far ran in demo mode. This is production — real TxLINE data.')
  await sleep(page, 4500)

  // highlight the Live data badge
  await page.evaluate(() => {
    const b = document.querySelector('.badge')
    if (b) b.style.cssText += ';outline:3px solid rgba(255,140,40,.9);outline-offset:6px;border-radius:10px'
  })
  await moveTo(page, '.badge')
  await cap(page, 'On-chain subscription on Solana devnet → API token → the badge flips to ● Live data. Same UI, zero code changes.')
  await sleep(page, 7000)

  await page.evaluate(() => {
    const b = document.querySelector('.badge'); if (b) b.style.outline = 'none'
  })

  // real fixtures
  await scrollToEl(page, '.fixtures')
  await cap(page, 'Real World Cup 2026 fixtures, straight from the TxLINE feed — Argentina, Colombia, Canada…')
  const items = await page.locator('.fixtures button').count()
  for (let i = 1; i < Math.min(items, 4); i++) {
    await moveTo(page, `.fixtures li:nth-child(${i + 1}) button`)
    await sleep(page, 900)
  }
  await clickAt(page, '.fixtures li:nth-child(2) button')
  await sleep(page, 3000)

  await cap(page, 'Guest auth · token activation · fixtures + live score snapshots — proxied server-side, tokens never reach the browser.')
  await scrollToEl(page, '.txline-strip')
  await sleep(page, 6500)

  // outro
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await cap(page, '🔥 Try it — forge-picks.vercel.app · hit Kick off and make your pick. Built by PrzemSas.')
  await sleep(page, 6000)
  await cap(page, null)
  await sleep(page, 800)

  await ctx.close()
  return page.video()
}

// ---------- main ----------
const browser = await chromium.launch()
const vA = await clipA(browser)
console.log('clipA:', await vA.path())
const vB = await clipB(browser)
console.log('clipB:', await vB.path())
await browser.close()
console.log('DONE')
