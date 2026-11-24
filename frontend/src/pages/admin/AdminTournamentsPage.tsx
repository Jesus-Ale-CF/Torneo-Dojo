import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, ArrowRight } from 'lucide-react';
import { get, post } from '@/lib/api';
import type { Sport, Tournament } from '@/lib/types';
import { fmtRange } from '@/lib/format';
import { useMut } from '@/lib/hooks';
import { PageHeader } from '@/components/ui/Page';
import { TournamentBadge } from '@/components/ui/Badge';
import { ListSkeleton, ErrorState, EmptyState } from '@/components/ui/States';
import { TournamentForm, emptyTournament, type TournamentFormData } from './TournamentForm';
import { Modal } from '@/components/ui/Modal';
import { FormErrors } from '@/components/ui/Field';
import { tournamentSchema } from '@/lib/validation';

export function AdminTournamentsPage() {
  const q = useQuery({ queryKey: ['tournaments'], queryFn: () => get<Tournament[]>('/tournaments') });
  const sports = useQuery({ queryKey: ['sports'], queryFn: () => get<Sport[]>('/sports') });
  const [sp, setSp] = useSearchParams();
  const [form, setForm] = useState<TournamentFormData | null>(null);
  useEffect(() => { if (sp.get('nuevo') && sports.data) setForm((f) => f ?? { ...emptyTournament, sportId: sports.data[0]?.id ?? '' }); }, [sp, sports.data]);
  const create = useMut((f: TournamentFormData) => post<Tournament>('/tournaments', f), { invalidate: [['tournaments']], success: 'Torneo creado', onSuccess: () => close(), schema: tournamentSchema });
  const close = () => { setForm(null); create.reset(); if (sp.get('nuevo')) setSp({}); };
  return (
    <>
      <PageHeader title="Torneos" subtitle="Crea y configura torneos. Entra en uno para gestionar categorías, inscripciones, pesaje, llaves y tatamis." actions={<button className="btn-primary" onClick={() => setForm({ ...emptyTournament, sportId: sports.data?.[0]?.id ?? '' })}><Plus className="h-4 w-4" aria-hidden />Nuevo torneo</button>} />
      {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorState error={q.error} retry={() => q.refetch()} /> : !q.data?.length ? <EmptyState title="Sin torneos" text="Crea el primer torneo para empezar." /> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {q.data.map((t) => (
            <li key={t.id} className="card obi relative p-4 pl-5 transition-shadow hover:shadow-lift">
              <div className="flex items-start justify-between gap-2"><h2 className="text-base"><Link to={`/admin/torneos/${t.id}`} className="after:absolute after:inset-0">{t.name}</Link></h2><TournamentBadge status={t.status} /></div>
              <p className="mt-1 text-sm text-muted">{t.sport.name} · {t.venue} · {fmtRange(t.startDate, t.endDate)}</p>
              <p className="mt-2 flex items-center gap-1 text-xs text-muted"><span className="num">{t._count.categories}</span> categorías · <span className="num">{t._count.registrations}</span> inscritos · <span className="num">{t._count.mats}</span> tatamis<ArrowRight className="ml-auto h-4 w-4" aria-hidden /></p>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!form} onClose={close} title="Nuevo torneo" footer={<><button className="btn-secondary" onClick={close}>Cancelar</button><button type="submit" form="form-torneo" className="btn-primary" disabled={create.isPending}>Crear torneo</button></>}>
        {form && <form id="form-torneo" noValidate onSubmit={(e) => { e.preventDefault(); create.mutate(form); }}><FormErrors errors={create.fieldErrors}><TournamentForm value={form} onChange={setForm} sports={sports.data ?? []} /></FormErrors></form>}
      </Modal>
    </>
  );
}
