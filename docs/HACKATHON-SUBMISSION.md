# Forge Picks — Hackathon submission (Superteam Earn × TxODDS)

**Track:** Consumer & Fan Experiences  
**Deadline:** 19 July 2026  
**Builder:** [PrzemSas](https://github.com/PrzemSas) · [GORWELD®](https://gorweld.com)

---

## Links

| | URL |
|--|-----|
| **Live app** | https://forge-picks.vercel.app |
| **Repo** | https://github.com/PrzemSas/forge-picks |
| **Demo video** | `forge-picks-demo.mp4` (local / YouTube — add link on submit) |

---

## One-liner

Live World Cup scores from **TxLINE** (on-chain anchored data) turned into a fan pick game — call the result, watch it update in real time, climb the **Forge Board**.

---

## Problem

Fans juggle tabs: fixtures, live score, their prediction, friends’ takes. TxLINE already delivers trustworthy live sports data on Solana. Forge Picks is a single screen that consumes that feed and turns it into a lightweight game loop.

---

## Solution

1. **Pick** — home / draw / away for the featured match (+10 forge points if correct at full time).
2. **Watch** — hero card polls TxLINE every ~2s; goals trigger banner, score pop, hero flash.
3. **Dig** — goal timeline with scorer, minute, club, Transfermarkt lookup (national-team goals ≠ everyday club).
4. **Compete** — Forge Board reshuffles when results settle; match history persists locally.

**Two modes, one UI:** demo replay (no tokens) and live TxLINE (on-chain subscribe → API token → same components).

---

## TxLINE integration

| Endpoint | Role |
|----------|------|
| `POST /auth/guest/start` | Guest JWT (origin root) |
| `POST /api/token/activate` | API token after on-chain subscription |
| `GET /api/fixtures/snapshot` | World Cup fixture list |
| `GET /api/scores/snapshot/{fixtureId}` | Live score + events |

Serverless `/api/*` proxies TxLINE — **tokens never reach the browser**.

Activation flow: see [`scripts/txline-activate.md`](../scripts/txline-activate.md).

---

## API feedback (for judges)

- Snapshot endpoints are straightforward to poll; fixture + score shapes map cleanly to a fan UI.
- Guest → activate → poll is a clear onboarding path for consumer apps without client-side secrets.
- Suggestion: document a minimal “fan app” recipe (guest JWT + one fixture poll loop) in TxLINE docs — would lower friction for hackathon builders.

---

## Stack

React 19 · Vite · TypeScript · Vercel serverless (`api/*`) · shared `lib/txline.mjs` · TheSportsDB enrichment (venues, squads).

---

## Demo video structure (~3 min, no audio — EN captions burned in)

1. Title card  
2. **Mock replay** — Germany vs Paraguay, full match, pick, goals, board reshuffle  
3. **Production** — `forge-picks.vercel.app`, ● Live data badge, real WC fixtures from TxLINE  

---

## PL — skrót dla buildera

Aplikacja pod hackathon TxODDS: live MŚ 2026 z TxLINE → typ 1/X/2 → punkty → leaderboard. Wideo najpierw pokazuje demo (mock), potem produkcję z prawdziwym feedem. Tekst pod upload: [`VIDEO-UPLOAD.txt`](./VIDEO-UPLOAD.txt).

---

## Checklist

- [x] Public repo  
- [x] Deployed URL  
- [x] Live TxLINE (devnet, on-chain subscription)  
- [x] Demo video ≤ 5 min  
- [x] Brief doc (this file)  
- [ ] Upload video (YouTube unlisted / public)  
- [ ] Submit on [Superteam Earn](https://earn.superteam.fun) → Consumer & Fan Experiences