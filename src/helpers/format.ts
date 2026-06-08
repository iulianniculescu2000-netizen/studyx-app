/**
 * Format Helper - Formatare \u0219i display pentru StudyX
 * Date, ore, statistici, numere, text
 */

// Formatare date
export function formatDate(date: Date | number | string, format: 'short' | 'long' | 'time' | 'relative' = 'short'): string {
  const dateObj = typeof date === 'number' ? new Date(date) : 
                  typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return 'Data invalid\u0103';
  }

  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  switch (format) {
    case 'short':
      return dateObj.toLocaleDateString('ro-RO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

    case 'long':
      return dateObj.toLocaleDateString('ro-RO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

    case 'time':
      return dateObj.toLocaleTimeString('ro-RO', {
        hour: '2-digit',
        minute: '2-digit'
      });

    case 'relative':
      if (diffDays === 0) return 'Ast\u0103zi';
      if (diffDays === 1) return 'Ieri';
      if (diffDays < 7) return `Acum ${diffDays} zile`;
      if (diffDays < 30) return `Acum ${Math.floor(diffDays / 7)} s\u0103pt\u0103m\u00e2ni`;
      if (diffDays < 365) return `Acum ${Math.floor(diffDays / 30)} luni`;
      return `Acum ${Math.floor(diffDays / 365)} ani`;

    default:
      return dateObj.toLocaleDateString('ro-RO');
  }
}

// Formatare timp
export function formatTime(seconds: number, showHours = false): string {
  if (seconds < 0) return '00:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (showHours || hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Formatare durat\u0103
export function formatDuration(milliseconds: number): {
  value: string;
  short: string;
  detailed: string;
} {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const value = milliseconds < 1000 ? `${milliseconds}ms` :
                milliseconds < 60000 ? `${seconds}s` :
                milliseconds < 3600000 ? `${minutes}m ${seconds % 60}s` :
                `${hours}h ${minutes % 60}m`;

  const short = milliseconds < 1000 ? `${milliseconds}ms` :
               milliseconds < 60000 ? `${seconds}s` :
               milliseconds < 3600000 ? `${minutes}m` :
               `${hours}h`;

  const detailed = days > 0 ? `${days}z ${hours % 24}h ${minutes % 60}m ${seconds % 60}s` :
                  hours > 0 ? `${hours}h ${minutes % 60}m ${seconds % 60}s` :
                  minutes > 0 ? `${minutes}m ${seconds % 60}s` :
                  `${seconds}s`;

  return { value, short, detailed };
}

// Formatare numere
export function formatNumber(num: number, options: {
  decimals?: number;
  separator?: string;
  suffix?: string;
  prefix?: string;
} = {}): string {
  const {
    decimals = 0,
    separator = '.',
    suffix = '',
    prefix = ''
  } = options;

  const rounded = decimals > 0 ? num.toFixed(decimals) : Math.round(num).toString();
  const parts = rounded.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  return `${prefix}${parts.join(separator)}${suffix}`;
}

// Formatare procente
export function formatPercentage(value: number, decimals = 1): {
  value: string;
  color: 'green' | 'yellow' | 'red';
  label: string;
} {
  const percentage = value * 100;
  const formatted = formatNumber(percentage, { decimals, suffix: '%' });
  
  let color: 'green' | 'yellow' | 'red';
  let label: string;

  if (percentage >= 80) {
    color = 'green';
    label = 'Excelent';
  } else if (percentage >= 60) {
    color = 'yellow';
    label = 'Bun';
  } else if (percentage >= 40) {
    color = 'yellow';
    label = 'Mediu';
  } else {
    color = 'red';
    label = 'Sc\u0103zut';
  }

  return { value: formatted, color, label };
}

// Formatare dimensiune fi\u0219iere
export function formatFileSize(bytes: number): {
  value: string;
  short: string;
  bytes: number;
} {
  if (bytes === 0) {
    return { value: '0 B', short: '0B', bytes: 0 };
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, unitIndex);
  const rounded = unitIndex === 0 ? size : size.toFixed(2);

  return {
    value: `${rounded} ${units[unitIndex]}`,
    short: `${rounded}${units[unitIndex].charAt(0)}`,
    bytes
  };
}

// Formatare scor
export function formatScore(score: number, total: number): {
  percentage: string;
  fraction: string;
  grade: string;
  color: 'green' | 'yellow' | 'red';
} {
  const percentage = total > 0 ? (score / total) * 100 : 0;
  const percentageStr = formatNumber(percentage, { decimals: 1, suffix: '%' });
  const fraction = `${score}/${total}`;

  let grade: string;
  let color: 'green' | 'yellow' | 'red';

  if (percentage >= 90) {
    grade = 'A';
    color = 'green';
  } else if (percentage >= 80) {
    grade = 'B';
    color = 'green';
  } else if (percentage >= 70) {
    grade = 'C';
    color = 'yellow';
  } else if (percentage >= 60) {
    grade = 'D';
    color = 'yellow';
  } else {
    grade = 'F';
    color = 'red';
  }

  return { percentage: percentageStr, fraction, grade, color };
}

// Formatare streak
export function formatStreak(days: number): {
  value: string;
  emoji: string;
  message: string;
  color: string;
} {
  let emoji: string;
  let message: string;
  let color: string;

  if (days >= 30) {
    emoji = '\ud83d\udd25';
    message = 'Incredibil! Eri un campion!';
    color = '#FF6B6B';
  } else if (days >= 14) {
    emoji = '\u2b50';
    message = 'Excelent! Continu\u0103 a\u0219a!';
    color = '#4ECDC4';
  } else if (days >= 7) {
    emoji = '\ud83d\udcaa';
    message = 'Foarte bine! S\u0103pt\u0103minat o s\u0103pt\u0103m\u00e2n\u0103!';
    color = '#45B7D1';
  } else if (days >= 3) {
    emoji = '\ud83d\udc4d';
    message = 'Bun \u00eenceput! Continu\u0103 a\u0219a!';
    color = '#96CEB4';
  } else if (days >= 1) {
    emoji = '\ud83d\udc4c';
    message = 'Primul pas! Continu\u0103 a\u0219a!';
    color = '#FFEAA7';
  } else {
    emoji = '\ud83d\udcaa';
    message = '\u00cencepe ast\u0103zi!';
    color = '#DFE6E9';
  }

  return {
    value: `${days} ${days === 1 ? 'zi' : 'zile'}`,
    emoji,
    message,
    color
  };
}

// Formatare num\u0103r de \u00eentreb\u0103ri
export function formatQuestionCount(count: number): {
  value: string;
  label: string;
  color: string;
} {
  let label: string;
  let color: string;

  if (count === 1) {
    label = 'o \u00eentrebare';
    color = '#3498db';
  } else if (count <= 10) {
    label = `${count} \u00eentreb\u0103ri`;
    color = '#2ecc71';
  } else if (count <= 25) {
    label = `${count} \u00eentreb\u0103ri`;
    color = '#f39c12';
  } else if (count <= 50) {
    label = `${count} \u00eentreb\u0103ri`;
    color = '#e74c3c';
  } else {
    label = `${count} \u00eentreb\u0103ri`;
    color = '#9b59b6';
  }

  return { value: label, label: label, color };
}

// Formatare text (truncare, capitalizare)
export function formatText(text: string, options: {
  maxLength?: number;
  capitalize?: boolean;
  uppercase?: boolean;
  lowercase?: boolean;
  trim?: boolean;
} = {}): string {
  const {
    maxLength = Infinity,
    capitalize = false,
    uppercase = false,
    lowercase = false,
    trim = false
  } = options;

  let result = text;

  if (trim) {
    result = result.trim();
  }

  if (lowercase) {
    result = result.toLowerCase();
  } else if (uppercase) {
    result = result.toUpperCase();
  } else if (capitalize) {
    result = result.charAt(0).toUpperCase() + result.slice(1).toLowerCase();
  }

  if (result.length > maxLength) {
    result = result.slice(0, maxLength - 3) + '...';
  }

  return result;
}

// Formatare list\u0103
export function formatList(items: string[], options: {
  separator?: string;
  maxItems?: number;
  showCount?: boolean;
} = {}): string {
  const {
    separator = ', ',
    maxItems = Infinity,
    showCount = false
  } = options;

  if (items.length === 0) return 'Niciun element';

  if (items.length <= maxItems) {
    return items.join(separator);
  }

  const visibleItems = items.slice(0, maxItems);
  const hiddenCount = items.length - maxItems;

  if (showCount) {
    return `${visibleItems.join(separator)} \u0219i alte ${hiddenCount} elemente`;
  }

  return `${visibleItems.join(separator)}...`;
}

// Formatare rang
export function formatRank(rank: number, total: number): {
  value: string;
  ordinal: string;
  percentile: string;
  medal?: string;
} {
  const ordinal = getOrdinal(rank);
  const percentile = total > 0 ? Math.round(((total - rank) / total) * 100) : 0;
  const percentileStr = `Top ${percentile}%`;

  let medal: string | undefined;
  if (rank === 1) medal = '\ud83e\udd47';
  else if (rank === 2) medal = '\ud83e\udd48';
  else if (rank === 3) medal = '\ud83e\udd49';

  return {
    value: `#${rank}`,
    ordinal,
    percentile: percentileStr,
    medal
  };
}

// Func\u021bie ajut\u0103toare pentru ordinal
function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// Formatare temperatur\u0103 (pentru gamification)
export function formatTemperature(value: number, type: 'hot' | 'cold' | 'neutral' = 'neutral'): {
  value: string;
  emoji: string;
  color: string;
  description: string;
} {
  let emoji: string;
  let color: string;
  let description: string;

  if (type === 'hot') {
    if (value >= 80) {
      emoji = '\ud83d\udd25';
      color = '#FF6B6B';
      description = 'Focar!';
    } else if (value >= 60) {
      emoji = '\u2600\ufe0f';
      color = '#FFA500';
      description = 'Arz\u0103tor';
    } else if (value >= 40) {
      emoji = '\ud83c\udf21\ufe0f';
      color = '#FFD700';
      description = 'Cald';
    } else {
      emoji = '\ud83c\udf24\ufe0f';
      color = '#87CEEB';
      description = 'C\u0103ldu\u021bel';
    }
  } else if (type === 'cold') {
    if (value >= 80) {
      emoji = '\u2744\ufe0f';
      color = '#00CED1';
      description = 'Ghea\u021b\u0103 Arctic';
    } else if (value >= 60) {
      emoji = '\ud83e\uddca';
      color = '#4682B4';
      description = 'Ghea\u021b\u0103 Polar';
    } else if (value >= 40) {
      emoji = '\ud83e\udd76';
      color = '#87CEEB';
      description = 'Rece';
    } else {
      emoji = '\ud83d\udc0c';
      color = '#ADD8E6';
      description = 'C\u0103ldu\u021bel';
    }
  } else {
    emoji = '\ud83c\udf21\ufe0f';
    color = '#95A5A6';
    description = 'Normal';
  }

  return {
    value: `${value}\u00b0`,
    emoji,
    color,
    description
  };
}

// Export pentru utilizare u\u0219oar\u0103
export const FormatHelper = {
  formatDate,
  formatTime,
  formatDuration,
  formatNumber,
  formatPercentage,
  formatFileSize,
  formatScore,
  formatStreak,
  formatQuestionCount,
  formatText,
  formatList,
  formatRank,
  formatTemperature
};

export default FormatHelper;
