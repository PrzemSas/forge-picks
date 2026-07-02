import { txlineConfigured } from '../lib/txline.mjs'

export default function handler(_req, res) {
  res.status(200).json({ ok: true, txlineConfigured: txlineConfigured() })
}
