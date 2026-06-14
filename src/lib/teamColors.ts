// Couleurs d'équipe (maillot/drapeau) pour le dégradé d'en-tête « façon Apple Sports » :
// domicile à gauche, extérieur à droite, fondus au centre. Tons volontairement profonds
// et saturés — un voile sombre est appliqué par-dessus pour que le texte blanc reste lisible.
// Les équipes à identité claire (blanc/jaune vif) sont ramenées à une teinte sombre tenante.
const TEAM_COLOR: Record<string, string> = {
  // Hôtes
  USA: '#1b3a8f',
  MEX: '#1f7a44',
  CAN: '#c01627',
  // Europe
  FRA: '#1e3a8a',
  ENG: '#1d3b87',
  ESP: '#b91c2c',
  GER: '#3a3a3a',
  POR: '#9e1b32',
  NED: '#d2611a',
  BEL: '#9a1b1f',
  CRO: '#b01b2e',
  ITA: '#1f4ea1',
  SUI: '#c01627',
  AUT: '#a31420',
  SCO: '#1f5fae',
  NOR: '#9a1b2f',
  DEN: '#a4122a',
  SWE: '#1f6fb0',
  POL: '#b51d3a',
  UKR: '#1f6fb0',
  WAL: '#9a1b2f',
  IRL: '#157a4f',
  NIR: '#15553a',
  CZE: '#1f4ea1',
  SVK: '#1f4ea1',
  SVN: '#1f5fae',
  SRB: '#9a1b2f',
  HUN: '#1f7a4a',
  ROU: '#1f4ea1',
  TUR: '#c01627',
  GRE: '#1f5fae',
  ALB: '#8f1620',
  BIH: '#1f4ea1',
  MKD: '#b51d2a',
  KOS: '#1f4ea1',
  ISL: '#1f4ea1',
  FIN: '#1f6fb0',
  // Amérique du Sud
  ARG: '#2f7dc2',
  BRA: '#8f7a1e',
  URU: '#2f6fae',
  COL: '#caa21a',
  ECU: '#caa21a',
  PAR: '#b01b2e',
  CHI: '#9a1b2f',
  PER: '#b01b2e',
  VEN: '#8a4a1e',
  BOL: '#1f7a4a',
  // Afrique
  MAR: '#8a1f1f',
  SEN: '#1f7a4a',
  TUN: '#b01b2e',
  ALG: '#157a4f',
  EGY: '#a4122a',
  CIV: '#d2611a',
  GHA: '#1f7a4a',
  NGA: '#157a4f',
  CMR: '#1f7a4a',
  RSA: '#1f7a4a',
  CPV: '#1f4ea1',
  COD: '#2f7dc2',
  // Asie / Océanie
  JPN: '#1e3a8a',
  KOR: '#b01b2e',
  IRN: '#157a4f',
  AUS: '#caa21a',
  KSA: '#157a4f',
  QAT: '#7a1330',
  UZB: '#1f6fb0',
  JOR: '#8f1620',
  IRQ: '#157a4f',
  UAE: '#157a4f',
  NZL: '#3a3a3a',
  NCL: '#1f4ea1',
  // Concacaf
  PAN: '#b01b2e',
  CRC: '#9a1b2f',
  HON: '#1f6fb0',
  JAM: '#caa21a',
  HAI: '#1f3a8a',
  CUW: '#1f4ea1',
  SUR: '#1f7a4a',
}

// Teinte neutre (graphite) pour les slots non encore déterminés (TBD du tableau final).
const NEUTRAL = '#3a3f4a'

export function teamColor(code: string | null): string {
  return (code && TEAM_COLOR[code]) || NEUTRAL
}

// Grain léger (turbulence SVG) pour la texture organique du dégradé Apple.
export const GRAIN_DATA_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

/**
 * Dégradé d'en-tête d'un match : couleur domicile → extérieur en diagonale douce,
 * bloom central, voile sombre pour la lisibilité du texte blanc. À poser en
 * `style` sur le conteneur ; ajouter par-dessus un calque de grain (GRAIN_DATA_URI).
 */
export function matchGradient(
  homeCode: string | null,
  awayCode: string | null,
): { backgroundColor: string; backgroundImage: string } {
  const h = teamColor(homeCode)
  const a = teamColor(awayCode)
  return {
    backgroundColor: h,
    backgroundImage: [
      // voile sombre vertical → contraste du texte blanc
      'linear-gradient(180deg, rgba(0,0,0,0.20) 0%, rgba(0,0,0,0.30) 55%, rgba(0,0,0,0.48) 100%)',
      // bloom doux là où les deux couleurs se rencontrent
      'radial-gradient(130% 95% at 50% 16%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 55%)',
      // fondu horizontal domicile → extérieur
      `linear-gradient(100deg, ${h} 0%, ${h} 26%, ${a} 74%, ${a} 100%)`,
    ].join(', '),
  }
}
