import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';
import type { Audit, Tournament } from '@/lib/types';
import { fmtDateTime, MATCH_STATUS } from '@/lib/format';
import { ListSkeleton, EmptyState, ErrorState } from '@/components/ui/States';
import { useRegistrations } from './shared';

const st = (s: string | null) => (s ? MATCH_STATUS[s as keyof typeof MATCH_STATUS] ?? s : '—');

export function AuditTab({ t }: { t: Tournament }) {
  const q = useQuery({ queryKey: ['audit', 'tournament', t.id], queryFn: () => get<Audit[]>(`/tournaments/${t.id}/audit`), refetchInterval: 15_000 });
  const regs = useRegistrations(t.id);
  const name = (id: string | null) => { if (!id) return '—'; const r = regs.data?.find((x) => x.id === id); return r ? `${r.athlete.firstName} ${r.athlete.lastName}` : '—'; };
  if (q.isLoading) return <ListSkeleton />;
  if (q.isError) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  if (!q.data?.length) return <EmptyState title="Sin registros" text="Aquí aparecerá cada resultado registrado o corregido: quién, cuándo y el valor anterior." />;
  return (
    <div className="card overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla desplazable">
      <table className="w-full text-sm">
        <caption className="sr-only">Auditoría de resultados (últimos 300)</caption>
        <thead className="bg-elevated text-left"><tr><th className="px-3 py-2.5">Cuándo</th><th className="px-3 py-2.5">Quién</th><th className="px-3 py-2.5">Combate</th><th className="px-3 py-2.5">Antes</th><th className="px-3 py-2.5">Después</th><th className="hidden px-3 py-2.5 lg:table-cell">Motivo</th></tr></thead>
        <tbody>
          {q.data.map((a) => (
            <tr key={a.id} className="border-t border-line align-top">
              <td className="whitespace-nowrap px-3 py-2">{fmtDateTime(a.createdAt)}</td>
              <td className="px-3 py-2">{a.user?.name ?? 'Sistema'}</td>
              <td className="px-3 py-2"><div>{a.match?.category.name}</div><div className="text-xs text-muted">{a.match?.label ?? ''}</div></td>
              <td className="px-3 py-2"><div>{st(a.previousStatus)}</div><div className="text-xs text-muted">{name(a.previousWinnerId)}</div></td>
              <td className="px-3 py-2"><div>{st(a.newStatus)}</div><div className="text-xs text-muted">{name(a.newWinnerId)}</div></td>
              <td className="hidden px-3 py-2 text-muted lg:table-cell">{a.reason ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
