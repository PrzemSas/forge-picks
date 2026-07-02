import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

type Fixture = {
  id: string
  home: string
  away: string
  kickoff: string
  status: string
  round?: string
}

type Score = {
  home: number
  away: number
  minute: number
  status: 'scheduled' | 'live' | 'finished'
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
            const r = await fetch(`${API}/scores/${f.id}`)
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
  }, [fixtures])

  useEffect(() => {
    localStorage.setItem('forge-picks', JSON.stringify(picks))
  }, [picks])

  const kickoff = useCallback(() => {
    fetch(`${API}/live/kickoff`, { method: 'POST' }).catch(console.error)
  }, [])

  const selected = fixtures.find((f) => f.id === selectedId) ?? null
  const selectedScore = selected ? scores[selectedId!] : undefined
  const myPick = picks.find((p) => p.fixtureId === selectedId)

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

  return (
    <div className="app">
      <header>
        <p className="eyebrow">World Cup · Consumer &amp; Fan Experiences</p>
        <h1>🔥 Forge Picks</h1>
        <p className="sub">
          Live World Cup data via TxLINE · call the outcome · climb the forge board as the match burns.
        </p>
        <p className="note">Poland did not qualify — mock uses real WC 2026 knockout teams only.</p>
        <span className={`badge ${txlineOk ? 'live' : 'mock'}`}>
          {txlineOk ? '● TxLINE live' : '● Mock mode — add .env tokens'}
        </span>
      </header>

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
                        {f.home} vs {f.away}
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
                      {live ? `${s!.minute}'` : s?.status === 'finished' ? 'FT' : f.status}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="panel">
          <h2>Pick</h2>
          {selected ? (
            <>
              <p className="matchline">
                {selected.home} <span className="vs">vs</span> {selected.away}
              </p>

              <div className={`scoreboard ${selectedScore?.status ?? 'scheduled'}`}>
                <span className="big">{selectedScore?.home ?? 0}</span>
                <span className="sep">:</span>
                <span className="big">{selectedScore?.away ?? 0}</span>
                <span className="clock">
                  {selectedScore?.status === 'live'
                    ? `${selectedScore.minute}'`
                    : selectedScore?.status === 'finished'
                      ? 'Full time'
                      : 'Not started'}
                </span>
              </div>

              {selected.id === LIVE_ID && selectedScore?.status === 'scheduled' && !txlineOk && (
                <button type="button" className="kickoff" onClick={kickoff}>
                  ▶ Kick off (demo)
                </button>
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
                  <p className="hint">
                    Pick locked in. Points forge when the match ends.
                  </p>
                ))}
              {!myPick && <p className="hint">Tap a side to stake your call.</p>}
            </>
          ) : (
            <p className="hint">Select a match.</p>
          )}
        </section>

        <section className="panel">
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
          <p className="hint small">Board reshuffles the moment a match hits full time.</p>
        </section>
      </main>
    </div>
  )
}
