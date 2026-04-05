import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef } from 'react';
import { 
  Library, Trash2, Search, 
  Bot, Brain, Database, Plus,
  FileType, Loader2, Image, FileText, MessageSquare
} from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useAIStore, type AIKnowledgeSourceType } from '../store/aiStore';
import { useToastStore } from '../store/toastStore';
import { useUIStore } from '../store/uiStore';
import { parsePDF } from '../ai/pdfParser';
import { parseDocx } from '../ai/docxParser';
import { parseImageOCR } from '../ai/ocrParser';

export default function KnowledgeVault() {
  const theme = useTheme();
  const { knowledgeSources, addKnowledgeSource, removeKnowledgeSource } = useAIStore();
  const { addToast } = useToastStore();
  const setChatOpen = useUIStore(s => s.setChatOpen);
  
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [processStep, setProcessStep] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = knowledgeSources.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.preview.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => b.addedAt - a.addedAt);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    setLoading(true);
    
    try {
      for (const file of files) {
        const name = file.name.toLowerCase();
        const isPdf = name.endsWith('.pdf');
        const isDocx = name.endsWith('.docx');
        const isImage = /\.(jpe?g|png|webp|bmp)$/i.test(name);
        
        let text = '';
        let type: AIKnowledgeSourceType = 'txt';

        setProcessStep(`Citim ${file.name}...`);
        if (isPdf) {
          try {
            text = await parsePDF(file);
            type = 'pdf';
          } catch (pdfErr: unknown) {
            addToast(pdfErr instanceof Error ? pdfErr.message : 'Eroare PDF', 'error');
            continue;
          }
        } else if (isDocx) {
          text = await parseDocx(file);
          type = 'docx';
        } else if (isImage) {
          setProcessStep(`Analizăm imaginea (OCR)...`);
          text = await parseImageOCR(file);
          type = 'image';
        } else {
          text = await file.text();
        }

        if (text.trim().length < 5) {
          addToast(`Conținut insuficient în ${file.name}`, 'warning');
          continue;
        }

        setProcessStep(`Fragmentăm și indexăm...`);
        await addKnowledgeSource(file.name, text, type);
        addToast(`"${file.name}" adăugat cu succes.`, 'success');
      }
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Eroare la procesarea fișierelor.', 'error');
    } finally {
      setLoading(false);
      setProcessStep('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const totalWords = knowledgeSources.reduce((acc, s) => acc + s.wordCount, 0);
  const totalChars = knowledgeSources.reduce((acc, s) => acc + s.charCount, 0);

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-8 py-6 sm:py-10">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, color: '#fff' }}>
                  <Database size={20} />
                </div>
                <h1 className="text-3xl font-black tracking-tight" style={{ color: theme.text }}>
                  Knowledge <span style={{ color: theme.accent }}>Vault</span>
                </h1>
              </div>
              <p className="text-sm font-medium opacity-60 max-w-md" style={{ color: theme.text }}>
                Centrul tău local de date. AI-ul StudyX folosește aceste documente pentru a-ți oferi răspunsuri bazate pe cursurile tale.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Permanent Chat Button in Header */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setChatOpen(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl font-bold transition-all border"
                style={{ 
                  background: theme.surface2, 
                  borderColor: theme.border, 
                  color: theme.text2 
                }}
              >
                <MessageSquare size={18} /> Chat AI
              </motion.button>

              <input 
                type="file" 
                ref={fileInputRef} 
                multiple 
                accept=".pdf,.docx,.txt,.md,image/*" 
                className="hidden" 
                onChange={handleFileUpload} 
              />
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="flex items-center gap-3 px-6 py-3 rounded-2xl font-black text-white shadow-xl transition-all min-w-[180px] justify-center"
                style={{ background: theme.accent, boxShadow: `0 8px 24px ${theme.accent}40` }}>
                {loading ? (
                  <><Loader2 size={18} className="animate-spin" /> {processStep.split(' ')[0]}...</>
                ) : (
                  <><Plus size={18} /> Adaugă Documente</>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {[
            { label: 'Documente', value: knowledgeSources.length, icon: <Library size={18} />, color: theme.accent },
            { label: 'Total Cuvinte', value: totalWords.toLocaleString(), icon: <FileType size={18} />, color: theme.accent2 },
            { label: 'Indexare RAG', value: `${((totalChars / 2000000) * 100).toFixed(1)}%`, icon: <Brain size={18} />, color: theme.success },
          ].map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="rounded-[24px] p-5 relative overflow-hidden glass-panel premium-shadow"
              style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: `${s.color}15`, color: s.color }}>
                  {s.icon}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest opacity-50" style={{ color: theme.text }}>{s.label}</span>
              </div>
              <div className="text-2xl font-black tracking-tight" style={{ color: theme.text }}>{s.value}</div>
            </motion.div>
          ))}
        </div>

        {/* Search & List */}
        <div className="space-y-6">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40">
              <Search size={18} style={{ color: theme.text }} />
            </div>
            <input 
              type="text"
              placeholder="Caută în bibliotecă..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-[20px] text-sm font-medium transition-all focus:ring-2"
              style={{ 
                background: theme.surface, 
                border: `1px solid ${theme.border}`, 
                color: theme.text,
                outline: 'none'
              } as React.CSSProperties}
            />
          </div>

          <AnimatePresence mode="popLayout">
            {filtered.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                  style={{ background: `${theme.accent}15` }}>
                  <Library size={28} style={{ color: theme.accent }} />
                </div>
                <p className="font-bold text-base mb-1" style={{ color: theme.text }}>
                  {search ? 'Niciun document găsit.' : 'Biblioteca ta este goală.'}
                </p>
                <p className="text-sm opacity-50" style={{ color: theme.text }}>
                  {search ? 'Încearcă alt termen de căutare.' : 'Adaugă PDF-uri, DOCX sau imagini pentru a începe.'}
                </p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filtered.map((s, i) => (
                  <motion.div
                    key={s.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.02 }}
                    className="group flex items-center gap-4 p-4 rounded-[22px] transition-all hover:translate-x-1 glass-panel premium-shadow"
                    style={{ background: theme.surface, border: `1px solid ${theme.border}` }}
                  >
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner"
                      style={{ 
                        background: s.type === 'pdf' ? `${theme.accent}15` : s.type === 'docx' ? '#2B579A15' : s.type === 'image' ? '#FF9F0A15' : `${theme.accent2}15`,
                        color: s.type === 'pdf' ? theme.accent : s.type === 'docx' ? '#2B579A' : s.type === 'image' ? '#FF9F0A' : theme.accent2 
                      }}>
                      {s.type === 'pdf' ? <FileText size={22} /> : s.type === 'docx' ? <FileText size={22} /> : s.type === 'image' ? <Image size={22} /> : <FileText size={22} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-[15px] truncate" style={{ color: theme.text }}>{s.name}</h3>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider"
                          style={{ background: theme.surface2, color: theme.text3 }}>{s.type}</span>
                      </div>
                      <p className="text-[11px] font-medium opacity-50 truncate" style={{ color: theme.text }}>
                        {s.preview}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] font-bold uppercase tracking-tighter" style={{ color: theme.text3 }}>
                        <span>{s.wordCount} cuvinte</span>
                        <span>•</span>
                        <span>{s.charCount.toLocaleString()} caractere</span>
                        <span>•</span>
                        <span>{new Date(s.addedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => removeKnowledgeSource(s.id)}
                      className="w-10 h-10 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10 text-red-500">
                      <Trash2 size={18} />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>

        {knowledgeSources.length > 0 && (
          <div className="mt-12 p-8 rounded-[32px] text-center relative overflow-hidden glass-panel premium-shadow"
            style={{ background: `linear-gradient(135deg, ${theme.accent}10, ${theme.accent2}10)`, border: `1px solid ${theme.accent}20` }}>
            <div className="relative z-10">
              <Bot size={40} className="mx-auto mb-4" style={{ color: theme.accent }} />
              <h2 className="text-xl font-black mb-2" style={{ color: theme.text }}>AI-ul tău este gata</h2>
              <p className="text-sm font-medium opacity-60 mb-6 max-w-sm mx-auto" style={{ color: theme.text }}>
                Folosește biblioteca pentru a-ți personaliza experiența de studiu.
              </p>
              <button 
                onClick={() => setChatOpen(true)}
                className="px-8 py-3 rounded-2xl font-black text-sm text-white shadow-lg transition-all hover:scale-105 active:scale-95"
                style={{ background: theme.accent }}>
                Deschide Chat AI
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
