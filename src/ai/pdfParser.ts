function cleanText(input: string) {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\f/g, '\n')
    .replace(/-\n(?=\p{Ll})/gu, '')
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\x20-\x7E\u00A0-\u036F\u2000-\u206F\u2070-\u218F\n]/g, ' ')
    .trim();
}

function getTextStats(text: string) {
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  const digits = (text.match(/\p{N}/gu) ?? []).length;
  const tokens = text.split(/\s+/).filter(Boolean);
  const usefulRatio = text.length > 0 ? (letters + digits) / text.length : 0;

  return {
    letters,
    digits,
    tokens,
    usefulRatio,
  };
}

function scorePdfCandidate(text: string) {
  const cleaned = cleanText(text);
  const { letters, digits, tokens, usefulRatio } = getTextStats(cleaned);

  return {
    cleaned,
    score: letters * 2 + digits + tokens.length * 8 + usefulRatio * 1000,
  };
}

function validateExtractedText(text: string, kind: 'pdf' | 'docx' | 'image') {
  const cleaned = cleanText(text);
  const { letters, tokens, usefulRatio } = getTextStats(cleaned);

  if (kind === 'pdf') {
    const hasUsefulBody = letters >= 45 && tokens.length >= 8;
    const hasStrongBody = letters >= 140 || (tokens.length >= 22 && usefulRatio >= 0.16);

    if (hasStrongBody) return cleaned;
    if (hasUsefulBody && usefulRatio >= 0.06) return cleaned;

    throw new Error(
      'Textul extras din PDF este prea slab pentru a fi folosit sigur. Încearcă o versiune digitală, un export nou sau importul prin OCR în Biblioteca AI.',
    );
  }

  const minChars = 80;
  const minTokens = 15;
  const minUsefulRatio = 0.45;

  if (cleaned.length < minChars || tokens.length < minTokens || usefulRatio < minUsefulRatio) {
    throw new Error('Conținutul extras pare incomplet sau ilizibil.');
  }

  return cleaned;
}

export async function parsePDF(file: File | string) {
  if (typeof file === 'string') {
    return validateExtractedText(file, 'pdf');
  }

  const candidates: string[] = [];

  if (window.electronAPI) {
    const filePath = (file as { path?: string }).path;

    if (file instanceof File && filePath) {
      const text = await window.electronAPI.readPdfPath(filePath);
      if (text && text.trim().length > 5) {
        candidates.push(text);
      }
    }

    if (file instanceof File && typeof window.electronAPI.readPdfBuffer === 'function') {
      const buffer = await file.arrayBuffer();
      const text = await window.electronAPI.readPdfBuffer(new Uint8Array(buffer));
      if (text && text.trim().length > 5) {
        candidates.push(text);
      }
    }
  }

  if (candidates.length === 0) {
    throw new Error(
      'Nu am putut extrage text din acest PDF. Încearcă o versiune digitală sau importă documentul prin OCR în Biblioteca AI.',
    );
  }

  const bestCandidate = candidates
    .map(scorePdfCandidate)
    .sort((left, right) => right.score - left.score)[0]?.cleaned ?? '';

  return validateExtractedText(bestCandidate, 'pdf');
}
