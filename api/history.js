import { getHistory } from '../lib/txline.mjs'

export default async function handler(_req, res) {
  res.status(200).json(await getHistory())
}
