import { motion } from 'framer-motion';
import { Medal } from 'lucide-react';
import type { MedalEntry } from '@/lib/types';
import { fullName } from '@/lib/format';
import { BeltBadge } from './ui/BeltBadge';

type Entry = MedalEntry['athlete'] | null | undefined;

function Step({ place, entry, height, delay }: { place: 1 | 2 | 3; entry: Entry; height: number; delay: number }) {
  // Rellenos de medalla fijos (claros) con texto tinta: ≥7:1 en ambos temas
  const tone = place === 1 ? 'bg-[#e3b341]' : place === 2 ? 'bg-[#bcc2cc]' : 'bg-[#d09262]';
  const label = place === 1 ? 'Oro' : place === 2 ? 'Plata' : 'Bronce';
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay + 0.25, duration: 0.3 }} className="flex w-full flex-col items-center text-center">
        <Medal className={`h-6 w-6 ${place === 1 ? 'text-gold' : place === 2 ? 'text-silver' : 'text-bronze'}`} aria-hidden />
        <span className="label">{label}</span>
        <span className="mt-1 w-full hyphens-auto break-words px-1 text-sm font-bold leading-tight sm:text-base" title={fullName(entry)}>{entry ? fullName(entry) : '—'}</span>
        {entry?.academy && <span className="w-full break-words text-xs text-muted" title={entry.academy.name}>{entry.academy.name}</span>}
        {entry?.beltLevel && <BeltBadge belt={entry.beltLevel} size="sm" showName={false} />}
      </motion.div>
      <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }} style={{ height, originY: 1 }}
        className={`flex w-full items-start justify-center rounded-t-lg ${tone} text-[#1f2433] shadow-card`}>
        <span className="num pt-2 text-2xl font-bold ">{place}</span>
      </motion.div>
    </div>
  );
}

export function Podium({ gold, silver, bronze }: { gold: Entry; silver: Entry; bronze: Entry[] }) {
  const two = bronze.length > 1;
  return (
    <div className="card tatami-weave px-3 pt-6 sm:px-6" role="group" aria-label="Podio">
      <div className={`mx-auto flex max-w-2xl items-end gap-2 sm:gap-4 ${two ? '' : ''}`}>
        <Step place={2} entry={silver} height={72} delay={0.15} />
        <Step place={1} entry={gold} height={104} delay={0} />
        <Step place={3} entry={bronze[0]} height={52} delay={0.3} />
        {two && <Step place={3} entry={bronze[1]} height={52} delay={0.4} />}
      </div>
    </div>
  );
}
