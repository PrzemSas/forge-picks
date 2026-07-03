import { chromium } from 'playwright'
const html = `<!doctype html><html><body style="margin:0"><div style="width:1920px;height:1080px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;background:radial-gradient(ellipse at 50% 120%, #3a1c08 0%, #170e07 55%, #0b0705 100%);font-family:system-ui,sans-serif;color:#ffe9d6">
<svg width="130" height="130" viewBox="0 0 24 24"><defs><linearGradient id="f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff5a00"/><stop offset=".6" stop-color="#ff9a3c"/><stop offset="1" stop-color="#ffd28a"/></linearGradient></defs><path fill="url(#f)" d="M12 23c-4.4 0-8-3.2-8-7.6 0-3 1.7-5.2 3.2-7 .3-.4 1-.2 1 .3.1 1 .4 2 1.1 2.6C10.2 8.9 11 5.4 10.4 1.9c-.1-.5.5-.9.9-.6 3.5 2.5 8.7 7.7 8.7 13.9 0 4.6-3.6 7.8-8 7.8z"/></svg>
<div style="font-size:96px;font-weight:800;letter-spacing:1px">Forge Picks</div>
<div style="font-size:36px;color:#ffb373;font-weight:600">Live TxLINE World Cup scores → a fan pick game</div>
<div style="font-size:28px;color:#c9a98e;margin-top:18px">Superteam Earn × TxODDS · Consumer &amp; Fan Experiences</div>
<div style="position:absolute;bottom:60px;font-size:26px;color:#a0876f">forge-picks.vercel.app</div>
</div></body></html>`
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } })
await p.setContent(html)
await p.screenshot({ path: 'title.png' })
await b.close()
console.log('title.png done')
