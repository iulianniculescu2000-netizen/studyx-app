import type { ReactElement } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { Theme } from '../../theme/themes';

interface ChartPoint {
  day: string;
  sesiuni: number;
  acuratete: number;
}

export default function ActivityBarChart({ data, theme, tooltip }: { data: ChartPoint[]; theme: Theme; tooltip: ReactElement }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
        <XAxis dataKey="day" tick={{ fill: theme.text3, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: theme.text3, fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={tooltip} />
        <Bar dataKey="sesiuni" fill={theme.accent} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
