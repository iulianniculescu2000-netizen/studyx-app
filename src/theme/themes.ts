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
    bg: '#F5F5F7',
    surface: 'rgba(255, 255, 255, 0.85)',
    surface2: '#ECECEC',
    modalBg: 'rgba(255, 255, 255, 0.98)',
    border: 'rgba(0,0,0,0.06)',
    border2: 'rgba(0,0,0,0.12)',
    text: '#1d1d1f',
    text2: '#424245', // Darkened from #3a3a3c
    text3: '#6e6e73', // Darkened from #86868b
    accent: '#0071E3',
    accent2: '#34AADC',
    success: '#30D158',
    danger: '#FF3B30',
    warning: '#FF9F0A',
    navBg: 'rgba(255, 255, 255, 0.7)',
    orb1: 'rgba(0,113,227,0.12)',
    orb2: 'rgba(52,170,220,0.10)',
    orb3: 'rgba(48,209,88,0.08)',
    inputBg: 'rgba(242, 242, 247, 0.8)',
    gridColor: 'rgba(0,0,0,0.015)',
    isDark: false,
  },
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian Pro',
    emoji: '💎',
    bg: '#1C1C1E', // Ridicat de la #161618 pentru mai mult "aer"
    surface: 'rgba(255, 255, 255, 0.06)', // Mai vizibil
    surface2: 'rgba(255, 255, 255, 0.10)',
    modalBg: '#2C2C2E', // Elevație clară
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
    navBg: 'rgba(28, 28, 30, 0.85)',
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
    emoji: '🐚',
    bg: 'rgba(255, 255, 255, 0.8)',
    surface: 'rgba(255, 255, 255, 0.9)',
    surface2: 'rgba(0, 0, 0, 0.02)',
    modalBg: '#FFFFFF',
    border: 'rgba(0, 0, 0, 0.05)',
    border2: 'rgba(0, 0, 0, 0.1)',
    text: '#121212',
    text2: '#4a4a4e', // Darkened from #4A4A4A
    text3: '#76767a', // Darkened from #707070
    accent: '#FF2D55',
    accent2: '#5856D6',
    success: '#28CD41',
    danger: '#FF3B30',
    warning: '#FF9500',
    navBg: 'rgba(255, 255, 255, 0.75)',
    orb1: 'rgba(255, 45, 85, 0.08)',
    orb2: 'rgba(88, 86, 214, 0.08)',
    orb3: 'rgba(40, 205, 65, 0.05)',
    inputBg: '#FFFFFF',
    gridColor: 'rgba(0, 0, 0, 0.01)',
    isDark: false,
  },
  aurora: {
    id: 'aurora',
    name: 'Aurora Neon',
    emoji: '🌌',
    bg: '#1A1429', // Mult mai deschis și mai "deep purple"
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
    bg: '#161B26', // Un bleumarin-slate premium
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
  text3: '#636366', // Darkened from #8E8E93
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
