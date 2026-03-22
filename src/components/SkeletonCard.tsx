import { useTheme } from '../theme/ThemeContext';

export function SkeletonCard() {
  const theme = useTheme();
  return (
    <div className="rounded-2xl p-5 animate-pulse"
      style={{ background: theme.surface, border: `1px solid ${theme.border}`, minHeight: 160 }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl" style={{ background: theme.surface2 }} />
        <div className="flex-1 space-y-2">
          <div className="h-3 rounded-full w-3/4" style={{ background: theme.surface2 }} />
          <div className="h-2.5 rounded-full w-1/2" style={{ background: theme.surface2 }} />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-2.5 rounded-full w-full" style={{ background: theme.surface2 }} />
        <div className="h-2.5 rounded-full w-5/6" style={{ background: theme.surface2 }} />
        <div className="h-2.5 rounded-full w-2/3" style={{ background: theme.surface2 }} />
      </div>
      <div className="flex gap-2 mt-4">
        <div className="h-6 rounded-full w-16" style={{ background: theme.surface2 }} />
        <div className="h-6 rounded-full w-20" style={{ background: theme.surface2 }} />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
