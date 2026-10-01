/**
 * Dependency-free renderer for the AI chat's visual schemas.
 *
 * The model is asked to emit a Mermaid flowchart (```mermaid + `graph TD`), a
 * syntax every LLM already writes fluently. We parse a safe subset of it and lay
 * it out ourselves into inline SVG — no mermaid bundle, works offline in
 * Electron, and renders identically in light & dark because every color is
 * either `currentColor` or a translucent accent.
 *
 * Anything we cannot parse falls back to the plain code block upstream, so a
 * malformed diagram never breaks a chat message.
 */

/**
 * Marks a block the chat can open full-screen. The chat drawer delegates clicks
 * and re-renders the matched element's markup inside an overlay, so wide
 * schemas and tables are readable without widening every message bubble.
 */
export const ZOOM_ATTR = 'data-sx-zoom="1"';

export type DiagramDirection = 'TD' | 'LR';

export type NodeShape = 'process' | 'decision' | 'terminal' | 'accent';

export interface DiagramNode {
  id: string;
  label: string;
  shape: NodeShape;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
}

export interface ParsedDiagram {
  direction: DiagramDirection;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

/** Languages we accept on the fence: ```mermaid, ```flowchart, ```graph, ```schema. */
export function isDiagramLanguage(lang: string) {
  return /^(mermaid|flowchart|graph|schema|schem[ăa])$/i.test(lang.trim());
}

// ── Parsing ──────────────────────────────────────────────────────────────────

// `id[Label]`, `id{Label}`, `id(Label)`, `id((Label))`, `id([Label])`, or bare `id`.
const NODE_RE = /^([A-Za-z0-9_À-ɏ]+)\s*(\(\(|\(\[|\{|\[|\()?/;

const SHAPE_CLOSERS: Record<string, { close: string; shape: NodeShape }> = {
  '[': { close: ']', shape: 'process' },
  '{': { close: '}', shape: 'decision' },
  '(': { close: ')', shape: 'terminal' },
  '([': { close: '])', shape: 'terminal' },
  '((': { close: '))', shape: 'accent' },
};

function decodeEntities(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function cleanLabel(raw: string) {
  return decodeEntities(raw)
    .replace(/^["']|["']$/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/[*`]/g, '')
    .trim();
}

interface TokenResult {
  node: DiagramNode;
  rest: string;
}

/** Reads one node token from the head of `text`; returns null when it isn't one. */
function readNode(text: string): TokenResult | null {
  const match = NODE_RE.exec(text.trimStart());
  if (!match) return null;
  const trimmed = text.trimStart();
  const id = match[1];
  const opener = match[2];

  if (!opener) {
    return { node: { id, label: id, shape: 'process' }, rest: trimmed.slice(match[0].length) };
  }

  const spec = SHAPE_CLOSERS[opener];
  const bodyStart = match[0].length;
  const closeIndex = trimmed.indexOf(spec.close, bodyStart);
  if (closeIndex === -1) return null;

  const label = cleanLabel(trimmed.slice(bodyStart, closeIndex));
  return {
    node: { id, label: label || id, shape: spec.shape },
    rest: trimmed.slice(closeIndex + spec.close.length),
  };
}

const ARROW_RE = /^\s*(-{2,}>|-\.-+>|={2,}>|-{3,}|-\.-+)\s*(\|([^|]*)\||"([^"]*)")?\s*/;

export function parseDiagram(source: string): ParsedDiagram | null {
  // The chat pipeline HTML-escapes model text before formatting, so arrows
  // arrive as `--&gt;`. Restore them; label text is re-escaped at render time.
  const rawLines = source.replace(/&gt;/g, '>').split('\n');
  let direction: DiagramDirection = 'TD';

  const nodes = new Map<string, DiagramNode>();
  const edges: DiagramEdge[] = [];

  const upsert = (node: DiagramNode) => {
    const existing = nodes.get(node.id);
    // A later, richer declaration wins over a bare id reference.
    if (!existing || (existing.label === existing.id && node.label !== node.id)) {
      nodes.set(node.id, node);
    }
  };

  for (const rawLine of rawLines) {
    const line = rawLine.trim().replace(/;+$/, '');
    if (!line) continue;

    const header = /^(?:graph|flowchart)\s+(TD|TB|LR|RL|BT)\b/i.exec(line);
    if (header) {
      const value = header[1].toUpperCase();
      direction = value === 'LR' || value === 'RL' ? 'LR' : 'TD';
      continue;
    }

    // Structural noise we intentionally ignore rather than fail on.
    if (/^(subgraph|end|classDef|class|style|linkStyle|click|%%)/i.test(line)) continue;

    const first = readNode(line);
    if (!first) continue;
    upsert(first.node);

    // `A --> B --> C` chains: each parsed target becomes the next edge's source.
    let source = first.node;
    let cursor = first.rest;
    while (cursor.trim()) {
      const arrow = ARROW_RE.exec(cursor);
      if (!arrow) break;
      const next = readNode(cursor.slice(arrow[0].length));
      if (!next) break;

      upsert(next.node);
      edges.push({
        from: source.id,
        to: next.node.id,
        label: (arrow[3] ?? arrow[4] ?? '').trim() || undefined,
        dashed: arrow[1].includes('.'),
      });
      source = next.node;
      cursor = next.rest;
    }
  }

  if (nodes.size === 0 || edges.length === 0) return null;
  return { direction, nodes: [...nodes.values()], edges };
}

// ── Layout ───────────────────────────────────────────────────────────────────

const FONT_SIZE = 13;
const CHAR_WIDTH = 7.1;
const LINE_HEIGHT = 17;
const PAD_X = 16;
const PAD_Y = 14;
const MIN_W = 88;
const MAX_W = 210;
const GAP_MAIN = 58; // between layers
const GAP_CROSS = 24; // between siblings in a row
const GAP_ROW = 20; // between wrapped rows of the same layer
/** Cross-axis budget before a layer wraps: keeps wide fan-outs readable in the chat. */
const CROSS_CAPACITY_TD = 660;
const CROSS_CAPACITY_LR = 520;
const MARGIN = 14;

export function wrapLabel(label: string, maxChars = 26): string[] {
  const out: string[] = [];
  for (const paragraph of label.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    let line = '';
    for (const word of words) {
      if (!line) {
        line = word;
      } else if (line.length + 1 + word.length <= maxChars) {
        line += ` ${word}`;
      } else {
        out.push(line);
        line = word;
      }
    }
    if (line) out.push(line);
  }
  return out.length ? out.slice(0, 4) : [label];
}

interface PlacedNode extends DiagramNode {
  lines: string[];
  width: number;
  height: number;
  x: number;
  y: number;
}

/** Longest-path layering, cycle-safe (a back edge never pushes a node deeper). */
function computeLayers(nodes: DiagramNode[], edges: DiagramEdge[]) {
  const depth = new Map<string, number>();
  nodes.forEach((node) => depth.set(node.id, 0));

  const incoming = new Map<string, number>();
  nodes.forEach((node) => incoming.set(node.id, 0));
  edges.forEach((edge) => incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1));

  const maxPasses = Math.min(nodes.length, 24);
  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false;
    for (const edge of edges) {
      if (edge.from === edge.to) continue;
      const candidate = (depth.get(edge.from) ?? 0) + 1;
      if (candidate > (depth.get(edge.to) ?? 0) && candidate < nodes.length) {
        depth.set(edge.to, candidate);
        changed = true;
      }
    }
    if (!changed) break;
  }

  return depth;
}

function layout(diagram: ParsedDiagram) {
  const depth = computeLayers(diagram.nodes, diagram.edges);

  const placed: PlacedNode[] = diagram.nodes.map((node) => {
    const lines = wrapLabel(node.label);
    const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
    const width = Math.max(MIN_W, Math.min(MAX_W, longest * CHAR_WIDTH + PAD_X * 2));
    const height = lines.length * LINE_HEIGHT + PAD_Y * 2;
    return { ...node, lines, width, height, x: 0, y: 0 };
  });

  const byId = new Map(placed.map((node) => [node.id, node]));
  const layers = new Map<number, PlacedNode[]>();
  placed.forEach((node) => {
    const level = depth.get(node.id) ?? 0;
    const bucket = layers.get(level) ?? [];
    bucket.push(node);
    layers.set(level, bucket);
  });

  const orderedLevels = [...layers.keys()].sort((a, b) => a - b);
  const horizontal = diagram.direction === 'LR';
  const crossOf = (node: PlacedNode) => (horizontal ? node.height : node.width);
  const mainOf = (node: PlacedNode) => (horizontal ? node.width : node.height);

  // A chapter hub with eight children would otherwise be one 1500px-wide row.
  // Wide layers wrap into several rows so the whole schema stays compact.
  const capacity = horizontal ? CROSS_CAPACITY_LR : CROSS_CAPACITY_TD;
  const rowsPerLayer = new Map<number, PlacedNode[][]>();
  for (const level of orderedLevels) {
    const bucket = layers.get(level)!;
    const rows: PlacedNode[][] = [];
    let row: PlacedNode[] = [];
    let rowCross = 0;
    for (const node of bucket) {
      const next = rowCross === 0 ? crossOf(node) : rowCross + GAP_CROSS + crossOf(node);
      if (row.length > 0 && next > capacity) {
        rows.push(row);
        row = [node];
        rowCross = crossOf(node);
        continue;
      }
      row.push(node);
      rowCross = next;
    }
    if (row.length > 0) rows.push(row);
    rowsPerLayer.set(level, rows);
  }

  const rowCrossSize = (row: PlacedNode[]) =>
    row.reduce((sum, node) => sum + crossOf(node), 0) + GAP_CROSS * (row.length - 1);

  // Main axis offsets: each layer takes as many rows as it needed above.
  let mainOffset = MARGIN;
  const layerMain = new Map<number, number>();
  const rowExtents = new Map<number, number[]>();
  for (const level of orderedLevels) {
    const rows = rowsPerLayer.get(level)!;
    const extents = rows.map((row) => row.reduce((max, node) => Math.max(max, mainOf(node)), 0));
    layerMain.set(level, mainOffset);
    rowExtents.set(level, extents);
    mainOffset += extents.reduce((sum, extent) => sum + extent, 0) + GAP_ROW * (rows.length - 1) + GAP_MAIN;
  }
  const mainSize = mainOffset - GAP_MAIN + MARGIN;

  // Cross axis: center every row against the widest one in the whole schema.
  let crossSize = 0;
  for (const level of orderedLevels) {
    for (const row of rowsPerLayer.get(level)!) {
      crossSize = Math.max(crossSize, rowCrossSize(row));
    }
  }
  crossSize += MARGIN * 2;

  for (const level of orderedLevels) {
    const rows = rowsPerLayer.get(level)!;
    const extents = rowExtents.get(level)!;
    let main = layerMain.get(level)!;

    rows.forEach((row, rowIndex) => {
      let cross = (crossSize - rowCrossSize(row)) / 2;
      for (const node of row) {
        if (horizontal) {
          node.x = main + (extents[rowIndex] - node.width) / 2;
          node.y = cross;
          cross += node.height + GAP_CROSS;
        } else {
          node.y = main + (extents[rowIndex] - node.height) / 2;
          node.x = cross;
          cross += node.width + GAP_CROSS;
        }
      }
      main += extents[rowIndex] + GAP_ROW;
    });
  }

  return {
    placed,
    byId,
    width: horizontal ? mainSize : crossSize,
    height: horizontal ? crossSize : mainSize,
    horizontal,
  };
}

// ── SVG rendering ────────────────────────────────────────────────────────────

const PALETTE: Record<NodeShape, { stroke: string; fill: string }> = {
  process: { stroke: 'rgba(99,102,241,0.62)', fill: 'rgba(99,102,241,0.13)' },
  decision: { stroke: 'rgba(245,158,11,0.68)', fill: 'rgba(245,158,11,0.14)' },
  terminal: { stroke: 'rgba(16,185,129,0.62)', fill: 'rgba(16,185,129,0.13)' },
  accent: { stroke: 'rgba(244,63,94,0.62)', fill: 'rgba(244,63,94,0.13)' },
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nodeShapePath(node: PlacedNode) {
  const { x, y, width: w, height: h, shape } = node;
  const color = PALETTE[shape];
  const common = `fill="${color.fill}" stroke="${color.stroke}" stroke-width="1.5"`;

  if (shape === 'decision') {
    const cx = x + w / 2;
    const cy = y + h / 2;
    // A diamond needs more room than the text box, so it is drawn inflated.
    const dx = w / 2 + 12;
    const dy = h / 2 + 10;
    return `<polygon points="${cx},${cy - dy} ${cx + dx},${cy} ${cx},${cy + dy} ${cx - dx},${cy}" ${common}/>`;
  }

  const radius = shape === 'terminal' || shape === 'accent' ? h / 2 : 11;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" ry="${radius}" ${common}/>`;
}

function nodeText(node: PlacedNode) {
  const cx = node.x + node.width / 2;
  const startY = node.y + node.height / 2 - ((node.lines.length - 1) * LINE_HEIGHT) / 2 + 1;
  const weight = node.shape === 'decision' || node.shape === 'accent' ? 700 : 600;
  return node.lines
    .map(
      (line, index) =>
        `<text x="${cx}" y="${startY + index * LINE_HEIGHT}" text-anchor="middle" dominant-baseline="middle" font-size="${FONT_SIZE}" font-weight="${weight}" fill="currentColor">${escapeXml(line)}</text>`,
    )
    .join('');
}

interface Point {
  x: number;
  y: number;
}

/** Fan-out slot: k-th of n edges leaving/entering a border, spread over its middle half. */
function slot(size: number, index: number, count: number) {
  if (count <= 1) return size / 2;
  const usable = Math.min(size - 16, size * 0.7);
  return size / 2 - usable / 2 + (usable * index) / (count - 1);
}

interface Fan {
  outIndex: number;
  outCount: number;
  inIndex: number;
  inCount: number;
}

/**
 * Anchor points on the node borders. Edges sharing a node are fanned out along
 * that border so parallel branches (and their labels) never overlap.
 */
function anchors(from: PlacedNode, to: PlacedNode, horizontal: boolean, fan: Fan): [Point, Point] {
  const inflate = (node: PlacedNode) => (node.shape === 'decision' ? 10 : 0);

  if (horizontal) {
    const forward = to.x >= from.x;
    return [
      {
        x: forward ? from.x + from.width : from.x,
        y: from.y + slot(from.height, fan.outIndex, fan.outCount),
      },
      {
        x: forward ? to.x - inflate(to) : to.x + to.width + inflate(to),
        y: to.y + slot(to.height, fan.inIndex, fan.inCount),
      },
    ];
  }

  const forward = to.y >= from.y;
  return [
    {
      x: from.x + slot(from.width, fan.outIndex, fan.outCount),
      y: forward ? from.y + from.height + inflate(from) : from.y - inflate(from),
    },
    {
      x: to.x + slot(to.width, fan.inIndex, fan.inCount),
      y: forward ? to.y - inflate(to) : to.y + to.height + inflate(to),
    },
  ];
}

/** Control points of the cubic used for an edge — shared by the path and its label. */
function edgeCurve(start: Point, end: Point, horizontal: boolean): [Point, Point, Point, Point] {
  if (horizontal) {
    const midX = (start.x + end.x) / 2;
    return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
  }
  const midY = (start.y + end.y) / 2;
  return [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end];
}

function edgePath(curve: [Point, Point, Point, Point]) {
  const [p0, p1, p2, p3] = curve;
  return `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;
}

function pointOnCurve(curve: [Point, Point, Point, Point], t: number): Point {
  const [p0, p1, p2, p3] = curve;
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

let markerSeq = 0;

/** A hub is one node branching into simple leaves — a book's chapter list, typically. */
const HUB_MIN_CHILDREN = 4;

interface HubShape {
  root: DiagramNode;
  children: DiagramNode[];
}

/**
 * Detects "one node, many leaves": a table of contents, a classification, a list
 * of causes. Drawn as a graph it becomes a very wide row (or a grid crossed by
 * long curves); drawn as a bracketed list it is compact and instantly readable.
 */
function detectHub(diagram: ParsedDiagram): HubShape | null {
  if (diagram.nodes.length < HUB_MIN_CHILDREN + 1) return null;

  const rootId = diagram.edges[0]?.from;
  if (!rootId) return null;
  if (!diagram.edges.every((edge) => edge.from === rootId)) return null;

  const byId = new Map(diagram.nodes.map((node) => [node.id, node]));
  const root = byId.get(rootId);
  if (!root) return null;

  const seen = new Set<string>();
  const children: DiagramNode[] = [];
  for (const edge of diagram.edges) {
    if (edge.to === rootId || seen.has(edge.to)) continue;
    const child = byId.get(edge.to);
    if (!child) return null;
    seen.add(edge.to);
    children.push(child);
  }

  // Every node must take part, otherwise this is a richer graph than a hub.
  if (children.length + 1 !== diagram.nodes.length) return null;
  return children.length >= HUB_MIN_CHILDREN ? { root, children } : null;
}

const HUB_ROOT_GAP = 34; // root → rail
const HUB_RAIL_GAP = 26; // rail → child
const HUB_ROW_GAP = 12;

/** Bracketed-list rendering for the hub shape: root on the left, leaves stacked right. */
function renderHubSvg(hub: HubShape, markerId: string): { markup: string; width: number; height: number } {
  const measure = (node: DiagramNode, maxChars: number) => {
    const lines = wrapLabel(node.label, maxChars);
    const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
    return {
      ...node,
      lines,
      width: Math.max(MIN_W, Math.min(MAX_W + 40, longest * CHAR_WIDTH + PAD_X * 2)),
      height: lines.length * LINE_HEIGHT + PAD_Y * 2,
      x: 0,
      y: 0,
    } as PlacedNode;
  };

  const root = measure(hub.root, 20);
  const children = hub.children.map((child) => measure(child, 30));
  const childWidth = children.reduce((max, child) => Math.max(max, child.width), 0);

  // Root sits on top like a title, with the rail dropping from it — a centered
  // root would leave a tall empty column beside a long chapter list.
  root.x = MARGIN;
  root.y = MARGIN;

  const railX = MARGIN + Math.min(30, root.width / 2);
  const columnX = railX + HUB_RAIL_GAP;
  let cursorY = root.y + root.height + HUB_ROOT_GAP;
  for (const child of children) {
    child.x = columnX;
    child.y = cursorY;
    child.width = childWidth; // one column reads calmer than ragged cards
    cursorY += child.height + HUB_ROW_GAP;
  }

  const totalHeight = cursorY - HUB_ROW_GAP + MARGIN;
  const lastCenter = children[children.length - 1].y + children[children.length - 1].height / 2;

  const connectors = [
    `<path d="M ${railX} ${root.y + root.height} V ${lastCenter}" fill="none" stroke="currentColor" stroke-opacity="0.42" stroke-width="1.6"/>`,
    ...children.map((child) => {
      const center = child.y + child.height / 2;
      return `<path d="M ${railX} ${center} H ${child.x}" fill="none" stroke="currentColor" stroke-opacity="0.42" stroke-width="1.6" marker-end="url(#${markerId})"/>`;
    }),
  ].join('');

  const nodes = [root, ...children].map((node) => `${nodeShapePath(node)}${nodeText(node)}`).join('');

  return {
    markup: `${connectors}${nodes}`,
    width: Math.max(columnX + childWidth, MARGIN + root.width) + MARGIN,
    height: totalHeight,
  };
}

/** Renders a parsed diagram to standalone inline SVG markup. */
/**
 * A wide LR chain squeezed into the chat column shrinks until the labels are
 * unreadable. Past this width the same graph is re-laid-out top-down, which is
 * tall (and scrollable) but stays at full size.
 */
const LR_REFLOW_WIDTH = 720;

/** Below this the SVG may scale down to fit; above it the wrapper scrolls instead. */
const SHRINK_LIMIT = 560;

export function renderDiagramSvg(diagram: ParsedDiagram): string {
  markerSeq += 1;
  const hubMarkerId = `sx-arrow-${markerSeq}`;

  const hub = detectHub(diagram);
  if (hub) {
    const { markup, width, height } = renderHubSvg(hub, hubMarkerId);
    return wrapSvg(markup, width, height, hubMarkerId);
  }

  let computed = layout(diagram);
  if (diagram.direction === 'LR' && computed.width > LR_REFLOW_WIDTH) {
    computed = layout({ ...diagram, direction: 'TD' });
  }
  const { placed, byId, width, height, horizontal } = computed;
  const markerId = hubMarkerId;

  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  diagram.edges.forEach((edge, index) => {
    if (edge.from === edge.to) return;
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), String(index)]);
    incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), String(index)]);
  });

  const edgeMarkup = diagram.edges
    .map((edge, index) => {
      const from = byId.get(edge.from);
      const to = byId.get(edge.to);
      if (!from || !to || from === to) return '';
      const outSlots = outgoing.get(edge.from) ?? [];
      const inSlots = incoming.get(edge.to) ?? [];
      const [start, end] = anchors(from, to, horizontal, {
        outIndex: Math.max(0, outSlots.indexOf(String(index))),
        outCount: outSlots.length,
        inIndex: Math.max(0, inSlots.indexOf(String(index))),
        inCount: inSlots.length,
      });
      const curve = edgeCurve(start, end, horizontal);
      const dash = edge.dashed ? ' stroke-dasharray="5 4"' : '';
      const path = `<path d="${edgePath(curve)}" fill="none" stroke="currentColor" stroke-opacity="0.42" stroke-width="1.6"${dash} marker-end="url(#${markerId})"/>`;
      if (!edge.label) return path;

      // Anchored near the source (mermaid convention) so an edge that skips a
      // layer never drops its label on top of an unrelated node.
      // Alternate the distance for sibling branches so two labels leaving the
      // same node are never printed side by side.
      const anchor = pointOnCurve(curve, outSlots.indexOf(String(index)) % 2 === 0 ? 0.22 : 0.4);
      const label = escapeXml(edge.label);
      const boxWidth = label.length * 6.4 + 12;
      return `${path}<rect x="${anchor.x - boxWidth / 2}" y="${anchor.y - 9}" width="${boxWidth}" height="18" rx="9" fill="rgba(128,128,128,0.22)"/><text x="${anchor.x}" y="${anchor.y + 1}" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="700" fill="currentColor" fill-opacity="0.9">${label}</text>`;
    })
    .join('');

  const nodeMarkup = placed.map((node) => `${nodeShapePath(node)}${nodeText(node)}`).join('');

  return wrapSvg(`${edgeMarkup}${nodeMarkup}`, width, height, markerId);
}

/** Shared chrome: zoom wrapper, scroll box, arrow marker, and fit-vs-scroll sizing. */
function wrapSvg(inner: string, width: number, height: number, markerId: string): string {
  const boxWidth = Math.round(width);
  const boxHeight = Math.round(height);
  // Narrow schemas may scale down to fit the bubble; wider ones keep their
  // natural size and the wrapper scrolls, so the text never becomes tiny.
  const sizing = boxWidth <= SHRINK_LIMIT
    ? 'max-width:100%;height:auto;'
    : `min-width:${boxWidth}px;`;

  return [
    `<div ${ZOOM_ATTR} style="position:relative;margin:10px 0;border:1px solid rgba(128,128,128,0.22);border-radius:14px;background:rgba(128,128,128,0.05);cursor:zoom-in;">`,
    '<div data-sx-hint="1" style="position:absolute;top:6px;right:10px;z-index:1;font-size:10px;font-weight:700;letter-spacing:0.04em;opacity:0.55;pointer-events:none;">⤢ MĂREȘTE</div>',
    '<div style="overflow-x:auto;padding:10px 4px;border-radius:14px;">',
    `<svg viewBox="0 0 ${boxWidth} ${boxHeight}" width="${boxWidth}" height="${boxHeight}" style="${sizing}display:block;margin:0 auto;color:currentColor;font-family:inherit;" role="img" aria-label="Schemă generată de StudyX AI">`,
    `<defs><marker id="${markerId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" fill-opacity="0.5"/></marker></defs>`,
    inner,
    '</svg>',
    '</div>',
    '</div>',
  ].join('');
}

/** Parse + render in one step; returns null when the block isn't a usable diagram. */
export function renderDiagramBlock(source: string): string | null {
  try {
    const parsed = parseDiagram(source);
    if (!parsed) return null;
    if (parsed.nodes.length > 40 || parsed.edges.length > 60) return null;
    return renderDiagramSvg(parsed);
  } catch {
    return null;
  }
}
