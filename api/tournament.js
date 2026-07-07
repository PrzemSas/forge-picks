import { getTournament } from '../lib/thesportsdb.mjs'

export default async function handler(_req, res) {
  try {
    res.status(200).json(await getTournament())
  } catch (err) {
    res.status(200).json({ matches: [], standings: [], error: String(err) })
  }
}
