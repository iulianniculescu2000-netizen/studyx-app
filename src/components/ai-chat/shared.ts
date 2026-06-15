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
  /** True when `mode` was auto-detected from the message (not user-selected). */
  autoMode?: boolean;
  /** When set, this assistant message renders an agent job (plan/progress) card. */
  agentJobId?: string;
  /** When set, renders an "open" CTA that navigates to created content. */
  openRoute?: { route: string; label: string };
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

// ── Markdown → HTML renderer ─────────────────────────────────────────────────
// Hand-rolled, dependency-free (this is an offline Electron app). Output is fed
// to dangerouslySetInnerHTML, so ALL user/model text is HTML-escaped before any
// transform runs. Theme-neutral colors (currentColor / rgba) so it adapts to
// light & dark without needing the theme object here.

const MD_BORDER = 'rgba(128,128,128,0.28)';
const MD_SOFT_BG = 'rgba(128,128,128,0.10)';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Inline-level formatting: code, bold, italic, links. Runs on already-escaped text. */
function formatInline(text: string) {
  let out = text;

  // Inline code first so its content is shielded from bold/italic transforms.
  out = out.replace(/`([^`]+?)`/g, (_match, code: string) =>
    `<code style="background:${MD_SOFT_BG};padding:1px 5px;border-radius:5px;font-size:0.88em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${code}</code>`,
  );

  // Safe links: [label](http(s)://...) only — never javascript:, data:, etc.
  out = out.replace(/\[([^\]]+?)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label: string, href: string) =>
    `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:currentColor;text-decoration:underline;font-weight:600;">${label}</a>`,
  );

  out = out
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*(?!\s)([^*\n]{1,120}?)(?<!\s)\*([\s).,;:!?]|$)/g, '$1<em>$2</em>$3')
    .replace(/(^|[\s(])_(?!\s)([^_\n]{1,120}?)(?<!\s)_([\s).,;:!?]|$)/g, '$1<em>$2</em>$3');

  return out;
}

function isTableSeparator(line: string) {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function renderTable(header: string, rows: string[]) {
  const headCells = splitTableRow(header)
    .map((cell) => `<th style="text-align:left;padding:6px 10px;border:1px solid ${MD_BORDER};font-weight:800;background:${MD_SOFT_BG};">${formatInline(cell)}</th>`)
    .join('');
  const bodyRows = rows
    .map((row) => {
      const cells = splitTableRow(row)
        .map((cell) => `<td style="padding:6px 10px;border:1px solid ${MD_BORDER};vertical-align:top;">${formatInline(cell)}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return `<table style="border-collapse:collapse;margin:10px 0;font-size:0.92em;width:100%;"><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
}

export function formatMessage(content: string) {
  if (!content) return '';

  const escaped = escapeHtml(content);
  const lines = escaped.split('\n');
  const html: string[] = [];
  let i = 0;

  // Stack of open list types for nesting; entries: 'ul' | 'ol'
  const listStack: Array<'ul' | 'ol'> = [];
  const closeListsTo = (depth: number) => {
    while (listStack.length > depth) {
      html.push(listStack.pop() === 'ol' ? '</ol>' : '</ul>');
    }
  };

  const paragraphBuffer: string[] = [];
  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    const joined = paragraphBuffer.join('<br/>');
    html.push(`<p style="margin:6px 0;line-height:1.6;">${formatInline(joined)}</p>`);
    paragraphBuffer.length = 0;
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // ── Fenced code block ──────────────────────────────────────────────────
    if (/^```/.test(trimmed)) {
      flushParagraph();
      closeListsTo(0);
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing fence
      html.push(
        `<pre style="background:${MD_SOFT_BG};border:1px solid ${MD_BORDER};border-radius:10px;padding:10px 12px;margin:8px 0;overflow-x:auto;font-size:0.86em;line-height:1.5;"><code style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${codeLines.join('\n')}</code></pre>`,
      );
      continue;
    }

    // ── Blank line ─────────────────────────────────────────────────────────
    if (trimmed === '') {
      flushParagraph();
      closeListsTo(0);
      i += 1;
      continue;
    }

    // ── Table (header row followed by separator) ───────────────────────────
    if (trimmed.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushParagraph();
      closeListsTo(0);
      const header = trimmed;
      i += 2; // consume header + separator
      const rows: string[] = [];
      while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim() !== '') {
        rows.push(lines[i].trim());
        i += 1;
      }
      html.push(renderTable(header, rows));
      continue;
    }

    // ── Horizontal rule ────────────────────────────────────────────────────
    if (/^(?:---|\*\*\*|___)\s*$/.test(trimmed)) {
      flushParagraph();
      closeListsTo(0);
      html.push(`<hr style="border:none;border-top:1px solid ${MD_BORDER};margin:12px 0;"/>`);
      i += 1;
      continue;
    }

    // ── Heading ────────────────────────────────────────────────────────────
    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeListsTo(0);
      const level = heading[1].length;
      const size = level <= 1 ? '1.12em' : level === 2 ? '1.05em' : '1em';
      html.push(`<div style="margin:12px 0 6px;font-weight:900;font-size:${size};letter-spacing:0.01em;">${formatInline(heading[2])}</div>`);
      i += 1;
      continue;
    }

    // ── Blockquote ─────────────────────────────────────────────────────────
    const quote = trimmed.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      closeListsTo(0);
      html.push(`<blockquote style="margin:8px 0;padding:4px 0 4px 12px;border-left:3px solid ${MD_BORDER};color:currentColor;opacity:0.9;">${formatInline(quote[1])}</blockquote>`);
      i += 1;
      continue;
    }

    // ── List item (ordered / unordered), indentation = nesting ─────────────
    const listMatch = line.match(/^(\s*)(?:([-•*])|(\d+)[.)])\s+(.+)$/);
    if (listMatch) {
      flushParagraph();
      const indent = listMatch[1].replace(/\t/g, '  ').length;
      const depth = Math.min(Math.floor(indent / 2) + 1, 4);
      const ordered = Boolean(listMatch[3]);
      const type: 'ul' | 'ol' = ordered ? 'ol' : 'ul';

      while (listStack.length > depth) {
        html.push(listStack.pop() === 'ol' ? '</ol>' : '</ul>');
      }
      while (listStack.length < depth) {
        html.push(`<${type} style="margin:4px 0;padding-left:22px;line-height:1.55;">`);
        listStack.push(type);
      }
      // If same depth but list type switched, reopen.
      if (listStack[depth - 1] !== type) {
        html.push(listStack.pop() === 'ol' ? '</ol>' : '</ul>');
        html.push(`<${type} style="margin:4px 0;padding-left:22px;line-height:1.55;">`);
        listStack[depth - 1] = type;
      }
      html.push(`<li style="margin:2px 0;">${formatInline(listMatch[4])}</li>`);
      i += 1;
      continue;
    }

    // ── Plain paragraph line ───────────────────────────────────────────────
    closeListsTo(0);
    paragraphBuffer.push(trimmed);
    i += 1;
  }

  flushParagraph();
  closeListsTo(0);

  return html.join('');
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

/**
 * A short, proactive opener for the empty chat — the assistant "speaks first"
 * based on the strongest current study signal (weak topic, due reviews, recent
 * import). Returns the default greeting when nothing notable is happening.
 */
export function buildProactiveGreeting(
  weakTopics: Array<{ topic: string; accuracy: number }>,
  dueCount: number,
  recentSourceName?: string | null,
): { title: string; subtitle: string; proactive: boolean } {
  const weak = weakTopics[0];

  if (weak && weak.accuracy < 60) {
    return {
      title: `Hai să lucrăm la ${weak.topic} 💪`,
      subtitle: `Am observat că ${weak.topic} îți dă bătăi de cap (${weak.accuracy}% acuratețe). Pot să-ți explic conceptele cheie sau să-ți fac un set scurt de verificare — tu alegi.`,
      proactive: true,
    };
  }

  if (dueCount >= 5) {
    return {
      title: `Ai ${dueCount} itemi de recapitulat 📅`,
      subtitle: 'Pot să-ți construiesc un plan rapid pentru azi sau să te testez direct din ce e scadent. Cu ce începem?',
      proactive: true,
    };
  }

  if (recentSourceName) {
    return {
      title: `Am indexat „${recentSourceName}" 📚`,
      subtitle: `Vrei un rezumat pentru examen, o schemă logică sau un mini-test din „${recentSourceName}"?`,
      proactive: true,
    };
  }

  return {
    title: 'Cu ce te pot ajuta?',
    subtitle: '',
    proactive: false,
  };
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
    // Routes to the agent (generate_from_mistakes) → a real, saved, targeted set.
    actions.push({
      mode: 'test',
      label: 'Recapitulare greșeli',
      helper: 'Set de grile țintit pe ce greșești des',
      prompt: 'Fă-mi 10 grile de recapitulare din greșelile mele.',
    });
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
