# Forge Picks — Hackathon submission (Superteam Earn × TxODDS)

**Track:** Consumer & Fan Experiences  
**Deadline:** 19 July 2026  
**Builder:** [PrzemSas](https://github.com/PrzemSas) · [GORWELD®](https://gorweld.com)

---

## Links

| | URL |
|--|-----|
| **Live app** | https://forge.gorweld.com |
| **Repo** | https://github.com/PrzemSas/forge-picks |
| **Demo video** | https://youtu.be/H9vczXHdnFs |

---

## One-liner

Live World Cup scores from **TxLINE** (on-chain anchored data) turned into a fan pick game — call the result, watch it update in real time, climb the **Forge Board**.

---

## Problem

Fans juggle tabs: fixtures, live score, their prediction, friends’ takes. TxLINE already delivers trustworthy live sports data on Solana. Forge Picks is a single screen that consumes that feed and turns it into a lightweight game loop.

---

## Solution

1. **Pick** — home or away for the featured match (+10 forge points if correct at full time). Knockout bracket only: no draw option — level scores go to extra time / penalties, so the winner is always one side.
2. **Watch** — hero card polls TxLINE every ~2s; goals trigger banner, score pop, hero flash.
3. **Dig** — goal timeline with minute, scorer, club and Transfermarkt lookup (national-team goals ≠ everyday club). Minutes are stamped live as goals land; scorer names come from TheSportsDB's timeline where the fixture exists there, and degrade to team-only where it doesn't — TxLINE returns empty scorer fields.
4. **Compete** — Forge Board reshuffles when results settle; match history is served from `/api/history`, so it is identical on every device you open the app on.
5. **Explore** — full tournament bracket by round, with a team-progress ranking (who got how far, who went out when). Installable as a PWA and readable offline.

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

**What worked.** The normalised schema is the real win — `fixtures/snapshot` and `scores/snapshot/{id}` return the same shape whatever the competition, so the feed layer is ~200 lines with no per-league special cases. `subscribe` → `/api/token/activate` (sign a message over `` `${txSig}::${jwt}` ``, get a durable token) is a clean piece of design, and the devnet free tier serves real World Cup fixtures, so the whole thing was built and demoed against live data at zero cost.

**Where we hit friction.**

1. The subscription mint is **Token-2022**, not classic SPL — deriving the ATA with the classic token program fails opaquely. One line in the docs would save an afternoon.
2. `subscribe(service_level_id, weeks)` rejects any `weeks` that isn't a multiple of 4 with `InvalidWeeks (6041)`. We tried `subscribe(1, 1)` first.
3. The **IDL is on-chain for devnet but not mainnet**. We decoded the layout from a real devnet transaction and reused the discriminators — they're chain-independent, so it works, but it's reverse engineering to learn something the docs could state.
4. **Guest JWTs are short-lived; the API token is durable** — and nothing says so. A deployed app silently 401s hours later. We ended up auto-refreshing: on 401, re-hit `/auth/guest/start` and retry once.
5. Scorer names come back empty and only the latest goal carries a minute; the rest only know the half. We enrich from TheSportsDB, but a fan app really wants "who scored, when" from the feed.
6. **Validation proofs are the most interesting thing in the API.** `GET /api/fixtures/validation?fixtureId=` returns a real Merkle proof (`updateSubTreeRoot` + `mainTreeProof` path) — exactly the "don't trust the feed, verify it on-chain" primitive, and the reason to pick TxLINE over a plain REST sports API.
7. We couldn't get the odds equivalent to answer on devnet. `/api/odds/validation` takes `messageId` + `ts`, but a `MessageId` taken straight from `/api/odds/snapshot/{fixtureId}` returns `Odds record for messageId … not found` — either the validation store lags the snapshot feed, or snapshot ids aren't what the proof tree is keyed on. One worked snapshot → proof → verify example with real ids would be the difference between reading about proofs and shipping them.

---

## Stack

React 19 · Vite · TypeScript · Vercel serverless (`api/*`) · shared `lib/txline.mjs` · TheSportsDB enrichment (venues, squads).

---

## Demo video structure (~3 min — EN captions + live-style sports audio)

1. Title card  
2. **Mock replay** — Germany vs Paraguay, full match, pick, goals, board reshuffle  
3. **Production** — `forge-picks.vercel.app`, ● Live data badge, real WC fixtures from TxLINE  

---

## PL — streszczenie

Aplikacja pod hackathon TxODDS: live MŚ 2026 z TxLINE → typ 1/2 (knockout, bez remisu) → punkty → leaderboard. Wideo najpierw pokazuje demo (mock), potem produkcję z prawdziwym feedem.

---

## Checklist

- [x] Public repo  
- [x] Deployed URL  
- [x] Live TxLINE (devnet, on-chain subscription)  
- [x] Demo video ≤ 5 min  
- [x] Brief doc (this file)  
- [x] Upload video — https://youtu.be/H9vczXHdnFs  
- [ ] Submit on [Superteam Earn](https://earn.superteam.fun) → Consumer & Fan Experiences