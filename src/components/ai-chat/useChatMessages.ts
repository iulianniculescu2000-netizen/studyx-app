import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from './shared';

// v2: bumped to clear old messages with malformed citation.topic === citation.source
export const CHAT_STORAGE_KEY = 'studyx:chat:messages:v2';
/** How many trailing messages survive a reload — older ones are summarized, not persisted verbatim. */
const PERSISTED_MESSAGE_LIMIT = 60;

export type ChatThread = 'general' | 'rezidentiat';

function storageKeyFor(thread: ChatThread): string {
  return thread === 'rezidentiat' ? `${CHAT_STORAGE_KEY}:rezidentiat` : CHAT_STORAGE_KEY;
}

function loadMessages(key: string): ChatMessage[] {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    return JSON.parse(stored) as ChatMessage[];
  } catch {
    return [];
  }
}

/**
 * Owns the chat thread itself: the `messages` array, its localStorage
 * persistence, a `messagesRef` mirror for reads inside async closures (the
 * agent planner's history, the summarizer), and the scroll-to-bottom effect.
 *
 * `thread` selects which conversation is live — Rezidențiat and the general
 * app keep fully separate histories/storage so switching between them never
 * mixes context.
 *
 * Deliberately just state + persistence — every other concern (streaming,
 * agent commands, studio generation) reads/writes `messages` through the
 * setter this returns, so none of that logic needs to move here too.
 */
export function useChatMessages(options: { open: boolean; calmMotion: boolean; thread: ChatThread }) {
  const { open, calmMotion, thread } = options;
  const storageKey = storageKeyFor(thread);

  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages(storageKey));

  const chatEndRef = useRef<HTMLDivElement>(null);
  const [prevStorageKey, setPrevStorageKey] = useState(storageKey);
  const messagesRef = useRef<ChatMessage[]>([]);

  if (storageKey !== prevStorageKey) {
    setPrevStorageKey(storageKey);
    setMessages(loadMessages(storageKey));
  }

  // Follow the conversation, but never fight the reader: a new message always scrolls into
  // view, while streaming chunks only do so if the reader is already near the bottom (so they can
  // scroll up during a long answer), and without restarting a smooth animation on every chunk.
  const lastCountRef = useRef(0);
  useEffect(() => {
    if (!open) return;
    const end = chatEndRef.current;
    if (!end) return;
    const isNewMessage = messages.length !== lastCountRef.current;
    lastCountRef.current = messages.length;
    const scroller = end.closest('.custom-scrollbar') as HTMLElement | null;
    const nearBottom = !scroller || scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120;
    if (!isNewMessage && !nearBottom) return;
    end.scrollIntoView({ behavior: calmMotion || !isNewMessage ? 'auto' : 'smooth' });
  }, [messages, open, calmMotion]);

  useEffect(() => {
    messagesRef.current = messages;
    try {
      const toSave = messages.slice(-PERSISTED_MESSAGE_LIMIT);
      localStorage.setItem(storageKey, JSON.stringify(toSave));
    } catch {
      // quota exceeded — ignore
    }
  }, [messages, storageKey]);

  return { messages, setMessages, messagesRef, chatEndRef };
}
