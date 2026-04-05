import type { PerformanceSummary } from './aiContext';
import type { AIKnowledgeSource } from '../store/aiStore';

export interface StudyCoachAction {
  title: string;
  detail: string;
  tone: 'accent' | 'success' | 'warning';
  route?: string;
}

export interface StudyCoachPlan {
  headline: string;
  summary: string;
  focusTopic: string;
  sourceQualityLabel: string;
  actions: StudyCoachAction[];
}

export function buildStudyCoachPlan(
  summary: PerformanceSummary,
  sources: AIKnowledgeSource[],
): StudyCoachPlan {
  const focusTopic = summary.weakTopics[0]?.tag ?? summary.strongTopics[0]?.tag ?? 'Consolidare generala';
  const avgSourceQuality = Math.round(
    sources.reduce((acc, source) => acc + (source.qualityScore ?? 60), 0) / Math.max(sources.length, 1),
  );

  const sourceQualityLabel = sources.length === 0
    ? 'Fara surse AI incarcate'
    : avgSourceQuality >= 78
      ? `Biblioteca AI excelenta (${avgSourceQuality}%)`
      : avgSourceQuality >= 60
        ? `Biblioteca AI buna (${avgSourceQuality}%)`
        : `Biblioteca AI cere curatare (${avgSourceQuality}%)`;

  const actions: StudyCoachAction[] = [];

  if (summary.dueCount > 0) {
    actions.push({
      title: `Recapitulare rapida pentru ${summary.dueCount} itemi`,
      detail: 'Porneste o sesiune scurta de recovery si inchide intai restanta de azi.',
      tone: 'accent',
      route: '/daily-review',
    });
  }

  if (summary.weakTopics.length > 0) {
    actions.push({
      title: `Repara topicul slab: ${focusTopic}`,
      detail: `Acuratetea pe ${focusTopic} este inca joasa. Mergi pe intrebari explicate si repetitie ghidata.`,
      tone: 'warning',
      route: '/review',
    });
  }

  if (sources.length === 0) {
    actions.push({
      title: 'Alimenteaza AI-ul cu cursurile tale',
      detail: 'Adauga PDF-uri sau DOCX-uri pentru raspunsuri mai serioase si mai ancorate in materia ta.',
      tone: 'success',
      route: '/vault',
    });
  } else if (avgSourceQuality < 65) {
    actions.push({
      title: 'Curata documentele slab extrase',
      detail: 'Unele importuri par scanate prost. Refa OCR-ul pentru context AI mai clar si raspunsuri mai bune.',
      tone: 'warning',
      route: '/vault',
    });
  } else {
    actions.push({
      title: 'Foloseste AI-ul ca studiu activ',
      detail: `Intreaba AI-ul direct din chat despre ${focusTopic} si cere intrebari noi doar din biblioteca ta.`,
      tone: 'success',
      route: '/vault',
    });
  }

  return {
    headline: summary.weakTopics.length > 0
      ? `Astazi merita sa ataci ${focusTopic}`
      : 'Astazi esti intr-o zona buna de ritm',
    summary: summary.totalAnswered === 0
      ? 'Incepe cu o sesiune ghidata si lasa AI-ul sa-si construiasca profilul tau de invatare.'
      : `Ai ${summary.globalAccuracy}% acuratete globala, ${summary.streakDays} zile streak si ${summary.dueCount} itemi care cer atentie acum.`,
    focusTopic,
    sourceQualityLabel,
    actions: actions.slice(0, 3),
  };
}
