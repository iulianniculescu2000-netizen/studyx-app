import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from './shared';

// v2: bumped to clear old messages with malformed citation.topic === citation.source
export const CHAT_STORAGE_KEY = 'studyx:chat:messages:v2';
/** How many trailing messages survive a reload — older ones are summarized, not persisted verbatim. */
const PERSISTED_MESSAGE_LIMIT = 60;

/**
 * Owns the chat thread itself: the `messages` array, its localStorage
 * persistence, a `messagesRef` mirror for reads inside async closures (the
 * agent planner's history, the summarizer), and the scroll-to-bottom effect.
 *
 * Deliberately just state + persistence — every other concern (streaming,
 * agent commands, studio generation) reads/writes `messages` through the
 * setter this returns, so none of that logic needs to move here too.
 */
export function useChatMessages(options: { open: boolean; calmMotion: boolean }) {
  const { open, calmMotion } = options;

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY);
      if (!stored) return [];
      return JSON.parse(stored) as ChatMessage[];
    } catch {
      return [];
    }
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    if (open) {
      chatEndRef.current?.scrollIntoView({ behavior: calmMotion ? 'auto' : 'smooth' });
    }
  }, [messages, open, calmMotion]);

  useEffect(() => {
    messagesRef.current = messages;
    try {
      const toSave = messages.slice(-PERSISTED_MESSAGE_LIMIT);
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // quota exceeded — ignore
    }
  }, [messages]);

  return { messages, setMessages, messagesRef, chatEndRef };
}
