import { memo } from 'react';
import { Check, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Theme } from '../../theme/themes';

interface SortableQuestionTabProps {
  id: string;
  index: number;
  isActive: boolean;
  isValid: boolean;
  onClick: () => void;
  theme: Theme;
}

function SortableQuestionTabComponent({ id, index, isActive, isValid, onClick, theme }: SortableQuestionTabProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="flex-shrink-0 relative group"
    >
      <button
        onClick={onClick}
        className="w-9 h-9 rounded-xl text-sm font-medium transition-all"
        style={{
          background: isActive ? `${theme.accent}20` : isValid ? `${theme.success}15` : theme.surface,
          border: `1px solid ${isActive ? theme.accent + '40' : 'transparent'}`,
          color: isActive ? theme.accent : isValid ? theme.success : theme.text3,
        }}
      >
        {index + 1}
      </button>
      <div
        {...attributes}
        {...listeners}
        className="absolute -top-1 -right-1 p-0.5 rounded cursor-grab opacity-0 group-hover:opacity-100 transition-all"
        style={{ background: theme.surface2, color: theme.text3 }}
      >
        <GripVertical size={8} />
      </div>
    </div>
  );
}

export const SortableQuestionTab = memo(SortableQuestionTabComponent);

interface ToggleProps {
  value: boolean;
  onChange: () => void;
  label: string;
  theme: Theme;
}

export function Toggle({ value, onChange, label, theme }: ToggleProps) {
  return (
    <button
      onClick={onChange}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-all"
      style={{
        background: value ? `${theme.accent}20` : theme.surface2,
        border: `1px solid ${value ? theme.accent + '40' : theme.border}`,
        color: value ? theme.accent : theme.text3,
      }}
    >
      <div
        className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
        style={{ borderColor: value ? theme.accent : theme.border2, background: value ? theme.accent : 'transparent' }}
      >
        {value && <Check size={9} className="text-white" />}
      </div>
      {label}
    </button>
  );
}

interface PanelProps {
  children: React.ReactNode;
  theme: Theme;
  style?: React.CSSProperties;
}

export function Panel({ children, theme, style }: PanelProps) {
  return (
    <div
      className="rounded-2xl p-5 transition-all input-focus-draw"
      style={{ background: theme.surface, border: `1px solid ${theme.border}`, ...style }}
    >
      {children}
    </div>
  );
}

interface LabelProps {
  children: React.ReactNode;
  theme: Theme;
}

export function Label({ children, theme }: LabelProps) {
  return (
    <label className="text-sm font-medium" style={{ color: theme.text2 }}>
      {children}
    </label>
  );
}
