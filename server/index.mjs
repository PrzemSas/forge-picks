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

// Mock = real WC 2026 knockout teams (Poland did NOT qualify). Dates relative to ~2 Jul 2026.
function mockFixtures() {
  return [
    {
      id: 'wc-r16-1',
      home: 'France',
      away: 'Sweden',
      kickoff: '2026-07-04T20:00:00Z',
      status: 'scheduled',
      round: 'Round of 16',
    },
    {
      id: 'wc-r16-2',
      home: 'Germany',
      away: 'Paraguay',
      kickoff: '2026-07-02T18:00:00Z',
      status: 'live',
      round: 'Round of 16',
    },
    {
      id: 'wc-r32-1',
      home: 'Mexico',
      away: 'Ecuador',
      kickoff: '2026-06-29T22:00:00Z',
      status: 'finished',
      round: 'Round of 32',
    },
    {
      id: 'wc-r32-2',
      home: 'England',
      away: 'DR Congo',
      kickoff: '2026-06-30T19:00:00Z',
      status: 'finished',
      round: 'Round of 32',
    },
    {
      id: 'wc-r16-3',
      home: 'United States',
      away: 'Bosnia and Herzegovina',
      kickoff: '2026-07-05T22:00:00Z',
      status: 'scheduled',
      round: 'Round of 16',
    },
  ]
}

function mockScore(fixtureId) {
  const scores = {
    'wc-r16-1': { home: 0, away: 0, minute: 0 },
    'wc-r16-2': { home: 1, away: 1, minute: 72 },
    'wc-r32-1': { home: 2, away: 1, minute: 90 },
    'wc-r32-2': { home: 3, away: 0, minute: 90 },
    'wc-r16-3': { home: 0, away: 0, minute: 0 },
  }
  return scores[fixtureId] ?? { home: 0, away: 0, minute: 0 }
}

app.listen(PORT, () => {
  console.log(`Forge Picks API proxy http://localhost:${PORT}`)
  console.log(txlineHeaders() ? 'TxLINE: configured' : 'TxLINE: mock mode (set .env tokens)')
})