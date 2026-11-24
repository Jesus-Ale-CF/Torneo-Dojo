import type { Match } from '@/lib/types';
import { MatchBox } from './MatchBox';
import { roundName } from '@/lib/format';

/** Lista de combates agrupada por ronda (para round robin y vista móvil). */
export function MatchList({ matches, onSelect, highlightId }: { matches: Match[]; onSelect?: (m: Match) => void; highlightId?: string | null }) {
  const rounds = [...new Set(matches.map((m) => `${m.side}-${m.round}`))];
  return (
    <div className="space-y-6">
      {rounds.map((key) => {
        const list = matches.filter((m) => `${m.side}-${m.round}` === key);
        return (
          <section key={key}>
            <h3 className="label mb-2">{roundName(list[0])}</h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((m) => <MatchBox key={m.id} m={m} onClick={onSelect} highlight={highlightId === m.id} compact />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
