import { Link } from 'react-router-dom';
import { Users, LayoutList, Grid3X3, Scale, GitBranch, Eye, Tv, Settings, Tablet, Download, Check, ArrowRight } from 'lucide-react';
import type { Tournament } from '@/lib/types';
import { useCategories, useRegistrations, useMats, useDivisions, useAgeGroups } from './shared';
import { useLiveMats } from '@/lib/queries';
import { MatBoard } from '@/components/MatBoard';

/**
 * Resumen = guía paso a paso del torneo. Cada paso enlaza a su pestaña, indica si está hecho
 * y el primero pendiente se destaca como "siguiente paso".
 */
export function SummaryTab({ t }: { t: Tournament }) {
  const cats = useCategories(t.id);
  const regs = useRegistrations(t.id);
  const mats = useMats(t.id);
  const divs = useDivisions(t.id);
  const ages = useAgeGroups(t.id);
  const live = useLiveMats(t.id);
  const loading = cats.isLoading || regs.isLoading || mats.isLoading || divs.isLoading || ages.isLoading;

  const C = cats.data ?? [], R = regs.data ?? [], M = mats.data ?? [];
  const unassigned = R.filter((r) => !r.categoryId).length;
  const pendingWeigh = R.filter((r) => r.weighInStatus === 'PENDING').length;
  const outOfWeight = R.filter((r) => r.weighInStatus === 'OVERWEIGHT' || r.weighInStatus === 'UNDERWEIGHT').length;
  const withBracket = C.filter((c) => c.status !== 'OPEN').length;
  const finished = C.filter((c) => c.status === 'FINISHED').length;
  const assignments = M.reduce((s, m) => s + (m.assignments?.length ?? 0), 0);
  const n = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`;

  const steps = [
    { to: 'configuracion', icon: Settings, label: 'Configurar', done: (divs.data?.length ?? 0) > 0 && (ages.data?.length ?? 0) > 0, hint: `${n(divs.data?.length ?? 0, 'división de peso', 'divisiones de peso')} · ${n(ages.data?.length ?? 0, 'grupo de edad', 'grupos de edad')}`, todo: 'Define las divisiones de peso y los grupos de edad.' },
    { to: 'categorias', icon: LayoutList, label: 'Crear categorías', done: C.length > 0, hint: n(C.length, 'categoría', 'categorías'), todo: 'Genera las categorías (peso × edad × cinturón × género) o créalas a mano.' },
    { to: 'inscripciones', icon: Users, label: 'Inscribir atletas', done: R.length > 0 && unassigned === 0, hint: R.length ? `${n(R.length, 'inscrito', 'inscritos')}${unassigned ? ` · ${unassigned} sin categoría` : ' · todos con categoría'}` : 'Sin inscritos', todo: unassigned ? 'Asigna categoría a los atletas que no la tienen.' : 'Inscribe atletas uno a uno o importa un Excel.' },
    { to: 'pesaje', icon: Scale, label: 'Pesar', done: R.length > 0 && pendingWeigh === 0, hint: `${n(pendingWeigh, 'pendiente', 'pendientes')} · ${outOfWeight} fuera de peso`, todo: 'Registra el peso de cada atleta; si no da el peso, recolócalo en otra categoría.' },
    { to: 'llaves', icon: GitBranch, label: 'Generar llaves', done: C.length > 0 && withBracket === C.length, hint: `${withBracket} de ${C.length} con llave`, todo: 'Genera la llave de cada categoría cuando cierre su pesaje.' },
    { to: 'tatamis', icon: Grid3X3, label: 'Tatamis y mesas', done: M.length > 0 && assignments > 0, hint: `${n(M.length, 'tatami', 'tatamis')} · ${n(assignments, 'mesa asignada', 'mesas asignadas')}`, todo: 'Crea los tatamis, reparte las categorías y asigna un usuario de mesa a cada uno.' },
    { to: '/mesa', icon: Tablet, label: 'Registrar resultados', done: C.length > 0 && finished === C.length, hint: `${finished} de ${C.length} categorías finalizadas`, todo: 'La mesa de control registra el ganador de cada combate. También puedes hacerlo desde Llaves.' },
    { to: 'exportar', icon: Download, label: 'Exportar', done: false, hint: 'PDF y Excel en cualquier momento', todo: 'Descarga llaves, horarios, resultados y el Excel completo.' },
  ];
  const href = (to: string) => (to.startsWith('/') ? to : `/admin/torneos/${t.id}/${to}`);
  const next = steps.find((s) => !s.done && s.to !== 'exportar');

  return (
    <div className="space-y-8">
      {!loading && next && (
        <div className="card obi flex flex-col gap-3 p-4 pl-5 sm:flex-row sm:items-center" role="status">
          <div className="min-w-0 flex-1">
            <p className="label text-shu">Siguiente paso</p>
            <p className="font-semibold">{next.label}</p>
            <p className="text-sm text-muted">{next.todo}</p>
          </div>
          <Link to={href(next.to)} className="btn-primary shrink-0">Ir a {next.label.toLowerCase()} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
        </div>
      )}
      <section aria-labelledby="pasos-h">
        <h2 id="pasos-h" className="mb-3 text-lg">Pasos del torneo</h2>
        <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.to}>
              <Link to={href(s.to)} className={`card flex h-full gap-3 p-4 transition-shadow hover:shadow-lift ${next?.to === s.to ? 'ring-2 ring-shu/50' : ''}`}>
                <span className={`num grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${s.done ? 'bg-tatami text-on-accent' : 'bg-elevated text-ink'}`} aria-hidden>{s.done ? <Check className="h-4 w-4" /> : i + 1}</span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-semibold"><s.icon className="h-4 w-4 text-muted" aria-hidden />{s.label}</span>
                  <span className="sr-only">{s.done ? 'Hecho.' : 'Pendiente.'}</span>
                  <span className="mt-1 block text-xs text-muted">{loading ? '…' : s.hint}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
      <div className="flex flex-wrap gap-2"><Link to={`/t/${t.id}`} className="btn-secondary"><Eye className="h-4 w-4" aria-hidden />Ver como público</Link><Link to={`/t/${t.id}/tv`} className="btn-secondary"><Tv className="h-4 w-4" aria-hidden />Modo TV</Link></div>
      {t.description && <p className="max-w-2xl text-sm text-muted">{t.description}</p>}
      <section><h2 className="mb-3 text-lg">Tatamis en vivo</h2>{live.data?.length ? <MatBoard mats={live.data} /> : <p className="text-sm text-muted">Sin tatamis configurados.</p>}</section>
    </div>
  );
}
