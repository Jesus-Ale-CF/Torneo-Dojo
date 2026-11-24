import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Radio, Trophy, Tv, Users, Swords, Scale } from 'lucide-react';
import { usePublicTournaments } from '@/lib/queries';
import { fadeUp, stagger } from '@/lib/motion';
import { fmtRange } from '@/lib/format';
import { TournamentBadge } from '@/components/ui/Badge';
import { ListSkeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { LogoMark } from '@/components/ui/Logo';

export function HomePage() {
  const q = usePublicTournaments();
  const live = q.data?.filter((t) => t.status === 'IN_PROGRESS') ?? [];
  const others = q.data?.filter((t) => t.status !== 'IN_PROGRESS') ?? [];
  return (
    <div className="space-y-12">
      <section className="tatami-weave relative overflow-hidden rounded-dojo border border-line bg-elevated/60 px-6 py-12 sm:px-10 sm:py-16">
        <motion.div initial={{ opacity: 0, scale: 0.8, rotate: -20 }} animate={{ opacity: 0.08, scale: 1, rotate: 0 }} transition={{ duration: 0.8 }} className="pointer-events-none absolute -right-10 -top-10 text-ink" aria-hidden><LogoMark className="h-72 w-72 sm:h-96 sm:w-96" /></motion.div>
        <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="relative max-w-2xl">
          <motion.p variants={fadeUp} className="label text-shu">全快 · Zenkai Dojo</motion.p>
          <motion.h1 variants={fadeUp} className="mt-2 text-4xl leading-[1.05] sm:text-6xl">Torneos de combate, <span className="text-shu">en vivo</span> y sin fricción.</motion.h1>
          <motion.p variants={fadeUp} className="mt-4 max-w-xl text-base text-muted sm:text-lg">Sigue las llaves, los tatamis y el medallero en tiempo real. Si eres organización o mesa, entra para gestionar el torneo.</motion.p>
          <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
            <Link to="/torneos" className="btn-primary">Ver torneos <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            <Link to="/login" className="btn-secondary">Acceso organización</Link>
          </motion.div>
        </motion.div>
      </section>

      <section aria-labelledby="live-h">
        <div className="mb-4 flex items-center gap-2">
          <Radio className="h-5 w-5 text-tatami" aria-hidden />
          <h2 id="live-h" className="text-xl">Ahora en el tatami</h2>
        </div>
        {q.isLoading ? <ListSkeleton rows={2} /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : live.length === 0 ? (
          <EmptyState title="No hay torneos en curso" text="Cuando un torneo esté en marcha, aparecerá aquí con sus combates en vivo." icon={<Swords className="h-6 w-6" aria-hidden />} />
        ) : (
          <motion.ul variants={stagger()} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2">
            {live.map((t) => (
              <motion.li key={t.id} variants={fadeUp} className="card obi relative overflow-hidden p-5 pl-6 transition-shadow hover:shadow-lift">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><h3 className="text-xl"><Link to={`/t/${t.id}`} className="after:absolute after:inset-0">{t.name}</Link></h3><p className="text-sm text-muted">{t.venue}{t.city ? `, ${t.city}` : ''} · {fmtRange(t.startDate, t.endDate)}</p></div>
                  <TournamentBadge status={t.status} />
                </div>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted">
                  <span className="inline-flex items-center gap-1"><Trophy className="h-4 w-4" aria-hidden /><span className="num">{t._count.categories}</span> categorías</span>
                  <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" aria-hidden /><span className="num">{t._count.registrations}</span> atletas</span>
                  <span className="inline-flex items-center gap-1"><Scale className="h-4 w-4" aria-hidden /><span className="num">{t.mats.length}</span> tatamis</span>
                </div>
                <div className="relative z-10 mt-4 flex gap-2">
                  <Link to={`/t/${t.id}/tv`} className="btn-secondary text-sm"><Tv className="h-4 w-4" aria-hidden />Modo TV</Link>
                </div>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </section>

      {others.length > 0 && (
        <section aria-labelledby="others-h">
          <h2 id="others-h" className="mb-4 text-xl">Otros torneos</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((t) => (
              <li key={t.id} className="card relative p-4 transition-shadow hover:shadow-lift">
                <div className="flex items-start justify-between gap-2"><h3 className="text-base"><Link to={`/t/${t.id}`} className="after:absolute after:inset-0">{t.name}</Link></h3><TournamentBadge status={t.status} /></div>
                <p className="mt-1 text-sm text-muted">{fmtRange(t.startDate, t.endDate)} · {t.sport.name}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
