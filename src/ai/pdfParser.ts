export async function parsePDF(file: File | string) {
  if (typeof file === 'string') {
    return validateExtractedText(cleanText(file), 'pdf');
  }

  if (window.electronAPI) {
    const filePath = (file as { path?: string }).path;
    if (file instanceof File && filePath) {
      const text = await window.electronAPI.readPdfPath(filePath);
      if (text && text.trim().length > 5) {
        return validateExtractedText(cleanText(text), 'pdf');
      }
    }

    if (file instanceof File && typeof window.electronAPI.readPdfBuffer === 'function') {
      const buffer = await file.arrayBuffer();
      const text = await window.electronAPI.readPdfBuffer(new Uint8Array(buffer));
      if (text && text.trim().length > 5) {
        return validateExtractedText(cleanText(text), 'pdf');
      }

      throw new Error('Acest PDF pare sa fie scanat, protejat sau extras prost. Incearca o versiune digitala sau ruleaza OCR separat.');
    }
  }

  return '';
}

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

function validateExtractedText(text: string, kind: 'pdf' | 'docx' | 'image') {
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  const digits = (text.match(/\p{N}/gu) ?? []).length;
  const tokens = text.split(/\s+/).filter(Boolean);
  const usefulRatio = text.length > 0 ? (letters + digits) / text.length : 0;

  const minChars = kind === 'pdf' ? 36 : 80;
  const minTokens = kind === 'pdf' ? 6 : 15;
  const minUsefulRatio = kind === 'pdf' ? 0.22 : 0.45;

  if (text.length < minChars || tokens.length < minTokens || usefulRatio < minUsefulRatio) {
    throw new Error(
      kind === 'pdf'
        ? 'Textul extras din PDF pare incomplet sau ilizibil. Incearca o versiune digitala, nu scanata, ori foloseste OCR.'
        : 'Continutul extras pare incomplet sau ilizibil.',
    );
  }

  return text;
}
