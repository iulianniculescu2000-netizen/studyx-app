const fs = require('fs');

function cleanText(input) {
  return String(input || '')
    .replace(/\r\n/g, '\n')
    .replace(/\f/g, '\n')
    .replace(/-\n(?=\p{Ll})/gu, '')
    .replace(/[^\S\n]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[^\x20-\x7E\u00A0-\u036F\u2000-\u206F\u2070-\u218F\n]/g, ' ')
    .trim();
}

function regexPdfFallback(buffer) {
  const raw = buffer.toString('latin1');
  const textChunks = [];
  const arrayRe = /\[((?:\([^)]*\)|-?\d+(?:\.\d+)?|\s+)+)\]\s*TJ/g;
  let match;

  while ((match = arrayRe.exec(raw)) !== null) {
    const content = match[1];
    const innerParenRe = /\(([^)]*)\)/g;
    let inner;
    while ((inner = innerParenRe.exec(content)) !== null) {
      const text = inner[1]
        .replace(/\\([0-7]{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '')
        .replace(/\\\\/g, '\\');
      if (text.trim().length > 0) textChunks.push(text);
    }
  }

  const parenRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*(?:Tj|'|")/g;
  while ((match = parenRe.exec(raw)) !== null) {
    const text = match[1]
      .replace(/\\([0-7]{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\\\/g, '\\')
      .replace(/\\(.)/g, '$1');
    if (text.trim().length > 0) textChunks.push(text);
  }

  return cleanText(textChunks.join(' '));
}

async function parseWithPdfLib(buffer) {
  try {
    const pdfParse = require('pdf-parse');

    if (typeof pdfParse === 'function') {
      const data = await pdfParse(buffer);
      return cleanText(data?.text || '');
    }

    if (typeof pdfParse?.PDFParse === 'function') {
      const parser = new pdfParse.PDFParse({ data: buffer });
      try {
        const data = await parser.getText({ pageJoiner: '\n' });
        return cleanText(data?.text || '');
      } finally {
        try {
          await parser.destroy();
        } catch {}
      }
    }

    if (typeof pdfParse?.default === 'function') {
      const data = await pdfParse.default(buffer);
      return cleanText(data?.text || '');
    }
  } catch (error) {
    process.send?.({ type: 'log', message: `[PDF Worker] pdf-parse failed: ${error instanceof Error ? error.message : String(error)}` });
  }

  return '';
}

async function extractText(payload) {
  const buffer = payload?.filePath
    ? fs.readFileSync(payload.filePath)
    : payload?.bufferBase64
      ? Buffer.from(payload.bufferBase64, 'base64')
      : null;

  if (!buffer || buffer.length === 0) return null;

  const parsedText = await parseWithPdfLib(buffer);

  if (parsedText.length > 24) {
    return parsedText;
  }

  const fallbackText = regexPdfFallback(buffer);
  return fallbackText.length > 24 ? fallbackText : null;
}

process.on('message', async (payload) => {
  try {
    const text = await extractText(payload);
    process.send?.({ type: 'result', text });
  } catch (error) {
    process.send?.({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    process.exit(0);
  }
});
