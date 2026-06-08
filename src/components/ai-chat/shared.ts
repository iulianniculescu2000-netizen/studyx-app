export type ChatMode = 'grounded' | 'explain' | 'summarize' | 'diagram' | 'test' | 'mnemonic';

export type Citation = {
  source: string;
  topic: string;
  score: number;
  excerpt: string;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  suggestions?: string[];
  mode?: ChatMode;
};

export type RecommendedAction = {
  mode: ChatMode;
  label: string;
  helper: string;
  prompt: string;
};

export const CHAT_MODES: Array<{
  id: ChatMode;
  label: string;
  shortLabel: string;
  description?: string;
  placeholder: string;
  emptyPrompts: string[];
}> = [
  {
    id: 'grounded',
    label: 'Context',
    shortLabel: 'Context',
    description: 'răspuns bazat pe biblioteca ta',
    placeholder: 'Întreabă-mă orice din cursurile tale...',
    emptyPrompts: [
      'Ce merită învățat prioritar din biblioteca mea?',
      'Găsește în curs ce pare frecvent cerut la examen.',
      'Ce părți par prea detaliate și improbabile pentru grile?',
      'Leagă tema asta de ce am greșit până acum.',
    ],
  },
  {
    id: 'explain',
    label: 'Explică',
    shortLabel: 'Explică',
    description: 'mecanisme pas cu pas, cu exemple clinice',
    placeholder: 'Ce concept medical vrei să înțelegi în profunzime?',
    emptyPrompts: [
      'Explică-mi mecanismul, apoi capcana de grilă.',
      'Explică-mi variantele unei grile: corect, greșite și când s-ar potrivi.',
      'Unde apar confuziile frecvente la tema asta?',
      'Dă-mi un exemplu clinic simplu.',
    ],
  },
  {
    id: 'summarize',
    label: 'Rezumă',
    shortLabel: 'Rezumă',
    description: 'comprimă cursul în idei-cheie pentru examen',
    placeholder: 'Ce capitol sau temă vrei comprimată pentru examen?',
    emptyPrompts: [
      'Rezumă documentul în 5 idei-cheie.',
      'Ce trebuie memorat neapărat pentru examen?',
      'Separă: foarte probabil, posibil, puțin probabil.',
      'Fă-mi o fișă scurtă pentru recapitulare.',
    ],
  },
  {
    id: 'diagram',
    label: 'Scheme',
    shortLabel: 'Scheme',
    placeholder: 'Ce temă vrei să transform în schemă?',
    emptyPrompts: [
      'Fă-mi o schemă logică din cursul curent.',
      'Transformă mecanismul într-o diagramă cu săgeți.',
      'Fă-mi un tabel diferențial între conceptele apropiate.',
      'Construiește un algoritm de diagnostic/tratament când se potrivește.',
    ],
  },
  {
    id: 'test',
    label: 'Testează',
    shortLabel: 'Testează',
    description: 'mini-quiz adaptat punctelor tale slabe',
    placeholder: 'Pe ce temă sau capitol vrei să fii testat acum?',
    emptyPrompts: [
      'Testează-mă din tema principală a bibliotecii mele.',
      'Dă-mi 3 întrebări scurte fără răspuns.',
      'Fă-mi un mini-quiz pe tema documentului curent.',
      'Verifică dacă știu diferențele esențiale.',
    ],
  },
  {
    id: 'mnemonic',
    label: 'Mnemonic',
    shortLabel: 'Mnemonic',
    description: 'asocieri vizuale și trucuri de memorare',
    placeholder: 'Ce concept greu vrei să memorezi cu un mnemonic?',
    emptyPrompts: [
      'Creează un mnemonic creativ pentru această temă.',
      'Dă-mi 3 mnemonice scurte și memorabile.',
      'Transformă noțiunile grele într-o asociere vizuală.',
      'Fă un mnemonic pentru diferențialul important.',
    ],
  },
];

export function formatMessage(content: string) {
  if (!content) return '';

  let text = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  text = text
    .replace(/^#{1,4}\s+(.+)$/gm, '<div style="margin: 12px 0 6px; font-weight: 900; letter-spacing: 0.04em;">$1</div>')
    .replace(/^\s*\*\s+(.+)$/gm, '<div style="margin: 6px 0 6px 14px;">• $1</div>')
    .replace(/^\s*[→➜]\s+(.+)$/gm, '<div style="margin: 6px 0 6px 14px;">→ $1</div>');

  text = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*(?!\s)([^*\n]{2,80}?)(?<!\s)\*([\s).,;:!?]|$)/g, '$1<em>$2</em>$3');

  text = text.replace(/^(?:•|-)\s+(.+)$/gm, '<div style="margin: 4px 0 4px 12px;">• $1</div>');
  text = text.replace(/^(\d+\.\s+.+)$/gm, '<div style="margin: 4px 0 4px 12px;">$1</div>');
  text = text.replace(/^([A-Z]\)\s+.+)$/gm, '<div style="margin: 8px 0 4px 0; font-weight: 600;">$1</div>');
  text = text.replace(/^(?:•|-)\s+(.+)$/gm, '<div style="margin: 6px 0 6px 14px;">• $1</div>');
  text = text.replace(/(^|[\s>])\*(?=\s|$)/g, '$1');
  text = text
    .replace(/\n\n+/g, '</p><p style="margin: 8px 0;">')
    .replace(/\n/g, '<br/>');

  if (!text.startsWith('<div') && !text.startsWith('<p')) {
    text = `<p style="margin: 4px 0; line-height: 1.6;">${text}</p>`;
  }

  return text;
}

export function getCitationStrength(citations: Citation[]) {
  if (!citations.length) return null;
  const averageScore = citations.reduce((sum, citation) => sum + citation.score, 0) / citations.length;
  if (averageScore >= 0.78) return 'Context puternic';
  if (averageScore >= 0.52) return 'Context mediu';
  return 'Context redus';
}

export function buildFollowUpSuggestions(
  prompt: string,
  citations: Citation[],
  mode: ChatMode,
  scopedSourceName?: string | null,
  focusTopic?: string | null,
) {
  if (scopedSourceName) {
    return [
      `Rezumă-mi ${scopedSourceName} în 5 idei-cheie.`,
      `Ce merită memorat prioritar din ${scopedSourceName}?`,
      `Generează 5 întrebări strict din ${scopedSourceName}.`,
    ];
  }

  if (mode === 'test') {
    return [
      'Mai dă-mi 3 întrebări puțin mai grele.',
      'Acum arată-mi și răspunsurile corecte.',
      'Testează-mă doar din conceptele unde greșesc des.',
    ];
  }

  if (mode === 'mnemonic') {
    return [
      'Fă-l mai scurt și mai catchy.',
      'Mai dă-mi două variante complet diferite.',
      'Leagă-l de un exemplu clinic ușor de vizualizat.',
    ];
  }

  if (mode === 'diagram') {
    return [
      'Transformă schema într-un tabel diferențial.',
      'Adaugă capcanele de examen lângă fiecare ramură.',
      'Fă-mi o versiune de memorat în 60 de secunde.',
    ];
  }

  if (mode === 'summarize') {
    return [
      'Comprimă totul într-o fișă de 30 de secunde.',
      'Scoate doar capcanele frecvente.',
      'Spune-mi ce trebuie memorat neapărat.',
    ];
  }

  const topTopic = citations[0]?.topic;
  if (topTopic) {
    return [
      `Explică-mi mai simplu tema "${topTopic}".`,
      `Care sunt capcanele frecvente la "${topTopic}"?`,
      `Generează 3 întrebări de verificare pentru "${topTopic}".`,
    ];
  }

  if (focusTopic) {
    return [
      `Testează-mă doar din ${focusTopic}.`,
      `Rezumă-mi ${focusTopic} ca pentru examen.`,
      `Fă-mi un mnemonic rapid pentru ${focusTopic}.`,
    ];
  }

  if (/mnemonic|mnemon/i.test(prompt)) {
    return [
      'Fă-l mai scurt și mai ușor de memorat.',
      'Transformă-l într-o asociere vizuală.',
      'Dă-mi încă două variante diferite.',
    ];
  }

  return [
    'Rezumă-mi răspunsul în 3 puncte.',
    'Ce ar trebui să rețin pentru examen?',
    'Generează 3 întrebări scurte pe tema asta.',
  ];
}

export function getContextState(citations: Citation[]) {
  if (citations.length === 0) return 'Răspuns general';
  const averageScore = citations.reduce((sum, citation) => sum + citation.score, 0) / citations.length;
  if (averageScore >= 0.78) return 'Ancorat în bibliotecă';
  if (averageScore >= 0.52) return 'Parțial ancorat';
  return 'Context limitat';
}

export function buildRecommendedActions(
  weakTopics: Array<{ topic: string; accuracy: number }>,
  dueCount: number,
  scopedSourceName?: string | null,
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  const primaryWeakTopic = weakTopics[0];

  if (primaryWeakTopic) {
    actions.push({
      mode: 'test',
      label: 'Test pe punctul slab',
      helper: `${primaryWeakTopic.topic} · ${primaryWeakTopic.accuracy}% acuratețe`,
      prompt: `Testează-mă din ${primaryWeakTopic.topic}. Pune-mi 3 întrebări scurte, una câte una, și așteaptă răspunsul meu.`,
    });
    actions.push({
      mode: 'mnemonic',
      label: 'Mnemonic de fixare',
      helper: `Memorie rapidă pentru ${primaryWeakTopic.topic}`,
      prompt: `Creează-mi 3 mnemonice scurte și memorabile pentru ${primaryWeakTopic.topic}.`,
    });
  }

  if (dueCount > 0) {
    actions.push({
      mode: 'summarize',
      label: 'Plan pentru azi',
      helper: `${dueCount} itemi cer atenție`,
      prompt: 'Pe baza progresului meu, spune-mi foarte concret ce ar trebui să recapitulăm astăzi și în ce ordine.',
    });
  }

  if (scopedSourceName) {
    actions.unshift({
      mode: 'summarize',
      label: 'Rezumat document',
      helper: scopedSourceName,
      prompt: `Rezumă-mi documentul "${scopedSourceName}" în idei-cheie, capcane și ce trebuie memorat primul.`,
    });
    actions.unshift({
      mode: 'diagram',
      label: 'Schema document',
      helper: scopedSourceName,
      prompt: `Fă-mi o schemă logică din documentul "${scopedSourceName}": concepte principale, relații cauză-efect, capcane și ce este probabil la examen.`,
    });
  }

  return actions
    .filter((action, index, array) => array.findIndex((entry) => entry.label === action.label) === index)
    .slice(0, 3);
}
