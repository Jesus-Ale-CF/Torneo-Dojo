import { motion } from 'framer-motion';
import { Medal } from 'lucide-react';
import type { Medals } from '@/lib/types';
import { fadeUp, stagger } from '@/lib/motion';

export function MedalTable({ medals, tv = false }: { medals: Medals; tv?: boolean }) {
  const { academies, tournament } = medals;
  if (!academies.length) return <p className="card p-6 text-center text-sm text-muted">Aún no hay podios completos. El medallero se actualizará automáticamente.</p>;
  const max = academies[0]?.points || 1;
  return (
    <div className="card overflow-hidden">
      <table className={`w-full ${tv ? 'text-lg' : 'text-sm'}`}>
        <caption className="sr-only">Medallero por academia. Puntos: oro {tournament.pointsGold}, plata {tournament.pointsSilver}, bronce {tournament.pointsBronze}.</caption>
        <thead className="bg-elevated text-left">
          <tr>
            <th scope="col" className="w-12 px-3 py-2.5 text-center">#</th>
            <th scope="col" className="px-3 py-2.5">Academia</th>
            <th scope="col" className="px-2 py-2.5 text-center"><span className="inline-flex items-center gap-1"><Medal className="h-4 w-4 text-gold" aria-hidden /><span className={tv ? '' : 'sr-only sm:not-sr-only'}>Oro</span></span></th>
            <th scope="col" className="px-2 py-2.5 text-center"><span className="inline-flex items-center gap-1"><Medal className="h-4 w-4 text-silver" aria-hidden /><span className={tv ? '' : 'sr-only sm:not-sr-only'}>Plata</span></span></th>
            <th scope="col" className="px-2 py-2.5 text-center"><span className="inline-flex items-center gap-1"><Medal className="h-4 w-4 text-bronze" aria-hidden /><span className={tv ? '' : 'sr-only sm:not-sr-only'}>Bronce</span></span></th>
            <th scope="col" className="px-3 py-2.5 text-right">Puntos</th>
          </tr>
        </thead>
        <motion.tbody variants={stagger(0.03)} initial="hidden" animate="show">
          {academies.map((a) => (
            <motion.tr key={a.academyId} variants={fadeUp} className="border-t border-line">
              <td className="num px-3 py-2.5 text-center font-bold">{a.rank}</td>
              <td className="px-3 py-2.5">
                <div className="font-semibold">{a.academyName}</div>
                <div className="mt-1 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-elevated" aria-hidden><motion.div className="h-full rounded-full bg-shu" initial={{ width: 0 }} animate={{ width: `${(a.points / max) * 100}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} /></div>
              </td>
              <td className="num px-2 py-2.5 text-center">{a.gold}</td>
              <td className="num px-2 py-2.5 text-center">{a.silver}</td>
              <td className="num px-2 py-2.5 text-center">{a.bronze}</td>
              <td className="num px-3 py-2.5 text-right font-bold">{a.points}</td>
            </motion.tr>
          ))}
        </motion.tbody>
      </table>
    </div>
  );
}
