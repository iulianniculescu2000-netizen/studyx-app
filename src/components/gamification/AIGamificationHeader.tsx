import { motion } from 'framer-motion';

interface AIGamificationHeaderProps {
  username: string;
}

export default function AIGamificationHeader({ username }: AIGamificationHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center mb-8"
    >
      <div className="flex items-center justify-center gap-3 mb-4">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 360],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="text-4xl"
        >
          {'🏆'}
        </motion.div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
          Gamification AI
        </h1>
      </div>
      <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
        Provocari personalizate AI, realizari epice si clasamente globale pentru a-ti motiva studiul
      </p>
      <p className="mt-3 text-sm font-medium text-yellow-600/80 dark:text-yellow-400/80">
        Hub-ul premium de progres pentru {username}
      </p>
    </motion.div>
  );
}
