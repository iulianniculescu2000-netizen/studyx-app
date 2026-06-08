// Memory profiling and monitoring utilities

export interface MemoryMetrics {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  timestamp: number;
  pressure: 'low' | 'medium' | 'high' | 'critical';
}

export interface MemoryAlert {
  type: 'warning' | 'critical' | 'recovery';
  message: string;
  metrics: MemoryMetrics;
  timestamp: number;
}

export interface MemoryProfilerConfig {
  enabled: boolean;
  interval: number;
  alertThresholds: {
    warning: number; // percentage of heap limit
    critical: number; // percentage of heap limit
  };
  maxHistory: number;
  enableAutoGC: boolean;
}

class MemoryProfiler {
  private config: MemoryProfilerConfig;
  private metrics: MemoryMetrics[] = [];
  private alerts: MemoryAlert[] = [];
  private intervalId: number | null = null;
  private listeners: ((metrics: MemoryMetrics) => void)[] = [];
  private alertListeners: ((alert: MemoryAlert) => void)[] = [];

  constructor(config: Partial<MemoryProfilerConfig> = {}) {
    this.config = {
      enabled: true,
      interval: 5000, // 5 seconds
      alertThresholds: {
        warning: 70, // 70% of heap limit
        critical: 85  // 85% of heap limit
      },
      maxHistory: 100,
      enableAutoGC: true,
      ...config
    };
  }

  // Start memory profiling
  start(): void {
    if (!this.config.enabled || this.intervalId) {
      return;
    }

    console.log('Memory profiler started');
    this.intervalId = window.setInterval(() => {
      this.collectMetrics();
    }, this.config.interval);

    // Initial collection
    this.collectMetrics();
  }

  // Stop memory profiling
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Memory profiler stopped');
    }
  }

  // Collect memory metrics
  private collectMetrics(): void {
    if (!('memory' in performance)) {
      return;
    }

    const memory = (performance as any).memory;
    const metrics: MemoryMetrics = {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      timestamp: Date.now(),
      pressure: this.calculatePressure(memory.usedJSHeapSize, memory.jsHeapSizeLimit)
    };

    // Add to history
    this.metrics.push(metrics);
    if (this.metrics.length > this.config.maxHistory) {
      this.metrics.shift();
    }

    // Check for alerts
    this.checkAlerts(metrics);

    // Notify listeners
    this.listeners.forEach(listener => listener(metrics));

    // Auto GC if enabled and memory is high
    if (this.config.enableAutoGC && metrics.pressure === 'critical') {
      this.triggerGC();
    }
  }

  // Calculate memory pressure
  private calculatePressure(used: number, limit: number): 'low' | 'medium' | 'high' | 'critical' {
    const percentage = (used / limit) * 100;

    if (percentage >= this.config.alertThresholds.critical) {
      return 'critical';
    } else if (percentage >= this.config.alertThresholds.warning + 10) {
      return 'high';
    } else if (percentage >= this.config.alertThresholds.warning) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  // Check for memory alerts
  private checkAlerts(metrics: MemoryMetrics): void {
    const percentage = (metrics.usedJSHeapSize / metrics.jsHeapSizeLimit) * 100;

    if (percentage >= this.config.alertThresholds.critical) {
      this.createAlert('critical', `Critical memory usage: ${percentage.toFixed(1)}%`, metrics);
    } else if (percentage >= this.config.alertThresholds.warning) {
      this.createAlert('warning', `High memory usage: ${percentage.toFixed(1)}%`, metrics);
    }

    // Check for memory recovery
    if (this.metrics.length > 1) {
      const previous = this.metrics[this.metrics.length - 2];
      const previousPercentage = (previous.usedJSHeapSize / previous.jsHeapSizeLimit) * 100;
      
      if (previousPercentage >= this.config.alertThresholds.warning && 
          percentage < this.config.alertThresholds.warning) {
        this.createAlert('recovery', `Memory recovered: ${percentage.toFixed(1)}%`, metrics);
      }
    }
  }

  // Create memory alert
  private createAlert(type: MemoryAlert['type'], message: string, metrics: MemoryMetrics): void {
    const alert: MemoryAlert = {
      type,
      message,
      metrics,
      timestamp: Date.now()
    };

    this.alerts.push(alert);
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }

    // Notify alert listeners
    this.alertListeners.forEach(listener => listener(alert));

    console.warn(`Memory Alert [${type.toUpperCase()}]: ${message}`);
  }

  // Trigger garbage collection
  private triggerGC(): void {
    if ((window as any).gc) {
      try {
        (window as any).gc();
        console.log('Manual garbage collection triggered');
      } catch (error) {
        console.error('Failed to trigger GC:', error);
      }
    }
  }

  // Add metrics listener
  addListener(listener: (metrics: MemoryMetrics) => void): void {
    this.listeners.push(listener);
  }

  // Remove metrics listener
  removeListener(listener: (metrics: MemoryMetrics) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  // Add alert listener
  addAlertListener(listener: (alert: MemoryAlert) => void): void {
    this.alertListeners.push(listener);
  }

  // Remove alert listener
  removeAlertListener(listener: (alert: MemoryAlert) => void): void {
    const index = this.alertListeners.indexOf(listener);
    if (index > -1) {
      this.alertListeners.splice(index, 1);
    }
  }

  // Get current metrics
  getCurrentMetrics(): MemoryMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  // Get metrics history
  getMetricsHistory(): MemoryMetrics[] {
    return [...this.metrics];
  }

  // Get alerts
  getAlerts(): MemoryAlert[] {
    return [...this.alerts];
  }

  // Get memory statistics
  getMemoryStats(): {
    current: MemoryMetrics | null;
    average: number;
    peak: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    alerts: MemoryAlert[];
  } {
    const current = this.getCurrentMetrics();
    const alerts = this.getAlerts();

    if (this.metrics.length === 0) {
      return {
        current,
        average: 0,
        peak: 0,
        trend: 'stable',
        alerts
      };
    }

    const usedSizes = this.metrics.map(m => m.usedJSHeapSize);
    const average = usedSizes.reduce((a, b) => a + b, 0) / usedSizes.length;
    const peak = Math.max(...usedSizes);

    // Calculate trend
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (this.metrics.length >= 10) {
      const recent = this.metrics.slice(-5);
      const older = this.metrics.slice(-10, -5);
      
      const recentAvg = recent.reduce((sum, m) => sum + m.usedJSHeapSize, 0) / recent.length;
      const olderAvg = older.reduce((sum, m) => sum + m.usedJSHeapSize, 0) / older.length;
      
      const difference = (recentAvg - olderAvg) / olderAvg;
      if (difference > 0.05) {
        trend = 'increasing';
      } else if (difference < -0.05) {
        trend = 'decreasing';
      }
    }

    return {
      current,
      average,
      peak,
      trend,
      alerts
    };
  }

  // Force garbage collection
  forceGC(): boolean {
    if ((window as any).gc) {
      try {
        (window as any).gc();
        return true;
      } catch (error) {
        console.error('Failed to force GC:', error);
        return false;
      }
    }
    return false;
  }

  // Clear history
  clearHistory(): void {
    this.metrics = [];
    this.alerts = [];
  }

  // Update configuration
  updateConfig(newConfig: Partial<MemoryProfilerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart if interval changed
    if (this.intervalId && newConfig.interval) {
      this.stop();
      this.start();
    }
  }

  // Export data
  exportData(): {
    metrics: MemoryMetrics[];
    alerts: MemoryAlert[];
    config: MemoryProfilerConfig;
    exportTimestamp: number;
  } {
    return {
      metrics: this.getMetricsHistory(),
      alerts: this.getAlerts(),
      config: this.config,
      exportTimestamp: Date.now()
    };
  }
}

// Create singleton instance
export const memoryProfiler = new MemoryProfiler();

// React hook for memory monitoring
export function useMemoryProfiler(config?: Partial<MemoryProfilerConfig>) {
  const [metrics, setMetrics] = React.useState<MemoryMetrics | null>(null);
  const [stats, setStats] = React.useState(memoryProfiler.getMemoryStats());
  const [isMonitoring, setIsMonitoring] = React.useState(false);

  React.useEffect(() => {
    const profiler = config ? new MemoryProfiler(config) : memoryProfiler;

    // Set up listeners
    const handleMetrics = (newMetrics: MemoryMetrics) => {
      setMetrics(newMetrics);
      setStats(profiler.getMemoryStats());
    };

    const handleAlert = (alert: MemoryAlert) => {
      // Could show toast notification here
      console.warn('Memory alert:', alert);
    };

    profiler.addListener(handleMetrics);
    profiler.addAlertListener(handleAlert);

    // Start monitoring
    profiler.start();
    setIsMonitoring(true);

    return () => {
      profiler.removeListener(handleMetrics);
      profiler.removeAlertListener(handleAlert);
      profiler.stop();
      setIsMonitoring(false);
    };
  }, [config]);

  const forceGC = React.useCallback(() => {
    return memoryProfiler.forceGC();
  }, []);

  const clearHistory = React.useCallback(() => {
    memoryProfiler.clearHistory();
    setStats(memoryProfiler.getMemoryStats());
  }, []);

  return {
    metrics,
    stats,
    isMonitoring,
    forceGC,
    clearHistory,
    exportData: memoryProfiler.exportData.bind(memoryProfiler)
  };
}

// Memory leak detector
export class MemoryLeakDetector {
  private objectMap = new WeakMap();
  private snapshots: Map<string, number> = new Map();

  // Track object
  track(object: any, label: string): void {
    this.objectMap.set(object, label);
    const currentCount = this.snapshots.get(label) || 0;
    this.snapshots.set(label, currentCount + 1);
  }

  // Take snapshot
  takeSnapshot(label: string): void {
    this.snapshots.set(label, Date.now());
  }

  // Check for leaks
  checkForLeaks(): { label: string; count: number; leaked: boolean }[] {
    const results: { label: string; count: number; leaked: boolean }[] = [];
    
    for (const [label, count] of this.snapshots.entries()) {
      results.push({
        label,
        count,
        leaked: count > 0
      });
    }
    
    return results;
  }

  // Clear tracking
  clear(): void {
    this.snapshots.clear();
  }
}

// React import for hook
import React from 'react';
