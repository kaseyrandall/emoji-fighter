import { motion } from 'framer-motion';
import { Stage } from '../types/game';

interface StageBackgroundProps {
  stage: Stage;
}

export default function StageBackground({ stage }: StageBackgroundProps) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0"
    >
      <div 
        className="absolute inset-0 bg-black bg-cover bg-center"
        style={{ backgroundImage: `url(${stage.background})` }}
      />
      <div className={`absolute inset-0 ${stage.ambientLight} mix-blend-overlay`} />
    </motion.div>
  );
}