import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Plus, X, Sparkles } from 'lucide-react';
import { useUserStore, type Profile } from '../store/userStore';
import { useTheme } from '../theme/ThemeContext';
import { THEMES } from '../theme/themes';

interface Props {
  onAddNew: () => void;
}

export default function ProfileSelect({ onAddNew }: Props) {
  const { profiles, switchProfile, removeProfile } = useUserStore();
  const theme = useTheme();
  const [hovered, setHovered] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Auto-select first profile on Enter if only one
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && profiles.length === 1 && !selectedId) {
      handleSelect(profiles[0].id);
    }
  };

  const handleSelect = (id: string) => {
    if (selectedId) return;
    setSelectedId(id);
    setTimeout(() => switchProfile(id), 380);
  };

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setRemovingId(id);
    setTimeout(() => removeProfile(id), 280);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden select-none"
      style={{ background: theme.bg }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Ambient orbs */}
      <motion.div className="absolute rounded-full pointer-events-none"
        style={{ width: 700, height: 700, top: '-20%', left: '-15%', background: `radial-gradient(circle, ${theme.orb1}, transparent 65%)`, filter: 'blur(90px)', opacity: 0.7 }}
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div className="absolute rounded-full pointer-events-none"
        style={{ width: 600, height: 600, bottom: '-18%', right: '-12%', background: `radial-gradient(circle, ${theme.orb2}, transparent 65%)`, filter: 'blur(90px)', opacity: 0.6 }}
        animate={{ x: [0, -22, 0], y: [0, 22, 0] }}
        transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
      />

      <div className="relative z-10 flex flex-col items-center px-8">

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-14 text-center"
        >
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
            className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center text-2xl"
            style={{
              background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
              boxShadow: `0 16px 48px ${theme.accent}40`,
            }}>
            📚
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight mb-1.5" style={{ color: theme.text }}>
            StudyX
          </h1>
          <p className="text-sm" style={{ color: theme.text3 }}>Selectează profilul tău</p>
        </motion.div>

        {/* Profiles row */}
        <div className="flex items-start gap-8 mb-14 flex-wrap justify-center">
          {profiles.map((profile, i) => (
            <ProfileAvatar
              key={profile.id}
              profile={profile}
              index={i}
              isHovered={hovered === profile.id}
              isSelected={selectedId === profile.id}
              isRemoving={removingId === profile.id}
              onHover={(id) => setHovered(id)}
              onSelect={handleSelect}
              onRemove={handleRemove}
              theme={theme}
            />
          ))}

          {/* Add new profile */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 + profiles.length * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center gap-3 cursor-pointer"
            onMouseEnter={() => setHovered('__new__')}
            onMouseLeave={() => setHovered(null)}
            onClick={onAddNew}
          >
            <motion.div
              animate={{
                scale: hovered === '__new__' ? 1.06 : 1,
                y: hovered === '__new__' ? -5 : 0,
              }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
              style={{
                background: theme.surface,
                border: `2px dashed ${hovered === '__new__' ? theme.accent : theme.border2}`,
                color: hovered === '__new__' ? theme.accent : theme.text3,
                transition: 'border-color 0.2s, color 0.2s',
              }}>
              <Plus size={26} strokeWidth={1.5} />
            </motion.div>
            <motion.span
              animate={{ opacity: hovered === '__new__' ? 1 : 0.55 }}
              className="text-xs font-medium text-center"
              style={{ color: theme.text2 }}>
              Profil nou
            </motion.span>
          </motion.div>
        </div>

        {/* Bottom hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex items-center gap-1.5 text-xs"
          style={{ color: theme.text3 }}>
          <Sparkles size={11} />
          <span>Click pe avatar pentru a intra</span>
        </motion.div>
      </div>
    </div>
  );
}

function ProfileAvatar({ profile, index, isHovered, isSelected, isRemoving, onHover, onSelect, onRemove, theme }: {
  profile: Profile;
  index: number;
  isHovered: boolean;
  isSelected: boolean;
  isRemoving: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  onRemove: (e: React.MouseEvent, id: string) => void;
  theme: any;
}) {
  const profileTheme = THEMES[profile.themeId as keyof typeof THEMES] ?? THEMES.obsidian;
  const accentColor = profileTheme.accent;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{
        opacity: isRemoving ? 0 : 1,
        y: isRemoving ? -24 : 0,
        scale: isRemoving ? 0.8 : 1,
      }}
      transition={{ delay: 0.1 + index * 0.08, duration: isRemoving ? 0.25 : 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center gap-3 cursor-pointer relative"
      onMouseEnter={() => onHover(profile.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(profile.id)}
    >
      {/* Remove button */}
      <AnimatePresence>
        {isHovered && !isSelected && (
          <motion.button
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => onRemove(e, profile.id)}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center z-20"
            style={{ background: theme.danger, color: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            <X size={10} strokeWidth={3} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Avatar */}
      <motion.div
        animate={{
          scale: isSelected ? 1.18 : isHovered ? 1.08 : 1,
          y: isHovered && !isSelected ? -6 : 0,
        }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="relative w-[72px] h-[72px] rounded-full flex items-center justify-center"
        style={{
          background: profile.gradient,
          boxShadow: isHovered
            ? `0 18px 48px ${accentColor}45, 0 0 0 3px ${accentColor}35`
            : `0 6px 20px rgba(0,0,0,0.28)`,
          transition: 'box-shadow 0.25s ease',
        }}>
        <span className="text-2xl font-black text-white select-none"
          style={{ textShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
          {profile.username.charAt(0).toUpperCase()}
        </span>

        {/* Theme ring */}
        <div className="absolute inset-0 rounded-full"
          style={{
            border: `2px solid ${accentColor}`,
            opacity: isHovered ? 0.55 : 0.2,
            transition: 'opacity 0.2s',
          }} />

        {/* Selected pulse ring */}
        <AnimatePresence>
          {isSelected && (
            <motion.div
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: 1.6, opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="absolute inset-0 rounded-full"
              style={{ background: accentColor }}
            />
          )}
        </AnimatePresence>
      </motion.div>

      {/* Name */}
      <motion.span
        animate={{ opacity: isHovered ? 1 : 0.62 }}
        transition={{ duration: 0.18 }}
        className="text-sm font-semibold text-center max-w-[84px] truncate"
        style={{ color: theme.text }}>
        {profile.username}
      </motion.span>

      {/* Theme accent line */}
      <motion.div
        animate={{ width: isHovered ? 28 : 16, opacity: isHovered ? 1 : 0.4 }}
        transition={{ duration: 0.2 }}
        className="h-0.5 rounded-full"
        style={{ background: accentColor }}
      />
    </motion.div>
  );
}
