# 🔥 Forge Picks

**Live TxLINE World Cup scores turned into a fan pick game with a forge-themed leaderboard.**
Built for **Superteam Earn × TxODDS** — _Consumer & Fan Experiences_ track.

> Call a match outcome, watch the game unfold live, and climb the Forge Board as results settle in real time.

**▶ Live demo: <https://forge-picks.vercel.app>**

![Forge Picks — live World Cup fan picks](docs/forge-picks.png)

## What it does — a full World Cup fan hub

- **Live hero** — the featured match with flags, real venue, live score and a 0–90' progress bar.
- **Pick & settle** — call home or away; picks resolve against the real result for **+10 forge points**.
- **Final Forecast** — pick the champion (+50) and runner-up (+25); settles after the MetLife final on 19 July, with FIFA prize-pool context ($871M — $50M champion / $33M runner-up).
- **Match history** — finished matches are archived client-side (the TxLINE feed is a rolling window of upcoming games), with score, goal timeline and your pick verdict — points never expire.
- **Live match stats** — corners and cards straight from the TxLINE event feed.
- **Goal timeline** — minutes captured live as goals happen; scorer names & clubs in demo mode, Transfermarkt lookup links.
- **Teams & squads** — every nation in the feed, tap for its squad (players, positions, photos).
- **Forge Board + Share** — you vs rival typers, reshuffles at full time; share your forge to X.
- **Real venues** — BC Place, AT&T Stadium, MetLife… joined from TheSportsDB (TxLINE carries no venues).
- **Forge & arena styling** — animated embers, colosseum arches, FIFA sponsor wall.
- **Real-time** — polls TxLINE every 2s; a goal fires a banner, a score pop and a hero flash.

## Powered by TxLINE (TxODDS)

Live World Cup scores are cryptographically anchored on Solana by TxLINE. Endpoints used:

| Endpoint | Purpose |
| --- | --- |
| `POST /auth/guest/start` | guest JWT (origin root, no `/api`) — auto-refreshed server-side on 401 |
| `POST /api/token/activate` | API token, after on-chain subscription |
| `GET /api/fixtures/snapshot` | fixtures |
| `GET /api/scores/snapshot/{fixtureId}` | live score events (score, status, clock, goals, corners, cards) |

The app runs fully in **mock/demo mode** with no tokens, then switches to live data once `.env` is set — **same UI, no code change**. Venue names, squads and (when available) scorer names are enriched from **TheSportsDB**, joined on team names + kickoff date.

## Stack

React 19 · Vite · TypeScript · Express (dev API proxy that keeps TxLINE tokens off the browser). No heavy UI dependencies.

## Quick start (mock mode — no tokens needed)

```bash
npm install
npm run dev:all      # Express API on :8787 + Vite on :5173
```

Open <http://localhost:5173>, select **Germany vs Paraguay**, hit **▶ Kick off (demo)** and watch a full match play out in ~90 seconds — goals, timeline, board reshuffle. Use **↺ Reset demo** to replay.

## Live TxLINE data

See [`scripts/txline-activate.md`](scripts/txline-activate.md):

1. `node scripts/get-jwt.mjs` → `TXLINE_GUEST_JWT`
2. Subscribe on-chain in Phantom (free World Cup tier) → activate → `TXLINE_API_TOKEN`
3. Copy `.env.example` → `.env`, fill both tokens → `npm run dev:all`

The badge flips from **● Demo replay** to **● Live data**.

## Scripts

- `npm run dev:all` — API + web (development)
- `npm run build` — TypeScript typecheck + production build
- `npm run lint` — oxlint

## Hackathon checklist

- [x] Public repo
- [x] Deployed URL — <https://forge-picks.vercel.app>
- [x] Live TxLINE data (devnet — real World Cup feed, on-chain subscription)
- [x] Demo video ≤ 5 min — https://youtu.be/H9vczXHdnFs
- [x] Brief doc — [`docs/HACKATHON-SUBMISSION.md`](docs/HACKATHON-SUBMISSION.md) + [`docs/VIDEO-UPLOAD.txt`](docs/VIDEO-UPLOAD.txt)
- [x] Upload video — https://youtu.be/H9vczXHdnFs
- [ ] Submit on Earn → **Consumer & Fan Experiences**

## Notes

Demo mode uses real WC 2026 teams and host venues with **simulated** scores, scorers and clubs — all replaced by real TxLINE feeds in live mode. Secrets live only in `.env` (gitignored); nothing sensitive is committed.

---

Built by [PrzemSas](https://gorweld.com) · Data: TxLINE (TxODDS) · Superteam Earn — Consumer & Fan Experiences
