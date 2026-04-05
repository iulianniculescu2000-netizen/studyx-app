import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import { Trophy, Flame, Target, Clock, BookOpen, TrendingUp, Brain } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';
import { useQuizStore } from '../store/quizStore';
import { useStatsStore } from '../store/statsStore';


interface CustomTooltipProps {
  active?: boolean;
  payload?: {
    name: string;
    value: number;
    color: string;
  }[];
  label?: string;
  theme: import('../theme/themes').Theme;
}

const CustomTooltip = ({ active, payload, label, theme }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl p-3 text-sm shadow-xl"
      style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
      <p className="font-semibold mb-1" style={{ color: theme.text }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}{p.name === 'acuratete' ? '%' : ''}</strong>
        </p>
      ))}
    </div>
  );
};

export default function Stats() {
  const theme = useTheme();
  const { quizzes, sessions } = useQuizStore();
  const { streak, totalStudyTime, questionStats, getWeakQuestions, getAccuracy } = useStatsStore();
  

  const accuracy = getAccuracy();
  const weakQuestions = getWeakQuestions(5);
  const studyHours = (totalStudyTime / 3600).toFixed(1);

  // Heatmap: last 90 days
  const heatmapWeeks = useMemo(() => {
    const today = new Date();
    const cells: { date: string; count: number }[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const count = sessions.filter(s => new Date(s.startedAt).toISOString().split('T')[0] === key).length;
      cells.push({ date: key, count });
    }
    // Pad to fill complete weeks
    while (cells.length % 7 !== 0) cells.push({ date: '', count: 0 });
    const weeks: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [sessions]);

  // Sessions per day (last 14 days)
  const last14Days = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const key = d.toISOString().split('T')[0];
    const dayStr = d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
    const daySessions = sessions.filter(s => new Date(s.startedAt).toISOString().split('T')[0] === key);
    const count = daySessions.length;
    const dayAccuracy = daySessions.reduce((acc, s) => acc + s.score / s.total, 0);
    const avg = count > 0 ? Math.round((dayAccuracy / count) * 100) : 0;
    return { day: dayStr, sesiuni: count, acuratete: avg };
  }), [sessions]);

  // Accuracy per quiz
  const quizAccuracyData = useMemo(() => quizzes
    .map(q => ({
      name: q.title.length > 15 ? q.title.substring(0, 15) + '...' : q.title,
      acuratete: getAccuracy(q.id),
      sesiuni: sessions.filter(s => s.quizId === q.id).length,
    }))
    .filter(d => d.sesiuni > 0)
    .sort((a, b) => b.acuratete - a.acuratete),
  [quizzes, sessions, getAccuracy]);


  const bestScore = sessions.length > 0
    ? Math.max(...sessions.map(s => Math.round((s.score / s.total) * 100)))
    : 0;

  // Radar chart: accuracy per category
  const radarData = useMemo(() => {
    const CATEGORIES = ['Dermatologie', 'Anatomie', 'Fiziologie', 'Biochimie', 'Farmacologie', 'Patologie', 'Chirurgie', 'Medicină internă', 'Neurologie', 'Microbiologie'];
    return CATEGORIES.map(cat => {
      const catQuizzes = quizzes.filter(q => q.category === cat);
      if (catQuizzes.length === 0) return null;
      const acc = catQuizzes.reduce((sum, q) => sum + getAccuracy(q.id), 0) / catQuizzes.length;
      return { subject: cat.slice(0, 8), acuratete: Math.round(acc), fullMark: 100 };
    }).filter(Boolean) as { subject: string; acuratete: number; fullMark: number }[];
  }, [quizzes, getAccuracy]);

  // Exam predictor: weighted score based on recent sessions + streak + weak questions
  const examPrediction = useMemo(() => {
    if (sessions.length === 0) return null;
    const recentSessions = [...sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 10);
    const recentAcc = recentSessions.reduce((s, sess) => s + sess.score / sess.total, 0) / recentSessions.length;
    const weakQCount = getWeakQuestions(100).filter(q => q.timesCorrect / (q.timesCorrect + q.timesWrong) < 0.5).length;
    const totalAnswered = Object.values(questionStats).reduce((s, q) => s + q.timesCorrect + q.timesWrong, 0);
    const streakBonus = Math.min(streak.currentStreak * 0.5, 10);
    const weakPenalty = Math.min(weakQCount * 1.5, 20);
    const practiceBonus = Math.min(totalAnswered / 50, 10);
    const predicted = Math.round(Math.min(100, recentAcc * 100 + streakBonus - weakPenalty + practiceBonus));
    const trend = recentSessions.length >= 3
      ? recentSessions.slice(0, 3).reduce((s, sess) => s + sess.score / sess.total, 0) / 3 >
        recentSessions.slice(-3).reduce((s, sess) => s + sess.score / sess.total, 0) / 3
        ? 'up' : 'down'
      : 'stable';
    return { predicted, trend, weakQCount, recentAcc: Math.round(recentAcc * 100) };
  }, [sessions, streak, questionStats, getWeakQuestions]);

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-8 py-6 sm:py-10">
      <div className="max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} 
          className="mb-10">
          <h1 className="text-4xl font-black tracking-tighter mb-2" style={{ color: theme.text }}>
            Analiză <span style={{
              background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              display: 'inline-block'
            }}>Performanță</span>
          </h1>
          <p className="text-sm font-medium opacity-60" style={{ color: theme.text }}>Vizualizează progresul și evoluția ta în timp</p>
        </motion.div>

        {sessions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-[28px] p-16 text-center"
            style={{ background: theme.surface, border: `1px solid ${theme.border}` }}
          >
            <div className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center"
              style={{ background: `${theme.accent}12` }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={theme.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7">
                <path d="M3 3v18h18"/>
                <path d="M7 16l4-4 4 4 4-8"/>
              </svg>
            </div>
            <h3 className="text-lg font-black mb-2" style={{ color: theme.text }}>
              Nicio sesiune înregistrată
            </h3>
            <p className="text-sm max-w-xs mx-auto mb-6" style={{ color: theme.text3 }}>
              Rezolvă câteva grile pentru a-ți genera profilul de performanță.
            </p>
            <Link to="/quizzes"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white"
              style={{ background: theme.accent }}>
              Începe acum
            </Link>
          </motion.div>
        ) : (
          <>
            {/* KPI Grid */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
              className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              {[
                { label: 'Sesiuni Totale', value: sessions.length, icon: <BookOpen size={18} />, color: theme.accent },
                { label: 'Acuratețe Medie', value: `${accuracy}%`, icon: <Target size={18} />, color: theme.success },
                { label: 'Scor Maxim', value: `${bestScore}%`, icon: <Trophy size={18} />, color: '#FFD60A' },
                { label: 'Streak Curent', value: `${streak.currentStreak} zile`, icon: <Flame size={18} />, color: theme.warning },
                { label: 'Record Streak', value: `${streak.longestStreak} zile`, icon: <TrendingUp size={18} />, color: theme.accent2 },
                { label: 'Timp Studiu', value: `${studyHours}h`, icon: <Clock size={18} />, color: theme.text2 },
              ].map((stat, i) => (
                <motion.div key={stat.label}
                  initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.05 }}
                  whileHover={{ y: -3, boxShadow: `0 12px 32px ${stat.color}15` }}
                  className="rounded-2xl p-4 relative overflow-hidden"
                  style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
                  <div className="absolute top-0 left-0 w-16 h-16 rounded-full pointer-events-none"
                    style={{ background: `radial-gradient(circle at top left, ${stat.color}15, transparent 70%)` }} />
                  <div className="flex items-center gap-3 mb-3 relative">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${stat.color}15`, color: stat.color }}>
                      {stat.icon}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-60" style={{ color: theme.text }}>{stat.label}</span>
                  </div>
                  <div className="text-2xl font-black tracking-tighter relative" style={{ color: theme.text }}>{stat.value}</div>
                </motion.div>
              ))}
            </motion.div>

            {/* Achievements */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
              className="rounded-[32px] p-6 mb-8"
              style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{ background: 'rgba(255,214,10,0.15)', color: '#FFD60A' }}>
                  <Trophy size={20} />
                </div>
                <div>
                  <h2 className="font-black text-lg leading-tight" style={{ color: theme.text }}>Realizări</h2>
                  <p className="text-[10px] font-black uppercase tracking-wider opacity-50" style={{ color: theme.text }}>Trofee și Milestone-uri</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { id: 'first_quiz', emoji: '🎓', label: 'Prima Grilă', desc: 'Sesiune inițială', earned: sessions.length >= 1 },
                  { id: 'streak7', emoji: '🔥', label: 'O Săptămână', desc: '7 zile consecutive', earned: streak.longestStreak >= 7 },
                  { id: 'perfect', emoji: '🏆', label: 'Scor Perfect', desc: '100% la o sesiune', earned: sessions.some(s => s.score === s.total && s.total > 0) },
                  { id: 'accuracy90', emoji: '🎯', label: 'Nivel Expert', desc: 'Acuratețe ≥ 90%', earned: accuracy >= 90 },
                  { id: 'studytime', emoji: '⚡', label: 'Dedicat', desc: '1+ oră de studiu', earned: totalStudyTime >= 3600 },
                  { id: 'quizzes10', emoji: '📚', label: 'Colecționar', desc: '10+ grile create', earned: quizzes.filter(q => !q.id.startsWith('sample-') && !q.id.startsWith('img-')).length >= 10 },
                ].map((ach) => (
                  <motion.div
                    key={ach.id}
                    whileHover={ach.earned ? { scale: 1.03, y: -2 } : {}}
                    className="rounded-[24px] p-4 text-center relative overflow-hidden transition-all shadow-sm"
                    style={{
                      background: ach.earned ? `${theme.accent}10` : theme.surface2,
                      border: `1px solid ${ach.earned ? theme.accent + '40' : theme.border}`,
                      opacity: ach.earned ? 1 : 0.5,
                    }}>
                    <div className="text-4xl mb-3" style={{ filter: ach.earned ? 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))' : 'grayscale(1) opacity(0.5)' }}>
                      {ach.emoji}
                    </div>
                    <p className="text-xs font-black mb-1 uppercase tracking-tight" style={{ color: theme.text }}>{ach.label}</p>
                    <p className="text-[10px] font-medium leading-snug opacity-60" style={{ color: theme.text }}>{ach.desc}</p>
                    {ach.earned && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center shadow-lg"
                        style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}>
                        <span className="text-[10px] text-white font-black">✓</span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Heatmap calendar */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
              className="rounded-2xl p-5 mb-5"
              style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
              <h2 className="font-semibold mb-4" style={{ color: theme.text }}>Activitate (90 zile)</h2>
              <div className="flex gap-1 overflow-x-auto pb-1">
                {heatmapWeeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-1">
                    {week.map((day, di) => {
                      const opacity = day.count === 0 ? 0 : day.count === 1 ? 0.35 : day.count === 2 ? 0.6 : 1;
                      return (
                        <div key={di}
                          title={day.date ? `${day.date}: ${day.count} ${day.count === 1 ? 'sesiune' : 'sesiuni'}` : ''}
                          className="w-3 h-3 rounded-sm transition-all"
                          style={{
                            background: day.date
                              ? day.count === 0 ? theme.surface2 : theme.accent
                              : 'transparent',
                            opacity: day.date ? (day.count === 0 ? 1 : opacity) : 0,
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 mt-3">
                <span className="text-xs" style={{ color: theme.text3 }}>Mai puțin</span>
                {[0, 0.35, 0.6, 1].map((op, i) => (
                  <div key={i} className="w-3 h-3 rounded-sm"
                    style={{ background: i === 0 ? theme.surface2 : theme.accent, opacity: i === 0 ? 1 : op }} />
                ))}
                <span className="text-xs" style={{ color: theme.text3 }}>Mai mult</span>
              </div>
            </motion.div>

            {/* Activity chart */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              className="rounded-2xl p-5 mb-5"
              style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
              <h2 className="font-semibold mb-4" style={{ color: theme.text }}>Activitate (ultimele 14 zile)</h2>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={last14Days} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <XAxis dataKey="day" tick={{ fill: theme.text3, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: theme.text3, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip theme={theme} />} />
                  <Bar dataKey="sesiuni" fill={theme.accent} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Accuracy trend */}
            {last14Days.some(d => d.acuratete > 0) && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
                className="rounded-2xl p-5 mb-5"
                style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
                <h2 className="font-semibold mb-4" style={{ color: theme.text }}>Tendință acuratețe (%)</h2>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={last14Days.filter(d => d.acuratete > 0)} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                    <XAxis dataKey="day" tick={{ fill: theme.text3, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: theme.text3, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip theme={theme} />} />
                    <Line type="monotone" dataKey="acuratete" stroke={theme.success} strokeWidth={2} dot={{ fill: theme.success, r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </motion.div>
            )}

            {/* Per quiz accuracy */}
            {quizAccuracyData.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                className="rounded-2xl p-5 mb-5"
                style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
                <h2 className="font-semibold mb-4" style={{ color: theme.text }}>Acuratețe per grilă</h2>
                <div className="space-y-3">
                  {quizAccuracyData.map(q => (
                    <div key={q.name} className="flex items-center gap-3">
                      <span className="text-sm w-36 truncate flex-shrink-0" style={{ color: theme.text2 }}>{q.name}</span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: theme.surface2 }}>
                        <motion.div className="h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${q.acuratete}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          style={{
                            background: q.acuratete >= 70
                              ? `linear-gradient(90deg, ${theme.success}, ${theme.accent2})`
                              : q.acuratete >= 50
                              ? `linear-gradient(90deg, ${theme.warning}, ${theme.accent})`
                              : `linear-gradient(90deg, ${theme.danger}, rgba(255,69,58,0.6))`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold w-12 text-right flex-shrink-0"
                        style={{ color: q.acuratete >= 70 ? theme.success : q.acuratete >= 50 ? theme.warning : theme.danger }}>
                        {q.acuratete}%
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Radar chart — category progress */}
            {radarData.length >= 3 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.42 }}
                className="rounded-2xl p-5 mb-5"
                style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
                <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: theme.text }}>
                  <Brain size={16} style={{ color: theme.accent2 }} />
                  Progres pe categorii
                </h2>
                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke={theme.border} />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: theme.text3, fontSize: 11 }} />
                    <Radar name="Acuratețe" dataKey="acuratete" stroke={theme.accent} fill={theme.accent} fillOpacity={0.22} strokeWidth={2} />
                    <Tooltip contentStyle={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </motion.div>
            )}

            {/* Exam Predictor */}
            {examPrediction && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.44 }}
                className="rounded-2xl p-5 mb-5 relative overflow-hidden"
                style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
                {/* Decorative glow */}
                <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10"
                  style={{ background: examPrediction.predicted >= 70 ? theme.success : examPrediction.predicted >= 50 ? theme.warning : theme.danger }} />
                <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: theme.text }}>
                  <TrendingUp size={16} style={{ color: theme.accent }} />
                  Predictor examen
                </h2>
                <div className="flex items-center gap-6">
                  <div className="relative w-28 h-28 flex-shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke={theme.surface2} strokeWidth="10" />
                      <motion.circle cx="50" cy="50" r="40" fill="none"
                        stroke={examPrediction.predicted >= 70 ? theme.success : examPrediction.predicted >= 50 ? theme.warning : theme.danger}
                        strokeWidth="10" strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 40}`}
                        initial={{ strokeDashoffset: 2 * Math.PI * 40 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 40 * (1 - examPrediction.predicted / 100) }}
                        transition={{ duration: 1.2, ease: 'easeOut' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold" style={{ color: theme.text }}>{examPrediction.predicted}%</span>
                      <span className="text-[10px]" style={{ color: theme.text3 }}>estimat</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: theme.text3 }}>Acuratețe recentă</span>
                      <span className="text-sm font-semibold" style={{ color: theme.text }}>{examPrediction.recentAcc}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: theme.text3 }}>Întrebări slabe</span>
                      <span className="text-sm font-semibold" style={{ color: examPrediction.weakQCount > 5 ? theme.danger : theme.success }}>
                        {examPrediction.weakQCount}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: theme.text3 }}>Tendință</span>
                      <span className="text-sm font-semibold">
                        {examPrediction.trend === 'up' ? '📈 Crescătoare' : examPrediction.trend === 'down' ? '📉 Scăzătoare' : '→ Stabilă'}
                      </span>
                    </div>
                    <div className="pt-1 text-xs leading-relaxed" style={{ color: theme.text3 }}>
                      {examPrediction.predicted >= 70
                        ? '🎯 Ești pe drumul cel bun! Continuă practica regulată.'
                        : examPrediction.predicted >= 50
                        ? '💪 Progres bun, dar mai ai de lucrat la întrebările slabe.'
                        : '📚 Concentrează-te pe recapitulare și întrebările dificile.'}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Weak questions */}
            {weakQuestions.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
                className="rounded-2xl p-5"
                style={{ background: theme.surface, border: `1px solid ${theme.border}` }}>
                <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: theme.text }}>
                  <Target size={16} style={{ color: theme.danger }} />
                  Întrebări slabe (necesită atenție)
                </h2>
                <div className="space-y-2">
                  {weakQuestions.map(ws => {
                    const quiz = quizzes.find(q => q.id === ws.quizId);
                    const question = quiz?.questions.find(q => q.id === ws.questionId);
                    if (!question) return null;
                    const acc = Math.round(ws.timesCorrect / (ws.timesCorrect + ws.timesWrong) * 100);
                    return (
                      <div key={ws.questionId} className="flex items-start gap-3 p-3 rounded-xl"
                        style={{ background: `${theme.danger}08`, border: `1px solid ${theme.danger}20` }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: theme.text }}>{question.text}</p>
                          <p className="text-xs mt-0.5" style={{ color: theme.text3 }}>
                            {quiz?.title} · {ws.timesCorrect}/{ws.timesCorrect + ws.timesWrong} corecte
                          </p>
                        </div>
                        <span className="text-sm font-bold flex-shrink-0" style={{ color: theme.danger }}>{acc}%</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
