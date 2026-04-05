import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import type { Theme } from '../../theme/themes';

interface RadarPoint {
  subject: string;
  acuratete: number;
  fullMark: number;
}

export default function CategoryRadarChart({ data, theme }: { data: RadarPoint[]; theme: Theme }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data}>
        <PolarGrid stroke={theme.border} />
        <PolarAngleAxis dataKey="subject" tick={{ fill: theme.text3, fontSize: 11 }} />
        <Radar dataKey="acuratete" stroke={theme.accent2} fill={theme.accent2} fillOpacity={0.35} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
