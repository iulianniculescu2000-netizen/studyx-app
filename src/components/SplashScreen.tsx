import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from './Logo';

interface SplashScreenProps {
  visible: boolean;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ visible }) => {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0a0a0f', // Obsidian background
          }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: [0.8, 1.05, 1],
              opacity: 1,
            }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            style={{
              boxShadow: '0 20px 60px rgba(0, 113, 227, 0.15)',
              borderRadius: '40px',
              padding: '20px'
            }}
          >
            <Logo size={160} />
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            style={{ marginTop: 28, textAlign: 'center' }}
          >
            <h1 style={{ 
              color: 'white', 
              fontSize: '2.2rem', 
              fontWeight: 'bold', 
              letterSpacing: '3px',
              margin: 0,
              fontFamily: 'Inter, system-ui, sans-serif'
            }}>
              STUDY<span style={{ color: '#0071E3' }}>X</span>
            </h1>
            <div style={{ 
              height: '2px', 
              width: '40px', 
              background: '#0071E3', 
              margin: '12px auto',
              borderRadius: '2px'
            }} />
            <p style={{ 
              color: '#a0a0ba', 
              fontSize: '0.85rem', 
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '1.5px'
            }}>
              Medicină • Inteligență • Performanță
            </p>
          </motion.div>

          <div style={{ 
            position: 'absolute',
            bottom: '10%',
            width: '180px',
            textAlign: 'center'
          }}>
             <div style={{ 
                width: '100%', 
                height: '2px', 
                background: 'rgba(255,255,255,0.05)', 
                borderRadius: '10px',
                overflow: 'hidden',
                position: 'relative'
              }}>
                <motion.div
                  animate={{ 
                    x: ['-100%', '100%']
                  }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: 1.5, 
                    ease: "linear" 
                  }}
                  style={{ 
                    width: '60%', 
                    height: '100%', 
                    background: 'linear-gradient(90deg, transparent, #0071E3, transparent)',
                    position: 'absolute'
                  }}
                />
              </div>
              <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem', marginTop: 12 }}>
                Se încarcă experiența premium...
              </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
