import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { flagUrl, playerSearchUrl } from './teams'

type Fixture = {
  id: string
  home: string
  away: string
  kickoff: string
  status: string
  round?: string
  venue?: string
}

// scorer may be empty and minute null — the live TxLINE devnet feed carries no
// player names, and only the latest goal has an exact minute (older ones: half).
type Goal = { minute: number | null; half?: 1 | 2 | null; side: 'home' | 'away'; scorer: string; club?: string }

type SideStats = { corners: number; yellows: number; reds: number }

type Score = {
  home: number
  away: number
  minute: number
  status: 'scheduled' | 'live' | 'finished'
  goals?: Goal[]
  stats?: { home: SideStats; away: SideStats } | null
}

// Final Forecast — long-range bonus picks, settled when the MetLife final ends.
type Forecast = { champion: string | null; runnerUp: string | null }
const FINAL_DATE = '2026-07-19'
const BONUS_CHAMPION = 50
const BONUS_FINALIST = 25

type Outcome = 'home' | 'away' | 'draw'
type Pick = { fixtureId: string; choice: Outcome }

// Finished matches archived in localStorage — TxLINE's fixtures feed is a
// rolling window of upcoming games, so results vanish from it after a day.
type Archived = Fixture & { score: Score; archivedAt: number }

type SquadPlayer = { name: string; position: string; number: string; img: string | null }
type Squad = { team: string; badge?: string | null; players: SquadPlayer[] }

const API = '/api'
const POLL_MS = 2000

// Forge rivals — AI typers so the board is alive and reshuffles when a match ends.
const RIVALS: { name: string; base: number; live: Outcome }[] = [
  { name: 'Blacksmith_Ada', base: 20, live: 'home' },
  { name: 'MoltenMara', base: 20, live: 'away' },
  { name: 'AnvilKid', base: 10, live: 'draw' },
]

const LIVE_ID = 'wc-r16-2'

// FIFA WC 2026 sponsor wall — logos hotlinked from Wikimedia, rendered
// monochrome; a dead URL falls back to the plain text chip.
const WC_SPONSORS: { name: string; logo?: string; tier1?: boolean; noInvert?: boolean }[] = [
  { name: 'Adidas', tier1: true, logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Adidas_2022_logo.svg/330px-Adidas_2022_logo.svg.png' },
  { name: 'Coca-Cola', tier1: true, logo: 'https://commons.wikimedia.org/wiki/Special:FilePath/Coca-Cola_logo.svg?width=300' },
  { name: 'Hyundai–Kia', tier1: true, logo: 'https://commons.wikimedia.org/wiki/Special:FilePath/Hyundai_Motor_Company_logo.svg?width=300' },
  { name: 'Visa', tier1: true, logo: 'https://commons.wikimedia.org/wiki/Special:FilePath/Visa_Inc._logo_%282021%E2%80%93present%29.svg?width=300' },
  { name: 'Qatar Airways', tier1: true, logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Qatar_Airways_Logo.svg?width=300' },
  { name: 'Aramco', tier1: true, logo: 'https://en.wikipedia.org/wiki/Special:FilePath/Saudi_Aramco_logo.svg?width=300' },
  { name: 'Lenovo', tier1: true, noInvert: true, logo: 'https://commons.wikimedia.org/wiki/Special:FilePath/Lenovo%20Global%20Corporate%20Logo.png?width=300' },
  { name: 'AB InBev', logo: 'https://commons.wikimedia.org/wiki/Special:FilePath/Anheuser-Busch%20InBev%20Logo%202022.svg?width=300' },
  { name: 'Bank of America', logo: 'https://commons.wikimedia.org/wiki/Special:FilePath/Bank_of_America_logo.svg?width=300' },
  { name: "Lay's", noInvert: true, logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Lay%27s_2025.svg/330px-Lay%27s_2025.svg.png" },
  { name: 'Hisense', logo: 'https://commons.wikimedia.org/wiki/Special:FilePath/Hisense%20logo.svg?width=300' },
  { name: "McDonald's", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/McDonald%27s_Golden_Arches.svg/330px-McDonald%27s_Golden_Arches.svg.png" },
  { name: 'Mengniu' },
  { name: 'Unilever', logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e4/Unilever.svg/330px-Unilever.svg.png' },
  { name: 'Verizon', logo: 'https://commons.wikimedia.org/wiki/Special:FilePath/Verizon%202024.svg?width=300' },
]

function SponsorChip({ name, logo, tier1, noInvert }: { name: string; logo?: string; tier1?: boolean; noInvert?: boolean }) {
  const [broken, setBroken] = useState(false)
  return (
    <span className={`sponsor ${tier1 ? 'tier1' : ''}`} title={name}>
      {logo && !broken ? (
        <img className={noInvert ? 'color' : ''} src={logo} alt={name} loading="lazy" onError={() => setBroken(true)} />
      ) : (
        name
      )}
    </span>
  )
}

// Overlay exact minutes captured live on the client (the snapshot API only
// keeps the last goal's minute — but we watch every goal as it happens).
function withCapturedMinutes(
  fixtureId: string,
  goals: Goal[] | undefined,
  mins: Record<string, Record<string, number>>,
): Goal[] | undefined {
  const m = mins[fixtureId]
  if (!goals || !m) return goals
  const counters: Record<string, number> = { home: 0, away: 0 }
  return goals.map((g) => {
    const idx = counters[g.side]++
    const exact = m[`${g.side}-${idx}`]
    return exact != null && g.minute == null ? { ...g, minute: exact } : g
  })
}

function kickoffLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Upcoming'
  return d.toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function outcomeOf(s: Score | undefined): Outcome | null {
  if (!s || s.status !== 'finished') return null
  if (s.home > s.away) return 'home'
  if (s.away > s.home) return 'away'
  return 'draw'
}

function Flag({ name, size = 'w40' }: { name: string; size?: 'w20' | 'w40' | 'w80' | 'w160' }) {
  const url = flagUrl(name, size)
  if (!url) return <span className="flag flag-blank" aria-hidden />
  return <img className="flag" src={url} alt="" loading="lazy" />
}

export default function App() {
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scores, setScores] = useState<Record<string, Score>>({})
  const [picks, setPicks] = useState<Pick[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('forge-picks') || '[]')
    } catch {
      return []
    }
  })
  const [archive, setArchive] = useState<Record<string, Archived>>(() => {
    try {
      return JSON.parse(localStorage.getItem('forge-results') || '{}')
    } catch {
      return {}
    }
  })
  // Finished matches from the server — same on every device, unlike the
  // per-browser `archive`. Merged into `history` below.
  const [serverHistory, setServerHistory] = useState<Record<string, Archived>>({})
  const [txlineOk, setTxlineOk] = useState(false)
  const [goalMins, setGoalMins] = useState<Record<string, Record<string, number>>>(() => {
    try {
      return JSON.parse(localStorage.getItem('forge-goal-mins') || '{}')
    } catch {
      return {}
    }
  })
  const [forecast, setForecast] = useState<Forecast>(() => {
    try {
      return JSON.parse(localStorage.getItem('forge-forecast') || '{"champion":null,"runnerUp":null}')
    } catch {
      return { champion: null, runnerUp: null }
    }
  })
  const [squadTeam, setSquadTeam] = useState<string | null>(null)
  const [squad, setSquad] = useState<Squad | null>(null)
  const [squadLoading, setSquadLoading] = useState(false)
  const [kickoffAt, setKickoffAt] = useState<number | null>(() => {
    const v = localStorage.getItem('forge-kickoff')
    return v ? Number(v) : null
  })

  // animation state
  const prevScoresRef = useRef<Record<string, Score>>({})
  const goalTimer = useRef<number | undefined>(undefined)
  const [goal, setGoal] = useState<{ team: string; minute: number; scorer?: string } | null>(null)
  const celebrated = useRef<Set<string>>(new Set())
  const [celebrate, setCelebrate] = useState(false)

  useEffect(() => {
    fetch(`${API}/health`)
      .then((r) => r.json())
      .then((d) => setTxlineOk(Boolean(d.txlineConfigured)))
      .catch(() => setTxlineOk(false))

    fetch(`${API}/fixtures`)
      .then((r) => r.json())
      .then((d) => {
        const list: Fixture[] = d.fixtures ?? []
        setFixtures(list)
        setSelectedId((cur) => cur ?? list.find((f) => f.status === 'live')?.id ?? list[0]?.id ?? null)
      })
      .catch(console.error)
  }, [])

  // Server-side match history — identical across devices. Refreshed on a slow
  // cadence so newly-finished matches appear without a reload.
  useEffect(() => {
    let alive = true
    const load = () =>
      fetch(`${API}/history`)
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return
          const map: Record<string, Archived> = {}
          for (const m of (d.matches ?? []) as Archived[]) {
            map[m.id] = { ...m, archivedAt: Date.parse(m.kickoff) || Date.now() }
          }
          setServerHistory(map)
        })
        .catch(() => {})
    load()
    const t = setInterval(load, 90_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])

  // Live polling — the app comes alive during a match.
  useEffect(() => {
    if (fixtures.length === 0) return
    let alive = true
    const tick = async () => {
      const entries = await Promise.all(
        fixtures.map(async (f) => {
          try {
            const q = f.id === LIVE_ID && kickoffAt ? `?t=${kickoffAt}` : ''
            const r = await fetch(`${API}/scores/${f.id}${q}`)
            const d = await r.json()
            return [f.id, d.score as Score] as const
          } catch {
            return [f.id, undefined] as const
          }
        }),
      )
      if (!alive) return
      setScores((prev) => {
        const next = { ...prev }
        for (const [id, s] of entries) if (s) next[id] = s
        return next
      })
    }
    tick()
    const t = setInterval(tick, POLL_MS)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [fixtures, kickoffAt])

  useEffect(() => {
    localStorage.setItem('forge-picks', JSON.stringify(picks))
  }, [picks])

  // Archive finished matches (skip pure demo fixtures so mock replays don't pile up).
  useEffect(() => {
    const updates: Archived[] = []
    for (const f of fixtures) {
      const s = scores[f.id]
      if (!s || s.status !== 'finished' || f.id.startsWith('wc-')) continue
      const prev = archive[f.id]
      if (prev && prev.score.home === s.home && prev.score.away === s.away && (prev.score.goals?.length ?? 0) >= (s.goals?.length ?? 0)) continue
      const withMins = { ...s, goals: withCapturedMinutes(f.id, s.goals, goalMins) }
      updates.push({ ...f, status: 'finished', score: withMins, archivedAt: prev?.archivedAt ?? Date.now() })
    }
    if (updates.length > 0) {
      setArchive((prev) => {
        const next = { ...prev }
        for (const u of updates) next[u.id] = u
        localStorage.setItem('forge-results', JSON.stringify(next))
        return next
      })
    }
  }, [scores, fixtures, archive, goalMins])

  // ?demo[=seconds] → auto-start the demo clock (shareable live-looking link / screenshots)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.has('demo') && !localStorage.getItem('forge-kickoff')) {
      const secs = Number(p.get('demo')) || 70
      const t = Date.now() - secs * 1000
      localStorage.setItem('forge-kickoff', String(t))
      setKickoffAt(t)
    }
  }, [])

  // Goal detection -> banner (with scorer) + hero flash.
  useEffect(() => {
    const prev = prevScoresRef.current
    for (const f of fixtures) {
      const p = prev[f.id]
      const c = scores[f.id]
      if (!c || !p) continue
      if (c.home > p.home || c.away > p.away) {
        const side = c.home > p.home ? 'home' : 'away'
        const last = (c.goals ?? []).filter((g) => g.side === side).slice(-1)[0]
        setGoal({ team: side === 'home' ? f.home : f.away, minute: last?.minute ?? c.minute, scorer: last?.scorer })
        window.clearTimeout(goalTimer.current)
        goalTimer.current = window.setTimeout(() => setGoal(null), 2600)
        // remember the exact minute we saw this goal happen
        const idx = (side === 'home' ? c.home : c.away) - 1
        const key = `${side}-${idx}`
        setGoalMins((prev) => {
          if (prev[f.id]?.[key] != null) return prev
          const next = { ...prev, [f.id]: { ...(prev[f.id] ?? {}), [key]: last?.minute ?? c.minute } }
          localStorage.setItem('forge-goal-mins', JSON.stringify(next))
          return next
        })
      }
    }
    prevScoresRef.current = scores
  }, [scores, fixtures])

  // Correct-pick celebration -> +10 floater (once per pick).
  useEffect(() => {
    for (const p of picks) {
      const out = outcomeOf(scores[p.fixtureId])
      if (out && out === p.choice && !celebrated.current.has(p.fixtureId)) {
        celebrated.current.add(p.fixtureId)
        setCelebrate(true)
        window.setTimeout(() => setCelebrate(false), 1400)
      }
    }
  }, [scores, picks])

  useEffect(() => {
    localStorage.setItem('forge-forecast', JSON.stringify(forecast))
  }, [forecast])

  // Squad viewer (TheSportsDB via /api/squad)
  useEffect(() => {
    if (!squadTeam) return
    let alive = true
    setSquad(null)
    setSquadLoading(true)
    fetch(`${API}/squad?team=${encodeURIComponent(squadTeam)}`)
      .then((r) => r.json())
      .then((d) => alive && setSquad(d))
      .catch(() => alive && setSquad({ team: squadTeam, players: [] }))
      .finally(() => alive && setSquadLoading(false))
    return () => {
      alive = false
    }
  }, [squadTeam])

  const kickoff = useCallback(() => {
    const t = Date.now()
    localStorage.setItem('forge-kickoff', String(t))
    setKickoffAt(t)
  }, [])

  const resetDemo = useCallback(() => {
    localStorage.removeItem('forge-kickoff')
    setKickoffAt(null)
  }, [])

  const selected = fixtures.find((f) => f.id === selectedId) ?? null
  const selectedScore = selected ? scores[selectedId!] : undefined
  const myPick = picks.find((p) => p.fixtureId === selectedId)

  // Finished real matches move to Match history; mock fixtures stay (demo flow).
  const visibleFixtures = useMemo(
    () => fixtures.filter((f) => f.id.startsWith('wc-') || (scores[f.id]?.status ?? f.status) !== 'finished'),
    [fixtures, scores],
  )

  // Hero = live match, else the next upcoming one (never a real finished game).
  const featured =
    fixtures.find((f) => scores[f.id]?.status === 'live') ??
    (selected && (selected.id.startsWith('wc-') || scores[selected.id]?.status !== 'finished') ? selected : null) ??
    visibleFixtures[0] ??
    fixtures[0] ??
    null
  const fScore = featured ? scores[featured.id] : undefined
  const fStatus = fScore?.status ?? 'scheduled'
  const fPick = featured ? picks.find((p) => p.fixtureId === featured.id) : undefined

  function teamOf(fx: Fixture, choice: Outcome) {
    return choice === 'home' ? fx.home : choice === 'away' ? fx.away : 'Draw'
  }

  function makePick(choice: Outcome) {
    if (!selected) return
    const s = scores[selected.id]
    if (s && s.status === 'finished') return // locked
    setPicks((prev) => [...prev.filter((p) => p.fixtureId !== selected.id), { fixtureId: selected.id, choice }])
  }

  // When a real match ends it moves to history — shift focus to the next one.
  useEffect(() => {
    if (!selectedId || selectedId.startsWith('wc-')) return
    if (scores[selectedId]?.status === 'finished') {
      const next = visibleFixtures.find((f) => scores[f.id]?.status === 'live') ?? visibleFixtures[0]
      if (next && next.id !== selectedId) setSelectedId(next.id)
    }
  }, [scores, selectedId, visibleFixtures])

  // The final = whichever match kicks off on final day; settles forecast bonuses.
  const finalMatch = useMemo(() => {
    const live = fixtures.find((f) => f.kickoff.startsWith(FINAL_DATE))
    if (live) return { ...live, score: scores[live.id] }
    const past = Object.values(archive).find((m) => m.kickoff.startsWith(FINAL_DATE))
    return past ? { ...past, score: past.score } : null
  }, [fixtures, scores, archive])

  const forecastBonus = useMemo(() => {
    const s = finalMatch?.score
    if (!finalMatch || !s || s.status !== 'finished') return 0
    const winner = s.home > s.away ? finalMatch.home : s.away > s.home ? finalMatch.away : null
    let bonus = 0
    for (const nation of [forecast.champion, forecast.runnerUp]) {
      if (nation && (nation === finalMatch.home || nation === finalMatch.away)) bonus += BONUS_FINALIST
    }
    if (winner && forecast.champion === winner) bonus += BONUS_CHAMPION
    return bonus
  }, [finalMatch, forecast])

  // Points survive the fixture dropping out of the TxLINE window: fall back to the archive.
  const myPoints = useMemo(
    () =>
      picks.reduce(
        (sum, p) => sum + (outcomeOf(scores[p.fixtureId] ?? archive[p.fixtureId]?.score) === p.choice ? 10 : 0),
        0,
      ) + forecastBonus,
    [picks, scores, archive, forecastBonus],
  )

  const share = useCallback(() => {
    const parts = [`🔥 Forge Picks — ${myPoints} pts on the World Cup forge board (${picks.length} calls).`]
    if (forecast.champion) parts.push(`My champion: ${forecast.champion} 🏆`)
    parts.push('https://forge-picks.vercel.app')
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(parts.join(' '))}`, '_blank', 'noopener')
  }, [picks, myPoints, forecast])

  const leaderboard = useMemo(() => {
    const liveOut = outcomeOf(scores[LIVE_ID])
    const rows = [
      { name: 'You', points: myPoints, you: true },
      ...RIVALS.map((r) => ({
        name: r.name,
        points: r.base + (liveOut && liveOut === r.live ? 10 : 0),
        you: false,
      })),
    ]
    return rows.sort((a, b) => b.points - a.points)
  }, [scores, myPoints])

  const nextUp = fixtures.filter((f) => (scores[f.id]?.status ?? f.status) === 'scheduled')
  // Server history is authoritative (same on every device); the local archive
  // supplements it with matches this browser saw finish that have since dropped
  // out of the TxLINE window.
  const history = useMemo(
    () =>
      Object.values({ ...archive, ...serverHistory }).sort((a, b) =>
        b.kickoff.localeCompare(a.kickoff),
      ),
    [archive, serverHistory],
  )
  // Every nation seen in the feed or the archive — tap one for its squad.
  const allTeams = useMemo(() => {
    const names = new Set<string>()
    for (const f of fixtures) {
      names.add(f.home)
      names.add(f.away)
    }
    for (const m of history) {
      names.add(m.home)
      names.add(m.away)
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [fixtures, history])

  return (
    <div className="app">
      <header className="forge-header">
        <div className="forge-bg" aria-hidden>
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} className="spark-p" />
          ))}
          <div className="forge-glow" />
        </div>
        <p className="eyebrow">World Cup 2026 · Fan Picks</p>
        <h1>
          <span className="flame">🔥</span> Forge Picks
        </h1>
        <p className="sub">
          Live World Cup data via TxLINE · call the outcome · climb the forge board as the match burns.
        </p>
        <span className={`badge ${txlineOk ? 'live' : 'mock'}`}>{txlineOk ? '● Live data' : '● Demo replay'}</span>
        <nav className="hub-nav">
          <a href="#matches">Matches</a>
          <a href="#final">Final</a>
          <a href="#history">History</a>
          <a href="#teams">Teams</a>
        </nav>
      </header>

      {featured && (
        <section className={`hero ${fStatus} ${goal ? 'flash' : ''}`}>
          {goal && (
            <div className="goal-banner">
              ⚽ GOAL {goal.minute}' — {goal.scorer ? `${goal.scorer} (${goal.team})` : goal.team}
            </div>
          )}
          <div className="hero-tag">
            {fStatus === 'live' ? `● LIVE · ${fScore?.minute}'` : fStatus === 'finished' ? 'FULL TIME' : 'UP NEXT'}
            {featured.round ? <span className="hero-comp"> · {featured.round}</span> : null}
          </div>
          <div className="hero-match">
            <div className="hero-team">
              <Flag name={featured.home} size="w80" />
              <span>{featured.home}</span>
            </div>
            <div className="hero-score">
              <span key={`h-${fScore?.home ?? 0}`}>{fScore?.home ?? 0}</span>
              <i>:</i>
              <span key={`a-${fScore?.away ?? 0}`}>{fScore?.away ?? 0}</span>
            </div>
            <div className="hero-team away">
              <span>{featured.away}</span>
              <Flag name={featured.away} size="w80" />
            </div>
          </div>
          <div className="hero-bar">
            <div style={{ width: `${Math.min(100, ((fScore?.minute ?? 0) / 90) * 100)}%` }} />
          </div>
          {featured.venue && <div className="hero-venue">📍 {featured.venue}</div>}
          <div className="hero-pick">
            {fPick ? (
              <>
                Your pick: <strong>{teamOf(featured, fPick.choice)}</strong>
                {fStatus === 'finished' ? (outcomeOf(fScore) === fPick.choice ? ' ✓' : ' ✗') : ' · your call'}
              </>
            ) : (
              'Make your pick below ↓'
            )}
          </div>
        </section>
      )}

      <section className="final-banner" id="final">
        <div className="fb-inner">
          <span className="fb-tag">🏆 The Final · Sunday, 19 July 2026</span>
          <h3>MetLife Stadium</h3>
          <span className="fb-loc">East Rutherford, New Jersey · 82,500 seats</span>
          <div className="fb-prizes">
            <span className="chip gold">Champion $50M</span>
            <span className="chip silver">Runner-up $33M</span>
            <span className="chip">FIFA pool $871M</span>
          </div>
          <div className="fb-forecast">
            <span className="fb-f-label">Your forecast:</span>
            <select
              value={forecast.champion ?? ''}
              onChange={(e) => setForecast((f) => ({ ...f, champion: e.target.value || null }))}
            >
              <option value="">Champion (+{BONUS_CHAMPION})</option>
              {allTeams.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <select
              value={forecast.runnerUp ?? ''}
              onChange={(e) => setForecast((f) => ({ ...f, runnerUp: e.target.value || null }))}
            >
              <option value="">Runner-up (+{BONUS_FINALIST})</option>
              {allTeams.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            {forecastBonus > 0 ? (
              <span className="fb-bonus">⚒ +{forecastBonus} forged!</span>
            ) : (
              <span className="fb-note">+{BONUS_FINALIST} per finalist · +{BONUS_CHAMPION} champion · settles 19 July</span>
            )}
          </div>
        </div>
      </section>

      <div className="txline-strip">
        <span className="dot" /> Live scores via <strong>TxLINE</strong> · <code>/fixtures/snapshot</code> ·{' '}
        <code>/scores/snapshot</code>
      </div>

      <main className="grid" id="matches">
        <section className="panel">
          <h2>Matches</h2>
          <ul className="fixtures">
            {visibleFixtures.map((f) => {
              const s = scores[f.id]
              const live = s?.status === 'live'
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    className={selectedId === f.id ? 'active' : ''}
                    onClick={() => setSelectedId(f.id)}
                  >
                    <span className="row1">
                      <span className="teams">
                        <Flag name={f.home} size="w20" /> {f.home} <span className="vs">v</span> {f.away}{' '}
                        <Flag name={f.away} size="w20" />
                      </span>
                      {s && s.status !== 'scheduled' ? (
                        <span className="mini-score">
                          {s.home}–{s.away}
                          {live && <span className="live-dot" title="live" />}
                        </span>
                      ) : null}
                    </span>
                    <span className="meta">
                      {f.round ? `${f.round} · ` : ''}
                      {live ? `${s!.minute}'` : s?.status === 'finished' ? 'FT' : kickoffLabel(f.kickoff)}
                    </span>
                    {f.venue && <span className="venue-sm">📍 {f.venue}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="panel pick-panel">
          <h2>Pick</h2>
          {selected ? (
            <>
              <p className="matchline">
                {selected.home} <span className="vs">vs</span> {selected.away}
              </p>
              {selected.venue && <p className="venue">📍 {selected.venue}</p>}

              <div className={`scoreboard ${selectedScore?.status ?? 'scheduled'}`}>
                <Flag name={selected.home} size="w40" />
                <span className="big" key={`sh-${selectedScore?.home ?? 0}`}>{selectedScore?.home ?? 0}</span>
                <span className="sep">:</span>
                <span className="big" key={`sa-${selectedScore?.away ?? 0}`}>{selectedScore?.away ?? 0}</span>
                <Flag name={selected.away} size="w40" />
                <span className="clock">
                  {selectedScore?.status === 'live'
                    ? `${selectedScore.minute}'`
                    : selectedScore?.status === 'finished'
                      ? 'Full time'
                      : 'Not started'}
                </span>
              </div>

              {selectedScore?.status === 'live' && (
                <div className="mini-bar">
                  <div style={{ width: `${Math.min(100, ((selectedScore.minute ?? 0) / 90) * 100)}%` }} />
                </div>
              )}

              {selectedScore?.stats && selectedScore.status !== 'scheduled' && (
                <div className="stat-row">
                  <span>
                    ⚑ {selectedScore.stats.home.corners}–{selectedScore.stats.away.corners} corners
                  </span>
                  <span>
                    🟨 {selectedScore.stats.home.yellows}–{selectedScore.stats.away.yellows}
                  </span>
                  {(selectedScore.stats.home.reds > 0 || selectedScore.stats.away.reds > 0) && (
                    <span>
                      🟥 {selectedScore.stats.home.reds}–{selectedScore.stats.away.reds}
                    </span>
                  )}
                </div>
              )}

              {selectedScore?.goals && selectedScore.goals.length > 0 && (
                <ul className="goals">
                  {(withCapturedMinutes(selected.id, selectedScore.goals, goalMins) ?? []).map((g, i) => (
                    <li key={i}>
                      <span className="g-min">
                        {g.minute != null ? `${g.minute}'` : g.half ? `${g.half}H` : '—'}
                      </span>
                      <span className="g-ball">⚽</span>
                      {g.scorer ? (
                        <a className="g-scorer" href={playerSearchUrl(g.scorer)} target="_blank" rel="noreferrer">
                          {g.scorer}
                        </a>
                      ) : (
                        <span className="g-scorer">{g.side === 'home' ? selected.home : selected.away}</span>
                      )}
                      {g.club && <span className="g-club">{g.club}</span>}
                      <Flag name={g.side === 'home' ? selected.home : selected.away} size="w20" />
                    </li>
                  ))}
                </ul>
              )}

              {selected.id === LIVE_ID && !txlineOk && (
                <div className="demo-controls">
                  {!kickoffAt ? (
                    <button type="button" className="kickoff" onClick={kickoff}>
                      ▶ Kick off (demo)
                    </button>
                  ) : (
                    <button type="button" className="reset-btn" onClick={resetDemo}>
                      ↺ Reset demo
                    </button>
                  )}
                </div>
              )}

              <div className="pick-row">
                {(['home', 'draw', 'away'] as Outcome[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={myPick?.choice === c ? 'chosen' : ''}
                    disabled={selectedScore?.status === 'finished'}
                    onClick={() => makePick(c)}
                  >
                    {c === 'home' ? selected.home : c === 'away' ? selected.away : 'Draw'}
                  </button>
                ))}
              </div>

              <p className="hint prize-hint">
                🏆 Road to MetLife: the champion nation takes <strong>$50M</strong>, the runner-up{' '}
                <strong>$33M</strong> of FIFA's $871M pool.
              </p>

              {myPick &&
                (selectedScore?.status === 'finished' ? (
                  outcomeOf(selectedScore) === myPick.choice ? (
                    <p className="verdict win">✔ Called it — +10 forge points</p>
                  ) : (
                    <p className="verdict loss">✖ Missed this one</p>
                  )
                ) : (
                  <p className="hint">Your call is in — points forge at full time.</p>
                ))}
              {!myPick && <p className="hint">Tap a side to stake your call.</p>}
            </>
          ) : (
            <p className="hint">Select a match.</p>
          )}
        </section>

        <section className="panel board-panel">
          {celebrate && <span className="plus-ten">+10 ⚒</span>}
          <h2>Forge Board</h2>
          <ol className="board">
            {leaderboard.map((row, i) => (
              <li key={row.name} className={row.you ? 'you' : ''}>
                <span className="rank">{i + 1}</span>
                <span className="name">{row.name}</span>
                <strong>{row.points} pts</strong>
              </li>
            ))}
          </ol>
          <button type="button" className="share-btn" onClick={share}>
            𝕏 Share my forge
          </button>
          {nextUp.length > 0 && (
            <div className="next-up">
              <h3>Next up</h3>
              <ul>
                {nextUp.map((f) => (
                  <li key={f.id}>
                    <Flag name={f.home} size="w20" /> {f.home} v {f.away} <Flag name={f.away} size="w20" />
                    {f.venue && <span className="nv">📍 {f.venue}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>

      {history.length > 0 && (
        <section className="panel history" id="history">
          <h2>Match history</h2>
          <ul className="history-list">
            {history.map((m) => {
              const pick = picks.find((p) => p.fixtureId === m.id)
              const out = outcomeOf(m.score)
              return (
                <li key={m.id}>
                  <span className="h-date">{kickoffLabel(m.kickoff)}</span>
                  <span className="h-match">
                    <Flag name={m.home} size="w20" /> {m.home}
                    <strong className="h-score">
                      {m.score.home}–{m.score.away}
                    </strong>
                    {m.away} <Flag name={m.away} size="w20" />
                  </span>
                  {m.score.goals && m.score.goals.length > 0 && (
                    <span className="h-goals">
                      {m.score.goals
                        .map(
                          (g) =>
                            `⚽ ${g.minute != null ? `${g.minute}'` : g.half ? `${g.half}H` : ''} ${
                              g.scorer || (g.side === 'home' ? m.home : m.away)
                            }`,
                        )
                        .join(' · ')}
                    </span>
                  )}
                  <span className="h-meta">
                    {m.round ?? 'World Cup'}
                    {m.venue ? ` · 📍 ${m.venue}` : ''}
                  </span>
                  {pick && (
                    <span className={`h-pick ${out === pick.choice ? 'win' : 'loss'}`}>
                      {out === pick.choice ? '✓ +10' : '✗'} {teamOf(m, pick.choice)}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
          <p className="hint small">Finished matches are kept on this device — the live feed only carries upcoming games.</p>
        </section>
      )}

      {allTeams.length > 0 && (
        <section className="panel teams-panel" id="teams">
          <h2>Teams</h2>
          <div className="teams-grid">
            {allTeams.map((t) => (
              <button key={t} type="button" className="team-chip" onClick={() => setSquadTeam(t)}>
                <Flag name={t} size="w20" /> {t}
              </button>
            ))}
          </div>
          <p className="hint small">Tap a nation for its squad.</p>
        </section>
      )}

      {squadTeam && (
        <div className="modal-backdrop" onClick={() => setSquadTeam(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <Flag name={squadTeam} size="w40" />
              <h3>{squadTeam}</h3>
              <button type="button" className="modal-x" onClick={() => setSquadTeam(null)}>
                ✕
              </button>
            </div>
            {squadLoading ? (
              <p className="hint">Loading squad…</p>
            ) : squad && squad.players.length > 0 ? (
              <ul className="squad">
                {squad.players.map((p) => (
                  <li key={p.name}>
                    {p.img ? <img src={p.img} alt="" loading="lazy" /> : <span className="squad-noimg">👤</span>}
                    <a href={playerSearchUrl(p.name)} target="_blank" rel="noreferrer">
                      {p.name}
                    </a>
                    <span className="squad-pos">{p.position}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hint">No squad data for this team yet.</p>
            )}
            <p className="hint small">Squad data: TheSportsDB · tap a player for club &amp; profile</p>
          </div>
        </div>
      )}

      <section className="wc-sponsors">
        <span className="partners-label">FIFA World Cup 2026 · Official partners &amp; sponsors</span>
        <div className="partners-row">
          {WC_SPONSORS.filter((s) => s.tier1).map((s) => (
            <SponsorChip key={s.name} {...s} />
          ))}
        </div>
        <div className="partners-row">
          {WC_SPONSORS.filter((s) => !s.tier1).map((s) => (
            <SponsorChip key={s.name} {...s} />
          ))}
        </div>
      </section>

      <section className="partners">
        <span className="partners-label">Powered by</span>
        <div className="partners-row">
          <a className="partner" href="https://txodds.com" target="_blank" rel="noreferrer">
            <span className="partner-mono">Tx</span> TxLINE · TxODDS
          </a>
          <a className="partner" href="https://earn.superteam.fun" target="_blank" rel="noreferrer">
            <img src="https://res.cloudinary.com/dgvnuwspr/image/upload/assets//hackathon/world-cup/logo.png" alt="" />
            Superteam Earn
          </a>
          <a className="partner" href="https://solana.com" target="_blank" rel="noreferrer">
            <img src="https://cryptologos.cc/logos/solana-sol-logo.png" alt="" />
            Solana Devnet
          </a>
          <a className="partner" href="https://www.thesportsdb.com" target="_blank" rel="noreferrer">
            <img className="p-invert" src="https://www.thesportsdb.com/images/svg/site_logo_dark.svg" alt="" />
            TheSportsDB
          </a>
          <a className="partner" href="https://gorweld.com" target="_blank" rel="noreferrer">
            <img src="https://gorweld.com/icon-192.png" alt="" />
            GorWeld
          </a>
        </div>
      </section>

      <footer className="foot">
        <span>
          Built by{' '}
          <a href="https://gorweld.com" target="_blank" rel="noreferrer">
            PrzemSas
          </a>{' '}
          · Superteam Earn · Consumer &amp; Fan Experiences
        </span>
        <span>Data: TxLINE (TxODDS)</span>
      </footer>
    </div>
  )
}
