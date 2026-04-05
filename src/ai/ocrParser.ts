export async function parseImageOCR(file: File | string): Promise<string> {
  if (typeof file === 'string' && !file.startsWith('data:')) {
    return cleanText(file);
  }

  // Handle Electron environment
  if (window.electronAPI) {
    const filePath = (file as { path?: string }).path;
    if (file instanceof File && filePath) {
      const text = await window.electronAPI.readOCRPath(filePath);
      if (text) return cleanText(text);
    }
    
    // If just calling it manually (opens dialog)
    const api = window.electronAPI as { openOCRImage?: () => Promise<string | null> };
    if (typeof file === 'object' && file.type?.startsWith('image/') && api.openOCRImage) {
      const text = await api.openOCRImage();
      return cleanText(text ?? '');
    }
  }

  // Browser fallback (commented out to avoid Vite resolve errors until installed)
  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('ron');
    const source = file as string | File;
    const ret = await worker.recognize(source);
    await worker.terminate();
    return cleanText(ret.data.text);
  } catch (e) {
    console.error('OCR Error:', e);
    return '';
  }
}

function cleanText(input: string) {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/\f/g, '\n')
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\x20-\x7E\u00A0-\u036F\u2000-\u206F\u2070-\u218F\n]/g, ' ')
    .trim();
}
