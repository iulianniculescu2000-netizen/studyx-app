import { motion } from 'framer-motion';
import { RefreshCw, Check, AlertCircle } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';

interface UpdateStatusProps {
  status: 'checking' | 'up-to-date' | 'available' | 'downloading' | 'error' | 'ready';
  localVersion: string;
  remoteVersion?: string;
  downloadPercent?: number;
  theme: any;
}

export function UpdateStatus({ 
  status, 
  localVersion, 
  remoteVersion, 
  downloadPercent, 
  theme 
}: UpdateStatusProps) {
  let icon: React.ReactNode;
  let color: string = theme.text3;
  let statusText: string;

  switch (status) {
    case 'checking':
      icon = (
        <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
          <RefreshCw size={16} />
        </motion.span>
      );
      color = theme.text3;
      statusText = 'Verificare actualiz\u0103ri...';
      break;
    case 'up-to-date':
      icon = <Check size={16} />;
      color = theme.success;
      statusText = 'Aplica\u021bia este la zi';
      break;
    case 'available':
      icon = <AlertCircle size={16} />;
      color = theme.warning;
      statusText = 'Actualizare disponibil\u0103';
      break;
    case 'downloading':
      icon = (
        <motion.div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" 
          animate={{ rotate: 360 }} 
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} 
        />
      );
      color = theme.accent;
      statusText = `Desc\u0103rcare ${downloadPercent || 0}%`;
      break;
    case 'error':
      icon = <AlertCircle size={16} />;
      color = theme.danger;
      statusText = 'Eroare la actualizare';
      break;
    case 'ready':
      icon = <Check size={16} />;
      color = theme.success;
      statusText = 'Gata de instalare';
      break;
    default:
      icon = <RefreshCw size={16} />;
      color = theme.text3;
      statusText = 'Status necunoscut';
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: theme.border, background: theme.surface }}>
      <div style={{ color }}>{icon}</div>
      <div className="flex-1">
        <div className="font-medium text-sm" style={{ color: theme.text }}>
          {statusText}
        </div>
        <div className="text-xs" style={{ color: theme.text3 }}>
          Local: {localVersion}
          {remoteVersion && ` | Remote: ${remoteVersion}`}
        </div>
      </div>
    </div>
  );
}
