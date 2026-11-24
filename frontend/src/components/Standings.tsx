import type { Bracket } from '@/lib/types';
import { fullName } from '@/lib/format';
import { BeltBadge } from './ui/BeltBadge';

export function Standings({ bracket }: { bracket: Bracket }) {
  const regs = new Map(bracket.category.registrations.map((r) => [r.id, r]));
  const rows = bracket.standings ?? [];
  if (!rows.length) return null;
  return (
    <div className="card overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla desplazable">
      <table className="w-full text-sm">
        <caption className="sr-only">Tabla de posiciones</caption>
        <thead className="bg-elevated text-left"><tr><th className="w-10 px-3 py-2 text-center">#</th><th className="px-3 py-2">Atleta</th><th className="px-2 py-2 text-center" title="Jugados">PJ</th><th className="px-2 py-2 text-center" title="Victorias">V</th><th className="px-2 py-2 text-center" title="Derrotas">D</th><th className="px-3 py-2 text-right" title="Puntos por método">Pts</th></tr></thead>
        <tbody>
          {rows.map((s) => { const r = regs.get(s.participantId); return (
            <tr key={s.participantId} className={`border-t border-line ${s.rank <= 3 ? 'font-semibold' : ''}`}>
              <td className="num px-3 py-2 text-center">{s.rank}</td>
              <td className="px-3 py-2"><div className="flex items-center gap-2"><span className="truncate">{fullName(r?.athlete)}</span><BeltBadge belt={r?.athlete.beltLevel} size="sm" showName={false} /></div><div className="text-xs text-muted">{r?.athlete.academy?.name}</div></td>
              <td className="num px-2 py-2 text-center">{s.played}</td><td className="num px-2 py-2 text-center">{s.wins}</td><td className="num px-2 py-2 text-center">{s.losses}</td><td className="num px-3 py-2 text-right">{s.methodPoints}</td>
            </tr>); })}
        </tbody>
      </table>
    </div>
  );
}
