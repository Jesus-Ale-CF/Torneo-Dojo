import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Trophy, Users, Building2, Swords, ArrowRight, Plus, Tablet, GitBranch, Scale } from 'lucide-react';
import { get } from '@/lib/api';
import type { Academy, Athlete, Sport, Tournament } from '@/lib/types';
import { fmtRange } from '@/lib/format';
import { fadeUp, stagger } from '@/lib/motion';
import { PageHeader } from '@/components/ui/Page';
import { TournamentBadge } from '@/components/ui/Badge';
import { useAuth } from '@/lib/auth';

export function AdminDashboard() {
  const { user } = useAuth();
  const t = useQuery({ queryKey: ['tournaments'], queryFn: () => get<Tournament[]>('/tournaments') });
  const a = useQuery({ queryKey: ['athletes'], queryFn: () => get<Athlete[]>('/athletes') });
  const ac = useQuery({ queryKey: ['academies'], queryFn: () => get<Academy[]>('/academies') });
  const s = useQuery({ queryKey: ['sports'], queryFn: () => get<Sport[]>('/sports') });
  const stats = [
    { label: 'Torneos', value: t.data?.length, icon: Trophy, to: '/admin/torneos' },
    { label: 'Atletas', value: a.data?.length, icon: Users, to: '/admin/atletas' },
    { label: 'Academias', value: ac.data?.length, icon: Building2, to: '/admin/academias' },
    { label: 'Deportes', value: s.data?.length, icon: Swords, to: '/admin/deportes' },
  ];
  const active = t.data?.filter((x) => x.status !== 'FINISHED') ?? [];
  return (
    <>
      <PageHeader eyebrow="Administración" title={`Hola, ${user?.name.split(' ')[0]}`} subtitle="Resumen general del sistema." actions={<Link to="/admin/torneos?nuevo=1" className="btn-primary"><Plus className="h-4 w-4" aria-hidden />Nuevo torneo</Link>} />
      <motion.ul variants={stagger()} initial="hidden" animate="show" className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((st) => (
          <motion.li key={st.label} variants={fadeUp}>
            <Link to={st.to} className="card flex items-center gap-4 p-4 transition-shadow hover:shadow-lift">
              <span className="rounded-lg bg-elevated p-2.5 text-shu"><st.icon className="h-5 w-5" aria-hidden /></span>
              <span><span className="num block text-2xl font-bold leading-none">{st.value ?? '…'}</span><span className="text-sm text-muted">{st.label}</span></span>
            </Link>
          </motion.li>
        ))}
      </motion.ul>
      <section className="mb-8" aria-labelledby="como-h">
        <h2 id="como-h" className="mb-3 text-lg">Cómo funciona</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Trophy, title: 'Crea el torneo', text: 'Fechas, sede, divisiones de peso y grupos de edad. Luego genera las categorías.' },
            { icon: Scale, title: 'Inscribe y pesa', text: 'Alta de atletas (o importa un Excel), categoría automática y pesaje el día del evento.' },
            { icon: GitBranch, title: 'Genera las llaves', text: 'Por sorteo o con siembra. Reparte las categorías entre los tatamis.' },
            { icon: Tablet, title: 'La mesa registra', text: 'Cada tatami tiene su mesa de control. El público sigue los resultados en vivo y en modo TV.' },
          ].map((s, i) => (
            <li key={s.title} className="card flex gap-3 p-4">
              <span className="num grid h-8 w-8 shrink-0 place-items-center rounded-full bg-elevated text-sm font-bold" aria-hidden>{i + 1}</span>
              <span className="min-w-0"><span className="flex items-center gap-2 font-semibold"><s.icon className="h-4 w-4 text-muted" aria-hidden />{s.title}</span><span className="mt-1 block text-sm text-muted">{s.text}</span></span>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h2 className="mb-3 text-lg">Torneos activos</h2>
        {active.length === 0 ? <p className="card p-6 text-sm text-muted">No hay torneos activos. Crea uno para empezar.</p> : (
          <ul className="grid gap-3 md:grid-cols-2">
            {active.map((x) => (
              <li key={x.id} className="card obi relative p-4 pl-5">
                <div className="flex items-start justify-between gap-2"><h3 className="text-base"><Link to={`/admin/torneos/${x.id}`} className="after:absolute after:inset-0">{x.name}</Link></h3><TournamentBadge status={x.status} /></div>
                <p className="mt-1 text-sm text-muted">{x.sport.name} · {fmtRange(x.startDate, x.endDate)}</p>
                <p className="mt-2 text-xs text-muted"><span className="num">{x._count.categories}</span> categorías · <span className="num">{x._count.registrations}</span> inscritos · <span className="num">{x._count.mats}</span> tatamis</p>
                <span className="absolute right-4 bottom-4 text-muted"><ArrowRight className="h-4 w-4" aria-hidden /></span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
