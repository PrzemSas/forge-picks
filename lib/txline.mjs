// Shared TxLINE logic — used by both the dev Express server and the Vercel
// serverless functions. Stateless: the demo live match is driven by a client
// timestamp (?t=), so it works on serverless (no in-memory state).
import { enrichMatch } from './thesportsdb.mjs'

const NETWORK = (process.env.TXLINE_NETWORK || 'mainnet').toLowerCase()
export const BASE_URL =
  process.env.TXLINE_BASE_URL ||
  (NETWORK === 'devnet' ? 'https://txline-dev.txodds.com/api' : 'https://txline.txodds.com/api')
const COMPETITION_ID = process.env.TXLINE_COMPETITION_ID || ''

// Guest JWTs are short-lived; the API token is the durable credential. On a
// 401/403 we grab a fresh guest JWT (open endpoint) and retry once, so the
// live feed never silently degrades to mock when the env JWT expires.
let refreshedJwt = null

export function txlineHeaders() {
  const jwt = refreshedJwt || process.env.TXLINE_GUEST_JWT
  const apiToken = process.env.TXLINE_API_TOKEN
  if (!jwt || !apiToken) return null
  return { Authorization: `Bearer ${jwt}`, 'X-Api-Token': apiToken }
}

async function refreshGuestJwt() {
  const origin = BASE_URL.replace(/\/api$/, '')
  const r = await fetch(`${origin}/auth/guest/start`, { method: 'POST' })
  if (!r.ok) throw new Error(`guest/start HTTP ${r.status}`)
  const d = await r.json()
  const token = d.token || d.jwt || d.accessToken
  if (!token) throw new Error('guest/start: no token in response')
  refreshedJwt = token
}

async function txFetch(url) {
  let r = await fetch(url, { headers: txlineHeaders() })
  if (r.status === 401 || r.status === 403) {
    try {
      await refreshGuestJwt()
      r = await fetch(url, { headers: txlineHeaders() })
    } catch (err) {
      console.warn('[txline] JWT refresh failed:', String(err))
    }
  }
  return r
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

// The real TxLINE scores/snapshot payload is a list holding the LAST event of
// each action type (goal, status, kickoff, game_finalised, …). Score lives in
// `Score.Participant{1,2}.{H1,H2,Total}.Goals`, match phase in `StatusId`
// (1 NS · 2 1st half · 3 HT · 4 2nd half · 5+ finished), clock in
// `Clock.Seconds`. `GameState` is unreliable on devnet (stays "scheduled").
function halfGoals(participant, half) {
  const bucket = participant?.[half]
  return bucket && typeof bucket.Goals === 'number' ? bucket.Goals : 0
}

function normalizeScores(payload) {
  const events = (Array.isArray(payload) ? payload : payload ? [payload] : []).filter(Boolean)
  if (events.length === 0) return { home: 0, away: 0, minute: 0, status: 'scheduled', goals: [] }

  let p1IsHome = true
  let scoreEv = null
  let lastGoal = null
  let finalised = false
  let maxStatus = 0
  let clockSec = 0
  for (const e of events) {
    if (e.Participant1IsHome !== undefined) p1IsHome = e.Participant1IsHome !== false
    if (e.Action === 'game_finalised') finalised = true
    if (e.Action === 'goal' && e.Confirmed !== false) lastGoal = e
    const sid =
      typeof e.StatusId === 'number' ? e.StatusId : typeof e.Data?.StatusId === 'number' ? e.Data.StatusId : 0
    if (sid > maxStatus) maxStatus = sid
    if (typeof e.Clock?.Seconds === 'number') clockSec = Math.max(clockSec, e.Clock.Seconds)
    if (e.Score && (!scoreEv || (e.Seq ?? 0) > (scoreEv.Seq ?? 0))) scoreEv = e
  }

  const s = scoreEv?.Score
  const bucket = (p, key) => {
    const t = p?.Total?.[key]
    if (typeof t === 'number') return t
    return (p?.H1?.[key] ?? 0) + (p?.H2?.[key] ?? 0)
  }
  const sideStats = (p) => ({
    corners: bucket(p, 'Corners'),
    yellows: bucket(p, 'YellowCards'),
    reds: bucket(p, 'RedCards'),
  })
  const split = (p) => {
    const h1 = halfGoals(p, 'H1')
    const h2 = halfGoals(p, 'H2')
    return { h1, h2, total: Math.max(halfGoals(p, 'Total'), h1 + h2) }
  }
  const p1 = split(s?.Participant1)
  const p2 = split(s?.Participant2)
  const homeS = p1IsHome ? p1 : p2
  const awayS = p1IsHome ? p2 : p1

  const status = finalised || maxStatus >= 5 ? 'finished' : maxStatus >= 2 || clockSec > 0 ? 'live' : 'scheduled'
  const minute = status === 'finished' ? 90 : Math.min(90, Math.floor(clockSec / 60))

  // Goal timeline rebuilt from the per-half splits (the snapshot only carries
  // the latest goal event, and the devnet feed has no player names). The last
  // goal gets its exact minute from that event; earlier ones only their half.
  const goals = []
  for (const side of ['home', 'away']) {
    const t = side === 'home' ? homeS : awayS
    if (t.h1 + t.h2 >= t.total) {
      for (let i = 0; i < t.h1; i++) goals.push({ minute: null, half: 1, side, scorer: '' })
      for (let i = 0; i < t.h2; i++) goals.push({ minute: null, half: 2, side, scorer: '' })
    } else {
      for (let i = 0; i < t.total; i++) goals.push({ minute: null, half: null, side, scorer: '' })
    }
  }
  if (lastGoal) {
    const side = (lastGoal.Participant === 1) === p1IsHome ? 'home' : 'away'
    const min = typeof lastGoal.Clock?.Seconds === 'number' ? Math.max(1, Math.round(lastGoal.Clock.Seconds / 60)) : null
    const mine = goals.filter((g) => g.side === side)
    if (min && mine.length > 0) mine[mine.length - 1].minute = min
  }
  goals.sort((a, b) => (a.minute ?? (a.half === 2 ? 70 : 25)) - (b.minute ?? (b.half === 2 ? 70 : 25)))

  const stats = s
    ? { home: sideStats(p1IsHome ? s.Participant1 : s.Participant2), away: sideStats(p1IsHome ? s.Participant2 : s.Participant1) }
    : null

  return { home: homeS.total, away: awayS.total, minute, status, goals, stats }
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
  const stats = {
    home: { corners: Math.floor(minute / 14), yellows: minute > 55 ? 1 : 0, reds: 0 },
    away: { corners: Math.floor(minute / 22), yellows: minute > 30 ? 1 : 0, reds: 0 },
  }
  return { home, away, minute, status: minute >= 90 ? 'finished' : 'live', goals, stats }
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
// Short-lived cache so getScore can look up fixture meta (team names) without
// hammering the fixtures endpoint on every 2s poll of every match.
let fixturesCache = { at: 0, fixtures: null }

export async function getFixtures() {
  const headers = txlineHeaders()
  if (!headers) return { source: 'mock', fixtures: mockFixtures() }
  try {
    const q = COMPETITION_ID ? `?competitionId=${encodeURIComponent(COMPETITION_ID)}` : ''
    const r = await txFetch(`${BASE_URL}/fixtures/snapshot${q}`)
    if (!r.ok) throw new Error(`fixtures HTTP ${r.status}`)
    const data = await r.json()
    const arr = Array.isArray(data) ? data : (data.fixtures ?? [])
    const fixtures = arr.map(normalizeFixture).sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    // Real venues from TheSportsDB (TxLINE has none) — best-effort.
    await Promise.all(
      fixtures.map(async (f) => {
        const e = await enrichMatch(f.home, f.away, f.kickoff)
        if (e?.venue) f.venue = e.city ? `${e.venue}, ${e.city}` : e.venue
      }),
    )
    fixturesCache = { at: Date.now(), fixtures }
    return { source: 'txline', fixtures }
  } catch (err) {
    console.warn('[txline] fixtures failed, serving mock:', String(err))
    return { source: 'mock-fallback', error: String(err), fixtures: mockFixtures() }
  }
}

async function fixtureMeta(fixtureId) {
  if (!fixturesCache.fixtures || Date.now() - fixturesCache.at > 60_000) {
    try {
      await getFixtures()
    } catch {
      /* keep stale cache */
    }
  }
  return fixturesCache.fixtures?.find((f) => f.id === String(fixtureId)) ?? null
}

// Overlay real scorer names (TheSportsDB goal details) onto the reconstructed
// timeline. Names appear once their DB records them — until then team-only.
function nameGoals(goals, scorers) {
  if (!scorers) return goals
  for (const side of ['home', 'away']) {
    const names = scorers[side] ?? []
    const mine = goals.filter((g) => g.side === side)
    for (let i = 0; i < mine.length && i < names.length; i++) {
      mine[i].scorer = names[i].name
      if (Number.isFinite(names[i].minute)) mine[i].minute = names[i].minute
    }
  }
  return goals.sort((a, b) => (a.minute ?? (a.half === 2 ? 70 : 25)) - (b.minute ?? (b.half === 2 ? 70 : 25)))
}

export async function getScore(fixtureId, startedAt) {
  const headers = txlineHeaders()
  if (!headers) return { source: 'mock', score: mockScore(fixtureId, startedAt) }
  try {
    const r = await txFetch(`${BASE_URL}/scores/snapshot/${encodeURIComponent(fixtureId)}`)
    if (!r.ok) throw new Error(`scores HTTP ${r.status}`)
    const data = await r.json()
    const score = normalizeScores(data)
    if (score.goals.length > 0) {
      const meta = await fixtureMeta(fixtureId)
      if (meta) {
        const e = await enrichMatch(meta.home, meta.away, meta.kickoff)
        score.goals = nameGoals(score.goals, e?.scorers)
      }
    }
    return { source: 'txline', score }
  } catch (err) {
    console.warn('[txline] scores failed, serving mock:', String(err))
    return { source: 'mock-fallback', error: String(err), score: mockScore(fixtureId, startedAt) }
  }
}
