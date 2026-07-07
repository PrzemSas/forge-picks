// TheSportsDB enrichment (free community key). TxLINE's devnet feed has no
// venues, player names or squads — TheSportsDB tracks the same real World Cup
// fixtures, so we join on team names + date. Scorer names come from the event
// "goal details" field, which their DB fills in after matches (may lag live).
const BASE = 'https://www.thesportsdb.com/api/v1/json/123'
const WC_LEAGUE = 4429
const WC_SEASON = '2026'
const TTL_MS = 10 * 60 * 1000

const cache = new Map()
async function cached(key, fn) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value
  const value = await fn()
  cache.set(key, { at: Date.now(), value })
  return value
}

async function getJson(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`tsdb HTTP ${r.status}`)
  return r.json()
}

// Team-name canonicalisation across the two data sources.
const ALIASES = {
  usa: 'united states', 'bosnia-herzegovina': 'bosnia and herzegovina', turkiye: 'turkey',
  'korea republic': 'south korea', korea: 'south korea', 'czech republic': 'czechia',
  "cote d'ivoire": 'ivory coast', 'cabo verde': 'cape verde', 'ir iran': 'iran',
}
function norm(name) {
  const k = String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '')
  return ALIASES[k] ?? k
}

async function wcEvents() {
  return cached('wc-events', async () => {
    const urls = [
      `${BASE}/eventsseason.php?id=${WC_LEAGUE}&s=${WC_SEASON}`,
      `${BASE}/eventspastleague.php?id=${WC_LEAGUE}`,
      `${BASE}/eventsnextleague.php?id=${WC_LEAGUE}`,
    ]
    const events = new Map()
    for (const url of urls) {
      try {
        const d = await getJson(url)
        for (const e of d.events ?? []) if (e?.idEvent) events.set(e.idEvent, e)
      } catch {
        // partial data is fine — enrichment is best-effort
      }
    }
    return [...events.values()]
  })
}

// "12':Jan Kowalski;45+2':X Y;" -> [{ minute: 12, name: 'Jan Kowalski' }, …]
function parseGoalDetails(details) {
  if (!details) return []
  return String(details)
    .split(';')
    .map((part) => {
      const m = part.trim().match(/^(\d+)(?:\+\d+)?'?\s*:?\s*(.*)$/)
      if (!m || !m[2]) return null
      return { minute: Number(m[1]), name: m[2].trim() }
    })
    .filter(Boolean)
}

// Goal scorers from the event timeline (lookuptimeline) — richer than the
// often-empty strHomeGoalDetails field: it carries the player name, exact
// minute and side. Own goals are dropped (their listed side is the scoring
// player's team, not the team credited, so overlaying them risks a wrong name).
async function eventScorers(idEvent) {
  return cached(`timeline:${idEvent}`, async () => {
    try {
      const d = await getJson(`${BASE}/lookuptimeline.php?id=${idEvent}`)
      return (d.timeline ?? [])
        .filter(
          (x) => x.strTimeline === 'Goal' && x.strPlayer && !/own goal/i.test(x.strTimelineDetail || ''),
        )
        .map((x) => ({
          name: x.strPlayer,
          minute: Number.isFinite(Number(x.intTime)) ? Number(x.intTime) : null,
          tsdbHome: x.strHome === 'Yes',
        }))
    } catch {
      return []
    }
  })
}

// Find the real-world event for a TxLINE fixture: same two teams, kickoff
// within a day (TheSportsDB stores local dates).
export async function enrichMatch(home, away, kickoffIso) {
  try {
    const events = await wcEvents()
    const h = norm(home)
    const a = norm(away)
    const t = new Date(kickoffIso).getTime()
    for (const e of events) {
      const eh = norm(e.strHomeTeam)
      const ea = norm(e.strAwayTeam)
      const straight = eh === h && ea === a
      const flipped = eh === a && ea === h
      if (!straight && !flipped) continue
      const et = new Date(`${e.dateEvent}T${e.strTime || '12:00:00'}Z`).getTime()
      if (Number.isFinite(t) && Number.isFinite(et) && Math.abs(t - et) > 36 * 3600 * 1000) continue
      // Prefer the timeline (real names + minutes); fall back to the goal-details
      // string only when the timeline is empty.
      const tl = await eventScorers(e.idEvent)
      let homeGoals
      let awayGoals
      if (tl.length > 0) {
        homeGoals = []
        awayGoals = []
        for (const g of tl) {
          // strHome is relative to TheSportsDB's home team — flip when the TxLINE
          // fixture lists the two teams the other way round.
          const txlineHome = straight ? g.tsdbHome : !g.tsdbHome
          ;(txlineHome ? homeGoals : awayGoals).push({ name: g.name, minute: g.minute })
        }
        const byMinute = (x, y) => (x.minute ?? 999) - (y.minute ?? 999)
        homeGoals.sort(byMinute)
        awayGoals.sort(byMinute)
      } else {
        homeGoals = parseGoalDetails(straight ? e.strHomeGoalDetails : e.strAwayGoalDetails)
        awayGoals = parseGoalDetails(straight ? e.strAwayGoalDetails : e.strHomeGoalDetails)
      }
      return {
        venue: e.strVenue || null,
        city: e.strCity || null,
        scorers: { home: homeGoals, away: awayGoals },
      }
    }
  } catch {
    // best-effort
  }
  return null
}

export async function getSquad(teamName) {
  const key = `squad:${norm(teamName)}`
  try {
    return await cached(key, async () => {
      const search = await getJson(`${BASE}/searchteams.php?t=${encodeURIComponent(teamName)}`)
      const team = (search.teams ?? []).find((x) => x.strSport === 'Soccer')
      if (!team) return { team: teamName, players: [] }
      const d = await getJson(`${BASE}/lookup_all_players.php?id=${team.idTeam}`)
      const players = (d.player ?? []).map((p) => ({
        name: p.strPlayer,
        position: p.strPosition || '',
        number: p.strNumber || '',
        img: p.strCutout || p.strThumb || null,
      }))
      return { team: team.strTeam, badge: team.strBadge || null, players }
    })
  } catch (err) {
    // rate limits etc. — don't cache, let a later tap retry
    return { team: teamName, players: [], error: String(err) }
  }
}
