# TxLINE activation (human step — Phantom)

Hackathon requires live TxLINE data. Free World Cup tier — no payment.

Docs: https://txline.txodds.com/documentation/worldcup

## Steps (mainnet recommended for hackathon)

1. Install deps in this repo: `npm install`
2. Open Phantom on **Solana Mainnet**
3. Follow World Cup doc: subscribe on-chain (service level 1 = 60s delay, or 12 = realtime)
4. Activate API token (sign message in Phantom)
5. Copy into `.env`:
   - `TXLINE_GUEST_JWT` from `/auth/guest/start`
   - `TXLINE_API_TOKEN` from `/api/token/activate`
6. Run `npm run dev:all` — app uses live data instead of mock

Ask Grok/Claude to help write a one-shot `scripts/activate.mjs` once you have Anchor IDL from TxLINE docs.