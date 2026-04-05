import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, X, SendHorizonal, Loader2 } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useUIStore } from '../store/uiStore';
import { generateChatResponse } from '../ai/AIEngine';
import { retrieveRelevantChunks } from '../ai/retriever';

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
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const sendMessage = async (overrideText?: string) => {
    const text = overrideText || input;
    if (!text.trim() || loading) return;

    const userMsg = { role: 'user' as const, content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const contextChunks = await retrieveRelevantChunks(text, null, 5);
      const contextSummary = contextChunks.map(c => c.text).join('\n\n');
      const response = await generateChatResponse(text, contextSummary, messages);
      
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      let current = "";
      const words = response.split(' ');
      for(let i=0; i<words.length; i++) {
        current += (i === 0 ? "" : " ") + words[i];
        const msg = current;
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1].content = msg;
          return next;
        });
        await new Promise(r => setTimeout(r, 20));
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Nu am putut genera un răspuns.';
      setMessages(prev => [...prev, { role: 'assistant', content: 'Eroare: ' + errorMessage }]);
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
          whileHover={{ scale: 1.1, y: -2 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setChatOpen(true)}
          className="fixed bottom-8 right-8 w-14 h-14 rounded-2xl z-[900] flex items-center justify-center text-white shadow-2xl transition-all"
          style={{ 
            background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
            boxShadow: `0 8px 32px ${theme.accent}60`,
            backdropFilter: 'blur(10px)'
          }}
        >
          <Bot size={28} />
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white"
            style={{ background: theme.success }}
          />
        </motion.button>
      )}

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeChat}
              className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ x: '100%' }} 
              animate={{ x: 0 }} 
              exit={{ x: '100%' }}
              transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
              className="fixed right-0 bottom-0 z-[9998] flex flex-col"
              style={{ 
                top: 40,
                width: 420, 
                maxWidth: '100%', 
                background: theme.isDark ? 'rgba(15,15,20,0.85)' : 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(32px) saturate(180%)',
                borderLeft: `1px solid ${theme.border}`,
                WebkitAppRegion: 'no-drag',
                boxShadow: '-20px 0 80px rgba(0,0,0,0.25)'
              } as React.CSSProperties}
            >
              <div className="relative flex flex-col h-full z-10">
                <div className="flex items-center gap-4 px-6 py-5 border-b" style={{ borderColor: theme.border }}>
                  <div className="w-12 h-12 rounded-[20px] flex items-center justify-center shadow-2xl relative overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, color: '#fff' }}>
                    <Bot size={24} />
                    <motion.div 
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                      className="absolute inset-0 bg-white/20 skew-x-[-20deg]"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-black tracking-tighter" style={{ color: theme.text }}>StudyX AI</h3>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: theme.success }} />
                      <p className="text-[10px] font-black uppercase opacity-50 tracking-[0.15em]" style={{ color: theme.text }}>Online & Pregătit</p>
                    </div>
                  </div>
                  <motion.button whileHover={{ rotate: 90, scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    onClick={closeChat}
                    className="p-2.5 rounded-2xl hover:bg-white/5 transition-colors" style={{ color: theme.text3 }}>
                    <X size={20} />
                  </motion.button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  {messages.length === 0 && (
                    <div className="text-center py-10">
                      <motion.div 
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-6xl mb-6">🧠</motion.div>
                      <h4 className="text-xl font-black mb-2 tracking-tight" style={{ color: theme.text }}>Cu ce te pot ajuta?</h4>
                      <p className="text-sm font-medium opacity-50 mb-10 px-6 leading-relaxed" style={{ color: theme.text }}>
                        Analizez cursurile tale și îți pot explica concepte complexe sau genera grile noi.
                      </p>
                      <div className="space-y-2.5 px-2">
                        {[
                          'Explică-mi un concept din curs',
                          'Verifică biblioteca mea AI',
                          'Creează un mnemonic creativ'
                        ].map((t, i) => (
                          <motion.button key={t} 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 + i * 0.1 }}
                            onClick={() => sendMessage(t)}
                            className="w-full text-left p-4 rounded-2xl text-[11px] font-black uppercase tracking-wider border transition-all hover:bg-accent/5 hover:translate-x-1"
                            style={{ background: theme.surface2, borderColor: theme.border, color: theme.text }}>
                            {t}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map((msg, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'text-white' : ''}`}
                        style={{
                          background: msg.role === 'user' 
                            ? `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` 
                            : theme.surface2,
                          color: msg.role === 'user' ? '#fff' : theme.text,
                          borderRadius: msg.role === 'user' ? '24px 24px 4px 24px' : '24px 24px 24px 4px',
                          border: msg.role === 'assistant' ? `1px solid ${theme.border}` : 'none',
                          boxShadow: msg.role === 'user' ? `0 8px 24px ${theme.accent}30` : 'none'
                        }}>
                        <span className="font-medium" dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                      </div>
                    </motion.div>
                  ))}
                  {loading && messages[messages.length-1]?.role === 'user' && (
                    <div className="flex justify-start">
                      <div className="p-4 rounded-2xl bg-surface2 border border-border" style={{ background: theme.surface2, borderColor: theme.border }}>
                        <Loader2 size={18} className="animate-spin opacity-40" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-6 border-t bg-black/5" style={{ borderColor: theme.border }}>
                  <div className="relative flex items-center gap-3 glass-panel rounded-2xl px-5 py-3 border focus-within:ring-2 transition-all"
                    style={{ borderColor: theme.border }}>
                    <textarea
                      rows={1}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      placeholder="Întreabă StudyX AI..."
                      className="flex-1 bg-transparent border-none text-sm focus:ring-0 p-0 max-h-32 resize-none custom-scrollbar outline-none font-medium"
                      style={{ color: theme.text, cursor: 'text' }}
                    />
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => sendMessage()}
                      disabled={!input.trim() || loading}
                      className="w-10 h-10 rounded-[14px] flex items-center justify-center flex-shrink-0 transition-all"
                      style={{ 
                        background: input.trim() && !loading ? `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` : 'transparent',
                        color: input.trim() && !loading ? '#fff' : theme.text3,
                        boxShadow: input.trim() && !loading ? `0 8px 16px ${theme.accent}40` : 'none',
                        cursor: input.trim() && !loading ? 'pointer' : 'default'
                      }}
                    >
                      {loading ? <Loader2 size={18} className="animate-spin" /> : <SendHorizonal size={18} />}
                    </motion.button>
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
