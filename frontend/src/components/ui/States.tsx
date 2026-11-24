import type { ReactNode } from 'react';
import { Inbox, AlertOctagon, RefreshCw } from 'lucide-react';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}
export function ListSkeleton({ rows = 4, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`} role="status" aria-label="Cargando">
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
    </div>
  );
}
export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="rounded-full bg-elevated p-3 text-muted">{icon ?? <Inbox className="h-6 w-6" aria-hidden />}</div>
      <h3 className="text-lg">{title}</h3>
      {text && <p className="max-w-sm text-sm text-muted">{text}</p>}
      {action}
    </div>
  );
}
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const msg = error instanceof Error ? error.message : 'Algo salió mal';
  return (
    <div className="card flex flex-col items-center gap-3 border-shu/40 px-6 py-10 text-center" role="alert">
      <div className="rounded-full bg-shu/10 p-3 text-shu"><AlertOctagon className="h-6 w-6" aria-hidden /></div>
      <h3 className="text-lg">No se pudo cargar</h3>
      <p className="max-w-sm text-sm text-muted">{msg}</p>
      {retry && <button className="btn-secondary" onClick={retry}><RefreshCw className="h-4 w-4" aria-hidden /> Reintentar</button>}
    </div>
  );
}
