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
  const messagesRef = useRef<ChatMessage[]>([]);
  const storageKeyRef = useRef(storageKey);

  useEffect(() => {
    if (storageKeyRef.current === storageKey) return;
    storageKeyRef.current = storageKey;
    setMessages(loadMessages(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (open) {
      chatEndRef.current?.scrollIntoView({ behavior: calmMotion ? 'auto' : 'smooth' });
    }
  }, [messages, open, calmMotion]);

  useEffect(() => {
    messagesRef.current = messages;
    try {
      const toSave = messages.slice(-PERSISTED_MESSAGE_LIMIT);
      localStorage.setItem(storageKeyRef.current, JSON.stringify(toSave));
    } catch {
      // quota exceeded — ignore
    }
  }, [messages]);

  return { messages, setMessages, messagesRef, chatEndRef };
}
