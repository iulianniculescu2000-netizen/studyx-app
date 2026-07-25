/**
 * Shared `studyx:ai-prompt` event payloads for chapter-scoped actions (Discută / Generează
 * grile), so the Knowledge Vault reader and the Residency bookshelf dispatch identically —
 * one place to change the prompt wording or event shape instead of two.
 */

export interface ChapterEventSource {
  id: string;
  name: string;
}

function dispatchChapterEvent(detail: {
  view: 'chat' | 'studio';
  mode: 'explain' | 'summarize';
  source: ChapterEventSource;
  heading: string;
  prompt: string;
}) {
  window.dispatchEvent(new CustomEvent('studyx:ai-prompt', {
    detail: {
      open: true,
      view: detail.view,
      mode: detail.mode,
      sourceId: detail.source.id,
      sourceName: detail.source.name,
      heading: detail.heading,
      resetConversation: true,
      prompt: detail.prompt,
    },
  }));
}

/** Opens the AI Studio panel with this chapter pre-selected, ready to generate. */
export function dispatchGenerateFromChapter(source: ChapterEventSource, heading: string, label: string) {
  dispatchChapterEvent({
    view: 'studio',
    mode: 'summarize',
    source,
    heading,
    prompt: `Generează grile din capitolul "${label}" al documentului "${source.name}".`,
  });
}

/** Opens the chat with a conversational prompt about this chapter. */
export function dispatchDiscussChapter(source: ChapterEventSource, heading: string, label: string) {
  dispatchChapterEvent({
    view: 'chat',
    mode: 'explain',
    source,
    heading,
    prompt: `Hai să discutăm capitolul "${label}" din cartea "${source.name}". Explică-mi ce e important din el și răspunde-mi la întrebări pe măsură ce le am.`,
  });
}
