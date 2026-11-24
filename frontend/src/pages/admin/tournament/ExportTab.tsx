import { useState } from 'react';
import { FileText, FileSpreadsheet, Download } from 'lucide-react';
import { downloadFile } from '@/lib/api';
import type { Tournament } from '@/lib/types';
import { useToast } from '@/lib/toast';
import { useCategories } from './shared';

export function ExportTab({ t }: { t: Tournament }) {
  const toast = useToast();
  const cats = useCategories(t.id);
  const [busy, setBusy] = useState<string | null>(null);
  const [cid, setCid] = useState('');
  const dl = async (key: string, path: string) => {
    setBusy(key);
    try { await downloadFile(path); toast.success('Descarga iniciada'); } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };
  const items = [
    { key: 'participants', icon: FileText, title: 'Participantes por categoría', desc: 'PDF con la lista de inscritos, academia, cinturón y pesaje.', path: `/export/tournaments/${t.id}/participants.pdf` },
    { key: 'schedule', icon: FileText, title: 'Horarios por tatami', desc: 'PDF con la programación de categorías en cada área.', path: `/export/tournaments/${t.id}/schedule.pdf` },
    { key: 'results', icon: FileText, title: 'Resultados y medallero', desc: 'PDF con medallero por academia y podios.', path: `/export/tournaments/${t.id}/results.pdf` },
    { key: 'xlsx', icon: FileSpreadsheet, title: 'Libro Excel completo', desc: 'Participantes, categorías, resultados, medallero y podios.', path: `/export/tournaments/${t.id}/export.xlsx` },
  ];
  return (
    <div className="space-y-6">
      <ul className="grid gap-3 md:grid-cols-2">
        {items.map((it) => (
          <li key={it.key} className="card flex items-start gap-4 p-4">
            <span className="rounded-lg bg-elevated p-2.5 text-shu"><it.icon className="h-5 w-5" aria-hidden /></span>
            <div className="min-w-0 flex-1"><h2 className="text-base">{it.title}</h2><p className="text-sm text-muted">{it.desc}</p></div>
            <button className="btn-secondary" disabled={busy === it.key} onClick={() => dl(it.key, it.path)} aria-label={`Descargar ${it.title}`}><Download className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">{busy === it.key ? 'Generando…' : 'Descargar'}</span></button>
          </li>
        ))}
      </ul>
      <section className="card p-4">
        <h2 className="text-base">Llave de una categoría (PDF)</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="flex-1"><span className="sr-only">Categoría</span><select className="input" value={cid} onChange={(e) => setCid(e.target.value)}><option value="">Selecciona una categoría…</option>{cats.data?.filter((c) => c._count.matches > 0).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <button className="btn-secondary" disabled={!cid || busy === 'bracket'} onClick={() => dl('bracket', `/export/categories/${cid}/bracket.pdf`)}><Download className="h-4 w-4" aria-hidden />Descargar llave</button>
        </div>
      </section>
    </div>
  );
}
