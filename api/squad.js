import { getSquad } from '../lib/thesportsdb.mjs'

export default async function handler(req, res) {
  const team = String(req.query.team || '').slice(0, 60)
  if (!team) {
    res.status(400).json({ error: 'team required' })
    return
  }
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
  res.status(200).json(await getSquad(team))
}
