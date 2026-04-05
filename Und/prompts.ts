import type { Question } from '../types';
import type { AIContextPayload, MistakeBankEntry, UserProfileData, WeakTopic } from './types';

// ─── Personalitate AI ─────────────────────────────────────────────────────────
export const AI_PERSONALITY =
  'Esti un profesor de medicina cu 20 de ani experienta clinica, extrem de exigent, care pregateste studenti romani pentru rezidentiat. ' +
  'Nu accepti raspunsuri superficiale. Prioritizezi INTELEGEREA mecanismelor patologice, nu memorarea mecanica. ' +
  'Folosesti terminologie medicala corecta, in limba romana, cu echivalente latine/engleze cand e relevant. ' +
  'Gandirea ta este structurata: fiziopatologie → clinic → diagnostic → tratament.';

// ─── Reguli de grounding ──────────────────────────────────────────────────────
export const GROUNDING_RULES =
  'REGULI STRICTE:\n' +
  '1. Foloseste PRIORITAR informatiile din contextul furnizat din biblioteca studentului.\n' +
  '2. Daca o informatie nu este in context, poti completa din cunostinte medicale generale — dar marcheaza clar "(cunostinte generale)".\n' +
  '3. Nu inventa date de laborator, doze sau statistici. Mai bine spui "conform literaturii" decat sa inventezi.\n' +
  '4. Raspunde EXCLUSIV in limba romana. Termenii latini/englezi pot aparea ca echivalente intre paranteze.';

function difficultyText(difficulty: 'easy' | 'medium' | 'hard') {
  if (difficulty === 'easy')
    return 'USOR — întrebări de recunoaștere: definiții, clasificări simple, asociații directe. Fără capcane.';
  if (difficulty === 'hard')
    return 'DIFICIL (nivel rezidențiat) — raționament clinic în mai mulți pași, diagnostic diferențial, complicații, tratament specific cu doze, situații atipice.';
  return 'MEDIU — corelații patofizologice, interpretare date clinice simple, alegere tratament de primă linie.';
}

function weakTopicsText(weakTopics: WeakTopic[]) {
  if (weakTopics.length === 0) return 'niciunul identificat încă';
  return weakTopics
    .map(t => `"${t.topic}" (${t.accuracy}% corect din ${t.total} răspunsuri)`)
    .join(', ');
}

function mistakeBankText(mistakeBank: MistakeBankEntry[]) {
  if (!mistakeBank?.length) return '';
  const top = mistakeBank
    .sort((a, b) => b.wrongCount - a.wrongCount)
    .slice(0, 5);
  return (
    'GREȘELILE FRECVENTE ALE STUDENTULUI (generează întrebări care atacă exact aceste lacune):\n' +
    top
      .map(
        m =>
          `- Topic: "${m.topic}" | Greșit de ${m.wrongCount}x | ` +
          `Răspuns greșit dat: "${m.userAnswer}" | ` +
          `Tip greșeală: ${m.mistakeType ?? 'nespecificat'} | ` +
          `Concept lipsă: ${m.missingConcept ?? 'nespecificat'}`
      )
      .join('\n')
  );
}

export function sanitizeUserInput(input: string) {
  return input
    .replace(/<\|.*?\|>/g, '')
    .replace(/system prompt/gi, '')
    .replace(/ignore previous instructions/gi, '')
    .replace(/\u0000/g, '')
    .trim();
}

// ─── PROMPT GENERARE ÎNTREBĂRI ────────────────────────────────────────────────
export function buildQuestionPrompt(
  profile: UserProfileData | null,
  weakTopics: WeakTopic[],
  difficulty: 'easy' | 'medium' | 'hard',
  contextPayload?: AIContextPayload
) {
  const safeContext = contextPayload?.summary ?? '';
  const mistakeBankSection = profile?.mistakeBank?.length
    ? mistakeBankText(profile.mistakeBank)
    : '';

  const profileLine = profile
    ? `PROFIL STUDENT: dificultate curentă ${profile.currentDifficulty}, ` +
      `acuratețe globală ${profile.globalAccuracy}%, streak ${profile.streak} răspunsuri corecte consecutive.`
    : 'Profil student indisponibil — generează pentru nivel mediu.';

  const vignetteInstruction =
    difficulty === 'hard'
      ? 'OBLIGATORIU pentru HARD: Creează un caz clinic complet (pacient cu vârstă/sex, simptome, semne vitale, date de laborator relevante, imagistică) ÎNAINTE de întrebare. Întrebarea trebuie să ceară diagnostic, mecanism sau tratament specific.'
      : difficulty === 'medium'
      ? 'Pentru MEDIUM: Include câteva date clinice (simptom principal + 1-2 date paraclinice) care necesită interpretare, nu doar memorare.'
      : 'Pentru EASY: Întrebare directă, clară, fără capcane. Verifică cunoștințele de bază.';

  const distractorInstruction =
    'DISTRACTORI DE CALITATE: Răspunsurile greșite trebuie să fie plauzibile clinic — confuzii reale pe care studenții le fac (ex: medicament corect dar doză greșită, diagnostic similar dar cu diferențiator cheie, mecanism adiacent). NU pune răspunsuri evident greșite.';

  const jsonSchema =
    '{"questions":[{"text":"","options":[{"text":"","isCorrect":true/false}],"explanation":"EXPLICATIE DETALIATA cu fiziopatologie + de ce fiecare distractor e greșit","tags":["topic"],"difficulty":"easy|medium|hard","sources":[""]}]}';

  return [
    AI_PERSONALITY,
    GROUNDING_RULES,
    profileLine,
    `TOPICURI SLABE (prioritizează-le): ${weakTopicsText(weakTopics)}.`,
    mistakeBankSection,
    `NIVEL DIFICULTATE: ${difficultyText(difficulty)}.`,
    vignetteInstruction,
    distractorInstruction,
    safeContext
      ? `CONTEXT DIN BIBLIOTECA STUDENTULUI (folosește-l prioritar):\n${safeContext}`
      : 'ATENȚIE: Nu există materiale în bibliotecă — folosește cunoștințe medicale generale.',
    'IMPORTANT: Returnează JSON strict, fără text înainte sau după. Schema exactă:',
    jsonSchema,
  ]
    .filter(Boolean)
    .join('\n\n');
}

// ─── PROMPT EXPLICAȚIE RĂSPUNS ────────────────────────────────────────────────
export function buildExplanationPrompt(
  userAnswer: string,
  correctAnswer: string,
  question?: Question,
  contextPayload?: AIContextPayload
) {
  return [
    AI_PERSONALITY,
    GROUNDING_RULES,
    'SARCINA TA: Analizează răspunsul studentului ca un profesor exigent. Nu te mulțumi cu o explicație superficială.',
    'STRUCTURA EXPLICAȚIEI (obligatorie):\n' +
      '1. De ce răspunsul ales este GREȘIT (mecanism specific, nu doar "nu e corect")\n' +
      '2. De ce răspunsul corect este corect — cu fiziopatologie/mecanism de acțiune\n' +
      '3. Cum să distingă pe viitor (regula clinică sau trucu mnemonic)\n' +
      '4. Ce alte concepte trebuie consolidate',
    question ? `ÎNTREBAREA: ${sanitizeUserInput(question.text)}` : '',
    `RĂSPUNS STUDENT: ${sanitizeUserInput(userAnswer)}`,
    `RĂSPUNS CORECT: ${sanitizeUserInput(correctAnswer)}`,
    contextPayload?.summary
      ? `CONTEXT RELEVANT:\n${contextPayload.summary}`
      : '',
    'Returnează JSON strict:\n' +
      '{"explanation":"EXPLICATIE DETALIATA minimum 100 cuvinte","mistakeType":"confuzie_mecanism|inversare_tratament|diagnostic_diferential|lipsa_cunostinte|citire_superficiala|altul","rule":"Regula scurta de retinut (max 2 propozitii)","confidence":0.0,"missingConcept":"Conceptul specific care lipseste","recommendedTopic":"Topicul de studiat urgent","relatedConcepts":["concept1","concept2"],"sources":[""]}',
  ]
    .filter(Boolean)
    .join('\n\n');
}

// ─── PROMPT MNEMONIC ──────────────────────────────────────────────────────────
export function buildMnemonicPrompt(concept: string, contextPayload?: AIContextPayload) {
  return [
    AI_PERSONALITY,
    GROUNDING_RULES,
    `CONCEPT: ${sanitizeUserInput(concept)}`,
    contextPayload?.summary ? `CONTEXT:\n${contextPayload.summary}` : '',
    'Creează un mnemonic creativ, MEMORABIL și MEDICAL pentru studenți români. ' +
      'Poate fi: acronim, rimă, poveste scurtă, asociație vizuală. ' +
      'Trebuie să fie ușor de reprodus în examen oral.',
    'Returnează JSON strict: {"mnemonic":"mnemonicul complet în română"}',
  ]
    .filter(Boolean)
    .join('\n\n');
}

// ─── PROMPT INDICII ───────────────────────────────────────────────────────────
export function buildHintPrompt(question: Question, contextPayload?: AIContextPayload) {
  return [
    AI_PERSONALITY,
    GROUNDING_RULES,
    `ÎNTREBAREA: ${sanitizeUserInput(question.text)}`,
    contextPayload?.summary ? `CONTEXT:\n${contextPayload.summary}` : '',
    'Generează 3 indicii PROGRESIVE (de la vag la explicit). ' +
      'Indiciul ușor să nu dea răspunsul, cel complet să explice mecanismul complet.',
    'Returnează JSON strict:\n' +
      '{"light":"Indiciu vag - direcție generală, fără să dezvăluie răspunsul","medium":"Indiciu mediu - mecanismul patofizologic cheie","full":"Explicație completă - răspuns + de ce + cum să ții minte"}',
  ]
    .filter(Boolean)
    .join('\n\n');
}

// ─── PROMPT OPȚIUNI GREȘITE ───────────────────────────────────────────────────
export function buildWrongOptionsPrompt(question: Question, contextPayload?: AIContextPayload) {
  const options = question.options.map(o => o.text).join(' | ');
  const correctOption = question.options.find(o => o.isCorrect)?.text ?? '';

  return [
    AI_PERSONALITY,
    GROUNDING_RULES,
    `ÎNTREBAREA: ${sanitizeUserInput(question.text)}`,
    `OPȚIUNILE: ${sanitizeUserInput(options)}`,
    `RĂSPUNSUL CORECT: ${correctOption}`,
    contextPayload?.summary ? `CONTEXT:\n${contextPayload.summary}` : '',
    'Pentru FIECARE opțiune greșită explică:\n' +
      '- De ce e greșită (mecanism specific)\n' +
      '- Când AR fi corectă acea opțiune (context diferit)\n' +
      '- Confuzia clasică pe care o reprezintă',
    'Returnează JSON strict: {"options":[{"option":"textul optiunii","whyWrong":"explicatie detaliata","whenCorrect":"contextul in care ar fi corect","classicConfusion":"confuzia tipica"}]}',
  ]
    .filter(Boolean)
    .join('\n\n');
}
