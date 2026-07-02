// Fetch a TxLINE guest JWT (step 1 of activation — no wallet needed).
// Usage: node scripts/get-jwt.mjs [mainnet|devnet]
const network = (process.argv[2] || 'mainnet').toLowerCase()
// NOTE: /auth/guest/start lives at the ORIGIN root (no /api). Only data + token
// endpoints are under /api (see OpenAPI: /auth/guest/start vs /api/token/activate).
const origin =
  network === 'devnet' ? 'https://txline-dev.txodds.com' : 'https://txline.txodds.com'

try {
  const r = await fetch(`${origin}/auth/guest/start`, { method: 'POST' })
  if (!r.ok) throw new Error(`HTTP ${r.status} ${await r.text()}`)
  const data = await r.json()
  const jwt = data.token ?? data.jwt ?? data.guestJwt ?? data
  console.log('\n# Paste into .env:')
  console.log(`TXLINE_GUEST_JWT=${typeof jwt === 'string' ? jwt : JSON.stringify(jwt)}`)
  console.log('\n# Next: on-chain subscribe in Phantom, then POST /api/token/activate (see txline-activate.md)')
} catch (err) {
  console.error(`Failed to get guest JWT from ${base}:`, String(err))
  process.exit(1)
}
