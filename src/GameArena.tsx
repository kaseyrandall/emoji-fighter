import { stages } from '../data/stages';
import StageBackground from '../components/StageBackground';

export default function GameArena() {
    <div className="relative min-h-screen flex flex-col items-center justify-between overflow-hidden">
      {stage && <StageBackground stage={stage} />}