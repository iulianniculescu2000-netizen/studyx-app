import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, BookOpen, BarChart3,
  StickyNote, Brain, MessageSquare, RefreshCw,
} from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';

interface SidebarNavigationProps {
  collapsed: boolean;
  theme: any;
}

export function SidebarNavigation({ collapsed, theme }: SidebarNavigationProps) {
  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/quizzes', icon: BookOpen, label: 'Quiz-uri' },
    { to: '/review', icon: RefreshCw, label: 'Review' },
    { to: '/stats', icon: BarChart3, label: 'Statistici' },
    { to: '/flashcards', icon: StickyNote, label: 'Flashcard-uri' },
    { to: '/knowledge', icon: Brain, label: 'Bibliotec\u0103 AI' },
    { to: '/ai-chat', icon: MessageSquare, label: 'AI Chat' },
  ];

  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
              isActive
                ? 'bg-blue-500 text-white shadow-lg'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`
          }
        >
          <item.icon size={18} />
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="font-medium"
            >
              {item.label}
            </motion.span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
