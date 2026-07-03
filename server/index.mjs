// Dev-only API server. Mirrors the Vercel serverless functions in api/* using
// the same shared logic (lib/txline.mjs). In production Vercel serves api/*.
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { getFixtures, getScore, txlineConfigured, BASE_URL } from '../lib/txline.mjs'
import { getSquad } from '../lib/thesportsdb.mjs'

const app = express()
const PORT = process.env.API_PORT || 8787

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, txlineConfigured: txlineConfigured() })
})

app.get('/api/fixtures', async (_req, res) => {
  res.json(await getFixtures())
})

app.get('/api/scores/:fixtureId', async (req, res) => {
  res.json(await getScore(req.params.fixtureId, req.query.t))
})

app.get('/api/squad', async (req, res) => {
  const team = String(req.query.team || '').slice(0, 60)
  if (!team) return res.status(400).json({ error: 'team required' })
  res.json(await getSquad(team))
})

app.listen(PORT, () => {
  console.log(`Forge Picks dev API http://localhost:${PORT}`)
  console.log(`TxLINE base: ${BASE_URL}`)
  console.log(txlineConfigured() ? 'TxLINE: configured — live data' : 'TxLINE: mock mode (set .env tokens)')
})
