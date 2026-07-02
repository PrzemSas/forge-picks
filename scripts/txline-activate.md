# TxLINE activation — turn live data on

The code is ready. This is the only human part: a Solana wallet (Phantom) has to
sign a free on-chain subscription. Then you paste 2 tokens into `.env` and the app
switches from mock to live — no code changes.

Base URL: **mainnet** `https://txline.txodds.com/api` · **devnet** `https://txline-dev.txodds.com/api`
Docs: https://txline.txodds.com/documentation/worldcup · OpenAPI: https://txline.txodds.com/docs/docs.yaml

## Step 1 — Guest JWT (no wallet, automated)

```bash
node scripts/get-jwt.mjs          # mainnet
node scripts/get-jwt.mjs devnet   # devnet
```

Prints `TXLINE_GUEST_JWT=...` — paste it into `.env`. (Under the hood:
`POST /auth/guest/start`.)

## Step 2 — On-chain subscription (Phantom — human)

Free World Cup tier, zero cost. Follow the World Cup doc and run the subscribe
instruction (Anchor program) with:

- `SERVICE_LEVEL_ID` = **12** (realtime, mainnet) or **1** (60s delay)
- `DURATION_WEEKS` = **4** (minimum)
- `SELECTED_LEAGUES` = `[]` (standard bundle)

Sign in Phantom → you get a **`txSig`** (transaction signature) and a
**`walletSignature`** (base64 message signature).

## Step 3 — Activate API token

```bash
curl -X POST https://txline.txodds.com/api/token/activate \
  -H 'Content-Type: application/json' \
  -d '{"txSig":"<txSig>","walletSignature":"<base64_sig>","leagues":[]}'
```

Response contains `token` → that is your **`TXLINE_API_TOKEN`**.

## Step 4 — Fill `.env` and run

```
TXLINE_NETWORK=mainnet
TXLINE_GUEST_JWT=<from step 1>
TXLINE_API_TOKEN=<from step 3>
```

```bash
npm run dev:all
```

`/api/health` now returns `txlineConfigured: true`, the badge flips to **TxLINE live**,
and fixtures/scores come from the real feed. If fixtures come back empty, set
`TXLINE_COMPETITION_ID` to the World Cup competition id (see WC docs).
