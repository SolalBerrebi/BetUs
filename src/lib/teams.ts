// Noms français + drapeaux par code FIFA. Fallback : nom anglais stocké en base.
const TEAMS: Record<string, { name: string; flag: string }> = {
  // Hôtes
  USA: { name: 'États-Unis', flag: '🇺🇸' },
  MEX: { name: 'Mexique', flag: '🇲🇽' },
  CAN: { name: 'Canada', flag: '🇨🇦' },
  // Europe
  FRA: { name: 'France', flag: '🇫🇷' },
  ENG: { name: 'Angleterre', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  ESP: { name: 'Espagne', flag: '🇪🇸' },
  GER: { name: 'Allemagne', flag: '🇩🇪' },
  POR: { name: 'Portugal', flag: '🇵🇹' },
  NED: { name: 'Pays-Bas', flag: '🇳🇱' },
  BEL: { name: 'Belgique', flag: '🇧🇪' },
  CRO: { name: 'Croatie', flag: '🇭🇷' },
  ITA: { name: 'Italie', flag: '🇮🇹' },
  SUI: { name: 'Suisse', flag: '🇨🇭' },
  AUT: { name: 'Autriche', flag: '🇦🇹' },
  SCO: { name: 'Écosse', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  NOR: { name: 'Norvège', flag: '🇳🇴' },
  DEN: { name: 'Danemark', flag: '🇩🇰' },
  SWE: { name: 'Suède', flag: '🇸🇪' },
  POL: { name: 'Pologne', flag: '🇵🇱' },
  UKR: { name: 'Ukraine', flag: '🇺🇦' },
  WAL: { name: 'Pays de Galles', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
  IRL: { name: 'Irlande', flag: '🇮🇪' },
  NIR: { name: 'Irlande du Nord', flag: '🇬🇧' },
  CZE: { name: 'Tchéquie', flag: '🇨🇿' },
  SVK: { name: 'Slovaquie', flag: '🇸🇰' },
  SVN: { name: 'Slovénie', flag: '🇸🇮' },
  SRB: { name: 'Serbie', flag: '🇷🇸' },
  HUN: { name: 'Hongrie', flag: '🇭🇺' },
  ROU: { name: 'Roumanie', flag: '🇷🇴' },
  TUR: { name: 'Turquie', flag: '🇹🇷' },
  GRE: { name: 'Grèce', flag: '🇬🇷' },
  ALB: { name: 'Albanie', flag: '🇦🇱' },
  BIH: { name: 'Bosnie-Herzégovine', flag: '🇧🇦' },
  MKD: { name: 'Macédoine du Nord', flag: '🇲🇰' },
  KOS: { name: 'Kosovo', flag: '🇽🇰' },
  ISL: { name: 'Islande', flag: '🇮🇸' },
  FIN: { name: 'Finlande', flag: '🇫🇮' },
  // Amérique du Sud
  ARG: { name: 'Argentine', flag: '🇦🇷' },
  BRA: { name: 'Brésil', flag: '🇧🇷' },
  URU: { name: 'Uruguay', flag: '🇺🇾' },
  COL: { name: 'Colombie', flag: '🇨🇴' },
  ECU: { name: 'Équateur', flag: '🇪🇨' },
  PAR: { name: 'Paraguay', flag: '🇵🇾' },
  CHI: { name: 'Chili', flag: '🇨🇱' },
  PER: { name: 'Pérou', flag: '🇵🇪' },
  VEN: { name: 'Venezuela', flag: '🇻🇪' },
  BOL: { name: 'Bolivie', flag: '🇧🇴' },
  // Afrique
  MAR: { name: 'Maroc', flag: '🇲🇦' },
  SEN: { name: 'Sénégal', flag: '🇸🇳' },
  TUN: { name: 'Tunisie', flag: '🇹🇳' },
  ALG: { name: 'Algérie', flag: '🇩🇿' },
  EGY: { name: 'Égypte', flag: '🇪🇬' },
  CIV: { name: "Côte d'Ivoire", flag: '🇨🇮' },
  GHA: { name: 'Ghana', flag: '🇬🇭' },
  NGA: { name: 'Nigeria', flag: '🇳🇬' },
  CMR: { name: 'Cameroun', flag: '🇨🇲' },
  RSA: { name: 'Afrique du Sud', flag: '🇿🇦' },
  CPV: { name: 'Cap-Vert', flag: '🇨🇻' },
  COD: { name: 'RD Congo', flag: '🇨🇩' },
  // Asie / Océanie
  JPN: { name: 'Japon', flag: '🇯🇵' },
  KOR: { name: 'Corée du Sud', flag: '🇰🇷' },
  IRN: { name: 'Iran', flag: '🇮🇷' },
  AUS: { name: 'Australie', flag: '🇦🇺' },
  KSA: { name: 'Arabie saoudite', flag: '🇸🇦' },
  QAT: { name: 'Qatar', flag: '🇶🇦' },
  UZB: { name: 'Ouzbékistan', flag: '🇺🇿' },
  JOR: { name: 'Jordanie', flag: '🇯🇴' },
  IRQ: { name: 'Irak', flag: '🇮🇶' },
  UAE: { name: 'Émirats arabes unis', flag: '🇦🇪' },
  NZL: { name: 'Nouvelle-Zélande', flag: '🇳🇿' },
  NCL: { name: 'Nouvelle-Calédonie', flag: '🇳🇨' },
  // Concacaf
  PAN: { name: 'Panama', flag: '🇵🇦' },
  CRC: { name: 'Costa Rica', flag: '🇨🇷' },
  HON: { name: 'Honduras', flag: '🇭🇳' },
  JAM: { name: 'Jamaïque', flag: '🇯🇲' },
  HAI: { name: 'Haïti', flag: '🇭🇹' },
  CUW: { name: 'Curaçao', flag: '🇨🇼' },
  SUR: { name: 'Suriname', flag: '🇸🇷' },
}

const STAGE_SHORT: Record<string, string> = {
  round_of_32: '16e',
  round_of_16: '8e',
  quarter_final: 'quart',
  semi_final: 'demie',
}

// Placeholders du tableau final : '1A' → « 1er groupe A », 'W73' → « Vainqueur 73 »…
function placeholderLabel(raw: string): string {
  const qualif = raw.match(/^([123])([A-L])$/)
  if (qualif) {
    const ord = qualif[1] === '1' ? '1er' : `${qualif[1]}e`
    return `${ord} groupe ${qualif[2]}`
  }
  const winner = raw.match(/^W(\d+)$/)
  if (winner) return `Vainqueur ${winner[1]}`
  const loser = raw.match(/^L(\d+)$/)
  if (loser) return `Perdant ${loser[1]}`
  // ex. '3A/B/C/D' (meilleurs 3es)
  if (/^3[A-L/]+$/.test(raw)) return `3e (${raw.slice(1)})`
  return raw
}

export function teamName(name: string, code: string | null): string {
  if (code && TEAMS[code]) return TEAMS[code].name
  return placeholderLabel(name)
}

export function teamFlag(code: string | null): string {
  if (code && TEAMS[code]) return TEAMS[code].flag
  return '⚽️'
}

export function isPlaceholder(code: string | null): boolean {
  return !code || !TEAMS[code]
}

export const ALL_TEAMS = TEAMS

export { STAGE_SHORT }
