import type { ReactElement } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { Theme } from '../../theme/themes';

interface ChartPoint {
  day: string;
  sesiuni: number;
  acuratete: number;
}

export default function AccuracyTrendChart({ data, theme, tooltip }: { data: ChartPoint[]; theme: Theme; tooltip: ReactElement }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
        <XAxis dataKey="day" tick={{ fill: theme.text3, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fill: theme.text3, fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={tooltip} />
        <Line type="monotone" dataKey="acuratete" stroke={theme.success} strokeWidth={2} dot={{ fill: theme.success, r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
