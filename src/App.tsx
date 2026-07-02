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

type Goal = { minute: number; side: 'home' | 'away'; scorer: string; club?: string }

type Score = {
  home: number
  away: number
  minute: number
  status: 'scheduled' | 'live' | 'finished'
  goals?: Goal[]
}

type Outcome = 'home' | 'away' | 'draw'
type Pick = { fixtureId: string; choice: Outcome }

const API = '/api'
const POLL_MS = 2000

// Forge rivals — AI typers so the board is alive and reshuffles when a match ends.
const RIVALS: { name: string; base: number; live: Outcome }[] = [
  { name: 'Blacksmith_Ada', base: 20, live: 'home' },
  { name: 'MoltenMara', base: 20, live: 'away' },
  { name: 'AnvilKid', base: 10, live: 'draw' },
]

const LIVE_ID = 'wc-r16-2'

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
  const [txlineOk, setTxlineOk] = useState(false)
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

  // Hero = the live match if any, else the selected/first fixture.
  const featured = fixtures.find((f) => scores[f.id]?.status === 'live') ?? selected ?? fixtures[0] ?? null
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

  const myPoints = useMemo(
    () => picks.reduce((sum, p) => sum + (outcomeOf(scores[p.fixtureId]) === p.choice ? 10 : 0), 0),
    [picks, scores],
  )

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

  return (
    <div className="app">
      <header>
        <p className="eyebrow">World Cup 2026 · Fan Picks</p>
        <h1>🔥 Forge Picks</h1>
        <p className="sub">
          Live World Cup data via TxLINE · call the outcome · climb the forge board as the match burns.
        </p>
        <span className={`badge ${txlineOk ? 'live' : 'mock'}`}>{txlineOk ? '● Live data' : '● Demo replay'}</span>
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

      <div className="txline-strip">
        <span className="dot" /> Live scores via <strong>TxLINE</strong> · <code>/fixtures/snapshot</code> ·{' '}
        <code>/scores/snapshot</code>
      </div>

      <main className="grid">
        <section className="panel">
          <h2>Matches</h2>
          <ul className="fixtures">
            {fixtures.map((f) => {
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
                      {live ? `${s!.minute}'` : s?.status === 'finished' ? 'FT' : 'Upcoming'}
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

              {selectedScore?.goals && selectedScore.goals.length > 0 && (
                <ul className="goals">
                  {selectedScore.goals.map((g, i) => (
                    <li key={i}>
                      <span className="g-min">{g.minute}'</span>
                      <span className="g-ball">⚽</span>
                      <a className="g-scorer" href={playerSearchUrl(g.scorer)} target="_blank" rel="noreferrer">
                        {g.scorer}
                      </a>
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
