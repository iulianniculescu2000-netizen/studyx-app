// Service Worker registration and management utilities

export interface ServiceWorkerConfig {
  cacheName?: string;
  enableOffline?: boolean;
  enableNotifications?: boolean;
  enableBackgroundSync?: boolean;
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private config: ServiceWorkerConfig;
  private isSupported = 'serviceWorker' in navigator;

  constructor(config: ServiceWorkerConfig = {}) {
    this.config = {
      cacheName: 'studyx-v1.0.0',
      enableOffline: true,
      enableNotifications: true,
      enableBackgroundSync: true,
      ...config
    };
  }

  // Register service worker
  async register(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('Service Worker not supported');
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('Service Worker registered:', this.registration.scope);
      
      // Setup event listeners
      this.setupEventListeners();
      
      return true;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return false;
    }
  }

  // Unregister service worker
  async unregister(): Promise<boolean> {
    if (!this.registration) {
      return true;
    }

    try {
      const success = await this.registration.unregister();
      console.log('Service Worker unregistered:', success);
      this.registration = null;
      return success;
    } catch (error) {
      console.error('Service Worker unregistration failed:', error);
      return false;
    }
  }

  // Update service worker
  async update(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      await this.registration.update();
      console.log('Service Worker update triggered');
      return true;
    } catch (error) {
      console.error('Service Worker update failed:', error);
      return false;
    }
  }

  // Check for updates
  async checkForUpdates(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      await this.registration.update();
      return true;
    } catch (error) {
      console.error('Check for updates failed:', error);
      return false;
    }
  }

  // Setup event listeners
  private setupEventListeners(): void {
    if (!this.registration) {
      return;
    }

    // Listen for controlling service worker changes
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('Service Worker controller changed');
      window.location.reload();
    });

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      this.handleServiceWorkerMessage(event);
    });
  }

  // Handle messages from service worker
  private handleServiceWorkerMessage(event: MessageEvent): void {
    const { type, payload } = event.data;

    switch (type) {
      case 'CACHE_UPDATED':
        console.log('Cache updated:', payload);
        break;
      case 'OFFLINE_READY':
        console.log('App ready for offline use');
        break;
      case 'SYNC_COMPLETED':
        console.log('Background sync completed');
        break;
      default:
        console.log('Unknown message from SW:', type);
    }
  }

  // Request notification permission
  async requestNotificationPermission(): Promise<boolean> {
    if (!this.config.enableNotifications || !('Notification' in window)) {
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Notification permission request failed:', error);
      return false;
    }
  }

  // Show notification
  async showNotification(title: string, options?: NotificationOptions): Promise<boolean> {
    if (!this.config.enableNotifications || !this.registration) {
      return false;
    }

    try {
      await this.registration.showNotification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options
      });
      return true;
    } catch (error) {
      console.error('Show notification failed:', error);
      return false;
    }
  }

  // Cache specific URL
  async cacheUrl(url: string): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      this.registration.active?.postMessage({
        type: 'CACHE_UPDATE',
        payload: { url }
      });
      return true;
    } catch (error) {
      console.error('Cache URL failed:', error);
      return false;
    }
  }

  // Clear specific cache
  async clearCache(cacheName?: string): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      this.registration.active?.postMessage({
        type: 'CACHE_CLEAR',
        payload: { cacheName }
      });
      return true;
    } catch (error) {
      console.error('Clear cache failed:', error);
      return false;
    }
  }

  // Get registration status
  getStatus(): {
    isSupported: boolean;
    isRegistered: boolean;
    isControlling: boolean;
    scope?: string;
  } {
    return {
      isSupported: this.isSupported,
      isRegistered: !!this.registration,
      isControlling: navigator.serviceWorker.controller !== null,
      scope: this.registration?.scope
    };
  }

  // Check if app is offline
  isOffline(): boolean {
    return !navigator.onLine;
  }

  // Monitor connection status
  monitorConnection(callback: (online: boolean) => void): () => void {
    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Return cleanup function
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }

  // Queue action for background sync
  async queueAction(url: string, options: RequestInit = {}): Promise<boolean> {
    if (!this.config.enableBackgroundSync) {
      return false;
    }

    try {
      // Store action in IndexedDB for background sync
      const action = {
        id: Date.now().toString(),
        url,
        options,
        timestamp: Date.now()
      };

      await this.storeQueuedAction(action);
      
      // Register for background sync if available
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        await (this.registration as any)?.sync.register('background-sync');
      }

      return true;
    } catch (error) {
      console.error('Queue action failed:', error);
      return false;
    }
  }

  // Store queued action in IndexedDB
  private async storeQueuedAction(action: any): Promise<void> {
    // Simplified IndexedDB implementation
    // In production, use a proper IndexedDB wrapper
    const actions = this.getQueuedActionsFromStorage();
    actions.push(action);
    localStorage.setItem('queuedActions', JSON.stringify(actions));
  }

  // Get queued actions from storage
  private getQueuedActionsFromStorage(): any[] {
    try {
      const stored = localStorage.getItem('queuedActions');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
}

// Create singleton instance
export const serviceWorkerManager = new ServiceWorkerManager();

// Hook for React components
export function useServiceWorker(config?: ServiceWorkerConfig) {
  const [status, setStatus] = React.useState({
    isSupported: false,
    isRegistered: false,
    isControlling: false,
    isOffline: !navigator.onLine
  });

  React.useEffect(() => {
    const manager = config ? new ServiceWorkerManager(config) : serviceWorkerManager;
    
    // Update status
    setStatus({
      ...manager.getStatus(),
      isOffline: !navigator.onLine
    });

    // Monitor connection changes
    const cleanup = manager.monitorConnection((online) => {
      setStatus(prev => ({ ...prev, isOffline: !online }));
    });

    return cleanup;
  }, [config]);

  const register = React.useCallback(async () => {
    const success = await serviceWorkerManager.register();
    if (success) {
      setStatus({
        ...serviceWorkerManager.getStatus(),
        isOffline: !navigator.onLine,
      });
    }
    return success;
  }, []);

  const unregister = React.useCallback(async () => {
    const success = await serviceWorkerManager.unregister();
    if (success) {
      setStatus({
        ...serviceWorkerManager.getStatus(),
        isOffline: !navigator.onLine,
      });
    }
    return success;
  }, []);

  const update = React.useCallback(async () => {
    return await serviceWorkerManager.update();
  }, []);

  const showNotification = React.useCallback(async (title: string, options?: NotificationOptions) => {
    return await serviceWorkerManager.showNotification(title, options);
  }, []);

  const cacheUrl = React.useCallback(async (url: string) => {
    return await serviceWorkerManager.cacheUrl(url);
  }, []);

  return {
    status,
    register,
    unregister,
    update,
    showNotification,
    cacheUrl,
    isOffline: status.isOffline
  };
}

// React import for hook
import React from 'react';
