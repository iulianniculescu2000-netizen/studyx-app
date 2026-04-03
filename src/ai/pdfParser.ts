export async function parsePDF(file: File | string) {
  if (typeof file === 'string') {
    return cleanText(file);
  }
  if (file.type === 'application/pdf' && 'electronAPI' in window && window.electronAPI?.openPdfFile) {
    const text = await window.electronAPI.openPdfFile();
    return cleanText(text ?? '');
  }
  const raw = await file.text();
  return cleanText(raw);
}

function cleanText(input: string) {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\f/g, '\n')
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\x20-\x7E\u00A0-\u024F\u1E00-\u1EFF\n]/g, ' ')
    .trim();
}
