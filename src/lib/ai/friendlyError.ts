/**
 * Turns a raw provider/network error into one plain sentence the student can
 * act on. Provider errors carry request ids, org ids and billing URLs that are
 * noise in a chat bubble (and overflow it).
 */
export function friendlyAIError(raw: unknown): string {
  const message = raw instanceof Error ? raw.message : typeof raw === 'string' ? raw : '';
  const text = message.trim();
  if (!text) return 'Nu am putut genera un răspuns. Încearcă din nou.';

  if (/rate limit|too many requests|\b429\b|tokens per minute|requests per minute/i.test(text)) {
    const wait = text.match(/try again in\s+((?:\d+(?:\.\d+)?\s*[hms]\s*)+)/i)?.[1]?.replace(/\s+/g, '');
    const tooBig = /requested\s+(\d+)/i.exec(text);
    const limit = /limit\s+(\d+)/i.exec(text);
    const oversized = tooBig && limit && Number(tooBig[1]) > Number(limit[1]);
    if (oversized) {
      return 'Cererea e prea mare pentru limita curentă a modelului AI. Alege un capitol mai mic sau cere mai puține grile odată.';
    }
    return `Am atins limita de utilizare a modelului AI.${wait ? ` Încearcă din nou în ${wait}.` : ' Așteaptă câteva secunde și încearcă din nou.'}`;
  }
  if (/\b401\b|invalid api key|unauthorized|incorrect api key/i.test(text)) {
    return 'Cheia AI nu este validă. Verific-o în Setări AI.';
  }
  if (/failed to fetch|networkerror|network request failed|load failed|ERR_INTERNET|ENOTFOUND/i.test(text)) {
    return 'Nu am putut contacta serviciul AI. Verifică conexiunea la internet și încearcă din nou.';
  }

  const cleaned = text.replace(/^(?:eroare\s+)?(?:groq|openai|gemini|google|anthropic)\s+api\s*:?\s*/i, '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
  return cleaned.length > 220 ? `${cleaned.slice(0, 217)}…` : cleaned || 'Nu am putut genera un răspuns. Încearcă din nou.';
}
