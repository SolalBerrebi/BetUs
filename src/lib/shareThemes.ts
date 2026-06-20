// Studio de partage : formats sociaux + thèmes de fond (dégradés premium).
export type ShareFormat = 'story' | 'square' | 'portrait'

// Largeur fixe (export ×3 = 1080px), hauteur selon le ratio social.
export const FORMAT_DIM: Record<ShareFormat, { w: number; h: number; ratio: string }> = {
  story: { w: 360, h: 640, ratio: '9:16' }, // 1080×1920 — stories/reels
  portrait: { w: 360, h: 450, ratio: '4:5' }, // 1080×1350 — feed Insta
  square: { w: 360, h: 360, ratio: '1:1' }, // 1080×1080 — post/WhatsApp
}

export const FORMATS: { id: ShareFormat; label: string }[] = [
  { id: 'story', label: 'Story 9:16' },
  { id: 'portrait', label: 'Portrait 4:5' },
  { id: 'square', label: 'Carré 1:1' },
]

export interface Theme {
  id: string
  label: string
  bg: React.CSSProperties
  accent: string
  swatch: string // dégradé CSS pour la pastille de sélection
}

const grad = (css: string): React.CSSProperties => ({ backgroundColor: '#0a1f3c', backgroundImage: css })

export const THEMES: Theme[] = [
  {
    id: 'ocean',
    label: 'Océan',
    bg: grad('linear-gradient(155deg, #0a1f3c 0%, #0a3a7a 60%, #0a7aff 130%)'),
    accent: 'rgba(10,122,255,0.9)',
    swatch: 'linear-gradient(135deg, #0a3a7a, #0a7aff)',
  },
  {
    id: 'fire',
    label: 'Feu',
    bg: grad('linear-gradient(155deg, #5e1300 0%, #ff6a00 75%, #ffb020 130%)'),
    accent: 'rgba(255,176,32,0.9)',
    swatch: 'linear-gradient(135deg, #ff6a00, #ffb020)',
  },
  {
    id: 'violet',
    label: 'Violet',
    bg: grad('linear-gradient(155deg, #1e1145 0%, #6a1fb0 70%, #c026d3 130%)'),
    accent: 'rgba(192,38,211,0.85)',
    swatch: 'linear-gradient(135deg, #6a1fb0, #c026d3)',
  },
  {
    id: 'forest',
    label: 'Forêt',
    bg: grad('linear-gradient(155deg, #0a2e1a 0%, #0f6b3a 70%, #21c46a 130%)'),
    accent: 'rgba(33,196,106,0.85)',
    swatch: 'linear-gradient(135deg, #0f6b3a, #21c46a)',
  },
  {
    id: 'night',
    label: 'Nuit',
    bg: grad('linear-gradient(160deg, #14161a 0%, #2a2f3a 100%)'),
    accent: 'rgba(120,140,170,0.55)',
    swatch: 'linear-gradient(135deg, #14161a, #2a2f3a)',
  },
  {
    id: 'rose',
    label: 'Sunset',
    bg: grad('linear-gradient(155deg, #3a0a2a 0%, #c01e6a 70%, #ff7eb3 130%)'),
    accent: 'rgba(255,126,179,0.85)',
    swatch: 'linear-gradient(135deg, #c01e6a, #ff7eb3)',
  },
]

export const themeById = (id: string): Theme => THEMES.find((t) => t.id === id) ?? THEMES[0]

// Quelles stats afficher sur la carte « stats » (l'utilisateur coche/décoche).
export interface StatToggles {
  vsAverage: boolean
  hitRate: boolean
  specialty: boolean
  bestMatch: boolean
}
export const DEFAULT_TOGGLES: StatToggles = { vsAverage: true, hitRate: true, specialty: true, bestMatch: true }
