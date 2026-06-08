import { useEffect, useState } from 'react';
import { useDiagnosticsStore } from '../store/diagnosticsStore';

interface StabilityEvent {
  id: string;
  timestamp: number;
  type: 'error' | 'warning' | 'info';
  area: string;
  title: string;
  detail: string;
}

export function StabilityTimeline() {
  const { events } = useDiagnosticsStore();
  const [filteredEvents, setFilteredEvents] = useState<StabilityEvent[]>([]);

  useEffect(() => {
    const stabilityEvents: StabilityEvent[] = events
      .map(event => ({
        id: event.id,
        timestamp: event.createdAt,
        type: event.level,
        area: event.area,
        title: event.title,
        detail: event.detail,
      }))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20); // Show last 20 events

    setFilteredEvents(stabilityEvents);
  }, [events]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📝';
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getAreaColor = (area: string) => {
    switch (area) {
      case 'ai':
        return 'bg-purple-100 text-purple-800';
      case 'storage':
        return 'bg-green-100 text-green-800';
      case 'updater':
        return 'bg-blue-100 text-blue-800';
      case 'startup':
        return 'bg-orange-100 text-orange-800';
      case 'ui':
        return 'bg-pink-100 text-pink-800';
      case 'runtime':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) return `acum ${days} zile`;
    if (hours > 0) return `acum ${hours} ore`;
    if (minutes > 0) return `acum ${minutes} minute`;
    return 'chiar acum';
  };

  if (filteredEvents.length === 0) {
    return (
      <div className="mt-4 rounded-lg border bg-white p-6">
        <h3 className="text-sm font-medium mb-4">Timeline Stabilitate</h3>
        <div className="text-center py-8 text-gray-500">
          <div className="text-2xl mb-2">✅</div>
          <p className="text-sm">Nu există evenimente de stabilitate înregistrate</p>
          <p className="text-xs mt-1">Aplicația funcționează normal</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">Timeline Stabilitate</h3>
        <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
          {filteredEvents.length} evenimente
        </span>
      </div>
      <div className="h-64 overflow-y-auto space-y-3">
        {filteredEvents.map((event) => (
          <div
            key={event.id}
            className={`flex gap-3 p-3 rounded-lg border-l-4 ${getEventColor(
              event.type
            )}`}
          >
            <div className="flex-shrink-0 text-lg">
              {getEventIcon(event.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm truncate">
                  {event.title}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded ${getAreaColor(event.area)}`}>
                  {event.area}
                </span>
              </div>
              <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                {event.detail}
              </p>
              <div className="text-xs text-gray-500">
                {formatTimeAgo(event.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
