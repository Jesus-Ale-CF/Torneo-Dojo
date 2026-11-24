import { motion } from 'framer-motion';
import { Play, Clock, CheckCircle2 } from 'lucide-react';
import type { LiveMat, Match } from '@/lib/types';
import { shortName } from '@/lib/format';
import { fadeUp, stagger } from '@/lib/motion';

function Fighter({ m, corner, big }: { m: Match; corner: 'red' | 'blue'; big: boolean }) {
  const reg = corner === 'red' ? m.red : m.blue;
  return (
    <div className={`flex min-w-0 items-center gap-2 ${corner === 'blue' ? 'flex-row-reverse text-right' : ''}`}>
      <span className={`shrink-0 rounded-full ${corner === 'red' ? 'bg-shu' : 'bg-ai'} ${big ? 'h-3 w-3' : 'h-2.5 w-2.5'}`} aria-hidden />
      <div className="min-w-0">
        <div className={`truncate font-semibold ${big ? 'text-lg sm:text-xl' : 'text-sm'}`}><span className="sr-only">{corner === 'red' ? 'Rojo' : 'Azul'}: </span>{shortName(reg?.athlete)}</div>
        {reg?.athlete.academy && <div className={`truncate text-muted ${big ? 'text-sm' : 'text-xs'}`}>{reg.athlete.academy.name}</div>}
      </div>
    </div>
  );
}

export function MatCard({ live, tv = false, onOpen }: { live: LiveMat; tv?: boolean; onOpen?: (matId: string) => void }) {
  const { mat, current, upcoming, remaining, finished } = live;
  const Wrapper = onOpen ? motion.button : motion.div;
  return (
    <Wrapper variants={fadeUp} onClick={onOpen ? () => onOpen(mat.id) : undefined} className={`card obi flex flex-col text-left ${onOpen ? 'hover:shadow-lift transition-shadow' : ''}`} style={{ '--obi': mat.color ?? undefined } as React.CSSProperties}>
      <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-2 pl-5">
        <h3 className={tv ? 'text-2xl' : 'text-lg'}>{mat.name}</h3>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1" title="Finalizados"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /><span className="num">{finished}</span><span className="sr-only">finalizados</span></span>
          <span className="inline-flex items-center gap-1" title="Pendientes"><Clock className="h-3.5 w-3.5" aria-hidden /><span className="num">{remaining}</span><span className="sr-only">pendientes</span></span>
        </div>
      </header>
      <div className="px-4 pb-3 pl-5">
        {current ? (
          <div className="rounded-lg border border-tatami/40 bg-tatami/5 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-tatami"><Play className="h-3.5 w-3.5" aria-hidden />En curso{current.matOrder ? ` · #${current.matOrder}` : ''}</span>
              <span className="truncate text-xs text-muted">{current.category.name}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <Fighter m={current} corner="red" big={tv} />
              <span className="font-display text-xs font-black text-muted">VS</span>
              <Fighter m={current} corner="blue" big={tv} />
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-line p-3 text-center text-sm text-muted">{remaining ? 'Sin combate en curso' : 'Tatami libre'}</div>
        )}
        {upcoming.length > 0 && (
          <ul className="mt-3 space-y-1.5" aria-label="Próximos combates">
            {upcoming.slice(0, tv ? 4 : 3).map((m) => (
              <li key={m.id} className={`flex items-center gap-2 ${tv ? 'text-base' : 'text-sm'}`}>
                <span className="num w-8 shrink-0 text-xs text-muted">#{m.matOrder ?? '·'}</span>
                <span className="min-w-0 flex-1 truncate"><span className="font-medium">{shortName(m.red?.athlete)}</span> <span className="text-muted">vs</span> <span className="font-medium">{shortName(m.blue?.athlete)}</span></span>
                <span className="hidden truncate text-xs text-muted sm:inline max-w-[40%]">{m.category.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Wrapper>
  );
}

export function MatBoard({ mats, tv = false, onOpen }: { mats: LiveMat[]; tv?: boolean; onOpen?: (matId: string) => void }) {
  return (
    <motion.div variants={stagger()} initial="hidden" animate="show" className={`grid gap-4 ${tv ? 'grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
      {mats.map((l) => <MatCard key={l.mat.id} live={l} tv={tv} onOpen={onOpen} />)}
    </motion.div>
  );
}
