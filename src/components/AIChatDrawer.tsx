import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Bot, X, SendHorizonal, Loader2 } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useUIStore } from '../store/uiStore';

let aiChatRuntimePromise: Promise<{
  generateChatResponse: typeof import('../ai/AIEngine').generateChatResponse;
  retrieveRelevantChunks: typeof import('../ai/retriever').retrieveRelevantChunks;
}> | null = null;

function loadAIChatRuntime() {
  if (!aiChatRuntimePromise) {
    aiChatRuntimePromise = Promise.all([
      import('../ai/AIEngine'),
      import('../ai/retriever'),
    ]).then(([engine, retriever]) => ({
      generateChatResponse: engine.generateChatResponse,
      retrieveRelevantChunks: retriever.retrieveRelevantChunks,
    }));
  }
  return aiChatRuntimePromise;
}

function formatMessage(content: string) {
  if (!content) return '';
  let text = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  text = text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
  return text;
}

export default function AIChatDrawer() {
  const theme = useTheme();
  const { chatOpen: open, setChatOpen } = useUIStore();
  const reducedMotion = useReducedMotion();
  const performanceLite = typeof document !== 'undefined'
    && document.documentElement.getAttribute('data-performance') === 'lite';
  const calmMotion = reducedMotion || performanceLite;
  const [messages, setMessages] = useState<Array<{
    role: 'user' | 'assistant';
    content: string;
    citations?: Array<{ source: string; topic: string; score: number }>;
  }>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ prompt?: string; open?: boolean }>).detail;
      if (!detail?.prompt) return;
      if (detail.open) setChatOpen(true);
      setInput(detail.prompt);
      requestAnimationFrame(() => textareaRef.current?.focus());
    };
    window.addEventListener('studyx:ai-prompt', handler as EventListener);
    return () => window.removeEventListener('studyx:ai-prompt', handler as EventListener);
  }, [setChatOpen]);

  useEffect(() => {
    if (open) chatEndRef.current?.scrollIntoView({ behavior: calmMotion ? 'auto' : 'smooth' });
  }, [messages, open, calmMotion]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
  }, [input]);

  const sendMessage = async (overrideText?: string) => {
    const text = overrideText || input;
    if (!text.trim() || loading) return;

    const userMsg = { role: 'user' as const, content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { retrieveRelevantChunks, generateChatResponse } = await loadAIChatRuntime();
      const contextChunks = await retrieveRelevantChunks(text, null, 5);
      const citations = contextChunks
        .reduce<Array<{ source: string; topic: string; score: number }>>((acc, chunk) => {
          if (acc.some((item) => item.source === chunk.source && item.topic === chunk.topic)) return acc;
          acc.push({ source: chunk.source, topic: chunk.topic, score: chunk.score });
          return acc;
        }, [])
        .slice(0, 3);
      const contextSummary = contextChunks
        .map((c) => `[Sursa: ${c.source} | Topic: ${c.topic} | Relevanta: ${(c.score * 100).toFixed(0)}%]\n${c.text}`)
        .join('\n\n');
      const response = await generateChatResponse(text, contextSummary, messages);

      setMessages((prev) => [...prev, { role: 'assistant', content: '', citations }]);
      let current = '';
      const words = response.split(' ');
      const batchSize = calmMotion ? words.length : 8;

      for (let i = 0; i < words.length; i += batchSize) {
        const nextWords = words.slice(i, i + batchSize).join(' ');
        current += (current ? ' ' : '') + nextWords;
        const msg = current;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1].content = msg;
          return next;
        });
        if (!calmMotion && i + batchSize < words.length) {
          await new Promise((r) => setTimeout(r, 42));
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Nu am putut genera un raspuns.';
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Eroare: ' + errorMessage }]);
    } finally {
      setLoading(false);
    }
  };

  const closeChat = () => setChatOpen(false);

  return (
    <>
      {!open && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={calmMotion ? undefined : { scale: 1.08, y: -2 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-[9998] flex h-14 w-14 items-center justify-center rounded-[22px] text-white shadow-2xl press-feedback"
          style={{
            background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
            boxShadow: `0 10px 30px ${theme.accent}45, 0 2px 8px rgba(0,0,0,0.12)`,
            backdropFilter: 'blur(14px)',
          }}
        >
          <Bot size={28} />
          <motion.div
            animate={calmMotion ? undefined : { scale: [1, 1.18, 1], opacity: [0.45, 1, 0.45] }}
            transition={calmMotion ? undefined : { repeat: Infinity, duration: 2 }}
            className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white"
            style={{ background: theme.success }}
          />
        </motion.button>
      )}

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeChat}
              className="fixed inset-0 z-[9996] bg-black/18"
            />

            <motion.div
              initial={{ y: 28, opacity: 0, scale: 0.985 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0, scale: 0.985 }}
              transition={calmMotion ? { duration: 0.2, ease: 'easeOut' } : { duration: 0.28, ease: [0.2, 0.9, 0.28, 1] }}
              className="assistant-sheet fixed bottom-5 right-5 z-[9999] flex flex-col overflow-hidden rounded-[34px]"
              style={{
                width: 'min(440px, calc(100vw - 28px))',
                height: 'min(78vh, 760px)',
                background: theme.isDark ? 'rgba(18,18,22,0.86)' : 'rgba(252,252,255,0.84)',
                backdropFilter: calmMotion ? 'blur(16px) saturate(132%)' : 'blur(30px) saturate(165%)',
                border: `1px solid ${theme.border}`,
                WebkitAppRegion: 'no-drag',
                boxShadow: calmMotion ? '0 20px 44px rgba(0,0,0,0.16)' : '0 28px 80px rgba(0,0,0,0.22), 0 6px 20px rgba(0,0,0,0.08)',
                willChange: 'transform, opacity',
                contain: 'layout paint style',
              } as React.CSSProperties}
            >
              <div className="sheet-handle" />
              <div className="relative z-10 flex h-full flex-col">
                <div className="flex items-center gap-4 border-b px-6 py-5" style={{ borderColor: theme.border }}>
                  <div
                    className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-[20px] shadow-2xl"
                    style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, color: '#fff' }}
                  >
                    <Bot size={24} />
                    <motion.div
                      animate={calmMotion ? undefined : { x: ['-100%', '200%'] }}
                      transition={calmMotion ? undefined : { repeat: Infinity, duration: 2, ease: 'linear' }}
                      className="absolute inset-0 bg-white/20 skew-x-[-20deg]"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-black tracking-tighter" style={{ color: theme.text }}>StudyX AI</h3>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: theme.success }} />
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] opacity-50" style={{ color: theme.text }}>
                        Assistant Sheet contextual
                      </p>
                    </div>
                  </div>

                  <div
                    className="hidden items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] sm:flex"
                    style={{ background: theme.surface2, color: theme.text3, border: `1px solid ${theme.border}` }}
                  >
                    Biblioteca + AI
                  </div>

                  <motion.button
                    whileHover={calmMotion ? undefined : { rotate: 90, scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={closeChat}
                    className="rounded-2xl p-2.5 hover:bg-white/5 transition-colors press-feedback"
                    style={{ color: theme.text3 }}
                  >
                    <X size={20} />
                  </motion.button>
                </div>

                <div
                  className="custom-scrollbar flex-1 overflow-y-auto px-6 py-5"
                  style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.04), transparent 28%)' }}
                >
                  {messages.length === 0 ? (
                    <div className="py-8 text-center">
                      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-5 text-6xl">
                        🧠
                      </motion.div>
                      <h4 className="mb-2 text-[1.35rem] font-black tracking-tight" style={{ color: theme.text }}>
                        Cu ce te pot ajuta?
                      </h4>
                      <p className="mb-8 px-6 text-sm font-medium leading-relaxed opacity-60" style={{ color: theme.text }}>
                        Iti raspund pe baza bibliotecii tale, explic concepte medicale si iti arat ce documente mi-au influentat raspunsul.
                      </p>

                      <div className="grid grid-cols-1 gap-2.5 px-1">
                        {[
                          'Explica-mi un concept din curs',
                          'Verifica biblioteca mea AI',
                          'Creeaza un mnemonic creativ',
                          'Genereaza 5 intrebari din documentele mele',
                        ].map((t, i) => (
                          <motion.button
                            key={t}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 + i * 0.1 }}
                            onClick={() => sendMessage(t)}
                            className="premium-card-hover w-full rounded-[22px] border p-4 text-left text-[11px] font-black uppercase tracking-wider transition-all press-feedback"
                            style={{ background: theme.surface2, borderColor: theme.border, color: theme.text }}
                          >
                            {t}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                        {messages.map((msg, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10, scale: 0.985 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                          <div
                            className={`max-w-[86%] ${msg.role === 'assistant' ? 'message-bubble-assistant' : ''} rounded-[24px] p-4 text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'text-white' : ''}`}
                            style={{
                              background: msg.role === 'user' ? `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` : theme.surface2,
                              color: msg.role === 'user' ? '#fff' : theme.text,
                              borderRadius: msg.role === 'user' ? '24px 24px 8px 24px' : '24px 24px 24px 8px',
                              border: msg.role === 'assistant' ? `1px solid ${theme.border}` : 'none',
                              boxShadow: msg.role === 'user' ? `0 10px 24px ${theme.accent}24` : '0 8px 18px rgba(0,0,0,0.04)',
                            }}
                          >
                            <span className="font-medium" dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                            {msg.role === 'assistant' && msg.citations && msg.citations.length > 0 && (
                              <div className="mt-4 flex flex-wrap gap-2">
                                {msg.citations.map((citation) => (
                                  <span key={`${citation.source}-${citation.topic}`} className="citation-pill">
                                    {citation.source} · {citation.topic}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}

                      {loading && messages[messages.length - 1]?.role === 'user' && (
                        <div className="flex justify-start">
                          <div
                            className="rounded-[22px] border p-4"
                            style={{ background: theme.surface2, borderColor: theme.border }}
                          >
                            <Loader2 size={18} className="animate-spin opacity-40" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                <div
                  className="border-t p-5"
                  style={{ borderColor: theme.border, background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.03))' }}
                >
                  <div className="rounded-[26px] p-1.5" style={{ background: theme.surface2, border: `1px solid ${theme.border}` }}>
                    <div className="matte-surface relative flex items-end gap-3 rounded-[22px] border px-4 py-3 transition-all" style={{ borderColor: theme.border }}>
                      <textarea
                        ref={textareaRef}
                        rows={1}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void sendMessage();
                          }
                        }}
                        placeholder="Intreaba StudyX AI..."
                        className="custom-scrollbar max-h-32 min-h-[24px] flex-1 resize-none border-none bg-transparent p-0 text-sm font-medium outline-none focus:ring-0"
                        style={{ color: theme.text, cursor: 'text' }}
                      />
                      <motion.button
                        whileHover={calmMotion ? undefined : { scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        onClick={() => void sendMessage()}
                        disabled={!input.trim() || loading}
                        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] transition-all press-feedback"
                        style={{
                          background: input.trim() && !loading ? `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` : 'transparent',
                          color: input.trim() && !loading ? '#fff' : theme.text3,
                          boxShadow: input.trim() && !loading ? `0 8px 16px ${theme.accent}40` : 'none',
                          cursor: input.trim() && !loading ? 'pointer' : 'default',
                        }}
                      >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <SendHorizonal size={18} />}
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
