// Team name -> ISO country code for flagcdn.com. Broad WC set so live TxLINE
// names resolve too. Unknown names return null (caller hides the flag).
const CODES: Record<string, string> = {
  argentina: 'ar',
  australia: 'au',
  austria: 'at',
  belgium: 'be',
  'bosnia and herzegovina': 'ba',
  brazil: 'br',
  cameroon: 'cm',
  canada: 'ca',
  chile: 'cl',
  colombia: 'co',
  croatia: 'hr',
  denmark: 'dk',
  'dr congo': 'cd',
  ecuador: 'ec',
  egypt: 'eg',
  england: 'gb-eng',
  france: 'fr',
  germany: 'de',
  ghana: 'gh',
  iran: 'ir',
  italy: 'it',
  japan: 'jp',
  mexico: 'mx',
  morocco: 'ma',
  netherlands: 'nl',
  nigeria: 'ng',
  norway: 'no',
  paraguay: 'py',
  peru: 'pe',
  poland: 'pl',
  portugal: 'pt',
  qatar: 'qa',
  'saudi arabia': 'sa',
  scotland: 'gb-sct',
  senegal: 'sn',
  serbia: 'rs',
  'south korea': 'kr',
  korea: 'kr',
  spain: 'es',
  sweden: 'se',
  switzerland: 'ch',
  tunisia: 'tn',
  turkey: 'tr',
  'united states': 'us',
  usa: 'us',
  uruguay: 'uy',
  wales: 'gb-wls',
}

export function flagCode(name: string): string | null {
  return CODES[name.trim().toLowerCase()] ?? null
}

export function flagUrl(name: string, size: 'w20' | 'w40' | 'w80' | 'w160' = 'w40'): string | null {
  const code = flagCode(name)
  return code ? `https://flagcdn.com/${size}/${code}.png` : null
}
