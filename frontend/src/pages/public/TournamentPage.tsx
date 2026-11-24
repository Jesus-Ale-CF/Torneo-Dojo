import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Tv, Search, Medal, Grid3X3, LayoutList, Download } from 'lucide-react';
import { useLiveMats, useMedals, usePublicCategories, usePublicTournament } from '@/lib/queries';
import { fmtRange, fmtWeight, FORMAT_SHORT, GENDER, fmtTime, fullName } from '@/lib/format';
import { fadeUp, stagger } from '@/lib/motion';
import { downloadUrl } from '@/lib/api';
import { PageHeader } from '@/components/ui/Page';
import { Tabs } from '@/components/ui/Tabs';
import { CategoryBadge, TournamentBadge } from '@/components/ui/Badge';
import { BeltBadge } from '@/components/ui/BeltBadge';
import { ListSkeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { MatBoard } from '@/components/MatBoard';
import { MedalTable } from '@/components/MedalTable';

export function TournamentPage() {
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') ?? 'categorias';
  const t = usePublicTournament(id);
  const cats = usePublicCategories(id, true);
  const live = useLiveMats(id, tab === 'tatamis');
  const medals = useMedals(id, tab === 'medallero');
  const [q, setQ] = useState('');
  const [belt, setBelt] = useState('');
  const filtered = useMemo(() => (cats.data ?? []).filter((c) => (!q || c.name.toLowerCase().includes(q.toLowerCase())) && (!belt || c.beltLevel?.id === belt)), [cats.data, q, belt]);

  if (t.isLoading) return <ListSkeleton />;
  if (t.isError || !t.data) return <ErrorState error={t.error ?? new Error('Torneo no disponible')} retry={() => t.refetch()} />;
  const tour = t.data;
  return (
    <>
      <PageHeader eyebrow={tour.sport.name} title={tour.name}
        subtitle={<span className="flex flex-wrap items-center gap-2"><TournamentBadge status={tour.status} /><span>{tour.venue}{tour.city ? `, ${tour.city}` : ''} · {fmtRange(tour.startDate, tour.endDate)}</span></span>}
        actions={<><a href={downloadUrl(`/export/tournaments/${tour.id}/results.pdf`)} className="btn-secondary" target="_blank" rel="noreferrer"><Download className="h-4 w-4" aria-hidden />Resultados PDF</a><Link to={`/t/${tour.id}/tv`} className="btn-ai"><Tv className="h-4 w-4" aria-hidden />Modo TV</Link></>} />

      <Tabs id="pub" value={tab} onChange={(k) => setSp({ tab: k })} tabs={[
        { key: 'categorias', label: 'Categorías', icon: <LayoutList className="h-4 w-4" aria-hidden />, count: cats.data?.length },
        { key: 'tatamis', label: 'Tatamis', icon: <Grid3X3 className="h-4 w-4" aria-hidden />, count: tour.mats.length },
        { key: 'medallero', label: 'Medallero', icon: <Medal className="h-4 w-4" aria-hidden /> },
      ]} />

      <div role="tabpanel" id={`pub-panel-${tab}`} aria-labelledby={`pub-${tab}`} className="pt-6">
        {tab === 'categorias' && (
          <>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row">
              <label className="relative flex-1"><span className="sr-only">Buscar categoría</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden /><input className="input pl-9" placeholder="Buscar categoría…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
              <label className="sm:w-56"><span className="sr-only">Filtrar por cinturón</span><select className="input" value={belt} onChange={(e) => setBelt(e.target.value)}><option value="">Todos los cinturones</option>{tour.sport.beltLevels.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
            </div>
            {cats.isLoading ? <ListSkeleton /> : filtered.length === 0 ? <EmptyState title="Sin categorías" text="No hay categorías que coincidan con la búsqueda." /> : (
              <motion.ul variants={stagger(0.03)} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((c) => (
                  <motion.li key={c.id} variants={fadeUp} className="card obi relative p-4 pl-5 transition-shadow hover:shadow-lift" style={{ '--obi': c.beltLevel?.color ?? undefined } as React.CSSProperties}>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base leading-snug"><Link to={`/t/${tour.id}/c/${c.id}`} className="after:absolute after:inset-0">{c.name}</Link></h3>
                      <CategoryBadge status={c.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <BeltBadge belt={c.beltLevel} size="sm" />
                      <span>{GENDER[c.gender]}</span>
                      {c.weightDivision && <span>{fmtWeight(c.weightDivision)}</span>}
                      <span>{FORMAT_SHORT[c.format]}</span>
                    </div>
                    <p className="mt-2 text-xs text-muted"><span className="num">{c._count.registrations}</span> atletas{c.mat ? ` · ${c.mat.name}` : ''}{c.scheduledAt ? ` · ${fmtTime(c.scheduledAt)}` : ''}</p>
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </>
        )}
        {tab === 'tatamis' && (live.isLoading ? <ListSkeleton rows={3} /> : live.isError ? <ErrorState error={live.error} retry={() => live.refetch()} /> : !live.data?.length ? <EmptyState title="Sin tatamis" text="La organización aún no ha configurado las áreas de combate." /> : <MatBoard mats={live.data} />)}
        {tab === 'medallero' && (medals.isLoading ? <ListSkeleton rows={3} /> : medals.isError ? <ErrorState error={medals.error} retry={() => medals.refetch()} /> : medals.data && (
          <div className="space-y-8">
            <MedalTable medals={medals.data} />
            <section>
              <h2 className="mb-3 text-lg">Podios por categoría</h2>
              {medals.data.byCategory.filter((c) => c.complete).length === 0 ? <p className="text-sm text-muted">Todavía no hay categorías finalizadas.</p> : (
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {medals.data.byCategory.filter((c) => c.complete).map((c) => (
                    <li key={c.category.id} className="card p-4">
                      <h3 className="text-sm font-bold"><Link to={`/t/${tour.id}/c/${c.category.id}`} className="hover:underline">{c.category.name}</Link></h3>
                      <ol className="mt-2 space-y-1 text-sm">
                        <li className="flex items-center gap-2"><Medal className="h-4 w-4 text-gold" aria-hidden /><span className="sr-only">Oro:</span><span className="truncate font-medium">{fullName(c.gold?.athlete)}</span><span className="ml-auto truncate text-xs text-muted">{c.gold?.athlete.academy?.abbreviation}</span></li>
                        <li className="flex items-center gap-2"><Medal className="h-4 w-4 text-silver" aria-hidden /><span className="sr-only">Plata:</span><span className="truncate">{fullName(c.silver?.athlete)}</span><span className="ml-auto truncate text-xs text-muted">{c.silver?.athlete.academy?.abbreviation}</span></li>
                        {c.bronze.map((b) => <li key={b.registrationId} className="flex items-center gap-2"><Medal className="h-4 w-4 text-bronze" aria-hidden /><span className="sr-only">Bronce:</span><span className="truncate">{fullName(b.athlete)}</span><span className="ml-auto truncate text-xs text-muted">{b.athlete.academy?.abbreviation}</span></li>)}
                      </ol>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ))}
      </div>
    </>
  );
}
