import { Check, Loader2, X, AlertTriangle, RotateCcw, Sparkles } from 'lucide-react';
import { useAgentJobsStore, type AgentJobStep } from '../../store/agentJobsStore';
import type { Theme } from '../../theme/themes';

function StepIcon({ status, color }: { status: AgentJobStep['status']; color: string }) {
  if (status === 'running') return <Loader2 size={13} className="animate-spin" style={{ color }} />;
  if (status === 'done') return <Check size={13} style={{ color }} />;
  if (status === 'error') return <X size={13} style={{ color }} />;
  if (status === 'skipped') return <span style={{ color, fontSize: 11 }}>—</span>;
  return <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ border: `1.5px solid ${color}` }} />;
}

export default function AgentJobCard({
  jobId,
  theme,
  onConfirm,
  onCancel,
  onUndo,
}: {
  jobId: string;
  theme: Theme;
  onConfirm: () => void;
  onCancel: () => void;
  onUndo: () => void;
}) {
  const job = useAgentJobsStore((state) => state.jobs.find((entry) => entry.id === jobId));
  if (!job) return null;

  const awaiting = job.status === 'awaiting-confirm';
  const running = job.status === 'running';
  const done = job.status === 'done';
  const errored = job.status === 'error';

  return (
    <div
      className="rounded-[18px] border p-3.5"
      style={{ background: theme.surface2, borderColor: `${theme.accent}30` }}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <Sparkles size={14} style={{ color: theme.accent }} />
        <span className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: theme.accent }}>
          {awaiting ? 'Plan agent · confirmă' : running ? 'Agent lucrează' : done ? 'Agent · gata' : errored ? 'Agent · cu probleme' : 'Agent'}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {job.steps.map((step) => {
          const color = step.status === 'error'
            ? theme.danger
            : step.status === 'done'
              ? theme.success
              : step.status === 'running'
                ? theme.accent
                : theme.text3;
          return (
            <div key={step.id} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center">
                <StepIcon status={step.status} color={color} />
              </span>
              <div className="min-w-0">
                <span className="text-[12px] font-semibold" style={{ color: theme.text2 }}>{step.label}</span>
                {step.detail && (
                  <span className="ml-1.5 text-[11px]" style={{ color: step.status === 'error' ? theme.danger : theme.text3 }}>
                    · {step.detail}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {awaiting && (
        <div className="mt-3 flex items-center gap-2">
          {job.summary && (
            <span className="mr-auto flex items-center gap-1.5 text-[10px] font-bold" style={{ color: theme.warning }}>
              <AlertTriangle size={12} />
              {job.summary}
            </span>
          )}
          <button
            onClick={onCancel}
            className="rounded-xl px-3 py-1.5 text-[11px] font-black"
            style={{ background: theme.surface, color: theme.text3, border: `1px solid ${theme.border}` }}
          >
            Anulează
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-white"
            style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
          >
            Execută
          </button>
        </div>
      )}

      {done && (
        <button
          onClick={onUndo}
          className="mt-3 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-black"
          style={{ background: theme.surface, color: theme.text2, border: `1px solid ${theme.border}` }}
        >
          <RotateCcw size={12} />
          Anulează acțiunile (Undo)
        </button>
      )}
    </div>
  );
}
