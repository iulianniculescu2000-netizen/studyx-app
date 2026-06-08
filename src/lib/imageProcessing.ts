import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export interface SmartImageOptions {
  maxLongEdge?: number;
  quality?: number;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface PdfFlashcardImage {
  dataUrl: string;
  pageNumber: number;
  sourceName: string;
}

export interface PdfFlashcardPageSnapshot extends PdfFlashcardImage {
  text: string;
  wordCount: number;
  visuals: PdfFlashcardImage[];
}

const DEFAULT_MAX_LONG_EDGE = 1680;
const DEFAULT_QUALITY = 0.88;

function getCanvasContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', {
    alpha: false,
    desynchronized: true,
  });
  if (!context) {
    throw new Error('Nu am putut pregati imaginea pentru flashcard.');
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  return context;
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Imaginea selectata nu poate fi citita.'));
    image.src = dataUrl;
  });
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Fisierul nu a putut fi citit.'));
    reader.readAsDataURL(file);
  });
}

function cropCanvasToDataUrl(
  sourceCanvas: HTMLCanvasElement,
  box: { x: number; y: number; width: number; height: number },
  mimeType: SmartImageOptions['mimeType'],
  quality: number,
) {
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = Math.max(1, Math.round(box.width));
  cropCanvas.height = Math.max(1, Math.round(box.height));
  const cropContext = getCanvasContext(cropCanvas);
  cropContext.fillStyle = '#ffffff';
  cropContext.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
  cropContext.drawImage(
    sourceCanvas,
    Math.max(0, Math.round(box.x)),
    Math.max(0, Math.round(box.y)),
    cropCanvas.width,
    cropCanvas.height,
    0,
    0,
    cropCanvas.width,
    cropCanvas.height,
  );
  const dataUrl = cropCanvas.toDataURL(mimeType ?? 'image/jpeg', quality);
  cropCanvas.width = 0;
  cropCanvas.height = 0;
  return dataUrl;
}

function extractVisualCropsFromCanvas(
  canvas: HTMLCanvasElement,
  sourceName: string,
  pageNumber: number,
  mimeType: SmartImageOptions['mimeType'],
  quality: number,
) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context || canvas.width < 120 || canvas.height < 120) return [];

  const tileSize = 24;
  const columns = Math.ceil(canvas.width / tileSize);
  const rows = Math.ceil(canvas.height / tileSize);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const marked = new Uint8Array(columns * rows);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const startX = column * tileSize;
      const startY = row * tileSize;
      const endX = Math.min(canvas.width, startX + tileSize);
      const endY = Math.min(canvas.height, startY + tileSize);
      let nonWhite = 0;
      let colorful = 0;
      let samples = 0;

      for (let y = startY; y < endY; y += 2) {
        for (let x = startX; x < endX; x += 2) {
          const offset = (y * canvas.width + x) * 4;
          const r = imageData[offset] ?? 255;
          const g = imageData[offset + 1] ?? 255;
          const b = imageData[offset + 2] ?? 255;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const isInk = r < 238 || g < 238 || b < 238;
          if (isInk) nonWhite += 1;
          if (max - min > 18 && max < 248) colorful += 1;
          samples += 1;
        }
      }

      const density = nonWhite / Math.max(1, samples);
      const colorDensity = colorful / Math.max(1, samples);
      if (density > 0.22 || (density > 0.13 && colorDensity > 0.035)) {
        marked[row * columns + column] = 1;
      }
    }
  }

  const visited = new Uint8Array(marked.length);
  const boxes: Array<{ x: number; y: number; width: number; height: number; score: number }> = [];

  for (let index = 0; index < marked.length; index += 1) {
    if (!marked[index] || visited[index]) continue;

    const queue = [index];
    visited[index] = 1;
    let minColumn = index % columns;
    let maxColumn = minColumn;
    let minRow = Math.floor(index / columns);
    let maxRow = minRow;
    let tileCount = 0;

    while (queue.length > 0) {
      const current = queue.pop() ?? 0;
      const column = current % columns;
      const row = Math.floor(current / columns);
      tileCount += 1;
      minColumn = Math.min(minColumn, column);
      maxColumn = Math.max(maxColumn, column);
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);

      [
        [column + 1, row],
        [column - 1, row],
        [column, row + 1],
        [column, row - 1],
      ].forEach(([nextColumn, nextRow]) => {
        if (nextColumn < 0 || nextRow < 0 || nextColumn >= columns || nextRow >= rows) return;
        const nextIndex = nextRow * columns + nextColumn;
        if (!marked[nextIndex] || visited[nextIndex]) return;
        visited[nextIndex] = 1;
        queue.push(nextIndex);
      });
    }

    const padding = Math.round(tileSize * 0.75);
    const x = Math.max(0, minColumn * tileSize - padding);
    const y = Math.max(0, minRow * tileSize - padding);
    const width = Math.min(canvas.width - x, (maxColumn - minColumn + 1) * tileSize + padding * 2);
    const height = Math.min(canvas.height - y, (maxRow - minRow + 1) * tileSize + padding * 2);
    const areaRatio = (width * height) / Math.max(1, canvas.width * canvas.height);
    const widthRatio = width / canvas.width;
    const heightRatio = height / canvas.height;

    if (
      tileCount >= 10
      && areaRatio >= 0.035
      && areaRatio <= 0.7
      && widthRatio >= 0.18
      && heightRatio >= 0.1
    ) {
      boxes.push({ x, y, width, height, score: areaRatio + tileCount / 1000 });
    }
  }

  return boxes
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((box) => ({
      dataUrl: cropCanvasToDataUrl(canvas, box, mimeType, quality),
      pageNumber,
      sourceName,
    }));
}

export async function resizeImageDataUrl(dataUrl: string, options: SmartImageOptions = {}) {
  const image = await loadImage(dataUrl);
  const maxLongEdge = options.maxLongEdge ?? DEFAULT_MAX_LONG_EDGE;
  const quality = options.quality ?? DEFAULT_QUALITY;
  const mimeType = options.mimeType ?? 'image/jpeg';
  const sourceLongEdge = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, maxLongEdge / Math.max(1, sourceLongEdge));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = getCanvasContext(canvas);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL(mimeType, quality);
}

export async function resizeImageFile(file: File, options: SmartImageOptions = {}) {
  const dataUrl = await readFileAsDataUrl(file);
  return resizeImageDataUrl(dataUrl, options);
}

export async function renderPdfPagesAsImages(file: File, options: SmartImageOptions = {}) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const maxLongEdge = options.maxLongEdge ?? DEFAULT_MAX_LONG_EDGE;
  const quality = options.quality ?? DEFAULT_QUALITY;
  const mimeType = options.mimeType ?? 'image/jpeg';
  const images: PdfFlashcardImage[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const pageLongEdge = Math.max(baseViewport.width, baseViewport.height);
      const renderScale = Math.min(2.4, Math.max(0.5, maxLongEdge / Math.max(1, pageLongEdge)));
      const viewport = page.getViewport({ scale: renderScale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      const context = getCanvasContext(canvas);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvas, canvasContext: context, viewport }).promise;
      images.push({
        dataUrl: canvas.toDataURL(mimeType, quality),
        pageNumber,
        sourceName: file.name,
      });

      page.cleanup();
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    await pdf.destroy();
  }

  return images;
}

export async function renderPdfPagesWithText(file: File, options: SmartImageOptions = {}) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const maxLongEdge = options.maxLongEdge ?? DEFAULT_MAX_LONG_EDGE;
  const quality = options.quality ?? DEFAULT_QUALITY;
  const mimeType = options.mimeType ?? 'image/jpeg';
  const pages: PdfFlashcardPageSnapshot[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent().catch(() => null);
      const text = textContent
        ? textContent.items
            .map((item) => ('str' in item ? String(item.str) : ''))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim()
        : '';
      const baseViewport = page.getViewport({ scale: 1 });
      const pageLongEdge = Math.max(baseViewport.width, baseViewport.height);
      const renderScale = Math.min(2.4, Math.max(0.5, maxLongEdge / Math.max(1, pageLongEdge)));
      const viewport = page.getViewport({ scale: renderScale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      const context = getCanvasContext(canvas);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvas, canvasContext: context, viewport }).promise;
      const visuals = extractVisualCropsFromCanvas(canvas, file.name, pageNumber, mimeType, quality);
      pages.push({
        dataUrl: '',
        pageNumber,
        sourceName: file.name,
        text,
        wordCount: text.split(/\s+/).filter(Boolean).length,
        visuals,
      });

      page.cleanup();
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    await pdf.destroy();
  }

  return pages;
}
