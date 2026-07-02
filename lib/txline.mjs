// Shared TxLINE logic — used by both the dev Express server and the Vercel
// serverless functions. Stateless: the demo live match is driven by a client
// timestamp (?t=), so it works on serverless (no in-memory state).

const NETWORK = (process.env.TXLINE_NETWORK || 'mainnet').toLowerCase()
export const BASE_URL =
  process.env.TXLINE_BASE_URL ||
  (NETWORK === 'devnet' ? 'https://txline-dev.txodds.com/api' : 'https://txline.txodds.com/api')
const COMPETITION_ID = process.env.TXLINE_COMPETITION_ID || ''

export function txlineHeaders() {
  const jwt = process.env.TXLINE_GUEST_JWT
  const apiToken = process.env.TXLINE_API_TOKEN
  if (!jwt || !apiToken) return null
  return { Authorization: `Bearer ${jwt}`, 'X-Api-Token': apiToken }
}

export function txlineConfigured() {
  return Boolean(txlineHeaders())
}

// --- normalisation: TxLINE OpenAPI 1.5.2 -> stable client shape --------------
function toIso(t) {
  if (!t) return new Date().toISOString()
  const ms = t > 1e12 ? t : t * 1000
  return new Date(ms).toISOString()
}

function scoreNum(s) {
  if (s == null) return 0
  if (typeof s === 'number') return s
  return s.Score ?? s.Goals ?? s.Value ?? 0
}

function totalGoals(total) {
  if (total == null) return 0
  return scoreNum(total.Total ?? total.ETTotal ?? total.H2 ?? total.HT ?? total.H1)
}

function mapSoccerStatus(key) {
  if (!key) return 'scheduled'
  const k = String(key).toUpperCase()
  if (k.startsWith('NS')) return 'scheduled'
  if (k.startsWith('F') || k.startsWith('W')) return 'finished'
  if (k.startsWith('A') || k.startsWith('C')) return 'scheduled'
  return 'live'
}

function normalizeFixture(f) {
  const homeIs1 = f.Participant1IsHome !== false
  return {
    id: String(f.FixtureId),
    home: homeIs1 ? f.Participant1 : f.Participant2,
    away: homeIs1 ? f.Participant2 : f.Participant1,
    kickoff: toIso(f.StartTime),
    status: 'scheduled',
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
  return { home, away, minute, status: mapSoccerStatus(statusKey), goals: [] }
}

// --- demo data (mock mode) --------------------------------------------------
const LIVE_ID = 'wc-r16-2'
const MATCH_SECONDS = 90 // real seconds for a full 90' demo match
const LIVE_GOALS = [
  { minute: 12, side: 'home', scorer: 'Florian Wirtz', club: 'Liverpool' },
  { minute: 34, side: 'away', scorer: 'Antonio Sanabria', club: 'Torino' },
  { minute: 67, side: 'home', scorer: 'Jamal Musiala', club: 'Bayern München' },
]

// Stateless live sim: `startedAt` is a client-supplied epoch (ms). No server state.
function liveMatch(startedAt) {
  const started = startedAt ? Number(startedAt) : null
  if (!started || Number.isNaN(started)) return { home: 0, away: 0, minute: 0, status: 'scheduled', goals: [] }
  const elapsed = (Date.now() - started) / 1000
  const minute = Math.max(0, Math.min(90, Math.floor((elapsed / MATCH_SECONDS) * 90)))
  const goals = LIVE_GOALS.filter((g) => g.minute <= minute)
  const home = goals.filter((g) => g.side === 'home').length
  const away = goals.filter((g) => g.side === 'away').length
  return { home, away, minute, status: minute >= 90 ? 'finished' : 'live', goals }
}

export function mockScore(fixtureId, startedAt) {
  if (fixtureId === LIVE_ID) return liveMatch(startedAt)
  const finals = {
    'wc-r32-1': {
      home: 2,
      away: 1,
      minute: 90,
      status: 'finished',
      goals: [
        { minute: 23, side: 'home', scorer: 'Santiago Giménez', club: 'AC Milan' },
        { minute: 51, side: 'away', scorer: 'Enner Valencia', club: 'Internacional' },
        { minute: 78, side: 'home', scorer: 'Hirving Lozano', club: 'San Diego FC' },
      ],
    },
    'wc-r32-2': {
      home: 3,
      away: 0,
      minute: 90,
      status: 'finished',
      goals: [
        { minute: 15, side: 'home', scorer: 'Harry Kane', club: 'Bayern München' },
        { minute: 40, side: 'home', scorer: 'Bukayo Saka', club: 'Arsenal' },
        { minute: 62, side: 'home', scorer: 'Phil Foden', club: 'Manchester City' },
      ],
    },
  }
  return finals[fixtureId] ?? { home: 0, away: 0, minute: 0, status: 'scheduled', goals: [] }
}

export function mockFixtures() {
  return [
    { id: 'wc-r16-2', home: 'Germany', away: 'Paraguay', kickoff: '2026-07-02T18:00:00Z', status: 'live', round: 'Round of 16', venue: 'MetLife Stadium, New York/NJ' },
    { id: 'wc-r16-1', home: 'France', away: 'Sweden', kickoff: '2026-07-04T20:00:00Z', status: 'scheduled', round: 'Round of 16', venue: 'SoFi Stadium, Los Angeles' },
    { id: 'wc-r16-3', home: 'United States', away: 'Bosnia and Herzegovina', kickoff: '2026-07-05T22:00:00Z', status: 'scheduled', round: 'Round of 16', venue: 'AT&T Stadium, Dallas' },
    { id: 'wc-r32-1', home: 'Mexico', away: 'Ecuador', kickoff: '2026-06-29T22:00:00Z', status: 'finished', round: 'Round of 32', venue: 'Estadio Azteca, Mexico City' },
    { id: 'wc-r32-2', home: 'England', away: 'DR Congo', kickoff: '2026-06-30T19:00:00Z', status: 'finished', round: 'Round of 32', venue: 'Mercedes-Benz Stadium, Atlanta' },
  ]
}

// --- data access (mock or live TxLINE) --------------------------------------
export async function getFixtures() {
  const headers = txlineHeaders()
  if (!headers) return { source: 'mock', fixtures: mockFixtures() }
  try {
    const q = COMPETITION_ID ? `?competitionId=${encodeURIComponent(COMPETITION_ID)}` : ''
    const r = await fetch(`${BASE_URL}/fixtures/snapshot${q}`, { headers })
    if (!r.ok) throw new Error(`fixtures HTTP ${r.status}`)
    const data = await r.json()
    const arr = Array.isArray(data) ? data : (data.fixtures ?? [])
    return { source: 'txline', fixtures: arr.map(normalizeFixture) }
  } catch (err) {
    console.warn('[txline] fixtures failed, serving mock:', String(err))
    return { source: 'mock-fallback', error: String(err), fixtures: mockFixtures() }
  }
}

export async function getScore(fixtureId, startedAt) {
  const headers = txlineHeaders()
  if (!headers) return { source: 'mock', score: mockScore(fixtureId, startedAt) }
  try {
    const r = await fetch(`${BASE_URL}/scores/snapshot/${encodeURIComponent(fixtureId)}`, { headers })
    if (!r.ok) throw new Error(`scores HTTP ${r.status}`)
    const data = await r.json()
    return { source: 'txline', score: normalizeScores(data) }
  } catch (err) {
    console.warn('[txline] scores failed, serving mock:', String(err))
    return { source: 'mock-fallback', error: String(err), score: mockScore(fixtureId, startedAt) }
  }
}
