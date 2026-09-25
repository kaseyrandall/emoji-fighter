import React from 'react';
import { useNavigate } from 'react-router-dom';
import ReactGA from 'react-ga4';
import { motion } from 'framer-motion';
import { characters } from '../data/characters';
import { stages } from '../data/stages';
import { useGameStore, GAUNTLET_SIZE } from '../store/gameStore';
import { Swords, Sparkles, ArrowLeft, ChevronRight } from 'lucide-react';
import { Character } from '../types/game';
import { accentOf } from '../data/accents';
import FighterPreview from '../three/FighterPreview';
import { useSettings } from '../store/settingsStore';


const overallOf = (c: Character) =>
  Math.round(((c.stats.power + c.stats.speed + c.stats.technique) / 3) * 10) / 10;
const tierOf = (ovr: number) => (ovr >= 8.7 ? 'S' : ovr >= 8 ? 'A' : ovr >= 7.3 ? 'B' : 'C');

// Whether a CSS media query currently matches (updates live).
function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(() => window.matchMedia(query).matches);
  React.useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);
  return matches;
}

// Measure an element and keep its size in state (updates on resize / rotate).
function useElementSize<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

const StatBar = ({ label, value, accent }: { label: string; value: number; accent: string }) => (
  <div className="flex items-center gap-1.5">
    <span className="w-8 lg:w-10 text-[10px] sm:text-xs lg:text-sm text-gray-300 text-left shrink-0">{label}</span>
    <div className="flex-1 h-2 sm:h-2.5 lg:h-3 bg-gray-700/70 rounded-full overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${accent}, ${accent}aa)` }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, (value / 10) * 100)}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
    <span className="w-3.5 lg:w-5 text-right text-[10px] sm:text-xs lg:text-sm text-gray-400 tabular-nums shrink-0">{value}</span>
  </div>
);

export default function CharacterSelect() {
  const navigate = useNavigate();
  const startGauntlet = useGameStore((s) => s.startGauntlet);
  const [selectedId, setSelectedId] = React.useState<string>(characters[0].id);

  const selected = characters.find((c) => c.id === selectedId) || characters[0];
  const accent = accentOf(selected.id);
  const overall = overallOf(selected);
  const tier = tierOf(overall);

  // Random stage as an atmospheric, blurred backdrop.
  const backdrop = React.useMemo(() => stages[Math.floor(Math.random() * stages.length)].background, []);

  // Roster: two rows that scroll together as one unit; tile size follows the
  // available height of the scroll area.
  // Tablets / desktops (roomy landscape) get a different balance: the roster
  // stacks into as many rows of bigger tiles as fit — usually showing every
  // fighter at once — and the hero panel is wider. Phones keep two rows that
  // scroll sideways and a slim hero column.
  const roomy = useMediaQuery('(min-width: 900px) and (min-height: 600px)');
  const [rosterRef, rosterSize] = useElementSize<HTMLDivElement>();
  const GAP = roomy ? 10 : 8;
  // Roomy: pick the grid shape (rows × columns) that shows the whole roster
  // with the biggest tiles.
  const fitTile = (r: number) => {
    const c = Math.ceil(characters.length / r);
    return Math.min((rosterSize.h - GAP * (r - 1)) / r, (rosterSize.w - GAP * (c - 1)) / c, 168);
  };
  const rows = roomy ? [2, 3, 4, 5].reduce((best, r) => (fitTile(r) > fitTile(best) ? r : best), 3) : 2;
  const tile = Math.max(0, roomy ? fitTile(rows) : Math.min((rosterSize.h - GAP) / 2, 118));

  // Track scroll position so the edge fades only show when there's more to see.
  const [edges, setEdges] = React.useState({ left: false, right: false });
  const updateEdges = React.useCallback(() => {
    const el = rosterRef.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, [rosterRef]);
  React.useEffect(updateEdges, [updateEdges, tile, rosterSize.w]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    if (useSettings.getState().sfx) new Audio('/assets/select.wav').play().catch(() => {});
  };

  const handleFight = () => {
    ReactGA.event({ category: 'Game', action: 'Fight Started', label: selected.name });
    startGauntlet(selected);
    navigate('/arena');
  };

  const Tile = ({ character }: { character: Character }) => {
    const isSelected = character.id === selectedId;
    const a = accentOf(character.id);
    return (
      <motion.button
        onClick={() => handleSelect(character.id)}
        whileTap={{ scale: 0.94 }}
        className="relative rounded-xl border-2 flex flex-col items-center justify-center
                 overflow-hidden bg-gray-900/50 backdrop-blur-sm hover:bg-gray-800/60 transition-colors"
        style={{
          width: tile,
          height: tile,
          borderColor: isSelected ? a : 'rgba(148,163,184,0.25)',
          boxShadow: isSelected ? `0 0 18px ${a}66, inset 0 0 16px ${a}22` : undefined,
        }}
      >
        <span
          className="leading-none"
          style={{ fontSize: Math.round(tile * 0.4), filter: isSelected ? `drop-shadow(0 0 8px ${a}aa)` : undefined }}
        >
          {character.emoji}
        </span>
        <span
          className="w-full px-0.5 font-semibold leading-[1.05] text-center line-clamp-2"
          style={{ marginTop: tile * 0.04, fontSize: Math.max(8, Math.min(Math.round(tile * 0.12), roomy ? 15 : 13)), color: isSelected ? '#fff' : '#cbd5e1' }}
        >
          {character.name}
        </span>
      </motion.button>
    );
  };

  return (
    <div className="relative h-[100dvh] flex flex-col overflow-hidden">
      {/* Atmospheric stage backdrop */}
      <div
        className="absolute inset-0 -z-20 bg-cover bg-center scale-105"
        style={{ backgroundImage: `url(${backdrop})`, filter: 'blur(3px) brightness(0.35)' }}
      />
      <div
        className="absolute inset-0 -z-10 transition-all duration-500"
        style={{ background: `radial-gradient(55% 75% at 82% 55%, ${accent}2e, transparent 70%)` }}
      />

      {/* Header */}
      <div className="flex items-start justify-between px-3 pt-2 shrink-0">
        <button
          onClick={() => navigate('/')}
          className="px-2.5 py-1.5 text-gray-200 hover:text-white transition-colors flex items-center gap-1
                   bg-black/40 rounded-lg backdrop-blur-sm text-xs font-semibold"
        >
          <ArrowLeft size={15} />
          <span>BACK</span>
        </button>

        <div className="flex-1 min-w-0 text-center leading-none px-2">
          <h2 className="truncate text-sm sm:text-xl lg:text-2xl font-bold tracking-wide bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
            Choose Your Fighter
          </h2>
          <div className="truncate text-[8px] sm:text-[10px] text-gray-400 tracking-[0.18em] uppercase mt-1">
            Gauntlet · {GAUNTLET_SIZE} fights · rising difficulty
          </div>
        </div>

        {/* spacer to keep the title centered opposite the Back button */}
        <div className="w-[68px] shrink-0" />
      </div>

      {/* Body: roster that scrolls as one (left) + hero splash (right) */}
      <div className="flex-1 flex gap-2 sm:gap-3 min-h-0 px-3 pb-2 pt-1">
        {/* Roster — two rows in one horizontal scroll container, so they move
            together; edge fades hint that more fighters are off-screen. */}
        <div className="relative flex-1 min-w-0 min-h-0">
          <div
            ref={rosterRef}
            onScroll={updateEdges}
            className="h-full overflow-x-auto overflow-y-hidden no-scrollbar"
          >
            {tile > 0 && (
              <div
                style={{
                  display: 'grid',
                  // Phones: a two-row strip filling column by column (scrolls
                  // sideways). Roomy: a normal grid, read left to right.
                  ...(roomy
                    ? { gridTemplateColumns: `repeat(${Math.ceil(characters.length / rows)}, ${tile}px)`, gridAutoRows: `${tile}px` }
                    : { gridTemplateRows: `repeat(${rows}, ${tile}px)`, gridAutoFlow: 'column' as const, gridAutoColumns: `${tile}px` }),
                  gap: GAP,
                  justifyContent: roomy ? 'center' : 'start',
                  alignContent: 'center',
                  height: '100%',
                }}
              >
                {characters.map((character) => (
                  <Tile key={character.id} character={character} />
                ))}
              </div>
            )}
          </div>

          {/* left fade — appears once you've scrolled */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/80 to-transparent transition-opacity duration-200"
            style={{ opacity: edges.left ? 1 : 0 }}
          />
          {/* right fade + chevron — "more fighters this way" */}
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-black/85 to-transparent flex items-center justify-end pr-1 transition-opacity duration-200"
            style={{ opacity: edges.right ? 1 : 0 }}
          >
            <motion.div animate={{ x: [0, 4, 0] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}>
              <ChevronRight size={22} className="text-white/70" />
            </motion.div>
          </div>
        </div>

        {/* Hero — the 3D preview stays mounted (one WebGL context) and swaps
            fighters in place; only the text block re-animates per pick. */}
        <div className={`${roomy ? 'w-[40%] max-w-[30rem] pl-2' : 'w-[32%] max-w-[16rem]'} shrink-0 flex flex-col min-h-0`}>
          <div className="relative flex-1 min-h-0 -mx-2">
            <div className="absolute inset-0">
              <FighterPreview character={selected} />
            </div>
          </div>

          <motion.div
            key={selected.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0"
          >
            <div className="flex items-start gap-1.5">
              <h3 className={`flex-1 min-w-0 font-bold ${roomy ? 'text-3xl' : 'text-lg sm:text-xl'} leading-[1.05] break-words line-clamp-2`} style={{ textShadow: `0 0 14px ${accent}88` }}>
                {selected.name}
              </h3>
              <span
                className="shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-md flex items-center justify-center font-bold text-[11px] sm:text-sm"
                style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}88` }}
                title={`Overall ${overall}`}
              >
                {tier}
              </span>
            </div>
            <div className={`flex items-center gap-1 ${roomy ? 'text-sm mt-1.5' : 'text-[10px] sm:text-xs mt-0.5'}`} style={{ color: accent }}>
              <Sparkles size={roomy ? 15 : 11} className="shrink-0" />
              <span className="truncate">{selected.specialName}</span>
            </div>

            <div className={roomy ? 'mt-4 space-y-2.5' : 'mt-2 space-y-1.5'}>
              <StatBar label="POW" value={selected.stats.power} accent={accent} />
              <StatBar label="SPD" value={selected.stats.speed} accent={accent} />
              <StatBar label="TEC" value={selected.stats.technique} accent={accent} />
            </div>
          </motion.div>

          <motion.button
            onClick={handleFight}
            whileTap={{ scale: 0.96 }}
            animate={{ boxShadow: ['0 0 0px rgba(239,68,68,0)', '0 0 22px rgba(239,68,68,0.55)', '0 0 0px rgba(239,68,68,0)'] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className={`shrink-0 w-full bg-gradient-to-r from-red-600 to-orange-500 rounded-lg font-bold flex items-center justify-center gap-2 ${
              roomy ? 'mt-4 py-4 text-xl' : 'mt-2 py-2.5 sm:py-3 text-sm sm:text-lg'
            }`}
          >
            <Swords size={18} />
            FIGHT
          </motion.button>
        </div>
      </div>
    </div>
  );
}
