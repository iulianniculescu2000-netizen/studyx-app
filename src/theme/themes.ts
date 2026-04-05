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
    name: 'Big Sur',
    emoji: '🍎',
    bg: '#EFF4F8',
    surface: 'rgba(255, 255, 255, 0.74)',
    surface2: 'rgba(247, 250, 253, 0.90)',
    modalBg: 'rgba(255, 255, 255, 0.90)',
    border: 'rgba(18,30,48,0.07)',
    border2: 'rgba(18,30,48,0.14)',
    text: '#1d1d1f',
    text2: '#363b44',
    text3: '#6c7381',
    accent: '#0071E3',
    accent2: '#62C8F4',
    success: '#30D158',
    danger: '#FF3B30',
    warning: '#FF9F0A',
    navBg: 'rgba(255, 255, 255, 0.62)',
    orb1: 'rgba(0,113,227,0.16)',
    orb2: 'rgba(98,200,244,0.12)',
    orb3: 'rgba(48,209,88,0.09)',
    inputBg: 'rgba(250, 252, 255, 0.9)',
    gridColor: 'rgba(12,24,46,0.016)',
    isDark: false,
  },
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian Pro',
    emoji: '💎',
    bg: '#1C1C1E',
    surface: 'rgba(255, 255, 255, 0.075)',
    surface2: 'rgba(255, 255, 255, 0.11)',
    modalBg: 'rgba(36,36,39,0.94)',
    border: 'rgba(255,255,255,0.10)',
    border2: 'rgba(255,255,255,0.18)',
    text: '#FFFFFF',
    text2: '#AEAEB2',
    text3: '#8E8E93',
    accent: '#0A84FF',
    accent2: '#5E5CE6',
    success: '#32D74B',
    danger: '#FF453A',
    warning: '#FFD60A',
    navBg: 'rgba(24, 24, 27, 0.74)',
    orb1: 'rgba(10,132,255,0.18)',
    orb2: 'rgba(94,92,230,0.15)',
    orb3: 'rgba(50,215,75,0.10)',
    inputBg: 'rgba(255, 255, 255, 0.08)',
    gridColor: 'rgba(255,255,255,0.03)',
    isDark: true,
  },
  pearl: {
    id: 'pearl',
    name: 'Pearl Pure',
    emoji: '🦪',
    bg: '#F7F3EE',
    surface: 'rgba(255, 252, 248, 0.78)',
    surface2: 'rgba(255, 249, 244, 0.84)',
    modalBg: 'rgba(255, 252, 248, 0.92)',
    border: 'rgba(73, 55, 40, 0.07)',
    border2: 'rgba(73, 55, 40, 0.13)',
    text: '#171513',
    text2: '#4f433f',
    text3: '#85756e',
    accent: '#D9687A',
    accent2: '#7C71EE',
    success: '#28CD41',
    danger: '#FF3B30',
    warning: '#FF9500',
    navBg: 'rgba(255, 252, 248, 0.64)',
    orb1: 'rgba(217, 104, 122, 0.12)',
    orb2: 'rgba(124, 113, 238, 0.10)',
    orb3: 'rgba(40, 205, 65, 0.05)',
    inputBg: 'rgba(255,255,255,0.88)',
    gridColor: 'rgba(58, 37, 22, 0.013)',
    isDark: false,
  },
  aurora: {
    id: 'aurora',
    name: 'Aurora Neon',
    emoji: '🌌',
    bg: '#1A1429',
    surface: 'rgba(191,64,255,0.12)',
    surface2: 'rgba(191,64,255,0.18)',
    modalBg: '#251D3A',
    border: 'rgba(191,64,255,0.28)',
    border2: 'rgba(191,64,255,0.45)',
    text: '#F8F5FF',
    text2: '#DAC7FF',
    text3: '#A694D1',
    accent: '#BF40FF',
    accent2: '#FF2D78',
    success: '#3DED68',
    danger: '#FF4560',
    warning: '#FFDD57',
    navBg: 'rgba(26, 20, 41, 0.9)',
    orb1: 'rgba(191,64,255,0.22)',
    orb2: 'rgba(255,45,120,0.15)',
    orb3: 'rgba(61,237,104,0.08)',
    inputBg: '#251D3A',
    gridColor: 'rgba(191,64,255,0.04)',
    isDark: true,
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight Deep',
    emoji: '🌙',
    bg: '#161B26',
    surface: 'rgba(0,150,255,0.10)',
    surface2: 'rgba(0,150,255,0.15)',
    modalBg: '#212838',
    border: 'rgba(0,150,255,0.20)',
    border2: 'rgba(0,150,255,0.35)',
    text: '#FFFFFF',
    text2: '#B8C5E0',
    text3: '#7E8DA8',
    accent: '#00B4FF',
    accent2: '#52FFCE',
    success: '#32D74B',
    danger: '#FF453A',
    warning: '#FFD60A',
    navBg: 'rgba(22, 27, 38, 0.85)',
    orb1: 'rgba(0,180,255,0.18)',
    orb2: 'rgba(82,255,206,0.12)',
    orb3: 'rgba(50,215,75,0.08)',
    inputBg: '#212838',
    gridColor: 'rgba(0,150,255,0.03)',
    isDark: true,
  },
};

export const AUTO_THEME_ENTRY = {
  id: 'auto',
  name: 'Sistem',
  emoji: '🌗',
  bg: '#FFFFFF',
  surface: 'rgba(0, 0, 0, 0.03)',
  surface2: '#F2F2F7',
  modalBg: '#FFFFFF',
  border: '#E5E5EA',
  border2: '#C7C7CC',
  text: '#000000',
  text2: '#3A3A3C',
  text3: '#636366',
  accent: '#007AFF',
  accent2: '#5856D6',
  success: '#28CD41',
  danger: '#FF3B30',
  warning: '#FF9500',
  navBg: '#F6F6F6',
  orb1: 'rgba(0, 122, 255, 0.06)',
  orb2: 'rgba(88, 86, 214, 0.05)',
  orb3: 'rgba(40, 205, 65, 0.03)',
  inputBg: '#FFFFFF',
  gridColor: 'rgba(0, 0, 0, 0.01)',
  isDark: false,
} satisfies Theme & { id: 'auto' };

export const THEME_LIST = [...Object.values(THEMES), AUTO_THEME_ENTRY];
export type ThemeId = keyof typeof THEMES | 'auto';
