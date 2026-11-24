import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, CalendarDays } from 'lucide-react';
import { usePublicTournaments } from '@/lib/queries';
import { fadeUp, stagger } from '@/lib/motion';
import { fmtRange } from '@/lib/format';
import { TournamentBadge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/Page';
import { ListSkeleton, EmptyState, ErrorState } from '@/components/ui/States';

export function TournamentsPage() {
  const q = usePublicTournaments();
  return (
    <>
      <PageHeader title="Torneos" subtitle="Torneos publicados. Selecciona uno para ver sus categorías, llaves y resultados." />
      {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !q.data?.length ? <EmptyState title="Aún no hay torneos publicados" /> : (
        <motion.ul variants={stagger()} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {q.data.map((t) => (
            <motion.li key={t.id} variants={fadeUp} className="card obi relative p-5 pl-6 transition-shadow hover:shadow-lift">
              <div className="flex items-start justify-between gap-2"><h2 className="text-lg"><Link to={`/t/${t.id}`} className="after:absolute after:inset-0">{t.name}</Link></h2><TournamentBadge status={t.status} /></div>
              <p className="mt-1 text-sm text-muted">{t.sport.name}</p>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex items-center gap-2 text-muted"><CalendarDays className="h-4 w-4 shrink-0" aria-hidden /><dt className="sr-only">Fechas</dt><dd>{fmtRange(t.startDate, t.endDate)}</dd></div>
                <div className="flex items-center gap-2 text-muted"><MapPin className="h-4 w-4 shrink-0" aria-hidden /><dt className="sr-only">Sede</dt><dd>{t.venue}{t.city ? `, ${t.city}` : ''}</dd></div>
              </dl>
              <p className="mt-3 text-xs text-muted"><span className="num">{t._count.categories}</span> categorías · <span className="num">{t._count.registrations}</span> atletas</p>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </>
  );
}
