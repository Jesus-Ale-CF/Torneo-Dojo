import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, List, GitBranch, Users, ArrowDownUp } from 'lucide-react';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { usePublicBracket } from '@/lib/queries';
import { downloadUrl } from '@/lib/api';
import { FORMAT, GENDER, fmtWeight, fullName } from '@/lib/format';
import { PageHeader } from '@/components/ui/Page';
import { CategoryBadge } from '@/components/ui/Badge';
import { BeltBadge } from '@/components/ui/BeltBadge';
import { ListSkeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { Bracket } from '@/components/Bracket';
import { MatchList } from '@/components/MatchList';
import { Podium } from '@/components/Podium';
import { Standings } from '@/components/Standings';

export function CategoryPage() {
  const { id, cid } = useParams();
  const q = usePublicBracket(cid);
  const [view, setView] = useState<'bracket' | 'vertical' | 'list'>('bracket');
  const mobile = useMediaQuery('(max-width: 767px)');
  if (q.isLoading) return <ListSkeleton />;
  if (q.isError || !q.data) return <ErrorState error={q.error ?? new Error('Categoría no disponible')} retry={() => q.refetch()} />;
  const b = q.data;
  const c = b.category;
  const regs = new Map(c.registrations.map((r) => [r.id, r]));
  const entry = (rid: string | null) => (rid ? regs.get(rid)?.athlete ?? null : null);
  const isRR = c.format === 'ROUND_ROBIN';
  return (
    <>
      <Link to={`/t/${id}`} className="btn-ghost -ml-3 mb-2 text-sm"><ArrowLeft className="h-4 w-4" aria-hidden />{c.tournament.name}</Link>
      <PageHeader title={c.name}
        subtitle={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><CategoryBadge status={c.status as never} />{c.beltLevel && <BeltBadge belt={c.beltLevel} size="sm" />}<span>{GENDER[c.gender]}</span>{c.weightDivision && <span>{fmtWeight(c.weightDivision)}</span>}<span>{FORMAT[c.format]}</span>{c.mat && <span>{c.mat.name}</span>}</span>}
        actions={<a href={downloadUrl(`/export/categories/${c.id}/bracket.pdf`)} target="_blank" rel="noreferrer" className="btn-secondary"><Download className="h-4 w-4" aria-hidden />Llave PDF</a>} />

      {b.podium.complete && (
        <section className="mb-8" aria-labelledby="podio-h">
          <h2 id="podio-h" className="mb-3 text-lg">Podio</h2>
          <Podium gold={entry(b.podium.gold)} silver={entry(b.podium.silver)} bronze={b.podium.bronze.map(entry)} />
        </section>
      )}

      {b.matches.length === 0 ? (
        <EmptyState title="Llave aún no generada" text="La organización publicará la llave cuando cierre el pesaje." icon={<GitBranch className="h-6 w-6" aria-hidden />} />
      ) : (
        <section aria-labelledby="llave-h">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="llave-h" className="text-lg">{isRR ? 'Combates' : 'Llave'}</h2>
            {!isRR && (
              <div className="flex rounded-lg border border-line p-0.5" role="group" aria-label="Tipo de vista">
                <button onClick={() => setView('bracket')} aria-pressed={view === 'bracket'} className={`btn min-h-touch px-3 text-sm ${view === 'bracket' ? 'bg-elevated' : ''}`}><GitBranch className="h-4 w-4" aria-hidden />Gráfico</button>
                {mobile && <button onClick={() => setView('vertical')} aria-pressed={view === 'vertical'} className={`btn min-h-touch px-3 text-sm ${view === 'vertical' ? 'bg-elevated' : ''}`}><ArrowDownUp className="h-4 w-4" aria-hidden />Vertical</button>}
                <button onClick={() => setView('list')} aria-pressed={view === 'list'} className={`btn min-h-touch px-3 text-sm ${view === 'list' ? 'bg-elevated' : ''}`}><List className="h-4 w-4" aria-hidden />Lista</button>
              </div>
            )}
          </div>
          {isRR ? (
            <div className="space-y-6"><Standings bracket={b} /><MatchList matches={b.matches} /></div>
          ) : view === 'list' ? <MatchList matches={b.matches} /> : <Bracket matches={b.matches} layout={view === 'vertical' && mobile ? 'vertical' : 'graphic'} />}
        </section>
      )}

      <section className="mt-10" aria-labelledby="atletas-h">
        <h2 id="atletas-h" className="mb-3 flex items-center gap-2 text-lg"><Users className="h-5 w-5" aria-hidden />Atletas <span className="num text-sm text-muted">({c.registrations.length})</span></h2>
        <ul className="card divide-y divide-line">
          {c.registrations.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="flex-1 truncate font-medium">{fullName(r.athlete)}</span>
              <span className="hidden truncate text-muted sm:inline">{r.athlete.academy?.name}</span>
              <BeltBadge belt={r.athlete.beltLevel} size="sm" showName={false} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
