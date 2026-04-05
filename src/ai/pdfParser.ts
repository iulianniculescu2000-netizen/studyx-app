export async function parsePDF(file: File | string) {
  if (typeof file === 'string') {
    return cleanText(file);
  }

  // Handle Electron environment
  if (window.electronAPI) {
    const filePath = (file as { path?: string }).path;
    if (file instanceof File && filePath) {
      const text = await window.electronAPI.readPdfPath(filePath);
      if (text && text.trim().length > 5) return cleanText(text);
      
      // Dacă textul extras e prea scurt, probabil e un PDF scanat (imagine)
      throw new Error("Acest PDF pare să fie o imagine scanată sau este protejat. Încearcă să-l convertești în text sau folosește o versiune digitală.");
    }
  }

  // Browser fallback (foarte limitat pentru PDF-uri reale)
  return '';
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
