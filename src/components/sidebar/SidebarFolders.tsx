import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import type { QuizColor } from '../../types';

interface SidebarFoldersProps {
  folders: any[];
  quizzes: any[];
  collapsed: boolean;
  theme: any;
  onCreateFolder: (name: string, emoji: string, color: QuizColor) => void;
  onEditFolder: (id: string, name: string, emoji: string, color: QuizColor) => void;
  onDeleteFolder: (id: string) => void;
}

const FOLDER_COLORS: { id: QuizColor; bg: string }[] = [
  { id: 'blue', bg: '#0A84FF' }, { id: 'purple', bg: '#5E5CE6' },
  { id: 'green', bg: '#30D158' }, { id: 'orange', bg: '#FF9F0A' },
  { id: 'pink', bg: '#FF375F' }, { id: 'red', bg: '#FF453A' }, { id: 'teal', bg: '#5AC8FA' },
];

const FOLDER_EMOJIS = ['\u{1F4C1}', '\u{1F4DA}', '\u{1F9E0}', '\u{1F4A1}', '\u{1F52C}', '\u{1F30D}', '\u{1F4BB}', '\u2764\uFE0F', '\u{1F9B4}', '\u{1F48A}', '\u2695\uFE0F', '\u{1F9EA}', '\u{1F4CB}', '\u{1F3AF}', '\u26A1', '\u{1F3E5}'];

function FolderEmojiPicker({
  value,
  onChange,
  theme,
}: {
  value: string;
  onChange: (value: string) => void;
  theme: any;
}) {
  return (
    <div className="flex max-w-full gap-1 overflow-x-auto pb-1">
      {FOLDER_EMOJIS.map((emoji) => {
        const active = value === emoji;
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onChange(emoji)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border text-base transition-all"
            style={{
              background: active ? `${theme.accent}18` : theme.surface,
              borderColor: active ? theme.accent : theme.border,
              boxShadow: active ? `0 10px 20px ${theme.accent}22` : 'none',
            }}
          >
            {emoji}
          </button>
        );
      })}
    </div>
  );
}

function FolderColorPicker({
  value,
  onChange,
  theme,
}: {
  value: QuizColor;
  onChange: (value: QuizColor) => void;
  theme: any;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {FOLDER_COLORS.map((color) => {
        const active = value === color.id;
        return (
          <button
            key={color.id}
            type="button"
            onClick={() => onChange(color.id)}
            className="flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold uppercase transition-all"
            style={{
              background: active ? `${color.bg}18` : theme.surface,
              borderColor: active ? color.bg : theme.border,
              color: theme.text,
              boxShadow: active ? `0 10px 20px ${color.bg}22` : 'none',
            }}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color.bg }} />
            {color.id}
          </button>
        );
      })}
    </div>
  );
}

export function SidebarFolders({
  folders,
  quizzes,
  collapsed,
  theme,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder
}: SidebarFoldersProps) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderEmoji, setNewFolderEmoji] = useState(FOLDER_EMOJIS[0]);
  const [newFolderColor, setNewFolderColor] = useState<QuizColor>('blue');

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim(), newFolderEmoji, newFolderColor);
      setNewFolderName('');
      setNewFolderEmoji(FOLDER_EMOJIS[0]);
      setNewFolderColor('blue');
      setCreating(false);
    }
  };

  const handleEditFolder = () => {
    if (editingId && newFolderName.trim()) {
      onEditFolder(editingId, newFolderName.trim(), newFolderEmoji, newFolderColor);
      setEditingId(null);
      setNewFolderName('');
      setNewFolderEmoji(FOLDER_EMOJIS[0]);
      setNewFolderColor('blue');
    }
  };

  const startEdit = (folder: any) => {
    setEditingId(folder.id);
    setNewFolderName(folder.name);
    setNewFolderEmoji(folder.emoji);
    setNewFolderColor(folder.color);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setCreating(false);
    setNewFolderName('');
    setNewFolderEmoji(FOLDER_EMOJIS[0]);
    setNewFolderColor('blue');
  };

  if (collapsed) {
    return null;
  }

  return (
    <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: theme.text3 }}>
          Folder
        </h3>
        <button
          onClick={() => setCreating(true)}
          className="p-1 rounded-lg transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
          style={{ color: theme.text3 }}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Folder list */}
      <div className="space-y-1 mb-3">
        {folders.map((folder) => {
          const quizCount = quizzes.filter(q => q.folderId === folder.id).length;
          
          if (editingId === folder.id) {
            return (
              <div key={folder.id} className="space-y-3 rounded-2xl border p-3" style={{ borderColor: theme.border, background: theme.surface }}>
                <FolderEmojiPicker
                  value={newFolderEmoji}
                  onChange={setNewFolderEmoji}
                  theme={theme}
                />
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="flex-1 text-sm bg-transparent border-none outline-none"
                    placeholder="Nume folder"
                    autoFocus
                  />
                </div>
                <FolderColorPicker value={newFolderColor} onChange={setNewFolderColor} theme={theme} />
                <div className="flex gap-1">
                  <button
                    onClick={handleEditFolder}
                    className="p-1 rounded text-green-600 hover:bg-green-50"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="p-1 rounded text-red-600 hover:bg-red-50"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div
              key={folder.id}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer group"
              style={{ color: theme.text }}
            >
              <div className="flex items-center gap-2">
                <span>{folder.emoji}</span>
                <span className="text-sm font-medium">{folder.name}</span>
                <span className="text-xs" style={{ color: theme.text3 }}>
                  ({quizCount})
                </span>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => startEdit(folder)}
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => onDeleteFolder(folder.id)}
                  className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900 text-red-600"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create new folder */}
      <AnimatePresence>
        {(creating || editingId) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 rounded-2xl border p-3"
            style={{ borderColor: theme.border, background: theme.surface }}
          >
            <FolderEmojiPicker
              value={newFolderEmoji}
              onChange={setNewFolderEmoji}
              theme={theme}
            />
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="flex-1 text-sm bg-transparent border-none outline-none"
                placeholder="Nume folder"
                autoFocus
              />
            </div>
            <FolderColorPicker value={newFolderColor} onChange={setNewFolderColor} theme={theme} />
            <div className="flex gap-1">
              <button
                onClick={creating ? handleCreateFolder : handleEditFolder}
                className="p-1 rounded text-green-600 hover:bg-green-50"
              >
                <Check size={12} />
              </button>
              <button
                onClick={cancelEdit}
                className="p-1 rounded text-red-600 hover:bg-red-50"
              >
                <X size={12} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
