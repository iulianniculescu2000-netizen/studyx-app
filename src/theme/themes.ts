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
}

export const THEMES: Record<string, Theme> = {
  bigsur: {
    id: 'bigsur',
    name: 'Big Sur Glow',
    emoji: '\u{1F304}',
    bg: '#F2F2F7',
    surface: 'rgba(255, 255, 255, 0.72)',      // alb semi-transparent — mai curat decât negru
    surface2: 'rgba(0, 0, 0, 0.055)',
    modalBg: 'rgba(255, 255, 255, 0.96)',
    border: 'rgba(0, 0, 0, 0.09)',             // border mai fin
    border2: 'rgba(0, 0, 0, 0.16)',
    text: '#1D1D1F',                           // nu pur negru — mai plăcut la citit
    text2: '#3A3A3C',
    text3: '#6E6E73',
    accent: '#0A84FF',                         // mai viu față de #007AFF
    accent2: '#5E5CE6',
    success: '#30D158',
    danger: '#FF453A',
    warning: '#FF9F0A',
    navBg: 'rgba(242, 242, 247, 0.78)',
    orb1: 'rgba(10, 132, 255, 0.12)',
    orb2: 'rgba(94, 92, 230, 0.10)',
    orb3: 'rgba(48, 209, 88, 0.08)',
    inputBg: 'rgba(255, 255, 255, 0.96)',
    gridColor: 'rgba(0, 0, 0, 0.025)',
    isDark: false,
  },
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian Glow',
    emoji: '\u{1F311}',
    bg: '#161618',                            // mai adânc → orbii și glow-urile ies mai frumos
    surface: 'rgba(255, 255, 255, 0.08)',     // mai întunecată → carduri mai subtile
    surface2: 'rgba(255, 255, 255, 0.14)',    // mai clară față de surface → ierarhie mai bună
    modalBg: 'rgba(24, 24, 26, 0.97)',
    border: 'rgba(255, 255, 255, 0.11)',      // mai fin, fără să taie în ochi
    border2: 'rgba(255, 255, 255, 0.24)',
    text: '#FFFFFF',
    text2: '#E5E5EA',
    text3: '#8E8E93',                         // Apple gray — mai bun contrast față de #AEAEB2
    accent: '#0A84FF',                        // iOS accent mai viu
    accent2: '#5E5CE6',
    success: '#30D158',
    danger: '#FF453A',
    warning: '#FF9F0A',
    navBg: 'rgba(22, 22, 24, 0.88)',
    orb1: 'rgba(10, 132, 255, 0.26)',
    orb2: 'rgba(94, 92, 230, 0.20)',
    orb3: 'rgba(48, 209, 88, 0.14)',
    inputBg: 'rgba(255, 255, 255, 0.08)',
    gridColor: 'rgba(255, 255, 255, 0.03)',
    isDark: true,
  },
  pearl: {
    id: 'pearl',
    name: 'Pearl Glow',
    emoji: '\u{1F9AA}',
    bg: '#F8F7F4',                            // ușor mai cald, mai cream
    surface: 'rgba(255, 255, 255, 0.68)',     // alb semi-transparent → carduri clar definite
    surface2: 'rgba(0, 0, 0, 0.05)',
    modalBg: 'rgba(255, 255, 255, 0.97)',
    border: 'rgba(0, 0, 0, 0.08)',
    border2: 'rgba(0, 0, 0, 0.15)',
    text: '#1C1C1E',
    text2: '#3A3A3C',
    text3: '#6C6C70',
    accent: '#E05C3A',                        // terracotta — mai cald, mai premium decât roșu
    accent2: '#2A9D8F',                       // verde-teal profund
    success: '#2DB55D',
    danger: '#E63946',
    warning: '#F4A261',
    navBg: 'rgba(248, 247, 244, 0.82)',
    orb1: 'rgba(224, 92, 58, 0.14)',
    orb2: 'rgba(42, 157, 143, 0.12)',
    orb3: 'rgba(45, 181, 93, 0.08)',
    inputBg: 'rgba(255, 255, 255, 0.94)',
    gridColor: 'rgba(0, 0, 0, 0.018)',
    isDark: false,
  },
  aurora: {
    id: 'aurora',
    name: 'Aurora Glow',
    emoji: '\u{1F30C}',
    bg: '#16102A',                            // mai adânc, mai puțin navy generic
    surface: 'rgba(168, 85, 247, 0.10)',      // violet mai modern (purple-500)
    surface2: 'rgba(168, 85, 247, 0.18)',
    modalBg: 'rgba(22, 16, 42, 0.97)',
    border: 'rgba(168, 85, 247, 0.22)',       // de la 0.35 → mult mai subtil
    border2: 'rgba(168, 85, 247, 0.40)',      // de la 0.55
    text: '#F5F0FF',                          // alb cu nuanță violet — mai blând
    text2: '#D8B4FE',                         // violet deschis elegant
    text3: '#A78BCA',
    accent: '#A855F7',                        // purple-500 modern față de BlueViolet
    accent2: '#F472B6',                       // pink-400 — mai pastelat față de HotPink
    success: '#4ADE80',
    danger: '#F87171',
    warning: '#FBBF24',
    navBg: 'rgba(22, 16, 42, 0.92)',
    orb1: 'rgba(168, 85, 247, 0.28)',
    orb2: 'rgba(244, 114, 182, 0.20)',
    orb3: 'rgba(56, 189, 248, 0.14)',         // cyan — armonizează cu violet/roz, verdele tăia paleta
    inputBg: 'rgba(22, 16, 42, 0.65)',
    gridColor: 'rgba(168, 85, 247, 0.05)',
    isDark: true,
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight Glow',
    emoji: '\u{1F319}',
    bg: '#0D1117',                            // GitHub dark — mai profund și neutru
    surface: 'rgba(56, 139, 253, 0.10)',      // albastru mai luminos (GitHub blue)
    surface2: 'rgba(56, 139, 253, 0.17)',
    modalBg: 'rgba(13, 17, 23, 0.97)',
    border: 'rgba(56, 139, 253, 0.20)',       // de la 0.40 → subtle
    border2: 'rgba(56, 139, 253, 0.38)',      // de la 0.65
    text: '#F0F6FC',
    text2: '#B1BAC4',                         // GitHub secondary text
    text3: '#6E7681',                         // GitHub muted
    accent: '#2F81F7',                        // GitHub accent blue
    accent2: '#3DCBAB',                       // teal mai vibrant
    success: '#3FB950',
    danger: '#F85149',
    warning: '#D29922',
    navBg: 'rgba(13, 17, 23, 0.94)',
    orb1: 'rgba(47, 129, 247, 0.28)',
    orb2: 'rgba(61, 203, 171, 0.22)',
    orb3: 'rgba(63, 185, 80, 0.14)',
    inputBg: 'rgba(13, 17, 23, 0.72)',
    gridColor: 'rgba(47, 129, 247, 0.06)',
    isDark: true,
  },
};

export const AUTO_THEME_ENTRY = {
  id: 'auto',
  name: 'Sistem',
  emoji: '\u{1F313}',
  bg: '#F2F2F7',
  surface: 'rgba(255, 255, 255, 0.70)',
  surface2: 'rgba(0, 0, 0, 0.05)',
  modalBg: 'rgba(255, 255, 255, 0.97)',
  border: 'rgba(0, 0, 0, 0.09)',
  border2: 'rgba(0, 0, 0, 0.16)',
  text: '#1D1D1F',
  text2: '#3A3A3C',
  text3: '#6E6E73',
  accent: '#0A84FF',
  accent2: '#5E5CE6',
  success: '#30D158',
  danger: '#FF453A',
  warning: '#FF9F0A',
  navBg: 'rgba(242, 242, 247, 0.78)',
  orb1: 'rgba(10, 132, 255, 0.10)',
  orb2: 'rgba(94, 92, 230, 0.08)',
  orb3: 'rgba(48, 209, 88, 0.06)',
  inputBg: 'rgba(255, 255, 255, 0.96)',
  gridColor: 'rgba(0, 0, 0, 0.02)',
  isDark: false,
} satisfies Theme & { id: 'auto' };

export const THEME_LIST = [...Object.values(THEMES), AUTO_THEME_ENTRY];
export type ThemeId = keyof typeof THEMES | 'auto';
