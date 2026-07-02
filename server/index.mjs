import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = process.env.API_PORT || 8787
const TXLINE_ORIGIN = process.env.TXLINE_ORIGIN || 'https://txline.txodds.com'

app.use(cors())
app.use(express.json())

function txlineHeaders() {
  const jwt = process.env.TXLINE_GUEST_JWT
  const apiToken = process.env.TXLINE_API_TOKEN
  if (!jwt || !apiToken) return null
  return {
    Authorization: `Bearer ${jwt}`,
    'X-Api-Token': apiToken,
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    txlineConfigured: Boolean(txlineHeaders()),
  })
})

app.get('/api/fixtures', async (_req, res) => {
  const headers = txlineHeaders()
  if (!headers) {
    return res.json({ source: 'mock', fixtures: mockFixtures() })
  }

  try {
    const url = `${TXLINE_ORIGIN}/api/fixtures`
    const r = await fetch(url, { headers })
    const data = await r.json()
    res.json({ source: 'txline', fixtures: data })
  } catch (err) {
    res.status(502).json({ error: 'txline_fetch_failed', message: String(err) })
  }
})

app.get('/api/scores/:fixtureId', async (req, res) => {
  const headers = txlineHeaders()
  if (!headers) {
    return res.json({ source: 'mock', score: mockScore(req.params.fixtureId) })
  }

  try {
    const url = `${TXLINE_ORIGIN}/api/scores/snapshot?fixtureId=${req.params.fixtureId}`
    const r = await fetch(url, { headers })
    const data = await r.json()
    res.json({ source: 'txline', score: data })
  } catch (err) {
    res.status(502).json({ error: 'txline_fetch_failed', message: String(err) })
  }
})

// --- Demo live engine (mock mode only) --------------------------------------
// Matches are finished by the time judges review, so we simulate ONE live match
// that plays a full 90' in ~90s of real time. Kick it off from the UI for the
// demo video. In TxLINE live mode this is ignored — real feeds take over.
const LIVE_ID = 'wc-r16-2'
const MATCH_SECONDS = 90 // real seconds for a full 90' match
const LIVE_GOALS = [
  { minute: 12, side: 'home' },
  { minute: 34, side: 'away' },
  { minute: 67, side: 'home' },
]
let liveStartedAt = null

app.post('/api/live/kickoff', (_req, res) => {
  liveStartedAt = Date.now()
  res.json({ ok: true, startedAt: liveStartedAt })
})

app.post('/api/live/reset', (_req, res) => {
  liveStartedAt = null
  res.json({ ok: true })
})

function liveMatch() {
  if (!liveStartedAt) return { home: 0, away: 0, minute: 0, status: 'scheduled' }
  const elapsed = (Date.now() - liveStartedAt) / 1000
  const minute = Math.max(0, Math.min(90, Math.floor((elapsed / MATCH_SECONDS) * 90)))
  const home = LIVE_GOALS.filter((g) => g.side === 'home' && g.minute <= minute).length
  const away = LIVE_GOALS.filter((g) => g.side === 'away' && g.minute <= minute).length
  return { home, away, minute, status: minute >= 90 ? 'finished' : 'live' }
}

function mockScore(fixtureId) {
  if (fixtureId === LIVE_ID) return liveMatch()
  const finals = {
    'wc-r32-1': { home: 2, away: 1, minute: 90, status: 'finished' },
    'wc-r32-2': { home: 3, away: 0, minute: 90, status: 'finished' },
  }
  return finals[fixtureId] ?? { home: 0, away: 0, minute: 0, status: 'scheduled' }
}

// Mock = real WC 2026 knockout teams (Poland did NOT qualify). Dates ~ Jul 2026.
function mockFixtures() {
  return [
    { id: 'wc-r16-2', home: 'Germany', away: 'Paraguay', kickoff: '2026-07-02T18:00:00Z', status: 'live', round: 'Round of 16' },
    { id: 'wc-r16-1', home: 'France', away: 'Sweden', kickoff: '2026-07-04T20:00:00Z', status: 'scheduled', round: 'Round of 16' },
    { id: 'wc-r16-3', home: 'United States', away: 'Bosnia and Herzegovina', kickoff: '2026-07-05T22:00:00Z', status: 'scheduled', round: 'Round of 16' },
    { id: 'wc-r32-1', home: 'Mexico', away: 'Ecuador', kickoff: '2026-06-29T22:00:00Z', status: 'finished', round: 'Round of 32' },
    { id: 'wc-r32-2', home: 'England', away: 'DR Congo', kickoff: '2026-06-30T19:00:00Z', status: 'finished', round: 'Round of 32' },
  ]
}

app.listen(PORT, () => {
  console.log(`Forge Picks API proxy http://localhost:${PORT}`)
  console.log(txlineHeaders() ? 'TxLINE: configured' : 'TxLINE: mock mode (set .env tokens)')
})
