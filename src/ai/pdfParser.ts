export async function parsePDF(file: File | string) {
  if (typeof file === 'string') {
    return cleanText(file);
  }

  // Handle Electron environment
  if (window.electronAPI) {
    // If it's a File object from drag-and-drop or input
    if (file instanceof File && (file as any).path) {
      const text = await window.electronAPI.readPdfPath((file as any).path);
      if (text) return cleanText(text);
    }
    
    // If we're just calling it without a specific file (opens dialog)
    if (file.type === 'application/pdf' && window.electronAPI.openPdfFile) {
      const text = await window.electronAPI.openPdfFile();
      return cleanText(text ?? '');
    }
  }

  // Browser fallback or if Electron path failed
  try {
    const raw = await file.text();
    return cleanText(raw);
  } catch {
    return '';
  }
}

function cleanText(input: string) {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\f/g, '\n')
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    // Keep most printable characters including extended Latin, symbols and common punctuation
    .replace(/[^\x20-\x7E\u00A0-\u036F\u2000-\u206F\u2070-\u218F\n]/g, ' ')
    .trim();
}
