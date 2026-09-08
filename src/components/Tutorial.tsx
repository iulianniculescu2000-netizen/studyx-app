import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Sparkles, BookOpen, FolderOpen,
  Play, CreditCard, RefreshCw, BarChart3, StickyNote, Search,
  Keyboard, Check, ArrowRight, Bot, Database, Brain,
  TrendingUp, Timer } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useTutorialStore, TOTAL_STEPS } from '../store/tutorialStore';
import { useNavigate } from 'react-router-dom';
import { useViewportProfile } from '../hooks/useViewportProfile';
import { useOverlayFlag } from '../hooks/useOverlayFlag';

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
    description: 'StudyX este platforma ta de studiu inteligent pentru Medicină: grile interactive, flashcarduri cu repetare spațiată, o bibliotecă AI care citește cursurile tale și un agent care execută comenzi. Tur complet — durează 2 minute.',
    icon: <Sparkles size={22} />,
    tooltipPosition: 'center',
    accentColor: '#0A84FF',
  },
  {
    id: 'sidebar',
    title: 'Navigarea principală',
    description: 'Bara laterală îți dă acces la toate secțiunile: Dashboard, Grile, Recapitulare, Bibliotecă AI, Statistici, Flashcarduri și Notițe. O poți restrânge pentru mai mult spațiu.',
    icon: <FolderOpen size={22} />,
    target: '[data-tutorial="sidebar"]',
    targetPadding: 8,
    tooltipPosition: 'right',
    navigateTo: '/',
  },
  {
    id: 'create_quiz',
    title: 'Creează prima ta grilă',
    description: 'Apasă "Grilă nouă" pentru a crea o grilă de la zero. Adaugă un titlu, descriere, emoji și culoare. Poți adăuga oricâte întrebări vrei, cu răspunsuri multiple sau unice — sau lași AI-ul să le genereze din text.',
    icon: <BookOpen size={22} />,
    target: '[data-tutorial="btn-new-quiz"]',
    targetPadding: 6,
    tooltipPosition: 'bottom',
    navigateTo: '/',
    accentColor: '#30D158',
  },
  {
    id: 'import_quiz',
    title: 'Import de grile — trei căi',
    description: 'Ai deja grile? Trei opțiuni: 📄 fișier JSON gata pregătit, sau 🤖 „AI extern" — copiezi un prompt, îl lipești în ChatGPT/Gemini gratuit, apoi lipești răspunsul înapoi aici. Fără cotă internă, fără să atingi vreun fișier.',
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
    description: 'Creează foldere (și subfoldere) pentru fiecare materie: Anatomie, Fiziologie etc. Fiecare folder are emoji și culoare proprie. Click pe "+" din sidebar pentru a adăuga un folder nou.',
    icon: <FolderOpen size={22} />,
    target: '[data-tutorial="sidebar-folders"]',
    targetPadding: 8,
    tooltipPosition: 'right',
    navigateTo: '/',
    accentColor: '#FF9F0A',
  },
  {
    id: 'quiz_management',
    title: 'Organizare rapidă a grilelor',
    description: 'Din lista de grile poți: 📌 fixa sus grilele importante, 🗄️ arhiva ce nu mai folosești, 📋 duplica o grilă ca punct de plecare pentru una nouă, sau selecta mai multe grile odată pentru mutare/ștergere în masă.',
    icon: <BookOpen size={22} />,
    tooltipPosition: 'center',
    navigateTo: '/quizzes',
    accentColor: '#30D158',
  },
  {
    id: 'play_modes',
    title: 'Moduri de studiu',
    description: 'Fiecare grilă poate fi jucată în mai multe moduri:\n🎓 Studiu — cu feedback imediat și explicații\n📝 Examen — fără feedback, la final afli scorul\n⏱ Cronometrat — timp limitat per întrebare\n⚕️ Mod Rezidențiat — penalizare pentru răspuns greșit, ca la examen',
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
    description: 'Algoritmul SM-2 urmărește ce întrebări știi și ce nu știi, și le programează la intervale optime: 1zi → 3zile → 7zile → 14zile → 30zile. Memorezi pe termen lung, nu doar pentru mâine!',
    icon: <RefreshCw size={22} />,
    target: '[data-tutorial="nav-review"]',
    targetPadding: 6,
    tooltipPosition: 'right',
    navigateTo: '/',
    accentColor: '#FF9F0A',
  },
  {
    id: 'daily_review',
    title: 'Sesiunea zilnică',
    description: 'Un singur click grupează tot ce ai de recapitulat azi — din toate grilele — într-o singură sesiune scurtă. E cel mai rapid mod de a rămâne la zi, în fiecare zi.',
    icon: <Brain size={22} />,
    target: '[data-tutorial="nav-daily-review"]',
    targetPadding: 6,
    tooltipPosition: 'right',
    navigateTo: '/',
    accentColor: '#0A84FF',
  },
  {
    id: 'vault',
    title: 'Biblioteca AI — creierul din spate',
    description: 'Încarci cursuri (PDF, DOCX, poze cu OCR) și AI-ul le indexează automat. De acolo, orice răspuns al AI-ului e ancorat exact în cursurile tale — nu inventează, citează sursa și procentul de relevanță.',
    icon: <Database size={22} />,
    target: '[data-tutorial="nav-vault"]',
    targetPadding: 6,
    tooltipPosition: 'right',
    navigateTo: '/',
    accentColor: '#64D2FF',
  },
  {
    id: 'ai_chat',
    title: 'Chat AI + Agent — spune-i ce vrei',
    description: 'Scrie „fă-mi 3 pachete din cursul 4 și pune-le în folderul Mielom" — agentul planifică, execută fiecare pas vizibil și poate fi anulat oricând. Iar dacă a înțeles greșit un detaliu (nr. de întrebări, dificultate), îl corectezi direct din cardul de confirmare, înainte să apeși Confirmă.',
    icon: <Bot size={22} />,
    target: '[data-tutorial="ai-chat-button"]',
    targetPadding: 8,
    tooltipPosition: 'left',
    navigateTo: '/',
    accentColor: '#BF6FFF',
  },
  {
    id: 'ai_setup',
    title: 'Activează AI-ul — gratuit, cu toate cele trei chei',
    description: 'StudyX merge pe patru provideri gratuiți: Groq (foarte rapid), Google Gemini, Cerebras (1.000.000 tokeni/zi) și NVIDIA NIM. Din Setări → AI lipești cheile — fără card, doar cu un cont. Pune-le pe toate patru: fiecare are limita ei zilnică, iar când una se termină aplicația trece automat pe următoarea și continuă de unde ai rămas.',
    icon: <Bot size={22} />,
    target: '[data-tutorial="nav-settings"]',
    targetPadding: 6,
    tooltipPosition: 'right',
    navigateTo: '/',
    accentColor: '#BF6FFF',
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
    id: 'analytics_gamification',
    title: 'Predicții reale + progres vs. tine',
    description: 'Analiza predictivă îți arată lacunele calculate din statisticile tale reale, nu exemple fixe. Iar în Gamification, competiția e cu tine din trecut — azi vs. ieri, media săptămânii, cel mai bun scor — nu cu useri ficțiuni.',
    icon: <TrendingUp size={22} />,
    tooltipPosition: 'center',
    navigateTo: '/',
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
    description: 'Apasă Ctrl+K oricând pentru a căuta instantaneu în toate grilele și întrebările tale. Rezultatele sunt ordonate după relevanță — cele mai bune potriviri apar primele.',
    icon: <Search size={22} />,
    target: '[data-tutorial="global-search"]',
    targetPadding: 8,
    tooltipPosition: 'bottom',
    navigateTo: '/',
    accentColor: '#64D2FF',
  },
  {
    id: 'focus_pomodoro',
    title: 'Pomodoro & Mod Focus',
    description: 'Timer Pomodoro integrat pentru sesiuni cronometrate, plus Mod Focus care ascunde tot ce distrage (sidebar, notificări) când chiar trebuie să te concentrezi.',
    icon: <Timer size={22} />,
    tooltipPosition: 'center',
    navigateTo: '/',
    accentColor: '#FF9F0A',
  },
  {
    id: 'profiles',
    title: 'Profiluri multiple',
    description: 'Studiezi cu un coleg pe același calculator? Fiecare persoană își poate crea propriul profil — grile, statistici, streak și progres complet separate, fără să se amestece.',
    icon: <Sparkles size={22} />,
    tooltipPosition: 'center',
    navigateTo: '/',
    accentColor: '#5E5CE6',
  },
  {
    id: 'backup',
    title: 'Backup — datele tale sunt în siguranță',
    description: 'Din Setări poți exporta oricând un backup complet (grile, statistici, progres) și îl poți importa înapoi pe alt calculator. Aplicația face și auto-backup periodic, ca să nu pierzi nimic.',
    icon: <Database size={22} />,
    target: '[data-tutorial="nav-settings"]',
    targetPadding: 6,
    tooltipPosition: 'right',
    navigateTo: '/',
    accentColor: '#64D2FF',
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
    let current: HTMLElement | null = null;
    let ro: ResizeObserver | null = null;
    let mo: MutationObserver | null = null;

    // Center steps (no selector) never read `rect` — the hook's return coerces it to null —
    // so there's nothing to reset here.
    if (!selector) return;

    const detach = () => {
      current = null;
      ro?.disconnect();
      ro = null;
      mo?.disconnect();
      mo = null;
    };

    // Remember the last committed rect so snap() only calls setRect when the geometry actually
    // moved. Without this guard, every re-measure pushed a new object and re-rendered.
    let lastRect: SpotlightRect | null = null;
    const nearlyEqual = (a: SpotlightRect | null, b: SpotlightRect | null) => {
      if (a === b) return true;
      if (!a || !b) return false;
      return (
        Math.abs(a.top - b.top) < 0.5 &&
        Math.abs(a.left - b.left) < 0.5 &&
        Math.abs(a.width - b.width) < 0.5 &&
        Math.abs(a.height - b.height) < 0.5
      );
    };

    const commit = (next: SpotlightRect | null) => {
      if (nearlyEqual(next, lastRect)) return;
      lastRect = next;
      setRect(next);
    };

    const snap = () => {
      if (!current) return;
      const r = current.getBoundingClientRect();
      // A found-but-scrolled-off-screen target (e.g. a button below the fold) would put the
      // spotlight and tooltip outside the viewport, leaving only the dark overlay visible.
      // Treat that as "no anchor" so the tooltip falls back to a centered, always-visible card.
      const fullyOffscreen =
        r.bottom <= 0 || r.top >= window.innerHeight || r.right <= 0 || r.left >= window.innerWidth;
      if (fullyOffscreen || (r.width === 0 && r.height === 0)) {
        commit(null);
        return;
      }
      commit({
        top: r.top - padding,
        left: r.left - padding,
        width: r.width + padding * 2,
        height: r.height + padding * 2,
      });
    };

    const attach = (el: HTMLElement) => {
      detach();
      current = el;
      // The SVG mask already cuts a fully-undimmed hole around the target, and the
      // pulsing ring border (rendered separately) signals focus — an extra CSS
      // brightness/saturate boost on top of that was pushing already-colorful
      // elements (gradient nav pills) into a garish, oversaturated look.
      ro = new ResizeObserver(snap);
      ro.observe(el);
      // Only scroll if the target isn't already comfortably in view — and do it instantly, so
      // the spotlight doesn't have to chase a smooth-scrolling target (that chase was the jitter).
      const r = el.getBoundingClientRect();
      const partlyOffscreen = r.top < 0 || r.bottom > window.innerHeight;
      if (partlyOffscreen) {
        try {
          el.scrollIntoView({ block: 'center', inline: 'nearest' });
        } catch {
          /* scrollIntoView options unsupported — ignore */
        }
      }
      snap();
    };

    const resolveTarget = () => {
      const found = document.querySelector(selector) as HTMLElement | null;
      if (found && found !== current) {
        attach(found);
      } else if (!found) {
        detach();
        commit(null);
      } else {
        snap();
      }
    };

    resolveTarget();
    requestAnimationFrame(resolveTarget);
    setTimeout(resolveTarget, 180);
    // Watch only for elements being added/removed (so a target appears after navigation).
    // NOT attributes: framer-motion mutates inline styles every animation frame, which turned
    // this observer into a per-frame re-render loop — the "trembling" the user saw.
    mo = new MutationObserver(resolveTarget);
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', snap);
    window.addEventListener('scroll', snap, true);

    return () => {
      detach();
      window.removeEventListener('resize', snap);
      window.removeEventListener('scroll', snap, true);
    };
  }, [selector, padding]);

  return selector ? rect : null;
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

/**
 * `forceCenter` is set on narrow/short viewports: side-anchored placement assumes
 * desktop layout (room beside a target), which phones/small windows don't have —
 * so we always fall back to a single robust bottom-sheet-style placement there.
 */
function getTooltipStyle(position: string, rect: SpotlightRect | null, forceCenter: boolean): React.CSSProperties {
  const GAP = 16;
  const PAD = 12; // min distance from viewport edges
  const VW = window.innerWidth;
  const VH = window.innerHeight;
  // Fixed 340/380px widths overflowed narrow windows (the tooltip got clipped off-screen
  // instead of shrinking). Cap both to whatever actually fits the current viewport.
  const TW = Math.max(240, Math.min(340, VW - PAD * 2));
  const CENTER_W = Math.max(240, Math.min(380, VW - PAD * 2));
  // Every branch below clamps to this — a card taller than its slot scrolls
  // internally instead of running off the edge of the screen.
  const TH = Math.min(460, VH - PAD * 2);

  if (!rect || position === 'center' || forceCenter) {
    return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: CENTER_W, maxHeight: VH - PAD * 2, overflowY: 'auto' };
  }

  // Clamp horizontal center position
  const clampLeft = (rawLeft: number) =>
    Math.max(PAD, Math.min(rawLeft, VW - TW - PAD));

  // Side placements (left/right of target) need enough leftover width for the tooltip itself;
  // below a certain window width there just isn't room beside the target, so fall back to
  // stacking it under/over the target instead of letting it overflow the viewport edge.
  const sideRoomAvailable = VW - rect.width - GAP * 2 - PAD * 2 >= TW;

  switch (position) {
    case 'right': {
      if (!sideRoomAvailable) {
        const rawTop = rect.top + rect.height + GAP;
        const rawLeft = clampLeft(rect.left + rect.width / 2 - TW / 2);
        const top = rawTop + TH > VH - PAD ? Math.max(PAD, rect.top - GAP - TH) : rawTop;
        return { position: 'fixed', top, left: rawLeft, width: TW, maxHeight: TH, overflowY: 'auto' };
      }
      const left = rect.left + rect.width + GAP;
      const top = Math.max(PAD, Math.min(rect.top + rect.height / 2, VH - TH - PAD));
      // Flip to left if not enough room on right
      if (left + TW > VW - PAD) {
        return { position: 'fixed', right: VW - (rect.left - GAP), top, transform: 'translateY(-50%)', width: TW, maxHeight: TH, overflowY: 'auto' };
      }
      return { position: 'fixed', left, top, transform: 'translateY(-50%)', width: TW, maxHeight: TH, overflowY: 'auto' };
    }
    case 'left': {
      if (!sideRoomAvailable) {
        const rawTop = rect.top + rect.height + GAP;
        const rawLeft = clampLeft(rect.left + rect.width / 2 - TW / 2);
        const top = rawTop + TH > VH - PAD ? Math.max(PAD, rect.top - GAP - TH) : rawTop;
        return { position: 'fixed', top, left: rawLeft, width: TW, maxHeight: TH, overflowY: 'auto' };
      }
      const right = VW - (rect.left - GAP);
      const top = Math.max(PAD, Math.min(rect.top + rect.height / 2, VH - TH - PAD));
      return { position: 'fixed', right, top, transform: 'translateY(-50%)', width: TW, maxHeight: TH, overflowY: 'auto' };
    }
    case 'bottom': {
      const rawTop = rect.top + rect.height + GAP;
      const rawLeft = clampLeft(rect.left + rect.width / 2 - TW / 2);
      // Flip to top if tooltip would go off the bottom
      if (rawTop + TH > VH - PAD) {
        const topPos = Math.max(PAD, rect.top - GAP - TH);
        return { position: 'fixed', top: topPos, left: rawLeft, width: TW, maxHeight: TH, overflowY: 'auto' };
      }
      return { position: 'fixed', top: rawTop, left: rawLeft, width: TW, maxHeight: TH, overflowY: 'auto' };
    }
    case 'top': {
      const rawBottom = VH - (rect.top - GAP);
      const rawLeft = clampLeft(rect.left + rect.width / 2 - TW / 2);
      // Flip to bottom if tooltip would go off the top
      if (rect.top - GAP - TH < PAD) {
        return { position: 'fixed', top: rect.top + rect.height + GAP, left: rawLeft, width: TW, maxHeight: TH, overflowY: 'auto' };
      }
      return { position: 'fixed', bottom: rawBottom, left: rawLeft, width: TW, maxHeight: TH, overflowY: 'auto' };
    }
    default:
      return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: CENTER_W, maxHeight: VH - PAD * 2, overflowY: 'auto' };
  }
}

export default function Tutorial({ profileId }: { profileId: string }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const { active, currentStep, nextStep, prevStep, skipTutorial, completeTutorial } = useTutorialStore();
  useOverlayFlag(active);
  const skip = () => skipTutorial(profileId);
  const complete = () => completeTutorial(profileId);

  const step = STEPS[Math.min(currentStep, STEPS.length - 1)];
  const rect = useSpotlight(step?.target, step?.targetPadding ?? 8);
  const accentColor = step?.accentColor ?? theme.accent;
  const isLast = currentStep === TOTAL_STEPS - 1;
  const isFirst = currentStep === 0;

  // useViewportProfile (below) already re-renders this component on resize, which
  // keeps getTooltipStyle's window.innerWidth/innerHeight reads in sync — no
  // separate resize listener needed here.

  // Navigate when step changes
  useEffect(() => {
    if (!active || !step?.navigateTo) return;
    navigate(step.navigateTo);
  }, [active, currentStep, navigate, step?.navigateTo]);

  const { mobile, crampedHeight } = useViewportProfile();
  const compact = mobile || crampedHeight;

  if (!active || !step) return null;

  const tooltipPos = step.tooltipPosition ?? 'right';
  // Side-anchored placement assumes a desktop layout with room beside the target;
  // on phones/small windows there usually isn't any, so always use the robust
  // centered layout there instead of a cramped, possibly-clipped side card.
  const tooltipStyle = getTooltipStyle(tooltipPos, rect, compact);

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

        {/* Tooltip card.
            IMPORTANT: positioning lives on this plain div, not on the motion.div
            below. Framer Motion manages `transform` itself for any animated x/y/
            scale value — a static `transform: translate(-50%,-50%)` (needed to
            actually center the box, since top:50%/left:50% alone only aligns its
            top-left corner) gets silently overwritten by Framer's own transform
            once the enter/exit animation runs. Keeping position+transform here,
            and the enter/exit animation on a plain inner element, avoids that. */}
        <div
          key={`tooltip-pos-${step.id}`}
          style={{
            ...tooltipStyle,
            // Frosted glass card (same recipe as the rest of the app's modals/panels)
            // instead of a flat opaque rectangle — it reads as part of the same
            // design language rather than a sticker slapped over the dimmed scene.
            background: 'var(--glass-panel-strong)',
            backdropFilter: 'blur(24px) saturate(150%)',
            WebkitBackdropFilter: 'blur(24px) saturate(150%)',
            border: `1px solid ${accentColor}35`,
            borderRadius: compact ? 22 : 28,
            boxShadow: `0 32px 80px rgba(0,0,0,0.4), 0 0 0 1px ${accentColor}15, 0 8px 32px ${accentColor}15`,
            zIndex: 501,
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
          className="overflow-hidden"
        >
          <motion.div
            key={`tooltip-${step.id}`}
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: 'flex', flexDirection: 'column', width: '100%' }}
          >
          <TooltipArrow position={tooltipPos} />

          {/* Accent top bar */}
          <div style={{ height: 4, flexShrink: 0, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}44)` }} />

          <div className={compact ? 'p-5' : 'p-7'}>
            {/* Step counter */}
            <div className={`flex items-center justify-between ${compact ? 'mb-3.5' : 'mb-5'}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} flex-shrink-0 rounded-2xl flex items-center justify-center shadow-lg`}
                  style={{ background: `linear-gradient(135deg, ${accentColor}25, ${accentColor}10)`, color: accentColor, border: `1px solid ${accentColor}20` }}>
                  {step.icon}
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 truncate"
                  style={{ color: accentColor }}>
                  Pas {currentStep + 1} / {TOTAL_STEPS}
                </span>
              </div>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={skip}
                className="p-2 rounded-xl transition-all flex-shrink-0"
                style={{ color: theme.text3, background: theme.surface2, cursor: 'pointer' }}>
                <X size={14} />
              </motion.button>
            </div>

            {/* Progress bar — this + the "Pas X/Y" counter above already convey position,
                so a second dot-per-step indicator (unreadable at 22 steps anyway) was dropped. */}
            <div className={`w-full h-1.5 rounded-full ${compact ? 'mb-4' : 'mb-6'}`} style={{ background: theme.surface2 }}>
              <motion.div
                className="h-full rounded-full"
                animate={{ width: `${((currentStep + 1) / TOTAL_STEPS) * 100}%` }}
                transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}cc)` }}
              />
            </div>

            {/* Content */}
            <h3 className={`${compact ? 'text-base' : 'text-lg'} font-black mb-2.5 leading-tight tracking-tight`} style={{ color: theme.text }}>
              {step.title}
            </h3>
            <p className={`${compact ? 'text-[12.5px]' : 'text-sm'} font-medium leading-relaxed opacity-75 ${compact ? 'mb-4' : 'mb-6'}`} style={{ color: theme.text }}>
              {step.description}
            </p>

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
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black uppercase tracking-[0.15em] text-white shadow-2xl"
                style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`, boxShadow: `0 12px 24px ${accentColor}40` }}>
                {isLast
                  ? <><Check size={16} /> Finalizează</>
                  : <>{isFirst ? 'Hai să începem' : 'Continuă'} <ChevronRight size={16} /></>}
              </motion.button>

            </div>

            {/* Skip link */}
            {!isLast && (
              <button onClick={skip}
                className="w-full text-center text-[10px] font-black uppercase tracking-widest mt-4 opacity-30 hover:opacity-60 transition-all"
                style={{ color: theme.text3 }}>
                Sari peste tutorial
              </button>
            )}
          </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}
