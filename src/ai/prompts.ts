import type { Question } from '../types';
import type { AIContextPayload, MistakeBankEntry, UserProfileData, WeakTopic } from './types';

export const AI_PERSONALITY =
  'Ești un profesor de medicină cu experiență clinică vastă, exigent și foarte clar, ' +
  'care pregătește studenți români pentru examene și rezidențiat. ' +
  'Nu accepți explicații superficiale. Prioritizezi înțelegerea mecanismelor patologice, ' +
  'nu memorarea mecanică. Folosești terminologie medicală corectă, în limba română, ' +
  'și introduci echivalente latine sau engleze doar când adaugă claritate. ' +
  'Raționamentul tău urmează structura: fiziopatologie -> clinic -> diagnostic -> tratament.';

export const GROUNDING_RULES =
  'REGULI STRICTE:\n' +
  '1. Folosește prioritar informațiile din contextul extras din biblioteca studentului.\n' +
  '2. Dacă o informație nu apare în context, poți completa din cunoștințe medicale generale, ' +
  'dar marchează clar acea parte ca "(cunoștințe generale)".\n' +
  '3. Nu inventa valori de laborator, doze, scoruri sau statistici.\n' +
  '4. Răspunde exclusiv în limba română.\n' +
  '5. Nu formula întrebări despre document, fișier, PDF sau "cursul încărcat"; întreabă doar despre conținutul medical.\n' +
  '6. Opțiunile de răspuns trebuie să fie concise, clare și utile pentru examen, nu propoziții lungi copiate integral.\n' +
  '7. Evită să repeți textual pasaje întregi din context; reformulează fidel și precis.';

export const TRUSTED_GENERAL_KNOWLEDGE_RULES =
  'Cand biblioteca nu acopera complet raspunsul, completeaza doar cu rationament medical general stabil, compatibil cu manuale si ghiduri consacrate. ' +
  'Nu inventa citari exacte, editii, pagini, doze, scoruri sau recomandari temporale neverificate; marcheaza clar ce este completare generala.';

function difficultyText(difficulty: 'easy' | 'medium' | 'hard') {
  if (difficulty === 'easy') {
    return 'UȘOR: întrebări de recunoaștere, definiții, clasificări simple și asocieri directe, fără capcane.';
  }
  if (difficulty === 'hard') {
    return 'DIFICIL: raționament clinic în mai mulți pași, diagnostic diferențial, complicații, tratament specific și situații atipice.';
  }
  return 'MEDIU: corelații fiziopatologice, interpretare clinică simplă și alegerea conduitei corecte.';
}

function weakTopicsText(weakTopics: WeakTopic[]) {
  if (weakTopics.length === 0) return 'niciun topic slab identificat încă';
  return weakTopics
    .map((topic) => `"${topic.topic}" (${topic.accuracy}% corect din ${topic.total} răspunsuri)`)
    .join(', ');
}

function mistakeBankText(mistakeBank: MistakeBankEntry[]) {
  if (!mistakeBank?.length) return '';

  const topMistakes = [...mistakeBank]
    .sort((left, right) => right.wrongCount - left.wrongCount)
    .slice(0, 5);

  return (
    'GREȘELI FRECVENTE ALE STUDENTULUI:\n' +
    topMistakes
      .map((entry) => (
        `- Topic: "${entry.topic}" | ` +
        `Greșit de ${entry.wrongCount} ori | ` +
        `Răspuns dat: "${entry.userAnswer}" | ` +
        `Tip greșeală: ${entry.mistakeType ?? 'nespecificat'} | ` +
        `Concept lipsă: ${entry.missingConcept ?? 'nespecificat'}`
      ))
      .join('\n')
  );
}

export function sanitizeUserInput(input: string) {
  return input
    .replace(/<\|.*?\|>/g, '')
    .replace(/system prompt/gi, '')
    .replace(/ignore previous instructions/gi, '')
    .split('')
    .filter((char) => char.charCodeAt(0) !== 0)
    .join('')
    .trim();
}

export function buildQuestionPrompt(
  profile: UserProfileData | null,
  weakTopics: WeakTopic[],
  difficulty: 'easy' | 'medium' | 'hard',
  contextPayload?: AIContextPayload,
) {
  const safeContext = contextPayload?.summary ?? '';
  const mistakeSection = profile?.mistakeBank?.length ? mistakeBankText(profile.mistakeBank) : '';

  const profileLine = profile
    ? `PROFIL STUDENT: dificultate curentă ${profile.currentDifficulty}, acuratețe globală ${profile.globalAccuracy}%, streak ${profile.streak}.`
    : 'Profil student indisponibil. Generează pentru nivel mediu.';

  const vignetteInstruction = difficulty === 'hard'
    ? 'Pentru HARD: creează scenarii clinice complete, cu pacient, simptome, semne cheie și context relevant.'
    : difficulty === 'medium'
      ? 'Pentru MEDIUM: include 1-2 date clinice sau paraclinice care cer interpretare.'
      : 'Pentru EASY: păstrează întrebarea directă și clară.';

  const distractorInstruction =
    'Distractorii trebuie să fie plauzibili clinic și să reflecte confuzii reale, nu răspunsuri evident absurde.';

  const answerQualityInstruction =
    'Cerințe obligatorii pentru întrebări: 4 opțiuni, exact 1 răspuns corect, fără a menționa numele fișierului sau documentului, fără formulări meta de tip "conform cursului", fără opțiuni mai lungi de 18 cuvinte.';

  const jsonSchema =
    '{"questions":[{"text":"","options":[{"text":"","isCorrect":true}],"explanation":"","tags":["topic"],"difficulty":"easy|medium|hard","sources":[""]}]}';

  return [
    AI_PERSONALITY,
    GROUNDING_RULES,
    TRUSTED_GENERAL_KNOWLEDGE_RULES,
    profileLine,
    `TOPICURI SLABE DE PRIORITIZAT: ${weakTopicsText(weakTopics)}.`,
    mistakeSection,
    `NIVEL CERUT: ${difficultyText(difficulty)}`,
    vignetteInstruction,
    distractorInstruction,
    answerQualityInstruction,
    safeContext
      ? `CONTEXT DIN BIBLIOTECA STUDENTULUI:\n${safeContext}`
      : 'Nu există context în bibliotecă. Folosește doar cunoștințe medicale generale.',
    'Returnează strict JSON valid, fără text înainte sau după. Schema este:',
    jsonSchema,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildExplanationPrompt(
  userAnswer: string,
  correctAnswer: string,
  question?: Question,
  contextPayload?: AIContextPayload,
) {
  const optionLines = question?.options
    .map((option, index) => {
      const label = String.fromCharCode(65 + index);
      return `${label}. ${sanitizeUserInput(option.text)}${option.isCorrect ? ' [CORECT]' : ''}`;
    })
    .join('\n');

  return [
    AI_PERSONALITY,
    GROUNDING_RULES,
    TRUSTED_GENERAL_KNOWLEDGE_RULES,
    'SCOP: explicație SCURTĂ și CLARĂ după o grilă. Maxim 4-5 propoziții. Nu scrie eseuri.',
    'FORMAT STRICT:\n' +
      '1. De ce răspunsul corect e corect — 1-2 propoziții cu mecanismul cheie.\n' +
      '2. De ce varianta greșită aleasă cade — 1 propoziție, direct.\n' +
      '3. Regula de reținut pentru examen — 1 propoziție scurtă, memorabilă.',
    'Nu repeta întrebarea. Nu enumera toate variantele. Fii direct ca un profesor care corectează oral.',
    question ? `ÎNTREBAREA: ${sanitizeUserInput(question.text)}` : '',
    optionLines ? `OPȚIUNI:\n${optionLines}` : '',
    `RĂSPUNS STUDENT: ${sanitizeUserInput(userAnswer)}`,
    `RĂSPUNS CORECT: ${sanitizeUserInput(correctAnswer)}`,
    contextPayload?.summary ? `CONTEXT RELEVANT:\n${contextPayload.summary}` : '',
    'Returnează strict JSON:\n' +
      '{"explanation":"maxim 80 de cuvinte: de ce corectul e corect (mecanism), de ce gresitul cade, regula scurta","mistakeType":"confuzie_mecanism|inversare_tratament|diagnostic_diferential|lipsa_cunostinte|citire_superficiala|altul","rule":"regula scurta de retinut","confidence":0.0,"missingConcept":"concept lipsa","recommendedTopic":"topic recomandat","relatedConcepts":[""],"sources":[""]}',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildMnemonicPrompt(concept: string, contextPayload?: AIContextPayload) {
  return [
    AI_PERSONALITY,
    GROUNDING_RULES,
    TRUSTED_GENERAL_KNOWLEDGE_RULES,
    `CONCEPT: ${sanitizeUserInput(concept)}`,
    contextPayload?.summary ? `CONTEXT:\n${contextPayload.summary}` : '',
    'Creează un mnemonic medical memorabil pentru studenți români. Poate fi acronim, rimă, poveste scurtă sau asociere vizuală.',
    'Returnează strict JSON: {"mnemonic":"textul mnemonic complet"}',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildHintPrompt(question: Question, contextPayload?: AIContextPayload) {
  return [
    AI_PERSONALITY,
    GROUNDING_RULES,
    TRUSTED_GENERAL_KNOWLEDGE_RULES,
    `ÎNTREBAREA: ${sanitizeUserInput(question.text)}`,
    contextPayload?.summary ? `CONTEXT:\n${contextPayload.summary}` : '',
    'Generează 3 indicii progresive, de la vag la aproape complet, fără a strica imediat răspunsul.',
    'Returnează strict JSON:\n' +
      '{"light":"indiciu vag","medium":"indiciu mediu","full":"explicatia aproape completa"}',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildWrongOptionsPrompt(question: Question, contextPayload?: AIContextPayload) {
  const options = question.options.map((option) => option.text).join(' | ');
  const correctOption = question.options.find((option) => option.isCorrect)?.text ?? '';

  return [
    AI_PERSONALITY,
    GROUNDING_RULES,
    TRUSTED_GENERAL_KNOWLEDGE_RULES,
    `ÎNTREBAREA: ${sanitizeUserInput(question.text)}`,
    `OPȚIUNI: ${sanitizeUserInput(options)}`,
    `RĂSPUNS CORECT: ${sanitizeUserInput(correctOption)}`,
    contextPayload?.summary ? `CONTEXT:\n${contextPayload.summary}` : '',
    'Pentru fiecare opțiune greșită explică:\n' +
      '- de ce e greșită,\n' +
      '- în ce context ar fi putut deveni corectă,\n' +
      '- ce confuzie clasică reprezintă.',
    'Returnează strict JSON: {"options":[{"option":"","whyWrong":"","whenCorrect":"","classicConfusion":""}]}',
  ]
    .filter(Boolean)
    .join('\n\n');
}
