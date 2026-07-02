import { getScore } from '../../lib/txline.mjs'

export default async function handler(req, res) {
  const { fixtureId, t } = req.query
  res.status(200).json(await getScore(fixtureId, t))
}
