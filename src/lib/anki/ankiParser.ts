/**
 * Reads an Anki `.apkg` file (a zip containing a SQLite collection database plus
 * numbered media blobs) and returns its raw structure — decks, note types
 * ("models"), notes and cards, and the media filename map. Pure parsing, no
 * StudyX-shape mapping here (see `ankiImport.ts` for that).
 */
import JSZip from 'jszip';
// sql.js ships no ESM types re-export point other than the package root; the
// WASM binary is served exactly like pdf.js's worker elsewhere in this app.
import initSqlJs, { type Database } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

/** One card template of a note type — `qfmt`/`afmt` are Anki's mustache-ish front/back formats. */
export interface AnkiTemplate {
  name: string;
  qfmt: string;
  afmt: string;
}

export interface AnkiModel {
  id: string;
  name: string;
  /** Anki's own flag: 1 = Cloze note type, 0/undefined = Basic-family. */
  isCloze: boolean;
  fieldNames: string[];
  /**
   * Card templates, indexed by a card's `ord`. A "Basic (and reversed card)"
   * model has two — that's how one note legitimately becomes two DIFFERENT
   * cards, so this is what keeps the importer from emitting duplicates.
   */
  templates: AnkiTemplate[];
}

export interface AnkiNote {
  id: string;
  modelId: string;
  /** Raw field values, in model field order (split on Anki's \x1f separator). */
  fields: string[];
  tags: string[];
}

export interface AnkiCard {
  id: string;
  noteId: string;
  deckId: string;
  /**
   * Which card of the note this is. For Cloze models it selects the cloze
   * ordinal (`ord` 0 = `{{c1::…}}`); for Basic-family models it indexes into
   * the model's `templates`. Ignoring it collapses every card of a note into
   * the same front/back.
   */
  ord: number;
}

export interface AnkiCollection {
  /** deckId -> full "::"-separated deck name. */
  decks: Map<string, string>;
  models: Map<string, AnkiModel>;
  notes: AnkiNote[];
  cards: AnkiCard[];
  /** original filename -> raw bytes, keyed by the name referenced in field HTML. */
  media: Map<string, Uint8Array>;
}

let sqlJsPromise: ReturnType<typeof initSqlJs> | null = null;
function loadSqlJs() {
  sqlJsPromise ??= initSqlJs({ locateFile: () => sqlWasmUrl });
  return sqlJsPromise;
}

/** Anki's field separator inside `notes.flds` (ASCII Unit Separator). */
const FIELD_SEP = '\x1f';

function queryAll(db: Database, sql: string): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const stmt = db.prepare(sql);
  try {
    while (stmt.step()) rows.push(stmt.getAsObject());
  } finally {
    stmt.free();
  }
  return rows;
}

/**
 * Parses the `col` table's `decks`/`models` JSON blobs — the schema Anki has
 * kept for backward compatibility across versions, present in exported
 * `.apkg` files even where the live collection also has newer normalized
 * tables. Newer zstd-compressed `collection.anki21b` exports are NOT
 * supported (would need a zstd decoder) — surfaced as a clear error instead
 * of a silent failure.
 */
export async function parseApkg(file: File): Promise<AnkiCollection> {
  const zip = await JSZip.loadAsync(file);

  const collectionEntry = zip.file('collection.anki21') ?? zip.file('collection.anki2');
  if (!collectionEntry) {
    if (zip.file('collection.anki21b')) {
      throw new Error(
        'Acest fișier .apkg folosește compresia nouă zstd (Anki 2.1.50+, export "AnkiWeb"). ' +
        'Momentan nu e suportată — reexportă din Anki cu "Support older Anki versions" bifat.',
      );
    }
    throw new Error('Fișierul nu pare un pachet Anki valid (lipsește collection.anki2/anki21).');
  }

  const [dbBytes, mediaEntry, SQL] = await Promise.all([
    collectionEntry.async('uint8array'),
    zip.file('media')?.async('string') ?? Promise.resolve('{}'),
    loadSqlJs(),
  ]);

  const db = new SQL.Database(dbBytes);
  let decks: Map<string, string>;
  let models: Map<string, AnkiModel>;
  let notes: AnkiNote[];
  let cards: AnkiCard[];
  try {
    const colRow = queryAll(db, 'SELECT decks, models FROM col LIMIT 1')[0];
    if (!colRow) throw new Error('Baza de date Anki nu conține niciun rând în tabela "col".');

    const decksJson = JSON.parse(String(colRow.decks ?? '{}')) as Record<string, { name?: string }>;
    decks = new Map(Object.entries(decksJson).map(([id, d]) => [id, d.name ?? 'Default']));

    const modelsJson = JSON.parse(String(colRow.models ?? '{}')) as Record<
      string,
      {
        name?: string;
        type?: number;
        flds?: Array<{ name?: string }>;
        tmpls?: Array<{ name?: string; qfmt?: string; afmt?: string }>;
      }
    >;
    models = new Map(Object.entries(modelsJson).map(([id, m]) => [
      id,
      {
        id,
        name: m.name ?? 'Model',
        isCloze: m.type === 1,
        fieldNames: (m.flds ?? []).map((f) => f.name ?? ''),
        templates: (m.tmpls ?? []).map((t) => ({
          name: t.name ?? '',
          qfmt: t.qfmt ?? '',
          afmt: t.afmt ?? '',
        })),
      },
    ]));

    notes = queryAll(db, 'SELECT id, mid, flds, tags FROM notes').map((row) => ({
      id: String(row.id),
      modelId: String(row.mid),
      fields: String(row.flds ?? '').split(FIELD_SEP),
      tags: String(row.tags ?? '').trim().split(/\s+/).filter(Boolean),
    }));

    cards = queryAll(db, 'SELECT id, nid, did, ord FROM cards').map((row) => ({
      id: String(row.id),
      noteId: String(row.nid),
      deckId: String(row.did),
      ord: Number(row.ord ?? 0),
    }));
  } finally {
    db.close();
  }

  const mediaMap = JSON.parse(mediaEntry || '{}') as Record<string, string>;
  const media = new Map<string, Uint8Array>();
  await Promise.all(
    Object.entries(mediaMap).map(async ([numericKey, originalName]) => {
      const entry = zip.file(numericKey);
      if (!entry) return;
      media.set(originalName, await entry.async('uint8array'));
    }),
  );

  return { decks, models, notes, cards, media };
}
