export interface Theme {
  id: string;
  name: string;
  emoji: string;
  bg: string;
  surface: string;
  surface2: string;
  modalBg: string;
  border: string;
  border2: string;
  text: string;
  text2: string;
  text3: string;
  accent: string;
  accent2: string;
  success: string;
  danger: string;
  warning: string;
  navBg: string;
  orb1: string;
  orb2: string;
  orb3: string;
  inputBg: string;
  gridColor: string;
  isDark: boolean;
  /**
   * Optional overrides for the `--glass-panel`/`--glass-panel-strong`/`--glass-border`
   * CSS variables ThemeContext computes. Without them those variables are derived
   * from a flat `isDark` branch (a neutral grey glass); a theme that wants its own
   * hue in the glass itself (not just in bg/accent) sets these instead.
   */
  glassPanel?: string;
  glassPanelStrong?: string;
  glassBorder?: string;
  glassHighlight?: string;
}

/**
 * StudyX has one look: "Glass" (UI 2.0) — near-black with a violet cast, a
 * violet→cyan accent duo (matched chroma/lightness, hue-only variation) and its
 * own tinted glass recipe. The earlier UI 1.0 themes (Big Sur, Obsidian, Pearl,
 * Aurora, Midnight, Ambră, System) were retired; anything a profile saved for
 * them resolves to this one through `normalizeThemeId`.
 */
export const THEMES = {
  glass: {
    id: 'glass',
    name: 'Glass',
    emoji: '\u{1FA9F}',
    bg: '#0E0B15',
    surface: 'rgba(167, 139, 250, 0.07)',
    surface2: 'rgba(167, 139, 250, 0.13)',
    modalBg: 'rgba(14, 11, 21, 0.97)',
    border: 'rgba(167, 139, 250, 0.18)',
    border2: 'rgba(167, 139, 250, 0.34)',
    text: '#F5F3FF',
    text2: '#C9C2DE',
    text3: '#8B84A3',
    accent: '#A78BFA',
    accent2: '#22D3EE',
    success: '#4ADE80',
    danger: '#F87171',
    warning: '#FBBF24',
    navBg: 'rgba(14, 11, 21, 0.90)',
    orb1: 'rgba(167, 139, 250, 0.30)',
    orb2: 'rgba(34, 211, 238, 0.20)',
    orb3: 'rgba(139, 92, 246, 0.16)',
    inputBg: 'rgba(14, 11, 21, 0.72)',
    gridColor: 'rgba(167, 139, 250, 0.055)',
    isDark: true,
    glassPanel: 'linear-gradient(180deg, rgba(48, 38, 74, 0.60), rgba(20, 15, 32, 0.62))',
    glassPanelStrong: 'linear-gradient(180deg, rgba(58, 46, 88, 0.72), rgba(22, 17, 36, 0.80))',
    glassBorder: 'rgba(199, 178, 255, 0.16)',
    glassHighlight: 'rgba(199, 178, 255, 0.10)',
  },
} satisfies Record<string, Theme>;

export type ThemeId = keyof typeof THEMES;

export const DEFAULT_THEME_ID: ThemeId = 'glass';

export const THEME_LIST: Theme[] = Object.values(THEMES);

/** Any theme id ever saved (profiles, backups, old settings) → the one theme that exists now. */
export function normalizeThemeId(id?: unknown): ThemeId {
  void id; // whatever was saved, there is only one theme left
  return DEFAULT_THEME_ID;
}
