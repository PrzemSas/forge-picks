import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Fixture = {
  id: string
  home: string
  away: string
  kickoff: string
  status: string
  round?: string
}

type Pick = {
  fixtureId: string
  choice: 'home' | 'away' | 'draw'
  points: number
}

const API = '/api'

export default function App() {
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
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
      .then((d) => setFixtures(d.fixtures ?? []))
      .catch(console.error)
  }, [])

  useEffect(() => {
    localStorage.setItem('forge-picks', JSON.stringify(picks))
  }, [picks])

  const selected = fixtures.find((f) => f.id === selectedId) ?? null

  const leaderboard = useMemo(() => {
    const total = picks.reduce((s, p) => s + p.points, 0)
    return [{ name: 'You', points: total }]
  }, [picks])

  function makePick(choice: Pick['choice']) {
    if (!selected) return
    const points = choice === 'home' ? 3 : choice === 'away' ? 2 : 1
    setPicks((prev) => [
      ...prev.filter((p) => p.fixtureId !== selected.id),
      { fixtureId: selected.id, choice, points },
    ])
  }

  return (
    <div className="app">
      <header>
        <p className="eyebrow">World Cup · Consumer & Fan Experiences</p>
        <h1>Forge Picks</h1>
        <p className="sub">
          Live knockout-stage data via TxLINE · pick outcomes · climb the forge board
        </p>
        <p className="note">Poland did not qualify — mock uses real WC 2026 teams only.</p>
        <span className={`badge ${txlineOk ? 'live' : 'mock'}`}>
          {txlineOk ? 'TxLINE live' : 'Mock mode — add .env tokens'}
        </span>
      </header>

      <main className="grid">
        <section className="panel">
          <h2>Matches</h2>
          <ul className="fixtures">
            {fixtures.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  className={selectedId === f.id ? 'active' : ''}
                  onClick={() => setSelectedId(f.id)}
                >
                  <span className="teams">
                    {f.home} vs {f.away}
                  </span>
                  <span className="meta">
                    {f.round ? `${f.round} · ` : ''}
                    {f.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>Pick</h2>
          {selected ? (
            <>
              <p className="matchline">
                {selected.home} vs {selected.away}
              </p>
              <div className="pick-row">
                <button type="button" onClick={() => makePick('home')}>
                  {selected.home}
                </button>
                <button type="button" onClick={() => makePick('draw')}>
                  Draw
                </button>
                <button type="button" onClick={() => makePick('away')}>
                  {selected.away}
                </button>
              </div>
              <div className="bead" aria-hidden>
                <div className="bead-glow" />
              </div>
              <p className="hint">Bead score updates when match ends (MVP: instant demo points).</p>
            </>
          ) : (
            <p className="hint">Select a match.</p>
          )}
        </section>

        <section className="panel">
          <h2>Leaderboard</h2>
          <ol className="board">
            {leaderboard.map((row) => (
              <li key={row.name}>
                <span>{row.name}</span>
                <strong>{row.points} pts</strong>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  )
}