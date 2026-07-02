import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = process.env.API_PORT || 8787

// TxLINE base URL — mainnet (realtime, service level 12) or devnet.
const NETWORK = (process.env.TXLINE_NETWORK || 'mainnet').toLowerCase()
const BASE_URL =
  process.env.TXLINE_BASE_URL ||
  (NETWORK === 'devnet' ? 'https://txline-dev.txodds.com/api' : 'https://txline.txodds.com/api')
const COMPETITION_ID = process.env.TXLINE_COMPETITION_ID || '' // optional (World Cup id)

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
    network: NETWORK,
  })
})

// --- Normalisation: TxLINE schema (OpenAPI 1.5.2) -> stable client shape -----
// Fixture: Participant1/2 (+ Participant1IsHome), StartTime (epoch), Competition, FixtureId.
// Scores:  array of score events; scoreSoccer.ParticipantN.Total (goals),
//          statusSoccerId = externally-tagged key (NS2/H21/HT2/F2/...), dataSoccer.Minutes.
function toIso(t) {
  if (!t) return new Date().toISOString()
  const ms = t > 1e12 ? t : t * 1000 // spec uses int64; accept seconds or ms
  return new Date(ms).toISOString()
}

function scoreNum(soccerScore) {
  if (soccerScore == null) return 0
  if (typeof soccerScore === 'number') return soccerScore
  return soccerScore.Score ?? soccerScore.Goals ?? soccerScore.Value ?? 0
}

function totalGoals(total) {
  if (total == null) return 0
  // SoccerTotalScore: prefer full Total, fall back through periods.
  return scoreNum(total.Total ?? total.ETTotal ?? total.H2 ?? total.HT ?? total.H1)
}

function mapSoccerStatus(key) {
  if (!key) return 'scheduled'
  const k = String(key).toUpperCase()
  if (k.startsWith('NS')) return 'scheduled' // not started
  if (k.startsWith('F') || k.startsWith('W')) return 'finished' // F2/FET/WET/WPE = ended
  if (k.startsWith('A') || k.startsWith('C')) return 'scheduled' // abandoned/cancelled -> don't settle
  return 'live' // H11/H21/HT2/ET1/ET2/P/PE/... in progress
}

function normalizeFixture(f) {
  const homeIs1 = f.Participant1IsHome !== false
  return {
    id: String(f.FixtureId),
    home: homeIs1 ? f.Participant1 : f.Participant2,
    away: homeIs1 ? f.Participant2 : f.Participant1,
    kickoff: toIso(f.StartTime),
    status: 'scheduled', // real status arrives via /scores; client uses that
    round: f.Competition,
  }
}

function normalizeScores(payload) {
  const events = Array.isArray(payload) ? payload : payload ? [payload] : []
  let home = 0
  let away = 0
  let minute = 0
  let statusKey = null
  let p1IsHome = true
  for (const e of events) {
    if (!e) continue
    if (e.participant1IsHome !== undefined) p1IsHome = e.participant1IsHome !== false
    if (e.scoreSoccer) {
      const p1 = totalGoals(e.scoreSoccer.Participant1)
      const p2 = totalGoals(e.scoreSoccer.Participant2)
      home = p1IsHome ? p1 : p2
      away = p1IsHome ? p2 : p1
    }
    if (e.statusSoccerId && typeof e.statusSoccerId === 'object') {
      statusKey = Object.keys(e.statusSoccerId)[0] ?? statusKey
    }
    if (e.dataSoccer && typeof e.dataSoccer.Minutes === 'number') {
      minute = Math.max(minute, e.dataSoccer.Minutes)
    }
  }
  return { home, away, minute, status: mapSoccerStatus(statusKey) }
}

// --- Fixtures ---------------------------------------------------------------
app.get('/api/fixtures', async (_req, res) => {
  const headers = txlineHeaders()
  if (!headers) return res.json({ source: 'mock', fixtures: mockFixtures() })

  try {
    const q = COMPETITION_ID ? `?competitionId=${encodeURIComponent(COMPETITION_ID)}` : ''
    const r = await fetch(`${BASE_URL}/fixtures/snapshot${q}`, { headers })
    if (!r.ok) throw new Error(`fixtures HTTP ${r.status}`)
    const data = await r.json()
    const arr = Array.isArray(data) ? data : (data.fixtures ?? [])
    res.json({ source: 'txline', fixtures: arr.map(normalizeFixture) })
  } catch (err) {
    console.warn('[txline] fixtures failed, serving mock:', String(err))
    res.json({ source: 'mock-fallback', error: String(err), fixtures: mockFixtures() })
  }
})

// --- Scores -----------------------------------------------------------------
app.get('/api/scores/:fixtureId', async (req, res) => {
  const headers = txlineHeaders()
  if (!headers) return res.json({ source: 'mock', score: mockScore(req.params.fixtureId) })

  try {
    const r = await fetch(`${BASE_URL}/scores/snapshot/${encodeURIComponent(req.params.fixtureId)}`, { headers })
    if (!r.ok) throw new Error(`scores HTTP ${r.status}`)
    const data = await r.json()
    res.json({ source: 'txline', score: normalizeScores(data) })
  } catch (err) {
    console.warn('[txline] scores failed, serving mock:', String(err))
    res.json({ source: 'mock-fallback', error: String(err), score: mockScore(req.params.fixtureId) })
  }
})

// --- Demo live engine (mock mode only) --------------------------------------
// Matches are finished by the time judges review, so we simulate ONE live match
// that plays a full 90' in ~90s of real time. Kick it off from the UI for the
// demo video. In TxLINE live mode this is unused — real feeds take over.
const LIVE_ID = 'wc-r16-2'
const MATCH_SECONDS = 90
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
  console.log(`TxLINE base: ${BASE_URL} (${NETWORK})`)
  console.log(txlineHeaders() ? 'TxLINE: configured — live data' : 'TxLINE: mock mode (set .env tokens)')
})
