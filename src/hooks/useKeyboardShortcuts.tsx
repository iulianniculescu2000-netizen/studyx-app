import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../store/uiStore';
import { useUserStore } from '../store/userStore';
import { useTheme } from '../theme/ThemeContext';

interface KeyboardShortcut {
  key: string;
  modifiers: ('ctrl' | 'shift' | 'alt' | 'meta')[];
  description: string;
  action: () => void;
  global?: boolean;
  category: 'navigation' | 'quiz' | 'ui' | 'ai' | 'study';
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const setChatOpen = useUIStore((state) => state.setChatOpen);
  const setTheme = useUserStore((state) => state.setTheme);
  const theme = useTheme();
  const shortcutsRef = useRef<Map<string, KeyboardShortcut>>(new Map());

  const registerShortcut = useCallback((
    key: string,
    modifiers: ('ctrl' | 'shift' | 'alt' | 'meta')[],
    description: string,
    action: () => void,
    global = false,
    category: 'navigation' | 'quiz' | 'ui' | 'ai' | 'study' = 'ui'
  ) => {
    const shortcutKey = `${modifiers.join('+')}+${key}`.toLowerCase();
    shortcutsRef.current.set(shortcutKey, {
      key,
      modifiers,
      description,
      action,
      global,
      category
    });
  }, []);

  const unregisterShortcut = useCallback((key: string, modifiers: ('ctrl' | 'shift' | 'alt' | 'meta')[]) => {
    const shortcutKey = `${modifiers.join('+')}+${key}`.toLowerCase();
    shortcutsRef.current.delete(shortcutKey);
  }, []);

  // Register default shortcuts
  useEffect(() => {
    // Navigation shortcuts - folosim combina\u021bii pentru a evita conflictele cu typing
    registerShortcut('g', ['ctrl'], 'Go to Dashboard', () => navigate('/'), true, 'navigation');
    registerShortcut('q', ['ctrl'], 'Go to Quizzes', () => navigate('/quizzes'), true, 'navigation');
    registerShortcut('r', ['ctrl'], 'Go to Review', () => navigate('/review'), true, 'navigation');
    registerShortcut('s', ['ctrl'], 'Go to Stats', () => navigate('/stats'), true, 'navigation');
    registerShortcut('f', ['ctrl'], 'Go to Flashcards', () => navigate('/flashcards'), true, 'navigation');
    registerShortcut('k', ['ctrl'], 'Go to Knowledge Vault', () => navigate('/knowledge'), true, 'navigation');
    registerShortcut('c', ['ctrl'], 'Open AI Chat', () => setChatOpen(true), true, 'ai');
    
    // UI shortcuts
    registerShortcut('?', [], 'Show keyboard shortcuts', () => {
      // This will be handled by the KeyboardShortcutsModal component
      window.dispatchEvent(new CustomEvent('studyx:show-shortcuts'));
    }, true, 'ui');
    registerShortcut('escape', [], 'Close modal/drawer', () => {
      // Close any open modals or drawers
      setChatOpen(false);
      window.dispatchEvent(new CustomEvent('studyx:close-modals'));
    }, true, 'ui');
    
    // Theme shortcuts
    registerShortcut('t', [], 'Toggle theme', () => {
      setTheme(theme.id === 'obsidian' ? 'pearl' : 'obsidian');
    }, true, 'ui');
    
    // Study shortcuts
    registerShortcut('n', ['ctrl'], 'Create new quiz', () => navigate('/quizzes/new'), true, 'study');
    registerShortcut('d', ['ctrl'], 'Daily review', () => navigate('/review/daily'), true, 'study');

    return () => {
      // Cleanup shortcuts on unmount
      shortcutsRef.current.clear();
    };
  }, [navigate, setChatOpen, theme, registerShortcut]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const modifiers: ('ctrl' | 'shift' | 'alt' | 'meta')[] = [];

      if (event.ctrlKey) modifiers.push('ctrl');
      if (event.shiftKey) modifiers.push('shift');
      if (event.altKey) modifiers.push('alt');
      if (event.metaKey) modifiers.push('meta');

      // When the user is typing in a field, never let a bare key (Space, "t",
      // "n", …) be hijacked as a shortcut — that swallowed the space bar and
      // toggled theme mid-typing. Only Ctrl/Meta combos stay active so global
      // navigation (Ctrl+G, Ctrl+C…) still works from inside inputs.
      const target = event.target as HTMLElement | null;
      const isTypingTarget = !!target && (
        target.tagName === 'INPUT'
        || target.tagName === 'TEXTAREA'
        || target.isContentEditable
      );
      const hasCommandModifier = event.ctrlKey || event.metaKey;
      // Escape must still close modals/drawers even while a field is focused.
      if (isTypingTarget && !hasCommandModifier && key !== 'escape') {
        return;
      }

      const shortcutKey = `${modifiers.join('+')}+${key}`;

      // Check for exact match
      if (shortcutsRef.current.has(shortcutKey)) {
        event.preventDefault();
        const shortcut = shortcutsRef.current.get(shortcutKey)!;
        shortcut.action();
        return;
      }

      // Check for partial matches (e.g., just the key without modifiers)
      const keyOnlyShortcut = Array.from(shortcutsRef.current.values()).find(
        s => s.key === key && s.modifiers.length === 0
      );
      
      if (keyOnlyShortcut && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
        // Only prevent default if it's not a typing input
        const target = event.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true';
        
        if (!isInput) {
          event.preventDefault();
          keyOnlyShortcut.action();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getShortcutsByCategory = useCallback((category: 'navigation' | 'quiz' | 'ui' | 'ai' | 'study') => {
    return Array.from(shortcutsRef.current.values())
      .filter(shortcut => shortcut.category === category)
      .sort((a, b) => a.description.localeCompare(b.description));
  }, []);

  const getAllShortcuts = useCallback(() => {
    return Array.from(shortcutsRef.current.values())
      .sort((a, b) => {
        const categoryOrder = { navigation: 0, study: 1, ai: 2, quiz: 3, ui: 4 };
        const aOrder = categoryOrder[a.category] ?? 999;
        const bOrder = categoryOrder[b.category] ?? 999;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.description.localeCompare(b.description);
      });
  }, []);

  return {
    registerShortcut,
    unregisterShortcut,
    getShortcutsByCategory,
    getAllShortcuts
  };
}

// Hook for quiz-specific shortcuts
export function useQuizKeyboardShortcuts({
  onNext,
  onPrevious,
  onHint,
  onReveal,
  onNote,
  onSkip
}: {
  onNext?: () => void;
  onPrevious?: () => void;
  onHint?: () => void;
  onReveal?: () => void;
  onNote?: () => void;
  onSkip?: () => void;
}) {
  const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts();

  useEffect(() => {
    if (onNext) {
      registerShortcut('arrowright', [], 'Next question', onNext, false, 'quiz');
      registerShortcut('enter', [], 'Next/Confirm', onNext, false, 'quiz');
      registerShortcut(' ', [], 'Next/Confirm', onNext, false, 'quiz');
    }
    
    if (onPrevious) {
      registerShortcut('arrowleft', [], 'Previous question', onPrevious, false, 'quiz');
    }
    
    if (onHint) {
      registerShortcut('h', [], 'Get hint', onHint, false, 'quiz');
    }
    
    if (onReveal) {
      registerShortcut('r', [], 'Reveal answer', onReveal, false, 'quiz');
    }
    
    if (onNote) {
      registerShortcut('n', [], 'Toggle notes', onNote, false, 'quiz');
    }
    
    if (onSkip) {
      registerShortcut('s', [], 'Skip question', onSkip, false, 'quiz');
    }

    return () => {
      // Cleanup quiz shortcuts
      if (onNext) {
        unregisterShortcut('arrowright', []);
        unregisterShortcut('enter', []);
        unregisterShortcut(' ', []);
      }
      if (onPrevious) {
        unregisterShortcut('arrowleft', []);
      }
      if (onHint) {
        unregisterShortcut('h', []);
      }
      if (onReveal) {
        unregisterShortcut('r', []);
      }
      if (onNote) {
        unregisterShortcut('n', []);
      }
      if (onSkip) {
        unregisterShortcut('s', []);
      }
    };
  }, [onNext, onPrevious, onHint, onReveal, onNote, onSkip, registerShortcut, unregisterShortcut]);
}
