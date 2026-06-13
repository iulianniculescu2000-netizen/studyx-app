import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export interface SmartImageOptions {
  maxLongEdge?: number;
  quality?: number;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  /**
   * When true, images whose caption text is too short/absent will be sent to
   * Llama 4 Scout vision on Groq for an automatic description.
   * Only works when provider is Groq and an API key is configured.
   */
  visionFallback?: boolean;
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

/**
 * An embedded course photo paired with the caption written next to it.
 * Produced by `extractCaptionedImagesFromPdf` for layout-structured conspecte
 * where each image has a "Fotografia N" label and a description in the next column.
 */
export interface CaptionedPdfImage {
  /** Stable, section-namespaced id, e.g. "herpes-simplex-virus-foto-02". */
  tag: string;
  /** Section heading the photo belongs to (e.g. "Herpes Simplex Virus (HSV)"). */
  section: string;
  /** Photo number within the section, taken from the "Fotografia N" label. */
  photoNumber: number;
  pageNumber: number;
  /** Cropped photo as a data URL, at render resolution. */
  imageDataUrl: string;
  /** Verbatim caption text from the column next to the image. */
  caption: string;
}

const DEFAULT_MAX_LONG_EDGE = 2400;
const DEFAULT_QUALITY = 0.92;

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

type AffineMatrix = [number, number, number, number, number, number];

function multiplyAffine(a: AffineMatrix, b: AffineMatrix): AffineMatrix {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ];
}

/** Walk the operator list, tracking the CTM, to find where each image is placed (in PDF user space). */
function collectImagePlacements(
  opList: { fnArray: number[]; argsArray: unknown[] },
  ops: Record<string, number>,
): AffineMatrix[] {
  let ctm: AffineMatrix = [1, 0, 0, 1, 0, 0];
  const stack: AffineMatrix[] = [];
  const placements: AffineMatrix[] = [];

  for (let i = 0; i < opList.fnArray.length; i += 1) {
    const fn = opList.fnArray[i];
    if (fn === ops.save) {
      stack.push([...ctm]);
    } else if (fn === ops.restore) {
      ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    } else if (fn === ops.transform) {
      const args = opList.argsArray[i] as number[] | undefined;
      if (args && args.length >= 6) {
        ctm = multiplyAffine(args as AffineMatrix, ctm);
      }
    } else if (
      fn === ops.paintImageXObject
      || fn === ops.paintImageMaskXObject
      || fn === ops.paintInlineImageXObject
    ) {
      placements.push([...ctm]);
    }
  }

  return placements;
}

interface PdfBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** The unit square [0,1]² transformed by the image CTM gives the placement rectangle in PDF space. */
function placementToPdfBox(ctm: AffineMatrix): PdfBox {
  const corners: Array<[number, number]> = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [x, y] of corners) {
    xs.push(ctm[0] * x + ctm[2] * y + ctm[4]);
    ys.push(ctm[1] * x + ctm[3] * y + ctm[5]);
  }
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    bottom: Math.min(...ys),
    top: Math.max(...ys),
  };
}

function slugifySection(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^\s*\d+[.)]\s*/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function cleanCaption(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

interface TextItemBox {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Extracts course photos together with the caption written beside each one.
 *
 * Designed for layout-structured conspecte: a section heading ("1. HERPES SIMPLEX VIRUS"),
 * then repeated "Fotografia N" labels, each with the photo in the left column and a clinical
 * description in the right column. The image is taken verbatim (cropped from the rendered page)
 * and the caption is taken verbatim from the right-column text — nothing is rewritten.
 *
 * Returns an empty array for plain text PDFs with no usable captioned images, so the caller
 * can fall back to AI text-to-flashcard generation.
 */
export async function extractCaptionedImagesFromPdf(
  file: File,
  options: SmartImageOptions = {},
): Promise<CaptionedPdfImage[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const ops = pdfjs.OPS as unknown as Record<string, number>;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const maxLongEdge = options.maxLongEdge ?? 2800;
  const quality = options.quality ?? 0.94;
  const mimeType = options.mimeType ?? 'image/png';

  const results: CaptionedPdfImage[] = [];
  let currentSection = '';
  let currentSectionSlug = '';
  const photoCounters = new Map<string, number>();

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const pageLongEdge = Math.max(baseViewport.width, baseViewport.height);
      const renderScale = Math.min(2.4, Math.max(0.5, maxLongEdge / Math.max(1, pageLongEdge)));
      const viewport = page.getViewport({ scale: renderScale });

      const textContent = await page.getTextContent().catch(() => null);
      const items: TextItemBox[] = textContent
        ? textContent.items
            .map((item) => {
              if (!('str' in item)) return null;
              const transform = item.transform as number[];
              return {
                str: String(item.str),
                x: transform[4],
                y: transform[5],
                width: 'width' in item ? Number(item.width) : 0,
                height: Math.abs(transform[3]) || ('height' in item ? Number(item.height) : 0),
              } as TextItemBox;
            })
            .filter((entry): entry is TextItemBox => Boolean(entry && entry.str.trim()))
        : [];

      // Section heading: the largest text near the top of the page, like "1. HERPES SIMPLEX VIRUS".
      const headingCandidate = items
        .filter((item) => item.height >= 13 && item.y > baseViewport.height - 130)
        .sort((a, b) => b.height - a.height || b.y - a.y)[0];
      if (headingCandidate && /^\s*\d+[.)]/.test(headingCandidate.str)) {
        const headingText = items
          .filter((item) => Math.abs(item.y - headingCandidate.y) < 4 && item.height >= 13)
          .sort((a, b) => a.x - b.x)
          .map((item) => item.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .replace(/^\s*\d+[.)]\s*/, '')
          .trim();
        if (headingText) {
          currentSection = headingText;
          currentSectionSlug = slugifySection(headingCandidate.str) || slugifySection(headingText);
        }
      }

      const fotoLabels = items
        .map((item) => {
          const match = item.str.match(/Fotografia\s*(\d+)/i);
          return match ? { y: item.y, number: Number(match[1]) } : null;
        })
        .filter((entry): entry is { y: number; number: number } => Boolean(entry))
        .sort((a, b) => b.y - a.y);

      const opList = await page.getOperatorList();
      const placements = collectImagePlacements(opList, ops)
        .map((ctm) => placementToPdfBox(ctm))
        // Ignore decorative slivers (rules, page-wide thin bands).
        .filter((box) => (box.right - box.left) > 40 && (box.top - box.bottom) > 40)
        .sort((a, b) => b.top - a.top);

      if (placements.length === 0) {
        page.cleanup();
        continue;
      }

      // Render the page once so we can crop each photo at full resolution.
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = getCanvasContext(canvas);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;

      for (const box of placements) {
        // Nearest "Fotografia N" label sitting just above this image.
        let label: { y: number; number: number } | null = null;
        let labelIndex = -1;
        for (let i = 0; i < fotoLabels.length; i += 1) {
          const candidate = fotoLabels[i];
          if (candidate.y >= box.top - 6) {
            if (!label || candidate.y < label.y) {
              label = candidate;
              labelIndex = i;
            }
          }
        }

        const photoNumber = label ? label.number : results.length + 1;
        const bandTop = label ? label.y : box.top + 6;
        const bandBottom = labelIndex >= 0 && labelIndex + 1 < fotoLabels.length
          ? fotoLabels[labelIndex + 1].y
          : 0;

        // Caption = right-column text within this photo's vertical band.
        const caption = cleanCaption(
          items
            .filter((item) => (
              item.x > box.right - 4
              && item.y < bandTop - 1
              && item.y > bandBottom + 1
            ))
            .sort((a, b) => b.y - a.y || a.x - b.x)
            .map((item) => item.str)
            .join(' '),
        );

        // Compute viewport crop coords here so they can be reused for vision fallback.
        const [vx0, vy0] = viewport.convertToViewportPoint(box.left, box.top);
        const [vx1, vy1] = viewport.convertToViewportPoint(box.right, box.bottom);
        const cropBox = {
          x: Math.min(vx0, vx1),
          y: Math.min(vy0, vy1),
          width: Math.abs(vx1 - vx0),
          height: Math.abs(vy1 - vy0),
        };
        if (cropBox.width < 24 || cropBox.height < 24) continue;

        // If caption is absent, try vision fallback before skipping.
        let finalCaption = caption;
        if (finalCaption.length < 12 && options?.visionFallback) {
          try {
            const { groqVisionRequest, supportsVision } = await import('./groq');
            const { useAIStore } = await import('../store/aiStore');
            if (supportsVision(useAIStore.getState().provider)) {
              const cropDataUrl = cropCanvasToDataUrl(canvas, cropBox, mimeType, quality);
              finalCaption = await groqVisionRequest(
                cropDataUrl,
                'Ești asistent medical. Descrie pe scurt (1-3 propoziții) ce arată această imagine clinică/dermatologică. Fii specific și concis.',
              );
            }
          } catch {
            // Vision failed — skip image rather than produce empty caption.
          }
        }

        if (finalCaption.length < 12) continue;

        const sectionSlug = currentSectionSlug || 'curs';
        const counterKey = sectionSlug;
        const fallbackNumber = (photoCounters.get(counterKey) ?? 0) + 1;
        photoCounters.set(counterKey, Math.max(fallbackNumber, photoNumber));
        const numberForTag = label ? photoNumber : fallbackNumber;
        const tag = `${sectionSlug}-foto-${String(numberForTag).padStart(2, '0')}`;

        results.push({
          tag,
          section: currentSection || 'Curs',
          photoNumber: numberForTag,
          pageNumber,
          imageDataUrl: cropCanvasToDataUrl(canvas, cropBox, mimeType, quality),
          caption: finalCaption,
        });
      }

      page.cleanup();
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    await pdf.destroy();
  }

  // Guard against duplicate tags (e.g. repeated section names across the document).
  const seenTags = new Map<string, number>();
  for (const entry of results) {
    const count = seenTags.get(entry.tag) ?? 0;
    if (count > 0) entry.tag = `${entry.tag}-${count + 1}`;
    seenTags.set(entry.tag, count + 1);
  }

  return results;
}
