import { AnimatePresence, motion } from 'framer-motion';
import { Trophy, Play } from 'lucide-react';
import type { Match, RegMini } from '@/lib/types';
import { shortName } from '@/lib/format';
import { BeltBadge } from './ui/BeltBadge';

export const BOX_W = 232;
export const BOX_H = 72;

function Row({ reg, isWinner, isLoser, corner, bye, finished }: { reg: RegMini | null; isWinner: boolean; isLoser: boolean; corner: 'red' | 'blue'; bye: boolean; finished: boolean }) {
  return (
    <div className={`relative flex h-1/2 items-center gap-2 px-2 ${isWinner ? 'bg-gold/10' : ''} ${corner === 'red' ? 'rounded-t-dojo' : 'rounded-b-dojo'}`}>
      <span className={`h-5 w-1 shrink-0 rounded-full ${corner === 'red' ? 'bg-shu' : 'bg-ai'}`} aria-hidden />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={reg?.id ?? (bye ? 'bye' : 'empty')} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex min-w-0 flex-1 items-center gap-2">
          {reg ? (
            <>
              <span className={`min-w-0 flex-1 truncate text-[13px] leading-tight ${isWinner ? 'font-bold text-ink' : isLoser && finished ? 'text-muted line-through decoration-muted/60' : 'font-medium text-ink'}`}>
                <span className="sr-only">{corner === 'red' ? 'Rojo: ' : 'Azul: '}</span>{shortName(reg.athlete)}
              </span>
              {reg.athlete.academy?.abbreviation && <span className="num shrink-0 text-[10px] text-muted">{reg.athlete.academy.abbreviation}</span>}
              <BeltBadge belt={reg.athlete.beltLevel} size="sm" showName={false} />
            </>
          ) : (
            <span className="text-xs italic text-muted">{bye ? 'BYE' : 'Por definir'}</span>
          )}
        </motion.div>
      </AnimatePresence>
      {isWinner && <Trophy className="h-3.5 w-3.5 shrink-0 text-gold" aria-label="Ganador" />}
    </div>
  );
}

export function MatchBox({ m, onClick, highlight = false, compact = false }: { m: Match; onClick?: (m: Match) => void; highlight?: boolean; compact?: boolean }) {
  const finished = m.status === 'FINISHED';
  const live = m.status === 'IN_PROGRESS';
  const bye = m.status === 'BYE';
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick ? () => onClick(m) : undefined}
      className={`card group relative flex flex-col text-left transition-shadow ${onClick ? 'cursor-pointer hover:shadow-lift focus-visible:shadow-lift' : ''} ${live ? 'ring-2 ring-tatami' : highlight ? 'ring-2 ring-ai' : ''} ${bye ? 'border-dashed shadow-none' : ''}`}
      style={{ width: compact ? '100%' : BOX_W, height: BOX_H }}>
      <span className="sr-only">{m.label ?? `Ronda ${m.round}`}: </span>
      <Row reg={m.red} isWinner={finished && m.winnerId === m.redId && !!m.redId} isLoser={finished && m.winnerId !== m.redId} corner="red" bye={bye} finished={finished} />
      <div className="h-px bg-line" />
      <Row reg={m.blue} isWinner={finished && m.winnerId === m.blueId && !!m.blueId} isLoser={finished && m.winnerId !== m.blueId} corner="blue" bye={bye} finished={finished} />
      {(live || (finished && m.victoryMethod) || (m.matOrder && !bye)) && (
        <div className={`pointer-events-none absolute -bottom-2.5 right-2 rounded border px-1.5 text-[10px] font-semibold leading-4 ${live ? 'border-tatami bg-tatami text-on-accent' : 'border-line bg-surface text-muted'}`}>
          {live ? <span className="inline-flex items-center gap-1"><Play className="h-2.5 w-2.5" aria-hidden />En curso</span> : finished ? m.victoryMethod?.name : `#${m.matOrder}`}
        </div>
      )}
    </Comp>
  );
}
