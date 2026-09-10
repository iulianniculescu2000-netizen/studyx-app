/** Set an exam date + target grade for a Knowledge Vault folder and preview/confirm the generated study plan — mirrors ExamSplitModal.tsx's chrome and date-input pattern. */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Check, Trash2, X } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useAIStore, type AILibraryFolder } from '../store/aiStore';
import { useToastStore } from '../store/toastStore';
import Portal from './Portal';
import { daysUntil } from '../lib/examSplit';
import { buildStudyPlan, toExamPlan, mergeExamPlanProgress } from '../lib/studyPlan';
import type { AggregatedChapter } from '../lib/ai/folderChapters';

interface Props {
  folder: AILibraryFolder;
  chapters: AggregatedChapter[];
  onClose: () => void;
}

const GRADES = [5, 6, 7, 8, 9, 10];
const SESSION_DATE_FMT = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short' });

function defaultExamDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 21);
  return d.toISOString().slice(0, 10);
}

function passLabel(kind: 'first-pass' | 'recap', passIndex: number): string {
  return kind === 'first-pass' ? 'Prima trecere' : `Recapitulare ${passIndex}`;
}

export default function ExamPlanSetupModal({ folder, chapters, onClose }: Props) {
  const theme = useTheme();
  const setFolderExamPlan = useAIStore((state) => state.setFolderExamPlan);
  const addToast = useToastStore((state) => state.addToast);

  const [examDateStr, setExamDateStr] = useState(folder.examPlan?.examDate ?? defaultExamDate());
  const [targetGrade, setTargetGrade] = useState(folder.examPlan?.targetGrade ?? 9);

  const examDate = useMemo(() => new Date(`${examDateStr}T12:00:00`), [examDateStr]);
  const days = useMemo(() => daysUntil(examDate), [examDate]);
  const plan = useMemo(() => buildStudyPlan(chapters, examDate, targetGrade), [chapters, examDate, targetGrade]);

  const canConfirm = chapters.length >= 1;

  const handleConfirm = () => {
    if (!canConfirm) return;
    const generateId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    const persisted = toExamPlan(plan, examDate, targetGrade, generateId);
    const merged = mergeExamPlanProgress(persisted, folder.examPlan);
    setFolderExamPlan(folder.id, merged);
    addToast(`Plan de examen creat — ${plan.sessions.length} sesiuni până pe ${SESSION_DATE_FMT.format(examDate)}.`, 'success', 5000);
    onClose();
  };

  const handleDelete = () => {
    setFolderExamPlan(folder.id, null);
    addToast('Planul de examen a fost șters.', 'info');
    onClose();
  };

  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        className="fixed top-[6%] left-1/2 z-50 w-full max-w-lg -translate-x-1/2 px-4"
      >
        <div
          className="max-h-[86vh] overflow-y-auto rounded-3xl p-6 shadow-2xl"
          style={{ background: theme.isDark ? 'rgba(22,22,26,0.98)' : 'rgba(255,255,255,0.98)', border: `1px solid ${theme.border}` }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays size={16} style={{ color: theme.accent }} />
              <span className="text-sm font-bold" style={{ color: theme.text }}>Plan de examen — {folder.name}</span>
            </div>
            <button onClick={onClose} style={{ color: theme.text3 }}><X size={16} /></button>
          </div>

          {chapters.length === 0 ? (
            <p className="text-sm" style={{ color: theme.text3 }}>
              Folderul „{folder.name}" nu are încă niciun capitol detectat — adaugă documente și așteaptă indexarea lor.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-xs" style={{ color: theme.text3 }}>
                Împart cele <b style={{ color: theme.text2 }}>{chapters.length}</b> capitole din „{folder.name}" într-un
                plan de studiu, spre data examenului. Grilele/flashcardurile se generează manual, capitol cu capitol.
              </p>

              <div>
                <label className="mb-1 block text-xs font-medium" style={{ color: theme.text2 }}>Data examenului</label>
                <input
                  type="date"
                  lang="ro-RO"
                  value={examDateStr}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setExamDateStr(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: theme.surface2, border: `1px solid ${theme.border}`, color: theme.text, outline: 'none' }}
                />
                {/* Native date inputs render day/month order per the OS locale — spell the
                    parsed date out in words to remove the ambiguity (same reasoning as ExamSplitModal). */}
                <p className="mt-1.5 text-[11px] font-semibold" style={{ color: theme.accent }}>
                  → {new Intl.DateTimeFormat('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(examDate)}
                </p>
                <p className="mt-0.5 text-[11px]" style={{ color: theme.text3 }}>{days} zile rămase</p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium" style={{ color: theme.text2 }}>
                  Notă țintă — cu cât e mai mare, cu atât planul are mai multe recapitulări
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {GRADES.map((grade) => (
                    <button
                      key={grade}
                      onClick={() => setTargetGrade(grade)}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                      style={{
                        background: targetGrade === grade ? theme.accent : theme.surface2,
                        color: targetGrade === grade ? '#fff' : theme.text3,
                      }}
                    >
                      {grade}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-xl p-3" style={{ background: theme.surface2 }}>
                {plan.sessions.map((session) => (
                  <div key={session.index} className="flex items-center justify-between text-xs">
                    <span style={{ color: theme.text2 }}>{passLabel(session.kind, session.passIndex)}</span>
                    <span style={{ color: theme.text3 }}>
                      {session.chapters.length} {session.chapters.length === 1 ? 'capitol' : 'capitole'} · {SESSION_DATE_FMT.format(session.date)}
                    </span>
                  </div>
                ))}
                {plan.warnings.includes('dense-schedule') && (
                  <p className="pt-1 text-[10.5px] font-medium" style={{ color: theme.warning }}>
                    Multe capitole pentru puține zile — unele sesiuni combină mai multe capitole.
                  </p>
                )}
                {plan.warnings.includes('exam-imminent') && (
                  <p className="pt-1 text-[10.5px] font-medium" style={{ color: theme.warning }}>
                    Examenul e foarte aproape — o singură sesiune, fără recapitulare.
                  </p>
                )}
              </div>

              <motion.button
                onClick={handleConfirm}
                whileTap={{ scale: 0.98 }}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white"
                style={{ background: theme.accent }}
              >
                <Check size={14} /> {folder.examPlan ? 'Actualizează planul' : `Creează ${plan.sessions.length} sesiuni`}
              </motion.button>

              {folder.examPlan && (
                <button
                  onClick={handleDelete}
                  className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold"
                  style={{ color: theme.danger }}
                >
                  <Trash2 size={12} /> Șterge planul
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </Portal>
  );
}
