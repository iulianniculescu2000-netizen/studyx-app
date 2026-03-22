import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Sparkles, BookOpen, FolderOpen,
  Play, CreditCard, RefreshCw, BarChart3, StickyNote, Search,
  Keyboard, Check, ArrowRight, Bot } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useTutorialStore, TOTAL_STEPS } from '../store/tutorialStore';
import { useNavigate } from 'react-router-dom';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  target?: string;         // CSS selector for spotlight target
  targetPadding?: number;  // px padding around target
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  navigateTo?: string;     // Route to navigate to before showing step
  accentColor?: string;    // Override accent color for step
}

const STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Bun venit în StudyX! 🎓',
    description: 'StudyX este platforma ta de studiu inteligent. Grile interactive, flashcarduri cu repetare spațiată, statistici detaliate și mult mai mult. Hai să explorăm împreună!',
    icon: <Sparkles size={22} />,
    tooltipPosition: 'center',
    accentColor: '#0A84FF',
  },
  {
    id: 'sidebar',
    title: 'Navigarea principală',
    description: 'Bara laterală îți dă acces la toate secțiunile: Dashboard, Grile, Recapitulare, Statistici, Flashcarduri și Notițe. O poți restrânge pentru mai mult spațiu.',
    icon: <FolderOpen size={22} />,
    target: '[data-tutorial="sidebar"]',
    targetPadding: 8,
    tooltipPosition: 'right',
    navigateTo: '/',
  },
  {
    id: 'create_quiz',
    title: 'Creează prima ta grilă',
    description: 'Apasă "Grilă nouă" pentru a crea o grilă de la zero. Adaugă un titlu, descriere, emoji și culoare. Poți adăuga oricâte întrebări vrei, cu răspunsuri multiple sau unice.',
    icon: <BookOpen size={22} />,
    target: '[data-tutorial="btn-new-quiz"]',
    targetPadding: 6,
    tooltipPosition: 'bottom',
    navigateTo: '/',
    accentColor: '#30D158',
  },
  {
    id: 'import_quiz',
    title: 'Import rapid din JSON',
    description: 'Ai deja grile pregătite? Importă-le instant din fișiere JSON. Găsești șabloanele în folderul SABLON/ din aplicație — simplu și rapid.',
    icon: <ArrowRight size={22} />,
    target: '[data-tutorial="btn-import"]',
    targetPadding: 6,
    tooltipPosition: 'bottom',
    navigateTo: '/',
    accentColor: '#FF9F0A',
  },
  {
    id: 'folders',
    title: 'Organizează în foldere',
    description: 'Creează foldere pentru fiecare materie (Anatomie, Fiziologie etc.). Fiecare folder are emoji și culoare proprie. Click pe "+" din sidebar pentru a adăuga un folder nou.',
    icon: <FolderOpen size={22} />,
    target: '[data-tutorial="sidebar-folders"]',
    targetPadding: 8,
    tooltipPosition: 'right',
    navigateTo: '/',
    accentColor: '#FF9F0A',
  },
  {
    id: 'play_modes',
    title: 'Moduri de studiu',
    description: 'Fiecare grilă poate fi jucată în 3 moduri:\n🎓 Studiu — cu feedback imediat și explicații\n📝 Examen — fără feedback, la final afli scorul\n⏱ Cronometrat — 30 secunde per întrebare',
    icon: <Play size={22} />,
    tooltipPosition: 'center',
    navigateTo: '/',
    accentColor: '#5E5CE6',
  },
  {
    id: 'flashcards',
    title: 'Flashcarduri inteligente ✨',
    description: 'Secțiunea Flashcarduri transformă fiecare grilă într-un deck de carduri. Algoritmul SM-2 decide ce cărți să repeți și când — studiezi eficient, nu mult.',
    icon: <CreditCard size={22} />,
    target: '[data-tutorial="nav-flashcards"]',
    targetPadding: 6,
    tooltipPosition: 'right',
    navigateTo: '/flashcards',
    accentColor: '#BF6FFF',
  },
  {
    id: 'flashcard_session',
    title: 'Cum funcționează un deck',
    description: 'Răspunde la fiecare card, întoarce-l să vezi răspunsul corect, apoi evaluează-te: Ușor, Ok sau Greu. Algoritmul planifică automat recapitularea viitoare.',
    icon: <CreditCard size={22} />,
    target: '[data-tutorial="flashcard-hub"]',
    targetPadding: 10,
    tooltipPosition: 'bottom',
    navigateTo: '/flashcards',
    accentColor: '#BF6FFF',
  },
  {
    id: 'review',
    title: 'Repetare spațiată (SM-2)',
    description: 'Algoritmul SM-2 urmărește ce întrebări știi și ce nu știi, și le programează la intervale optime: 1zi → 3zile → 7zile → 14zile → 30zile. Memorezi pe termen lung!',
    icon: <RefreshCw size={22} />,
    target: '[data-tutorial="nav-review"]',
    targetPadding: 6,
    tooltipPosition: 'right',
    navigateTo: '/',
    accentColor: '#FF9F0A',
  },
  {
    id: 'stats',
    title: 'Statistici și realizări',
    description: 'Urmărește progresul tău: streak zilnic, acuratețe per grilă, heatmap activitate și realizări deblocabile. Cu cât studiezi mai mult, cu atât se completează mai mult.',
    icon: <BarChart3 size={22} />,
    target: '[data-tutorial="nav-stats"]',
    targetPadding: 6,
    tooltipPosition: 'right',
    navigateTo: '/stats',
    accentColor: '#32D74B',
  },
  {
    id: 'notes',
    title: 'Notițe personale',
    description: 'Adaugă notițe la orice întrebare în timp ce studiezi — apar după ce răspunzi. Toate notițele sunt grupate în secțiunea Notițe pentru revizuire rapidă.',
    icon: <StickyNote size={22} />,
    target: '[data-tutorial="nav-notes"]',
    targetPadding: 6,
    tooltipPosition: 'right',
    navigateTo: '/notes',
    accentColor: '#FFD60A',
  },
  {
    id: 'search',
    title: 'Căutare globală',
    description: 'Apasă Ctrl+K oricând pentru a căuta instantaneu în toate grilele și întrebările tale. Rezultatele apar în timp real — navighezi rapid oriunde.',
    icon: <Search size={22} />,
    target: '[data-tutorial="global-search"]',
    targetPadding: 8,
    tooltipPosition: 'bottom',
    navigateTo: '/',
    accentColor: '#64D2FF',
  },
  {
    id: 'ai_setup',
    title: 'AI integrat — Groq gratuit 🤖',
    description: 'StudyX are AI integrat! Poți:\n🧠 Genera grile automat din text/PDF\n💬 Chatea cu AI despre orice grilă\n🔍 Explica greșelile cu AI\n\nPentru a activa: click pe butonul "AI (Groq)" din sidebar → obține o cheie gratuită la console.groq.com → lipiți cheia → Salvează. 14.400 req/zi gratuit!',
    icon: <Bot size={22} />,
    target: '[data-tutorial="ai-settings-btn"]',
    targetPadding: 6,
    tooltipPosition: 'right',
    navigateTo: '/',
    accentColor: '#BF6FFF',
  },
  {
    id: 'shortcuts',
    title: 'Scurtături & finalizare 🚀',
    description: 'Apasă ? oricând pentru scurtăturile de tastatură. G+H=Dashboard, G+Q=Grile, N=Grilă nouă. StudyX e gata de folosit — succes la studiu!',
    icon: <Keyboard size={22} />,
    tooltipPosition: 'center',
    accentColor: '#0A84FF',
  },
];

interface SpotlightRect {
  top: number; left: number; width: number; height: number;
}

function useSpotlight(selector: string | undefined, padding = 8) {
  const [rect, setRect] = useState<SpotlightRect | null>(null);

  useEffect(() => {
    if (!selector) { setRect(null); return; }

    let current: HTMLElement | null = null;
    let ro: ResizeObserver | null = null;

    const detach = () => {
      if (current) {
        current.style.filter = '';
        current.style.transition = '';
        current = null;
      }
      ro?.disconnect();
      ro = null;
    };

    const attach = (el: HTMLElement) => {
      detach();
      current = el;
      // Boost brightness so the element pops through the overlay
      el.style.transition = 'filter 0.3s ease';
      el.style.filter = 'brightness(1.5) saturate(1.1)';
      ro = new ResizeObserver(snap);
      ro.observe(el);
      snap();
    };

    const snap = () => {
      if (!current) return;
      const r = current.getBoundingClientRect();
      setRect({
        top: r.top - padding,
        left: r.left - padding,
        width: r.width + padding * 2,
        height: r.height + padding * 2,
      });
    };

    // Retry loop: element may not be in DOM yet right after route navigation
    const tick = () => {
      const found = document.querySelector(selector) as HTMLElement | null;
      if (found && found !== current) {
        attach(found);
      } else if (!found && current) {
        detach();
        setRect(null);
      } else {
        snap();
      }
    };

    tick();
    const t = setInterval(tick, 200);
    window.addEventListener('resize', snap);

    return () => {
      detach();
      clearInterval(t);
      window.removeEventListener('resize', snap);
    };
  }, [selector, padding]);

  return rect;
}

function TooltipArrow({ position }: { position: string }) {
  const theme = useTheme();
  if (position === 'center') return null;
  const styles: Record<string, React.CSSProperties> = {
    right: { left: -8, top: '50%', transform: 'translateY(-50%)', borderRight: `8px solid ${theme.modalBg}`, borderTop: '8px solid transparent', borderBottom: '8px solid transparent' },
    left: { right: -8, top: '50%', transform: 'translateY(-50%)', borderLeft: `8px solid ${theme.modalBg}`, borderTop: '8px solid transparent', borderBottom: '8px solid transparent' },
    bottom: { top: -8, left: '50%', transform: 'translateX(-50%)', borderBottom: `8px solid ${theme.modalBg}`, borderLeft: '8px solid transparent', borderRight: '8px solid transparent' },
    top: { bottom: -8, left: '50%', transform: 'translateX(-50%)', borderTop: `8px solid ${theme.modalBg}`, borderLeft: '8px solid transparent', borderRight: '8px solid transparent' },
  };
  return <div style={{ position: 'absolute', width: 0, height: 0, ...styles[position] }} />;
}

function getTooltipStyle(position: string, rect: SpotlightRect | null): React.CSSProperties {
  const GAP = 16;
  const TW = 340; // tooltip width
  const TH = 300; // max estimated tooltip height
  const VW = window.innerWidth;
  const VH = window.innerHeight;
  const PAD = 12; // min distance from viewport edges

  if (!rect || position === 'center') {
    return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 380 };
  }

  // Clamp horizontal center position
  const clampLeft = (rawLeft: number) =>
    Math.max(PAD, Math.min(rawLeft, VW - TW - PAD));

  switch (position) {
    case 'right': {
      const left = rect.left + rect.width + GAP;
      const top = Math.max(PAD, Math.min(rect.top + rect.height / 2, VH - TH - PAD));
      // Flip to left if not enough room on right
      if (left + TW > VW - PAD) {
        return { position: 'fixed', right: VW - (rect.left - GAP), top, transform: 'translateY(-50%)', width: TW };
      }
      return { position: 'fixed', left, top, transform: 'translateY(-50%)', width: TW };
    }
    case 'left': {
      const right = VW - (rect.left - GAP);
      const top = Math.max(PAD, Math.min(rect.top + rect.height / 2, VH - TH - PAD));
      return { position: 'fixed', right, top, transform: 'translateY(-50%)', width: TW };
    }
    case 'bottom': {
      const rawTop = rect.top + rect.height + GAP;
      const rawLeft = clampLeft(rect.left + rect.width / 2 - TW / 2);
      // Flip to top if tooltip would go off the bottom
      if (rawTop + TH > VH - PAD) {
        const topPos = Math.max(PAD, rect.top - GAP - TH);
        return { position: 'fixed', top: topPos, left: rawLeft, width: TW };
      }
      return { position: 'fixed', top: rawTop, left: rawLeft, width: TW };
    }
    case 'top': {
      const rawBottom = VH - (rect.top - GAP);
      const rawLeft = clampLeft(rect.left + rect.width / 2 - TW / 2);
      // Flip to bottom if tooltip would go off the top
      if (rect.top - GAP - TH < PAD) {
        return { position: 'fixed', top: rect.top + rect.height + GAP, left: rawLeft, width: TW };
      }
      return { position: 'fixed', bottom: rawBottom, left: rawLeft, width: TW };
    }
    default:
      return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 380 };
  }
}

export default function Tutorial({ profileId }: { profileId: string }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const { active, currentStep, nextStep, prevStep, skipTutorial, completeTutorial } = useTutorialStore();
  const skip = () => skipTutorial(profileId);
  const complete = () => completeTutorial(profileId);

  const step = STEPS[Math.min(currentStep, STEPS.length - 1)];
  const rect = useSpotlight(step?.target, step?.targetPadding ?? 8);
  const accentColor = step?.accentColor ?? theme.accent;
  const isLast = currentStep === TOTAL_STEPS - 1;
  const isFirst = currentStep === 0;

  // Navigate when step changes
  useEffect(() => {
    if (!active || !step?.navigateTo) return;
    navigate(step.navigateTo);
  }, [active, currentStep]);

  if (!active || !step) return null;

  const tooltipPos = step.tooltipPosition ?? 'right';
  const tooltipStyle = getTooltipStyle(tooltipPos, rect);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[500] pointer-events-none">
        {/* Click blocker — clicking dark area advances tutorial */}
        <div
          className="absolute inset-0 pointer-events-auto"
          onClick={isLast ? complete : nextStep}
          style={{ cursor: 'default' }}
        />

        {/* SVG overlay — true mask cutout so spotlighted element is 100% clear */}
        <motion.svg
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 pointer-events-none"
          style={{ width: '100%', height: '100%' }}
        >
          {rect ? (
            <>
              <defs>
                <mask id="spotlight-mask">
                  <rect x="0" y="0" width="100%" height="100%" fill="white" />
                  <rect
                    x={rect.left} y={rect.top}
                    width={rect.width} height={rect.height}
                    rx="14" ry="14"
                    fill="black"
                  />
                </mask>
              </defs>
              <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.72)" mask="url(#spotlight-mask)" />
            </>
          ) : (
            <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.72)" />
          )}
        </motion.svg>

        {/* Spotlight border + pulsing ring */}
        {rect && (
          <motion.div
            key={`spot-${step.id}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute pointer-events-none"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              borderRadius: 14,
              zIndex: 2,
              border: `2px solid ${accentColor}90`,
              boxShadow: `0 0 0 1px ${accentColor}40, 0 0 24px ${accentColor}50`,
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.06, 1], opacity: [0.5, 0.15, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-[14px]"
              style={{ border: `2px solid ${accentColor}`, boxShadow: `0 0 20px ${accentColor}50` }}
            />
          </motion.div>
        )}

        {/* Tooltip card */}
        <motion.div
          key={`tooltip-${step.id}`}
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          style={{
            ...tooltipStyle,
            background: theme.modalBg,
            border: `1px solid ${accentColor}40`,
            borderRadius: 20,
            boxShadow: `0 24px 64px rgba(0,0,0,0.45), 0 0 0 1px ${accentColor}20, 0 4px 16px ${accentColor}20`,
            zIndex: 501,
            pointerEvents: 'auto',
          }}
          className="overflow-hidden"
        >
          <TooltipArrow position={tooltipPos} />

          {/* Accent top bar */}
          <div style={{ height: 3, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}55)` }} />

          <div className="p-5">
            {/* Step counter */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: `${accentColor}20`, color: accentColor }}>
                  {step.icon}
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: accentColor }}>
                  Pas {currentStep + 1} din {TOTAL_STEPS}
                </span>
              </div>
              <button onClick={skip}
                className="p-1.5 rounded-lg transition-all"
                style={{ color: theme.text3, background: theme.surface2 }}>
                <X size={13} />
              </button>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1 rounded-full mb-4" style={{ background: theme.surface2 }}>
              <motion.div
                className="h-full rounded-full"
                animate={{ width: `${((currentStep + 1) / TOTAL_STEPS) * 100}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}99)` }}
              />
            </div>

            {/* Content */}
            <h3 className="text-base font-bold mb-2 leading-snug" style={{ color: theme.text }}>
              {step.title}
            </h3>
            <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: theme.text2 }}>
              {step.description}
            </p>

            {/* Step dots */}
            <div className="flex items-center justify-center gap-1.5 my-4">
              {STEPS.map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    width: i === currentStep ? 20 : 6,
                    opacity: i === currentStep ? 1 : i < currentStep ? 0.5 : 0.25,
                  }}
                  transition={{ duration: 0.25 }}
                  className="h-1.5 rounded-full"
                  style={{ background: i <= currentStep ? accentColor : theme.text3 }}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  onClick={prevStep}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm"
                  style={{ background: theme.surface2, color: theme.text3 }}>
                  <ChevronLeft size={14} />Înapoi
                </button>
              )}
              <motion.button
                onClick={isLast ? complete : nextStep}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` }}>
                {isLast
                  ? <><Check size={15} />Terminat!</>
                  : <>{isFirst ? 'Să începem' : 'Continuă'}<ChevronRight size={15} /></>}

              </motion.button>
            </div>

            {/* Skip link */}
            {!isLast && (
              <button onClick={skip}
                className="w-full text-center text-xs mt-2 opacity-40 hover:opacity-60 transition-opacity"
                style={{ color: theme.text3 }}>
                Sari peste tutorial
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
