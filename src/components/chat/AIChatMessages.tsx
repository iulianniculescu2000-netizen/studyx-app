import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Bot, User } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';
import type { ChatMessage } from '../../components/ai-chat/shared';

interface AIChatMessagesProps {
  messages: ChatMessage[];
  loading: boolean;
  theme: any;
  calmMotion: boolean;
  activeCitationKey: string | null;
  onCitationClick: (key: string) => void;
}

export function AIChatMessages({
  messages,
  loading,
  theme,
  calmMotion,
  activeCitationKey,
  onCitationClick
}: AIChatMessagesProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <AnimatePresence>
        {messages.map((message, index) => (
          <motion.div
            key={`${message.role}-${index}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: calmMotion ? 0.2 : 0.3, delay: index * 0.1 }}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${theme.accent}15`, color: theme.accent }}>
                <Bot size={16} />
              </div>
            )}
            
            <div className={`max-w-[80%] p-3 rounded-2xl ${
              message.role === 'user' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            }`}>
              <div className="text-sm whitespace-pre-wrap">{message.content}</div>
              
              {message.citations && message.citations.length > 0 && (
                <div className="mt-2 space-y-1">
                  {message.citations.map((citation, idx) => (
                    <button
                      key={idx}
                      onClick={() => onCitationClick(`${citation.source}-${idx}`)}
                      className="text-xs px-2 py-1 rounded-lg border transition-all hover:opacity-80"
                      style={{
                        borderColor: activeCitationKey === `${citation.source}-${idx}` ? theme.accent : theme.border,
                        background: activeCitationKey === `${citation.source}-${idx}` ? `${theme.accent}15` : 'transparent',
                        color: activeCitationKey === `${citation.source}-${idx}` ? theme.accent : theme.text3
                      }}
                    >
                      {citation.source} - {Math.round(citation.score * 100)}% confidence
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {message.role === 'user' && (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-200 dark:bg-gray-700">
                <User size={16} />
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
      
      {loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-3 justify-start"
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${theme.accent}15`, color: theme.accent }}>
            <Bot size={16} />
          </div>
          <div className="p-3 rounded-2xl bg-gray-100 dark:bg-gray-800">
            <div className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm" style={{ color: theme.text3 }}>
                AI gânde\u0219te...
              </span>
            </div>
          </div>
        </motion.div>
      )}
      
      <div ref={chatEndRef} />
    </div>
  );
}
