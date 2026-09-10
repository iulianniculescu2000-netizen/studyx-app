/**
 * Compact "Plan examen" affordance mounted inside a Knowledge Vault folder's
 * view (KnowledgeVault.tsx). Deliberately slim when unused — a folder that
 * never sets an exam plan shows a one-line CTA, not a full card, so folders
 * that don't need this feature aren't burdened by it.
 */
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, ChevronDown, ChevronUp, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useAIStore, type AILibraryFolder, type AIKnowledgeSource } from '../store/aiStore';
import { useToastStore } from '../store/toastStore';
import { useFolderChapters } from '../hooks/useFolderChapters';
import { daysUntil } from '../lib/examSplit';
import ExamPlanSetupModal from './ExamPlanSetupModal';
import ExamPlanSessionRow from './ExamPlanSessionRow';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ExamPlanCard({ folder, sources }: { folder: AILibraryFolder; sources: AIKnowledgeSource[] }) {
  const theme = useTheme();
  const setFolderExamPlan = useAIStore((state) => state.setFolderExamPlan);
  const addToast = useToastStore((state) => state.addToast);
  const [expanded, setExpanded] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);

  const folderSources = useMemo(
    () => sources.map((s) => ({ id: s.id, name: s.name, addedAt: s.addedAt })),
    [sources],
  );
  const { chapters, loading } = useFolderChapters(folderSources);

  const plan = folder.examPlan;
  const examPast = plan ? plan.examDate < todayStr() : false;
  const daysLeft = plan && !examPast ? daysUntil(new Date(`${plan.examDate}T12:00:00`)) : null;
  const doneCount = plan ? plan.sessions.filter((s) => s.done).length : 0;
  const totalCount = plan ? plan.sessions.length : 0;
  const newDocsCount = plan ? sources.filter((s) => !plan.sourceIds.includes(s.id)).length : 0;

  const handleDelete = () => {
    setFolderExamPlan(folder.id, null);
    addToast('Planul de examen a fost șters.', 'info');
    setExpanded(false);
  };

  if (!plan) {
    return (
      <>
        <button
          onClick={() => setSetupOpen(true)}
          className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-all hover:-translate-y-0.5"
          style={{ background: theme.surface2, border: `1px dashed ${theme.border}` }}
        >
          <span className="flex items-center gap-2 text-xs font-bold" style={{ color: theme.text3 }}>
            <CalendarDays size={15} style={{ color: theme.text3 }} />
            Plan examen — nesetat
            {loading && <Loader2 size={12} className="animate-spin" />}
          </span>
          <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: theme.accent }}>
            Configurează
          </span>
        </button>
        {setupOpen && <ExamPlanSetupModal folder={folder} chapters={chapters} onClose={() => setSetupOpen(false)} />}
      </>
    );
  }

  return (
    <>
      <div className="rounded-2xl p-4" style={{ background: `${theme.accent}0d`, border: `1px solid ${theme.accent}25` }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => setExpanded((v) => !v)} className="flex min-w-0 items-center gap-2.5 text-left">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: examPast ? theme.surface2 : `${theme.accent}18` }}>
              <CalendarDays size={16} style={{ color: examPast ? theme.text3 : theme.accent }} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black" style={{ color: theme.text }}>
                {examPast ? 'Examen încheiat' : `${daysLeft} ${daysLeft === 1 ? 'zi' : 'zile'} până la examen`}
              </div>
              <div className="text-[11px] font-semibold" style={{ color: theme.text3 }}>
                Notă țintă {plan.targetGrade} · {doneCount}/{totalCount} sesiuni bifate
              </div>
            </div>
          </button>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <button
              onClick={() => setSetupOpen(true)}
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ color: theme.text3 }}
              aria-label="Editează planul"
              title="Editează planul"
            >
              <Pencil size={13} />
            </button>
            {examPast && (
              <button
                onClick={handleDelete}
                className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ color: theme.danger }}
                aria-label="Șterge planul"
                title="Șterge planul"
              >
                <Trash2 size={13} />
              </button>
            )}
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ color: theme.text3 }}
              aria-label={expanded ? 'Restrânge' : 'Extinde'}
            >
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>
        </div>

        {!examPast && totalCount > 0 && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: theme.surface2 }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.round((doneCount / totalCount) * 100)}%`, background: theme.accent }}
            />
          </div>
        )}

        {newDocsCount > 0 && (
          <button
            onClick={() => setSetupOpen(true)}
            className="mt-3 flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-semibold"
            style={{ background: theme.surface2, color: theme.text2 }}
          >
            <span>Ai adăugat {newDocsCount === 1 ? 'un document nou' : `${newDocsCount} documente noi`} — planul nu {newDocsCount === 1 ? 'îl' : 'le'} include încă.</span>
            <span style={{ color: theme.accent }}>Actualizează</span>
          </button>
        )}

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-2">
                {plan.sessions.map((session) => (
                  <ExamPlanSessionRow key={session.id} folderId={folder.id} session={session} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {setupOpen && <ExamPlanSetupModal folder={folder} chapters={chapters} onClose={() => setSetupOpen(false)} />}
    </>
  );
}
