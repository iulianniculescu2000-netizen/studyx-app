import { useMemo } from 'react';
import { useTheme } from '../../theme/ThemeContext';

interface ActivityHeatmapProps {
  sessionsByDay: Map<string, any[]>;
  theme: any;
}

export function ActivityHeatmap({ sessionsByDay, theme }: ActivityHeatmapProps) {
  const heatmapWeeks = useMemo(() => {
    const today = new Date();
    const cells: { date: string; count: number }[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const count = sessionsByDay.get(key)?.length ?? 0;
      cells.push({ date: key, count });
    }
    // Pad to fill complete weeks
    while (cells.length % 7 !== 0) cells.push({ date: '', count: 0 });
    const weeks: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [sessionsByDay]);

  const getIntensity = (count: number) => {
    if (count === 0) return 'bg-gray-100 dark:bg-gray-800';
    if (count <= 2) return 'bg-green-200 dark:bg-green-900';
    if (count <= 5) return 'bg-green-300 dark:bg-green-800';
    if (count <= 10) return 'bg-green-400 dark:bg-green-700';
    return 'bg-green-500 dark:bg-green-600';
  };

  const weekDays = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

  return (
    <div className="p-4 rounded-2xl border" style={{ borderColor: theme.border, background: theme.surface }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold" style={{ color: theme.text }}>
          Activitate Studiu
        </h3>
        <div className="flex items-center gap-2 text-xs" style={{ color: theme.text3 }}>
          <div className="w-3 h-3 rounded bg-gray-100 dark:bg-gray-800"></div>
          <div className="w-3 h-3 rounded bg-green-200 dark:bg-green-900"></div>
          <div className="w-3 h-3 rounded bg-green-300 dark:bg-green-800"></div>
          <div className="w-3 h-3 rounded bg-green-400 dark:bg-green-700"></div>
          <div className="w-3 h-3 rounded bg-green-500 dark:bg-green-600"></div>
          <span>Mai pu\u021bin</span>
          <span>Mai mult</span>
        </div>
      </div>
      
      <div className="space-y-1">
        <div className="flex gap-1">
          <div className="w-8"></div>
          {weekDays.map((day, i) => (
            <div key={i} className="w-4 h-4 flex items-center justify-center text-xs" style={{ color: theme.text3 }}>
              {day}
            </div>
          ))}
        </div>
        
        {heatmapWeeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex gap-1">
            <div className="w-8 text-xs flex items-center" style={{ color: theme.text3 }}>
              {weekIndex === 0 && '90 zile'}
              {weekIndex === Math.floor(heatmapWeeks.length / 2) && '45 zile'}
              {weekIndex === heatmapWeeks.length - 1 && 'Azi'}
            </div>
            {week.map((cell, dayIndex) => (
              <div
                key={dayIndex}
                className={`w-4 h-4 rounded-sm ${getIntensity(cell.count)} ${
                  cell.date ? 'cursor-pointer' : ''
                }`}
                title={cell.date ? `${cell.date}: ${cell.count} sesiuni` : ''}
              ></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
