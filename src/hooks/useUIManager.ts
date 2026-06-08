import { useState, useCallback, useEffect } from 'react';
import { useTheme } from '../theme/ThemeContext';

export interface UIState {
  // Loading states
  isLoading: boolean;
  loadingMessage: string;
  loadingProgress: number;
  
  // Modal states
  activeModal: string | null;
  modalData: any;
  
  // UI preferences
  sidebarCollapsed: boolean;
  compactMode: boolean;
  animationsEnabled: boolean;
  
  // Error states
  error: string | null;
  errorType: 'warning' | 'error' | 'info' | null;
  
  // Notifications
  notifications: Notification[];
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  action?: {
    label: string;
    callback: () => void;
  };
  timestamp: Date;
}

export interface UIManagerHook {
  // Loading management
  setLoading: (loading: boolean, message?: string, progress?: number) => void;
  startLoading: (message?: string) => void;
  stopLoading: () => void;
  
  // Modal management
  openModal: (modalId: string, data?: any) => void;
  closeModal: () => void;
  isModalOpen: (modalId: string) => boolean;
  
  // UI preferences
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleCompactMode: () => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  
  // Error management
  setError: (error: string, type?: 'warning' | 'error' | 'info') => void;
  clearError: () => void;
  
  // Notification management
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // State getters
  state: UIState;
}

export function useUIManager(): UIManagerHook {
  const theme = useTheme();
  
  const [state, setState] = useState<UIState>({
    isLoading: false,
    loadingMessage: '',
    loadingProgress: 0,
    activeModal: null,
    modalData: null,
    sidebarCollapsed: false,
    compactMode: false,
    animationsEnabled: true,
    error: null,
    errorType: null,
    notifications: []
  });

  // Loading management
  const setLoading = useCallback((loading: boolean, message?: string, progress?: number) => {
    setState(prev => ({
      ...prev,
      isLoading: loading,
      loadingMessage: message || prev.loadingMessage,
      loadingProgress: progress ?? prev.loadingProgress
    }));
  }, []);

  const startLoading = useCallback((message?: string) => {
    setLoading(true, message, 0);
  }, [setLoading]);

  const stopLoading = useCallback(() => {
    setLoading(false);
  }, [setLoading]);

  // Modal management
  const openModal = useCallback((modalId: string, data?: any) => {
    setState(prev => ({
      ...prev,
      activeModal: modalId,
      modalData: data
    }));
  }, []);

  const closeModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      activeModal: null,
      modalData: null
    }));
  }, []);

  const isModalOpen = useCallback((modalId: string) => {
    return state.activeModal === modalId;
  }, [state.activeModal]);

  // UI preferences
  const toggleSidebar = useCallback(() => {
    setState(prev => ({
      ...prev,
      sidebarCollapsed: !prev.sidebarCollapsed
    }));
  }, []);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setState(prev => ({
      ...prev,
      sidebarCollapsed: collapsed
    }));
  }, []);

  const toggleCompactMode = useCallback(() => {
    setState(prev => ({
      ...prev,
      compactMode: !prev.compactMode
    }));
  }, []);

  const setAnimationsEnabled = useCallback((enabled: boolean) => {
    setState(prev => ({
      ...prev,
      animationsEnabled: enabled
    }));
  }, []);

  // Error management
  const setError = useCallback((error: string, type: 'warning' | 'error' | 'info' = 'error') => {
    setState(prev => ({
      ...prev,
      error,
      errorType: type
    }));
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
      errorType: null
    }));
  }, []);

  // Notification management
  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    setState(prev => ({
      ...prev,
      notifications: [...prev.notifications, newNotification]
    }));

    // Auto-remove notification after duration
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        removeNotification(newNotification.id);
      }, notification.duration);
    }
  }, []);

  const removeNotification = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.filter(notif => notif.id !== id)
    }));
  }, []);

  const clearNotifications = useCallback(() => {
    setState(prev => ({
      ...prev,
      notifications: []
    }));
  }, []);

  // Auto-save preferences to localStorage
  useEffect(() => {
    const preferences = {
      sidebarCollapsed: state.sidebarCollapsed,
      compactMode: state.compactMode,
      animationsEnabled: state.animationsEnabled
    };
    
    localStorage.setItem('ui-preferences', JSON.stringify(preferences));
  }, [state.sidebarCollapsed, state.compactMode, state.animationsEnabled]);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('ui-preferences');
    if (saved) {
      try {
        const preferences = JSON.parse(saved);
        setState(prev => ({
          ...prev,
          ...preferences
        }));
      } catch (error) {
        console.error('Failed to load UI preferences:', error);
      }
    }
  }, []);

  return {
    // Loading management
    setLoading,
    startLoading,
    stopLoading,
    
    // Modal management
    openModal,
    closeModal,
    isModalOpen,
    
    // UI preferences
    toggleSidebar,
    setSidebarCollapsed,
    toggleCompactMode,
    setAnimationsEnabled,
    
    // Error management
    setError,
    clearError,
    
    // Notification management
    addNotification,
    removeNotification,
    clearNotifications,
    
    // State getter
    state
  };
}
