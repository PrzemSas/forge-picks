# Forge Picks

World Cup fan app for **Superteam Earn × TxODDS** — track **Consumer and Fan Experiences**.

Live TxLINE scores + simple picks + forge-themed leaderboard.

## Quick start (mock mode)

```bash
npm install
npm run dev:all
```

Open http://localhost:5173 — works without TxLINE tokens (mock fixtures).

## Live TxLINE

1. Follow `scripts/txline-activate.md` (Phantom, free World Cup tier)
2. Copy `.env.example` → `.env` and fill JWT + API token
3. `npm run dev:all`

## Hackathon submit checklist

- [ ] Deployed URL (Vercel / similar)
- [ ] Demo video ≤ 5 min (Loom/YouTube)
- [ ] Brief doc: idea + TxLINE endpoints used + API feedback
- [ ] Submit on Earn → **Consumer and Fan Experiences** (not Trading Tools/agents track)
- [ ] Owner: **PrzemSas** (or Cookie Chain team if agreed)

## Stack

- React + Vite + TypeScript
- Express proxy (hides TxLINE tokens from browser)

Built with agent assistance (Grok); owned by PrzemSas.