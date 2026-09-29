/**
 * LLM-backed halves of the chat memory: turning a stretch of conversation into
 * durable facts about the student, and double-checking an answer that carries
 * doses/thresholds. Both fail open — a missing key, a network error or an
 * unparseable reply just means "no new memory" / "no warning", never an error
 * surfaced to the student, because they run in the background after the reply.
 */
import { groqRequest } from '../lib/groq';
import { validateJson } from './validator';
import {
  isValidCandidate,
  cleanCandidateText,
  type HistoryTurn,
  type MemoryCandidate,
  type MemoryItem,
} from './chatMemory';

const MAX_CANDIDATES = 4;
const MAX_TURN_CHARS = 500;

interface ExtractionResponse {
  items?: { kind?: unknown; text?: unknown }[];
}

/** Parses the extractor's reply into validated candidates (exported for tests). */
export function parseMemoryCandidates(raw: string): MemoryCandidate[] {
  const parsed = validateJson<ExtractionResponse>(raw);
  if (!parsed.ok || !Array.isArray(parsed.value?.items)) return [];
  const out: MemoryCandidate[] = [];
  for (const entry of parsed.value.items) {
    if (isValidCandidate(entry)) out.push({ kind: entry.kind, text: cleanCandidateText(entry.text) });
    if (out.length >= MAX_CANDIDATES) break;
  }
  return out;
}

/**
 * Reads recent turns and returns what is worth remembering about the STUDENT
 * (never medical facts — those come from the library). `known` is passed so the
 * model does not re-emit what is already stored.
 */
export async function extractMemoryCandidates(turns: HistoryTurn[], known: MemoryItem[]): Promise<MemoryCandidate[]> {
  const transcript = turns
    .filter((turn) => turn.content.trim())
    .map((turn) => `${turn.role === 'user' ? 'Student' : 'Asistent'}: ${turn.content.replace(/\s+/g, ' ').slice(0, MAX_TURN_CHARS)}`)
    .join('\n');
  const userChars = turns.filter((t) => t.role === 'user').reduce((sum, t) => sum + t.content.trim().length, 0);
  if (userChars < 40) return [];

  const knownBlock = known.length > 0
    ? `Deja reținut (nu repeta):\n${known.slice(0, 25).map((m) => `- ${m.text}`).join('\n')}\n\n`
    : '';

  try {
    const raw = await groqRequest({
      task: 'analysis',
      messages: [
        {
          role: 'system',
          content: [
            'Ești modulul de memorie al unui asistent de studiu medical. Din conversația de mai jos extragi DOAR informații durabile despre STUDENT, spuse de student.',
            'Tipuri permise:',
            '- goal: obiective și context (examen, dată, an de studiu, specialitate țintă)',
            '- preference: cum învață/cum vrea explicațiile (scurt, cu scheme, cu exemple clinice, ton)',
            '- struggle: concepte pe care le-a spus explicit că nu le înțelege sau la care greșește repetat',
            '- fact: alte fapte personale utile pentru studiu (program, resurse folosite)',
            '- commitment: ceva ce s-a stabilit să se reia ("mâine repetăm X")',
            'REGULI: nu extrage cunoștințe medicale; nu deduce ce nu s-a spus; nu reține date sensibile fără legătură cu studiul; nu repeta ce e deja reținut; maximum ' + MAX_CANDIDATES + ' intrări; dacă nu e nimic durabil, întoarce lista goală.',
            'Formulează fiecare intrare într-o propoziție scurtă, la persoana a treia, în română (ex. "Se pregătește pentru rezidențiat în iulie", "Preferă scheme și tabele").',
            'Răspunde STRICT JSON: {"items":[{"kind":"goal","text":"..."}]}',
          ].join('\n'),
        },
        { role: 'user', content: `${knownBlock}Conversație:\n${transcript}` },
      ],
      temperature: 0,
      maxTokens: 400,
      skipLibraryContext: true,
    });
    return parseMemoryCandidates(raw);
  } catch {
    return [];
  }
}

interface VerificationResponse {
  issues?: { claim?: unknown; reason?: unknown }[];
}

export interface VerificationIssue { claim: string; reason: string }

export function parseVerificationIssues(raw: string): VerificationIssue[] {
  const parsed = validateJson<VerificationResponse>(raw);
  if (!parsed.ok || !Array.isArray(parsed.value?.issues)) return [];
  const out: VerificationIssue[] = [];
  for (const issue of parsed.value.issues) {
    if (typeof issue?.claim === 'string' && typeof issue?.reason === 'string' && issue.claim.trim() && issue.reason.trim()) {
      out.push({ claim: issue.claim.trim().slice(0, 160), reason: issue.reason.trim().slice(0, 240) });
    }
    if (out.length >= 3) break;
  }
  return out;
}

/**
 * Second look at an answer that contains doses / thresholds / scores. Flags only
 * claims the reviewer is confident are wrong or clearly outdated — ambiguity and
 * style are not issues. Returns [] on any failure.
 */
export async function verifyClinicalAnswer(answer: string, groundingText: string): Promise<VerificationIssue[]> {
  try {
    const raw = await groqRequest({
      task: 'analysis',
      messages: [
        {
          role: 'system',
          content: [
            'Ești examinator medical strict. Verifici doar afirmațiile cu valori numerice, doze, praguri, scoruri sau criterii dintr-un răspuns dat unui student.',
            groundingText
              ? `Sursa din biblioteca studentului (referință principală când e relevantă):\n"""\n${groundingText.slice(0, 3500)}\n"""`
              : 'Nu ai o sursă atașată: verifică pe baza cunoștințelor medicale general acceptate și STABILE.',
            'Semnalează o afirmație DOAR când ești sigur că e greșită sau clar depășită. NU semnala nuanțe, variații între ghiduri sau formulări.',
            'Răspunde STRICT JSON: {"issues":[{"claim":"afirmația exactă, scurtă","reason":"o propoziție: ce e greșit și care e varianta corectă"}]} — sau {"issues":[]} dacă totul e în regulă.',
          ].join('\n'),
        },
        { role: 'user', content: `Răspuns de verificat:\n${answer.slice(0, 5000)}` },
      ],
      temperature: 0,
      maxTokens: 500,
      skipLibraryContext: true,
    });
    return parseVerificationIssues(raw);
  } catch {
    return [];
  }
}
